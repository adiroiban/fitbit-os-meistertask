/*
This is the middle-man between the device and the Internet API.

It will start even when app on the device is not running to update the
state - get update tasks, send tasks updated while phone was not connected.
*/
import { settingsStorage } from 'settings'
import { peerSocket } from "messaging"
import { me } from 'companion'
import { encode } from 'cbor'
import { inbox, outbox } from 'file-transfer'

import {
    OAUTH_CLIENT_ID,
    OAUTH_CLIENT_SECRET,
    OAUTH_TOKEN_URL,
    OAUTH_REDIRECT_URL
    } from "../common/constant"
import { handleCommands, log, sendCommand } from '../common/util'

// The messages sent by the companion have short key names to reduce the size.
// Limit at 1024 bytes per message.
const COMMANDS = {
    'request_tasks': {
        'short': 'rt',
        'handler': getRemoteTasks,
    },
}
// Check for updates every 60.
const DEFAULT_WAKE_INTERVAL = 60


//
// ----------- Device communication -------------
//

// Message is received from the device.
peerSocket.onmessage = event => {
    log(`Companion received: ${JSON.stringify(event)} ${JSON.stringify(event.data)}`);
    handleCommands(event, COMMANDS)
};

// Ready to communicate with the companion.
peerSocket.onopen = () => {
    log("Companion Socket Open")

};

// Communication with the companion was closed.
peerSocket.onclose = () => {
    log("Companion Socket Closed")
};

// Failed to send a message.
peerSocket.onerror = (error) => {
  log("Companion socket error: " + error.code + " - " + error.message);
}

// Send data to the device using Messaging API
function send(name, payload) {
    log(`Sent: ${JSON.stringify(name)} ${JSON.stringify(payload)}`)
    sendCommand(
        peerSocket,
        COMMANDS,
        name,
        payload,
        )
}

//
// --------- File-Transfer communication
//

// Process the inbox queue for files, and read their contents as text
async function processAllFiles() {
  let file
  while ((file = await inbox.pop())) {
    let name = file.name
    log(`Received new file ${name}`)
    if (name == 'device_state') {
        let data = await file.cbor()
        onDeviceState(data)
    }
  }
}

// Process new files as they are received
inbox.addEventListener('newfile', processAllFiles);




//
// ---------- Settings handling --------------------
//

if (!settingsStorage.getItem('wake_interval')) {
    settingsStorage.setItem('wake_interval', DEFAULT_WAKE_INTERVAL)
}


// Called when setting was changed.
settingsStorage.onchange = function(event) {
    log(`Settings change: ${JSON.stringify(event)}`)
    if (event.key === 'authorization_code') {
        getToken().then((result) => validateProject())
    }

    if (event.key === 'project_name') {
        // We got a new project name.
        validateProject()
    }

    if (event.key === 'wake_interval') {
        setWakeInterval()
    }
 }


// ----------- Application logic -----------

/*
Return the text serial in URL encode format.
*/
function urlencode(object) {
    let parts = [];
    for (let prop in object) {
        let key = encodeURIComponent(prop);
        let value = encodeURIComponent(object[prop]);
        parts.push(key + '=' + value);
    }
    return parts.join("&")
}


/*
Check that configured project name is valid.

It will get all active projects and see if we can find it.
It will also store the ID of the project.
*/
function validateProject() {

    if (!settingsStorage.getItem('access_token')) {
        // No token yet.
        // Most probably project was set before doing the Login.
        log('Skip validation as there is no token yet.')
        return
    }

    let project_name = settingsStorage.getItem('project_name')
    if (!project_name) {
        log('Skip validation as there is no project yet.')
        return
    }

    project_name = project_name.toLowerCase()
    apiGET('/projects')
        .then(function(result){
            log(`Validating ${JSON.stringify(result)}`)
            settingsStorage.setItem('project_id', 0)

            result.forEach((project) => {
                if (project.name.toLowerCase() != project_name) {
                    return
                }
                log(`Got new project ${project.name} ${project.id}`)
                settingsStorage.setItem('project_id', project.id)
                // Now that we have a new project, trigger the tasks update.
                getRemoteTasks()
            })

            if (settingsStorage.getItem('project_id') == 0) {
                settingsStorage.setItem('project_name', project_name + ' NOT FOUND')
            }

        })
        .catch((err) => log('Fail to validate project.\n'+ err))
}


/*
Called when requested to get the latest tasks from the server.

We first send the project details in one message, and then the tasks in
another message.

It returns the list of remote tasks... but it also sends the sections and
their remote tasks.
*/
async function getRemoteTasks() {
    const project_id = settingsStorage.getItem('project_id')

    try {
        let result = await apiGET(`/projects/${project_id}/sections`)
        log(`Got sections ${JSON.stringify(result)}`)
        let sections = []
        // The first element is the project data.
        sections.push({
            'id': project_id,
            'remote_update': new Date().getTime(),
        })
        result.forEach((section) => {
            // See app code for section fields.
            sections.push({
                'id': section.id,
                'name': section.name,
                'order': Math.floor(section.sequence),
                'color': '#' + section.color
            })
        })
        outbox.enqueue('remote_sections', encode(sections))
    } catch(error) {
        log('Fail to get sections.\n'+ error)
        // Don't continue with the tasks.
        return
    }

    let tasks = []
    try {
        let result = await apiGET(`/projects/${project_id}/tasks`)
        log(`Got tasks ${JSON.stringify(result)}`)
        // The task can have a log of extra fields
        result.forEach((task) => {
            // See app code for task fields.
            if (task.status > 2) {
                // We don't show delete or archived items.
                return
            }
            tasks.push({
                'id': task.id,
                'name': task.name,
                'section': task.section_id,
                'done': task.status == 1 ? false : true,
                'remote_update': new Date(task.status_updated_at).getTime(),
                'order': Math.floor(task.sequence),
            })
        })
        outbox.enqueue('remote_tasks', encode(tasks))
    } catch(error) {
        log('Fail to get tasks.\n'+ error)
    }
    return tasks
}


