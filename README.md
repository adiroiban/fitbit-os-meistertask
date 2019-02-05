# fitbit-os-meistertask
Unofficial Fitbit OS app for MeisterTask

Not created by, affiliated with, or supported by MeisterTask.
Not created by, affiliated with, or supported by Fitbit.


## Functionality

For now, it will show tasks for a single project.
It will show each section of the project in a separate view.
Later it might be extended to show multiple projects... but I guess that
people will only want to have a few projects on the watch.

I am creating it to help with getting a shopping list... and be able to go
to the grocery without the phone... so without Internet.

It used the file-transfer API for communication, so it should work while
device is disconnected from the phone... and auto-sync on connection.

Before leaving to the store you can manually sync it, by pressing the UP
button.

After returning from shopping you should not need to manually resync...
but pressing UP button will trigger a sync.

The companion can run in the background and auto-sync...so manual sync should
only needed if you want fast sync.

Checked items are placed at the bottom to allow for easy undo.

For now, it only shows the list of tasks.

For now, tasks can't be reordered from the device.
They will observe the order as defined on the remote API.

You can't (yet) add tasks from the device.

Battery status is updated every minute together with the clock.
Battery status might be removed as is not critical... is there just as a
reminder that when battery is low, Fitbit OS will show something here.
So the app should not place anything critical there.

The companion is automatically started in the background when it will receive
a file, even if the app is not running on the device.
It will auto-sync but can only run for 15 seconds.

The companion can run in the background at configured time and will
get the remote state.
Make sure you have a fast connection, as it can only run in the background
for 15 seconds.


## UI/UX

Single press UP key to trigger a sync.
Double press UP key to show last sync date and time.

Single press Down key to go to next section.
Double press Down key to go to previous section.

Click on an item to mark as done(completed) or not-done(active).


Press the right-up button to refresh the list.

Drag the first item down to trigger a sync.
Tries to imitate the swipe down refresh.

A red X is show when device is not connected to the companion.


## Conflict resolution

It is possible for the same task to be updated independently on the device and
on the remote API.

It will use the state of the newer update.


## Development

This is not yet public.

You can create your own MeisterTask API key and add it to common/constant.js


## Screenshots

Main app page with tasks list for a section.

![main-app-screenshot](screenshots/device.png?raw=true "Main App")

Settings page.

![settings-screenshot](screenshots/settings.png?raw=true "Settings Page")


## TODO

* See OAuth token refresh API. Token don't have expire.

* Add tasks from the device - first add a keyboard

* View task description
  * Maybe long press on the task
  * Show only first 100 characters

* Add notes section
  * a section without checkbox
  * notes have title and description
  * Hardcoded to a section name "Notes"

* Archive/delete a task/notes - Maybe swipe in some direction


## Credits

* UI header inspired by https://github.com/abhijitvalluri/fitbit-todo-list
