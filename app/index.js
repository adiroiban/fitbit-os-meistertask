/*
Device side code for Fitbit OS Todoist app.

Due to memory limitation the device side uses a different data structure than
the remote API.
*/
import { me } from "appbit";
import document from "document";
import { peerSocket } from "messaging";
import * as filesystem from "fs";
import clock from 'clock'
import { battery } from 'power'
import { inbox, outbox } from 'file-transfer'

import { handleCommands, log, sendCommand } from '../common/util'

// Look at the widget implementation for debugging.
// let target_path = "/mnt/sysassets/widgets/checkbox_tile_widget.gui"
// let stats = filesystem.statSync(target_path);
// let target_data = filesystem.readFileSync(target_path, "utf-8");
// let cursor = 0
// while (cursor < stats.size) {
//     console.log(target_data.substring(cursor, cursor + 200))
//     cursor = cursor + 200
// }

/*
Commands used for live communication with the companion.

Most of the communication is done via the file-transfer API.

These command are mostly for signaling.
*/
const COMMANDS = {
    'request_remote_state': {  // This is not used... here as documentation.
        'short': 'rrs',
    },
}

// Where app data is stored.
const PERSISTANCE_PATH = 'persistance.cbor'

// Data which is persisted.
// We initialize it here, and later is loaded.

// Future format with multi-project support.
let persistance = {
    'tasks': {
        0: {
            'name': 'NO TASK YET',
            'section': 0,
            'remote_update': 0,  // Date when changes done on the remote API.
            'device_update': 0,  // Date when changes done on the device.
            'done': 1,
            'order': 0,  // The order in the task list.
        },
    },
    'sections': {
        0: {
            'id': 0,
            'name': 'NO SECTION YET',
            'order': 0,
            'color': 'fb-red',
        },
    },
    'projects': {
        0: {
            'name': 'NO PROJECT YET',
            'remote_update': 0,
        },
    },
    'active_project': 0,
    'active_section': 0,
}

persistance = {
    'tasks': [{
        'id': 0,
        'name': 'NO TASK YET',
        'section': 0,
        'remote_update': 0,  // Date when changes where done on the remote API.
        'device_update': 0,  // Date when changes where done on the device.
        'done': 1,
        'order': 0,  // The order in the task list.
    }],
    'sections': [{
        'id': 0,
        'name': 'NO SECTION YET',
        'order': 0,
        'color': 'fb-red',
    }],
    'active_project': {
        'id': 0,
        'remote_update': 0,
    },
    'active_section': 'TO-BE-SET-NEXT',
}
persistance.active_section = persistance.sections[0]


//
// ----------- Companion messaging -------------
//
// This is more like signaling, as the command might not be received and
// companion is many time offline.
//
// Messages should be less than 1024 bytes.

// Message is received from the companion
peerSocket.onmessage = event => {
  log(`App received: ${JSON.stringify(event)}`);
  handleCommands(event, COMMANDS)

};

let connected = false
// Ready to communicate with the companion.
peerSocket.onopen = () => {
    log("App Socket Open")
    connected = true
    connection_ui.style.display = 'none'
};

// Communication with the companion was closed.
peerSocket.onclose = () => {
    log("App Socket Closed")
    connected = false
    connection_ui.style.display = 'inline'
};

// Failed to send a message to the companion.
peerSocket.onerror = (error) => {
    connected = false
    log("App socket error: " + error.code + " - " + error.message)
}

function send(name, payload) {
    log(`App send: ${JSON.stringify(name)} ${JSON.stringify(payload)}`)
    let result = sendCommand(
        peerSocket,
        COMMANDS,
        name,
        payload,
        )
}


//
// ------ File-Transfer API
//
// This is the main data communication.
//

function processAllFiles() {
    let name
    while (name = inbox.nextFile()) {
        let path = '/private/data/' + name
        let data  = filesystem.readFileSync(path, 'cbor')
        if (name == 'remote_state') {
            onRemoteState(data)
            return
        }
        console.log(`Unknown file received: /private/data/$‌{fileName}`);
    }
}
inbox.addEventListener('newfile', processAllFiles)

//
// ------------- UI handling -------------
//


// Where time is displayed.
let time_ui = document.getElementById("time")
// Battery level indicator.
let battery_overlay = document.getElementById('battery-overlay')
let header_ui = document.getElementById('task-header')
let header_animation = document.getElementById('header-animation')
let connection_ui = document.getElementById('connection-closed')

// Title of the screen.
let title = 'Initializing...'
let header_color = 'green'
let title_ui = document.getElementById('top-title')

let gesture_ui = document.getElementById('my-pool[3]')