/*
Called when requested to update tasks based on changed from the device.
*/
async function onDeviceState(device_state) {
    log(`Got device update ${JSON.stringify(device_state.tasks)}`)
    // FIXME
    // Compare with remote tasks to avoid overwritng.

    let remote_tasks
    try {
        remote_tasks = await getRemoteTasks()
    } catch(error) {
        log('Fail to get remote tasks for update.\n'+ error)
        return
    }

    log(`Remote tasks ${JSON.stringify(remote_tasks)}`)

    device_state.tasks.forEach(function(device_task) {
        if (!device_task.device_update) {
            // Local task not updated.
            return
        }

        // See if we have a corresponding remote task.
        let remote_task
        remote_tasks.forEach((task) => {
            if (task.id == device_task.id) {
                remote_task = task
            }
        })

        if (!remote_task) {
            // Task no longer on remote server.
            // Maybe it was removed... so no need to sync
            return
        }

        if (remote_task.remote_update > device_task.device_update) {
            // Task was more recently updated on remote server
            // So ignore.
            log(`Ignore update as remote is newer. ${JSON.stringify(device_task)}`)
            return
        }

        let status = device_task.done ? 2 : 1
        log(`Send update for ${JSON.stringify(device_task)}`)

        apiPUT('/tasks/' + device_task.id, {'status': status})
            .then(result => log(`Update sent ${JSON.stringify(result)}`))
    })

}

/*
Make a GET request against the API.

Return a promise for JSON format of the response.

Raise an error when GET is not 200.
*/
function apiGET(path) {
    const request = {
        'method': 'GET',
        'headers': {
            'Authorization': 'Bearer ' + settingsStorage.getItem('access_token'),
            'Accept': 'application/json'
        }
    }
    const url = 'https://www.meistertask.com/api' + path

    return _fetchJSON(url, request)
}


/*
Make a PUT request against the API.

Return a promise for JSON format of the response.

Raise an error when GET is not 200.
*/
function apiPUT(path, body) {
    const request = {
        'method': 'PUT',
        'headers': {
            'Authorization': 'Bearer ' + settingsStorage.getItem('access_token'),
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
        },
        'body': urlencode(body),
    }
    const url = 'https://www.meistertask.com/api' + path

    return _fetchJSON(url, request)
}


/*
Low level method to fetch the API and return JSON
*/
function _fetchJSON(url, request, no_retry) {
    let method = request.method

    return fetch(url, request).
        then((response) => {
            if (response.ok) {
                return response.json()
            }

            if (response.status == 401) {
                if (!no_retry) {
                    return getToken().then(() => {
                        let no_retry = true
                        return _fetchJSON(url, request, no_retry)
                    })
                }
            }
            // Throw an error with reponse body.
            return response.text().then((body) => {
                throw new Error(
                    `${method} Request: ${url} ${JSON.stringify(request)}\n` +
                    `Response: ${JSON.stringify(response.status)} ${JSON.stringify(response.statusText)}\n` +
                    `${body}`
                    )
            })
        })
}


// Helper to get an OAuth token as the settings page is not able to do CORS.
async function getToken() {
    // https://mindmeister.readme.io/docs/
    //      oauth-2#section-4-exchange-code-for-access-token
    let authorization_code = settingsStorage.getItem('authorization_code')

    if (!authorization_code) {
        throw new Error('OAUTH not done yet.')
    }

    const token_request = {
        'method': 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: urlencode({
            'client_id': OAUTH_CLIENT_ID,
            'client_secret': OAUTH_CLIENT_SECRET,
            'code': authorization_code,
            'redirect_uri': OAUTH_REDIRECT_URL,
            'grant_type': 'authorization_code'
        })
    }

    // We only want to try getting the token once.
    let no_retry = true
    return await _fetchJSON(OAUTH_TOKEN_URL, token_request, no_retry)
        .then((result) => {
            // Store the new token.
            // Token type should always be `Bearer` so we don't store that.
            // So far, token don't expire.
            log(`Got token ${JSON.stringify(result)}`)
            settingsStorage.setItem('access_token', result.access_token)
            return result
        })
        .catch(function(error){
            settingsStorage.setItem('access_token', '')
            throw error
        })
}



//
// ---------- Lifecycle handling -----------
//


function setWakeInterval() {
    me.wakeInterval = settingsStorage.getItem('wake_interval') * 1000 * 60
}

log(`Launch reason ${JSON.stringify(me.launchReasons)}`)
setWakeInterval()

//
// peerAppLaunched
// wokenUp
// settingsChanged
// locationChanged
// fileTransfer
// externalAppMessage
// companionTriggerAction
//

if (me.launchReasons.fileTransfer) {
    processAllFiles()
} else {
    getRemoteTasks()
    // me.yield()
}
