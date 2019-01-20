/*
Device side code for Fitbit OS Todoist app.
*/
import { me } from "appbit";
import document from "document";
import { peerSocket } from "messaging";
import * as filesystem from "fs";
import clock from 'clock'
import { battery } from 'power'

import { handleCommands, log, sendCommand } from '../common/util'

// Look at the widget implementation for debugging.
// let target_path = "/mnt/sysassets/widgets/tile_list_widget.gui"
// let stats = filesystem.statSync(target_path);
// let target_data = filesystem.readFileSync(target_path, "utf-8");
// let cursor = 0
// while (cursor < stats.size) {
//     console.log(target_data.substring(cursor, cursor + 200))
//     cursor = cursor + 200
// }

//
// ---------- Lifecycle handling -----------
//
// We want to todo-list to run for longer.
const persitance_path = 'persistance.cbor'

const COMMANDS = {
    'request_tasks': {
        'short': 'rt',
    },
    'got_tasks': {
        'short': 'gt',
        'handler': onGotTasks,
    },
    'got_sections': {
        'short': 'gs',
        'handler': onGotSections,
    },
    'update_tasks': {
        'short': 'ut',
    },
}


// Data which is persisted.
// We initialize it here, and later is loaded.
let persistance = {
    'tasks': [{
        'id': 0,
        'section': 0,
        'name': 'NO TASK YET',
        'local_update': 0,  // Date when changes where done on the device.
        'remote_update': 0,  // Date when changed were done on the server.
        'done': 0,  // 0 when not done, 1 when completed.
        'order': 0,  // The order in the task list.
    }],
    'sections': [{
        'id': 0,
        'name': 'NO SECTION YET',
        'order': 0,
        'color': 'fb-red',
    }],
    'project_id': 0,
    'active_section': {
        'id': 0,
        'name': 'NO SECTION YET',
    },
}

persistanceLoad()

me.appTimeoutEnabled = false

me.onunload = () => {
  // We don't do nothing when app is closed as all data is save as soon as
  // is changed.
}

function persistanceLoad() {
    let stored
    try {
        stored = filesystem.readFileSync(persitance_path, 'cbor')
    } catch(err) {
        // No persisted data. Just ignore and use the default value.
        stored = {}
    }

    persistance = {...persistance, ...stored}
}

function persistanceSave() {
  filesystem.writeFileSync(persitance_path, persistance, 'cbor');
}


//
// ----------- Companion communication -------------
//

// Message is received from the companion
peerSocket.onmessage = event => {
  log(`App received: ${JSON.stringify(event)}`);
  handleCommands(event, COMMANDS)

};

// Ready to communicate with the companion.
peerSocket.onopen = () => {
    log("App Socket Open");
    connection_ui.style.display = 'none'
    onRequestTasks()
};

// Communication with the companion was closed.
peerSocket.onclose = () => {
  log("App Socket Closed");
    connection_ui.style.display = 'inline'
};

// Failed to send a message to the companion.
peerSocket.onerror = (error) => {
  log("App socket error: " + error.code + " - " + error.message);
}

function send(name, payload) {
    log(`App send: ${JSON.stringify(name)} ${JSON.stringify(payload)}`)

    sendCommand(
        peerSocket,
        COMMANDS,
        name,
        payload,
        )
}

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


let last_mouse_down = null