// Widget showing the tasks.
let task_list = document.getElementById('task-list')
// List of task currently in the widget.
let view_tasks = []

/*
Things to update at every minute.

This is not called when display is off.
*/
clock.granularity = 'minutes'
clock.ontick = (event) => {
    // Update time.
    let now = event.date
    let hours = now.getHours();
    let minutes = now.getMinutes();
    minutes = minutes > 9 ? minutes : '0' + minutes
    hours = hours > 9 ? hours : '0' + hours
    time_ui.text =  hours + ":" + minutes;

    // Update battery level.
    // We have a white battery as the background and over it, show
    // a black bar, or all red.
    let charge_level = battery.chargeLevel
    if (charge_level > 10) {
        battery_overlay.style.fill = "black";
        let width = Math.round((100 - charge_level) * 0.24);
        battery_overlay.width = width;
        battery_overlay.x = 26 - width;
    } else {
        // Battery is low.
        // We might just hide the battery as Fitbit OS forces the
        // low battery Icon.
        battery_overlay.style.fill = 'red';
        battery_overlay.width = 22
        battery_overlay.x = 4
    }

}


document.onkeypress = function(event) {
    log(`Key pressed: ${JSON.stringify(event)}`)

    if (event.key == 'down') {
        _onKeyDownRaw(event)
    }

    if (event.key == 'up') {
        _onKeyUpRaw(event)
    }

    if (event.key == 'back') {
        _onKeyBackRaw(event)
    }

}


/*
Called when back button is pressed.
*/
let _scheduled_exit
function _onKeyBackRaw(event) {
    event.preventDefault()

    let _onSingle = () => {
        _scheduled_exit = null
        onKeyBack()
    }

    if (_scheduled_exit) {
        clearTimeout(_scheduled_exit)
        _scheduled_exit = null
        // We got double back.
        onKeyBackDouble()
    } else {
        _scheduled_exit = setTimeout(_onSingle, 400)
    }
}

function _onKeyUpRaw(event) {

    let _onSingle = () => {
        _scheduled_exit = null
        onKeyUp()
    }

    if (_scheduled_exit) {
        clearTimeout(_scheduled_exit)
        _scheduled_exit = null
        // We got double back.
        onKeyUpDouble()
    } else {
        _scheduled_exit = setTimeout(_onSingle, 400)
    }
}

function _onKeyDownRaw(event) {

    let _onSingle = () => {
        _scheduled_exit = null
        onKeyDown()
    }

    if (_scheduled_exit) {
        clearTimeout(_scheduled_exit)
        _scheduled_exit = null
        // We got double back.
        onKeyDownDouble()
    } else {
        _scheduled_exit = setTimeout(_onSingle, 400)
    }
}


task_list.delegate = {
  getTileInfo: function(index) {
    return {
      'type': 'my-pool',
      'index': index
    }
  },
  configureTile: function(tile, info) {
    let data = view_tasks[info.index]

    let title = tile.getElementById('text')
    let check_unselected = tile.getElementById('check-unselected')
    let check_selected = tile.getElementById('check-selected')

    if (!data) {
        // We are at the footer.
        title.text = ''
        check_selected.style.display = 'none'
        check_unselected.style.display = 'none'
        return
    }

    title.text = data.name

    let setCheckUI = () => {
        if (data.done) {
            check_unselected.style.display = 'none'
            check_selected.style.display = 'inline'
        } else {
            check_unselected.style.display = 'inline'
            check_selected.style.display = 'none'
        }
    }

    // Do an initial update.
    setCheckUI()


    tile.onmousedown = onMouseDown

    tile.onmouseup = event => {

        let duration = new Date().getTime() - last_mouse_down.timestamp
        log(`Mouse up on button (${duration}) ${JSON.stringify(event)}`)

        if ((event.screenX == last_mouse_down.screenX) &&
            (event.screenY == last_mouse_down.screenY) &&
            (duration > 400)
                ) {
            return onLongPress(info.index)
        }

        // We have slide down reload gesture.
        if ((info.index == 0) && (event.screenY > 140)) {
            return onSwipeDown()
        }

    }

    tile.onclick = event => {
        log(`Click on item ${JSON.stringify(data)}`)

        if (data.done) {
            data.done = false
        } else {
            data.done = true
        }
        data.device_update = new Date().getTime()
        setCheckUI()
        setTimeout(onTasksUpdate, 500)
    }

  }
}


/*
Called when mouse was pressed on an element.
*/
let last_mouse_down = null
function onMouseDown(event) {
    log(`Mouse down ${JSON.stringify(event)}`)
    event.timestamp = new Date().getTime()
    last_mouse_down = event
}

