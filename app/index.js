import document from "document";

import * as fs from "fs";
let stats = fs.statSync("/mnt/sysassets/widgets/checkbox_tile_widget.gui");
if (stats) {
  console.log("File size: " + stats.size + " bytes");
  console.log("Last modified: " + stats.mtime);
}
let ascii_read = fs.readFileSync("/mnt/sysassets/widgets/checkbox_tile_widget.gui", "utf-8");
let cursor = 0

while (cursor < stats.size) {
    console.log(ascii_read.substring(cursor, cursor + 200))
    cursor = cursor + 200

}


let task_list = document.getElementById("task-list");

let tasks = [
    {'name': 'First thing', 'done': 0},
    {'name': 'Second thing', 'done': 1},
    {'name': 'Third thing', 'done': 0},
    {'name': 'Forth thing', 'done': 0},
    {'name': 'Fifth thing', 'done': 0}
]

task_list.delegate = {
  getTileInfo: function(index) {
    return {
      type: "my-pool",
      value: "Menu item",
      index: index
    };
  },
  configureTile: function(tile, info) {
    if (info.type == "my-pool") {
        let title = tile.getElementById('text')
        let button = tile.getElementById('checkbox-tile')

        title.text = tasks[info.index].name
        button.value = tasks[info.index].done

        button.onclick = event => {
            let name = tasks[info.index].name
            console.log('touched ' + name)
        };
    }
  }
};

// length must be set AFTER delegate
task_list.length = 5;
