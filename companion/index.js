/*


*/
import { settingsStorage } from 'settings'
import { peerSocket } from "messaging"
import { me } from 'companion'

import {
    OAUTH_CLIENT_ID,
    OAUTH_CLIENT_SECRET,
    OAUTH_TOKEN_URL,
    OAUTH_REDIRECT_URL
    } from "../common/constant"
import { handleCommands, log, sendCommand } from '../common/util'

//
// ---------- Lifecycle handling -----------
//
let pending_messages = []

// The messages sent by the companion have short key names to reduce the size.
// Limit at 1024 bytes per message.
// Each command will contain the project_id.
const COMMANDS = {
    'request_tasks': {
        'short': 'rt',
        'handler': onRequestTasks,
    },
    'update_tasks': {
        'short': 'ut',
        'handler': onUpdateTasks,
    },
    'got_tasks': {
        'short': 'gt',
    },
    'got_sections': {
        'short': 'gs',
    },
}

if (me.launchReasons.settingsChanged) {
  // Settings were changed while the companion was not running.
}


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
  log("Companion Socket Open");

};

// Communication with the companion was closed.
peerSocket.onclose = () => {
  log("Companion Socket Closed");
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
// ---------- Settings handling --------------------
//


// Called when setting was changed.
settingsStorage.onchange = function(event) {
    log(`Settings change: ${JSON.stringify(event)}`)
    if (event.key === 'exchange_code') {
        getToken(event.newValue)
            .then(function(result) {
                // Token type should always be `Bearer` so we don't store that.
                settingsStorage.setItem('access_token', result.access_token)
                // See if we have a valid project.
                validateProject()
            })
            .catch(function(err){
                settingsStorage.setItem('access_token', '')
                console.log('Err get token: '+ err);
            })
    }

    if (event.key === 'project_name') {
        // We got a new project name.
        validateProject()
    }
}

// Helper to get an OAuth token as the settings page is not able to do CORS.
async function getToken(authorization_code) {
    // https://mindmeister.readme.io/docs/
    //      oauth-2#section-4-exchange-code-for-access-token
    const token_request = {
        'method': 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: urlencode({
            'client_id': OAUTH_CLIENT_ID,
            'client_secret': OAUTH_CLIENT_SECRET,
            'code': authorization_code,
            'redirect_uri': OAUTH_REDIRECT_URL,
            'grant_type': 'authorization_code'
        })
    }

    return await fetch(OAUTH_TOKEN_URL, token_request)
        .then(function(data){
            return data.json();
        }).catch(function(err) {
            log('Err on token get '+ err);
        })
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
        return
    }

    apiGET('/projects')
        .then(function(result){
            const current = settingsStorage.getItem('project_name').toLowerCase()
            settingsStorage.setItem('project_id', 0)

            result.forEach((project) => {
                if (project.name.toLowerCase() != current) {
                    return
                }
                log(`Got new project ${project.name} ${project.id}`)
                settingsStorage.setItem('project_id', project.id)
                // Now that we have a new project, trigger the tasks update.
                onRequestTasks()
            })

            if (settingsStorage.getItem('project_id') == 0) {
                settingsStorage.setItem('project_name', current + ' NOT FOUND')
            }

        })
        .catch((err) => log('Fail to validate project.\n'+ err))
}


/*
Called when requested to get the latest tasks from the server.

We first send the project details in one message, and then the tasks in
another message.
*/
function onRequestTasks() {
    const project_id = settingsStorage.getItem('project_id')

    let path = `/projects/${project_id}/sections`
    apiGET(path)
        .then(function(result){
            let sections = []
            result.forEach((section) => {
                sections.push({
                    'i': section.id,
                    'n': section.name,
                    'o': section.sequence,
                    'c': '#' + section.color,
                })
            })
            send('got_sections', {'p': project_id, 's': sections})
        })
        .catch((err) => log('Fail to get tasks.\n'+ err))

    path = `/projects/${project_id}/tasks`
    apiGET(path)
        .then(function(result){
            let tasks = []
            result.forEach((task) => {
                if (task.status > 2) {
                    // We only send to the device the tasks which are active.
                    // open or completed.
                    // deleted or archived are not sent.
                    return
                }
                tasks.push({
                    'i': task.id,
                    'n': task.name,
                    's': task.status,
                    'o': task.sequence,
                    'c': task.section_id,
                    'u': task.status_updated_at,
                })
            })
            // With many task we might hit the 1K limit, so we might want
            // to send each task in a separate message.
            send('got_tasks', tasks)
        })
        .catch((err) => log('Fail to get tasks.\n'+ err))
}

/*
Called when requested to update tasks based on changed from the device.
*/
function onUpdateTasks(local_tasks) {

    // let remote_tasks = {}
    // const path = `/projects/${settingsStorage.getItem('project_id')}/tasks`
    // apiGET(path)
    //     .then(function(tasks){
    //         tasks.forEach((task) => {
    //             remote_tasks[task.id] = {
    //                 'status': task.status,
    //                 'update': task.status_updated_at,
    //             }
    //         })
    //     })
    //     .catch((err) => log('Fail to get remote tasks for update.\n'+ err))

    local_tasks.forEach((local) => {
        if (local.l == 0) {
            // Local task not updated.
            return
        }
        const path = '/tasks/' + local.i
        apiPUT(path, {'status': local.s})
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

    return fetch(url, request).
        then((response) => {
            if (response.ok) {
                return response.json()
            }
            throw new Error(
                `GET Request: ${url} ${JSON.stringify(request)}\n` +
                `Response: ${JSON.stringify(response.status)} ${JSON.stringify(response.statusText)}\n`
                )
        })
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

    return fetch(url, request).
        then((response) => {
            if (response.ok) {
                return response.json();
            }
            throw new Error(
                `PUT Request: ${url} ${JSON.stringify(request)}\n` +
                `Response: ${JSON.stringify(response.status)} ${JSON.stringify(response.statusText)}\n`
                )
        })
}