/*
Return `true` if a gesture was recognized.
*/
function onMouseUp(event, index) {
    log(`Mouse up ${JSON.stringify(event)}`)

    // We have a swipe right gesture.
    if ((event.screenX - last_mouse_down.screenX > 200) &&
            (Math.abs(event.screenY - last_mouse_down.screenY) < 100)) {
        onSwipeRight(index)
        return true
    }

    // We have a swipe left gesture.
    if ((last_mouse_down.screeny - event.screenX > 200) &&
            (Math.abs(event.screenY - last_mouse_down.screenY) < 100)) {
        return onSwipeLeft(index)
        return true
    }
    return false
}

/*
Set the permanent title of the page.

This will be reverted after notification.
*/
function setTitle(text, background) {
    title = text
    header_color = background

    title_ui.text = text
    header_ui.style.fill = background

    header_animation.animate('enable')
}


function notificationShow(message, background) {
    let box_color

    if (!background) {
        box_color = 'fb-blue'
    } else {
        box_color = background
    }

    header_ui.style.fill = box_color

    title_ui.text = message

    header_animation.animate('enable')
}

function notificationHide() {
    setTitle(title, header_color)
}

/*
Show notification for `duration` with `message`.
*/
function notificationSplash(duration, message, background) {
    notificationShow(message, background)
    setTimeout(notificationHide, duration)

}

/*
Convert a HEX color to RGB value.
*/
function hexToRGB(hex) {
    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, function(m, r, g, b) {
        return r + r + g + g + b + b;
    });
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
        ]
}


/*
Return the HSP for HEX color.
*/
function getHSP(color) {
    let color = hexToRGB(color)
    // Variables for red, green, blue values
    let red = color[0]
    let green = color[1]
    let blue = color[2]

    // http://alienryderflex.com/hsp.html
    return Math.sqrt(
        0.299 * (red * red) +
        0.587 * (green * green) +
        0.114 * (blue * blue)
        )
}



//
// ------------------------- App logic ----------------\
//

/*
Called when the tasks were changed from external sources.
*/
function onTasksChange() {

    setTitle(
        persistance.active_section.name,
        persistance.active_section.color,
        )

    view_tasks = []
    persistance.tasks.forEach((task) => {
        if (task.section != persistance.active_section.id) {
            return
        }
        view_tasks.push(task)
    })

    view_tasks.sort((a, b) => {
        if (a.done > b.done) return 1
        if (a.done < b.done) return -1

        if (a.order > b.order) return 1
        if (a.order < b.order) return -1
        return 0
    })

    // The virtual tile view is moved down to not overlap with the header
    // so in order to compensate bottom scroll we add a footer
    task_list.length = view_tasks.length + 1;
    persistanceSave()
}

/*
Called when tasks were updated by the device.
*/
let scheduled_task_update
function onTasksUpdate() {
    onTasksChange()
    if (scheduled_task_update) {
        clearTimeout(scheduled_task_update)
    }

    // Only send the changes to the device in 30 seconds.
    // The changes are sent anyway when the app exists.
    scheduled_task_update = setTimeout(sendTasksUpdate, 30000)
}

/*
Called when we got the remote state .
*/
function onRemoteState(remote_state) {
    console.log('Got remote')

    let project = remote_state.project
    let remote_sections = remote_state.sections
    let remote_tasks = remote_state.tasks
    let updated_tasks = []

    remote_sections.sort((a, b) => a.order - b.order)

    if (project.id != persistance.active_project.id) {
        // We have a new project.
        persistance.active_section = remote_sections[0]
        persistance.tasks = []
    } else {
        // See if the current active section still exists.

        let active_id = persistance.active_section.id
        let section_found = false
        remote_sections.forEach((section) => {
            if (section.id == active_id) {
                section_found = true
            }
        })
        if (!section_found) {
            // When not found, start with the first section.
            persistance.active_section = result[0]
        }
    }


    // We only construct based on the remote tasks.
    // Any local task which is not on the remote api, will be ignored as
    // it might have been deleted.
    remote_tasks.forEach((remote_task) => {
        let peer_task
        persistance.tasks.forEach((local_task) => {
            if (local_task.id == remote_task.id) {
                peer_task = local_task
            }
        })

        // We start with using the remote task and assume it was not changed
        // locally.
        remote_task.device_update = 0
        if (peer_task && peer_task.device_update) {
            // Local task was touched.
            if (remote_task.remote_update < peer_task.device_update) {
                // Device/local task is newer.
                remote_task.done = peer_task.done
                // Keep the update of the local one.
                // It needs to be synced later.
                remote_task.device_update = peer_task.device_update
            }
        }

        updated_tasks.push(remote_task)
    })

    log(`Active: ${JSON.stringify(persistance.active_section)}`)

    persistance.active_project = project
    persistance.sections = remote_sections
    persistance.tasks = updated_tasks
    onTasksChange()
}