document.onkeypress = function(event) {
    console.log("Key pressed: " + event.key)

    if (event.key == 'down') {
        onKeyDown()
    }

    if (event.key == 'up') {
        onKeyUp()
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
    let title = tile.getElementById('text')
    let button = tile.firstChild
    let data = view_tasks[info.index]

    title.text = data.name
    button.value = data.done

    button.onmousedown = event => {
        log(`Mouse down ${JSON.stringify(event)}`)
        last_mouse_down = event
    }

    button.onmouseup = event => {
        log(`Mouse up ${JSON.stringify(event)}`)

        if ((event.screenX == last_mouse_down.screenX) &&
                (event.screenY == last_mouse_down.screenY)) {
            return onLongPress(info.index)
        }

        // We have a swipe right gesture.
        if ((event.screenX - last_mouse_down.screenX > 200) &&
                (Math.abs(event.screenY - last_mouse_down.screenY) < 100)) {
            return onSwipeRight(info.index)
        }

        // We have a swipe left gesture.
        if ((last_mouse_down.screenX - event.screenX > 200) &&
                (Math.abs(event.screenY - last_mouse_down.screenY) < 100)) {
            return onSwipeLeft(info.index)
        }

        // We have slide down reload gesture.
        if ((info.index == 0) && (event.screenY > 100)) {
            return onSwipeDown()
        }
    }

    button.onclick = event => {
        if (data.done) {
            data.done = 0
        } else {
            data.done = 1
        }
        data.local_update = new Date().toISOString()

        // Allow for a bit of delay, as otherwise the items will be
        // rearanged and click event sent to unwanted elements.
        // It need to be more than 0.5 to allow for the full checkbox animation.
        setTimeout(onTasksUpdate, 500)
    }
  }
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






// It must be called AFTER delegate.
// Trigger an initial task sorting.
onTasksChange()


//
// ------------------------- App logic ----------------\
//

/*
Called when the tasks were changed from external sources.
*/
function onTasksChange() {

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

    task_list.length = view_tasks.length;
    persistanceSave()
}

/*
Called when tasks were updated by the device.
*/
function onTasksUpdate() {
    onTasksChange()
    setTimeout(sendTasksUpdate, 500)
}

/*
Called when we got sections.

This just record that data and does not act on it.
got_tasks should follow .
*/
function onGotSections(result) {
    let project_id = result.p
    let sections = []

    result.s.forEach((section) => {
        sections.push({
            'id': section.i,
            'name': section.n,
            'order': section.o,
            'color': section.c,
        })
    })

    sections.sort((a, b) => a.order - b.order)

    if (project_id != persistance.project_id) {
        // We have a new project.
        persistance.active_section = sections[0]
        persistance.tasks = []
    } else {
        // See if the current active section still exists.
        let active_id = persistance.active_section.id
        let section_found = false
        sections.forEach((section) => {
            if (section.id == active_id) {
                section_found = true
            }
        })
        if (!section_found) {
            // When not found, start with the first section.
            persistance.active_section = sections[0]
        }
    }

    persistance.project_id = project_id
    persistance.sections = sections

    log(
        `Got sections: ${JSON.stringify(sections)}\n' +
        'Active:  ${JSON.stringify(persistance.active_section)}`
        )

}

/*
Called when we have received the tasks from the server.

Tasks are sent by the companion and have short keys.
*/
function onGotTasks(tasks) {
    let updated_tasks = []

    tasks.forEach((task) => {
        const done = task.s == 1 ? 0 : 1
        updated_tasks.push({
            'id': task.i,
            'section': task.c,
            'name': task.n,
            'done': done,
            'order': task.o,
            'remote_update': task.u,
            'local_update': 0,
        })
    })

    persistance.tasks = updated_tasks
    onTasksChange()
    setTitle(
        persistance.active_section.name,
        persistance.active_section.color,
        )


}

/*
Called when there is a request to update the tasks.
*/
function onRequestTasks() {
    notificationShow('Loading tasks...')
    send('request_tasks')
}

/*
Send the local list of tasks as it was changes.

We always send the full list of tasks, as if we send tasks one by miss.
*/
function sendTasksUpdate() {
    let updated_tasks = []

    persistance.tasks.forEach((task) => {
        const status = task.done ? 2: 1
        updated_tasks.push({
            'i': task.id,
            'n': task.name,
            's': status,
            'u': task.remote_update,
            'l': task.local_update,
        })
    })

    send('update_tasks', updated_tasks)
}

/*
Called when up button is pressed.
*/
function onKeyUp() {
    log('Key up')
    onRequestTasks()
}

/*
Called when down button is pressed.
*/
function onKeyDown() {
    log('Key down')
    goToNextSection()
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
}

/*
Called when we have a down swipe gesture.
*/
function onSwipeDown() {
    log('Swipe down')
    onRequestTasks()
}

/*
Go to the next section.
*/
function goToNextSection() {
    let active_id = persistance.active_section.id
    let sections = persistance.sections

    // Switch to next section.
    for (var i = 0; i < sections.length; i++) {
        if (sections[i].id == active_id) {
            let next = i + 1
            if (next == sections.length) {
                next = 0
            }
            persistance.active_section = sections[next]
        }
    }
    log(`New section ${JSON.stringify(persistance.active_section)} of ${JSON.stringify(persistance.sections)}`)
    setTitle(
        persistance.active_section.name,
        persistance.active_section.color,
        )
    onTasksChange()
}
