import document from "document";

// Look at the widget implementation for debugging.
// import * as fs from "fs";
// let target_path = "/mnt/sysassets/widgets/tile_list_widget.gui"
// let stats = fs.statSync(target_path);
// let target_data = fs.readFileSync(target_path, "utf-8");
// let cursor = 0
// while (cursor < stats.size) {
//     console.log(target_data.substring(cursor, cursor + 200))
//     cursor = cursor + 200
// }

let task_list = document.getElementById("task-list");

let tasks = [
    {'name': 'First thing', 'done': 0, 'order': 1},
    {'name': 'Second thing', 'done': 1, 'order': 2},
    {'name': 'Third thing', 'done': 0, 'order': 3},
    {'name': 'Forth thing', 'done': 0, 'order': 4},
    {'name': 'Fifth thing', 'done': 0, 'order': 5}
]

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
    let data = tasks[info.index]

    console.log('Configuring ' + data.name + ' to ' + data.done + ' from ' + button.value)
    title.text = data.name
    button.value = data.done

    // Try to emulate a slide down reload gesture.
    button.onmouseup = event => {
        if (info.index != 0) return
        if (event.screenY < 100) return
        console.log('Sync tasks')
    }

    button.onclick = event => {
        if (data.done) {
            data.done = 0
        } else {
            data.done = 1
        }

        // Allow for a bit of delay, as otherwise the items will be
        // rearanged and click event sent to unwanted elements.
        // It need to be more than 0.5 to allow for the checkbox animation.
        setTimeout(arrange_items, 700)
    }
  }
}


// It must be called AFTER delegate.
arrange_items()

// Sort the tasks as they should be listed in the UI.
function arrange_items() {
    tasks.sort((a, b) => {

        if (a.done > b.done) return 1
        if (a.done < b.done) return -1

        if (a.order > b.order) return 1
        if (a.order < b.order) return -1
        return 0
    })
    console.log(JSON.stringify(tasks))
    task_list.length = tasks.length;
}