/*
Send the local list of tasks as it was changes.

We always send the full list of tasks, as if we send tasks one by miss.
*/
function sendTasksUpdate() {
    log('Sending device update')
    scheduled_task_update = null
    outbox.enqueueFile(PERSISTANCE_PATH, 'device_state')

}

/*
Called when back button is pressed once.
*/
function onKeyBack(event) {
    log('Key back')
    onExit()
}

/*
Called when back button is pressed twice.
*/
function onKeyBackDouble(event) {
    log('Key back double')
}


/*
Called when app should end.

This is reentrant as it is also called from unload.
*/
let _exiting = false
function onExit() {
    if (scheduled_task_update) {
        clearTimeout(scheduled_task_update)
    }
    if (_exiting) {
        return
    }
    _exiting = true
    sendTasksUpdate()
    me.exit()
}

/*
Called when up button is pressed.
*/
function onKeyUp() {
    log('Key up')
    triggerSync()
}

function onKeyUpDouble() {
    log('Key up double')
    let d = new Date(persistance.active_project.remote_update)
    let month = d.getMonth()
    let day = d.getDate()
    let hour = d.getHours()
    let minute = d.getMinutes()
    month = month < 10 ? '0' + month: month
    day = day < 10 ? '0' + day: day
    hour = hour < 10 ? '0' + hour: hour
    minute = minute < 10 ? '0' + minute: minute

    let last_update = `${d.getFullYear()}-${month}-${day} ${hour}:${minute}`
    notificationSplash(2000, last_update, 'fb-green')
}

/*
Called when down button is pressed.
*/
function onKeyDown() {
    log('Key down')
    goToNextSection()
}

function onKeyDownDouble() {
    log('Key down double')
    goToPreviousSection()
}

/*
Called when the finger was down for a long time.
*/
function onLongPress(index) {
    log('Long press')
}


/*
Called when we have a left swipe gesture (from right to left).
*/
function onSwipeLeft() {
    log('Swipe left')
    goToNextSection()
}

/*
Called when we have a right swipe gesture (from left to right).
*/
function onSwipeRight() {
    log('Swipe right')
    goToPreviousSection()
}

/*
Called when we have a down swipe gesture.
*/
function onSwipeDown() {
    log('Swipe down')
    triggerSync()
}


function triggerSync() {
    // We send our state...and this should trigger the companion to send
    // the remote state.
    sendTasksUpdate()

    if (!connected) {
        notificationSplash(2000, 'Not connected.', 'fb-red')
    } else {
        // When remote tasks are received, this should update the header.
        notificationShow('Refreshing...', 'fb-blue')
    }
}

/*
Go to the next section.
*/
function goToNextSection() {
    let index
    let active_id = persistance.active_section.id
    let sections = persistance.sections

    for (var i = 0; i < sections.length; i++) {
        if (sections[i].id == active_id) {
            index = i + 1
            break
        }
    }

    if (index > sections.length - 1) {
        // We have loop.
        index = 0
    }

    goToSection(index)
}

/*
Move to the previous section.
*/
function goToPreviousSection() {
    let index
    let active_id = persistance.active_section.id
    let sections = persistance.sections

    for (var i = 0; i < sections.length; i++) {
        if (sections[i].id == active_id) {
            index = i - 1
            break
        }
    }

    if (index < 0) {
        // We have loop.
        index = sections.length - 1
    }

    goToSection(index)
}


function goToSection(index) {
    persistance.active_section = persistance.sections[index]
    log(`New section ${JSON.stringify(persistance.active_section)} of ${JSON.stringify(persistance.sections)}`)
    setTitle(
        persistance.active_section.name,
        persistance.active_section.color,
        )
    onTasksChange()
}

//
// ---------- Lifecycle handling -----------
//

me.appTimeoutEnabled = false

me.onunload = () => {
  // We don't do nothing when app is closed as all data is save as soon as
  // is changed.
  onExit()
}

function persistanceLoad() {
    let stored
    try {
        stored = filesystem.readFileSync(PERSISTANCE_PATH, 'cbor')
    } catch(err) {
        // No persisted data. Just ignore and use the default value.
        stored = {}
    }

    persistance = {...persistance, ...stored}
}

function persistanceSave() {
  filesystem.writeFileSync(PERSISTANCE_PATH, persistance, 'cbor');
}


persistanceLoad()
processAllFiles()
// Trigger an initial task sorting.
// It must be called AFTER delegate.
onTasksChange()
