/*
Code shared by app and companion.
*/
import { DEBUG } from "../common/constant"

export function log(text) {
    if (!DEBUG) {
        return
    }
    console.log(text)
}

/*
Handle a received command, based on COMMANDS definition.
*/
export function handleCommands(event, COMMANDS) {
    const data = event.data
    const name = data.c
    let handler

    if (!data) {
        log(`Unknown command: ${JSON.stringify(event)}`)
        return
    }

    if (!name) {
        log(`Not a command: ${JSON.stringify(event.data)}`)
        return
    }

    for (var key in COMMANDS) {
        if (!COMMANDS.hasOwnProperty(key)) {
          continue
        }
        let command = COMMANDS[key]
        if (command.short != name) {
            // Not the targeted command.
            continue
        }
        handler = command.handler
    }


    if (!handler) {
        log(`Unhandled command: ${JSON.stringify(event)}`)
        return
    }

    // Call the command with the optional payload.
    handler(data.p)
}

/*
Send a command to the remote `peerSocket` based on `COMMANDS`.
*/
export function sendCommand(peerSocket, COMMANDS, name, payload) {
    const short_name = COMMANDS[name].short
    let data = {
        'c': short_name,
        }
    if (payload) {
        data['p'] = payload
    }

    if (peerSocket.readyState === peerSocket.OPEN) {
        peerSocket.send(data)
        return true
    }
    return false
}
