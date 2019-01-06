# fitbit-os-meistertask
Unofficial Fitbit OS app for MeisterTask

Not created by, affiliated with, or supported by MeisterTask.
Not created by, affiliated with, or supported by Fitbit.

## Functionality

For now, it will show tasks for a single project.
It will show each section of the project in a separate view.
Later it might be extended to show multiple projects.

I am creating it to help with getting a shopping list... and be able to go
to the grocery without the phone... so without Internet.

Before leaving to the store you will need to manually sync it.
After returning from shopping you will also manually sync it.

Manual sync is done from the device.

It should be enough to just start the app on the watch, and the sync will
start.

There can also be the option to sync from the Phone Setting page...but I
feel that this requires more steps.

I don't think that the app can run on the device in the background so there
is no way to auto-sync it.

Checked items are placed at the bottom to allow for easy undo.

For now, it only shows the list of tasks.
In the future it might also always show the clock and steps in small status
bar, but the screen is tiny... but maybe if you press a button it can show the
clock and act as a watch face and if you press it again it will go back to
the task list.

For now, tasks can't be reordered from the device.
They will observe the order as defined on the remote API.

You can't add tasks from the device.


## UI/UX

Click on an item to mark as done(completed) or not-done(active).

Completed items go to the bottom, for easy undo.

Press the right-down button to go to the next section.

Swipe an item from left to right on any item to move to the next section.
It will not work if you don't have an item, as the action is only associated
with list items.

Press the right-up button to refresh the list.

Drag the first item down to refresh the list. Tries to imitate the Android
drag refresh.


## Conflict resolution

It is possible for the same task to be updated independently on the device and
on the remote API.

A conflict is triggered when the status update date for a task as stored
on the device is different than the remote API status update date.

MeisterTaks is nice enough and has a dedicated time to track only status
changes.

Below are the rules for resolving a conflict:

* device open - remote ANY -> remote state
* device completed - remote open -> remote completed
* device completed - remote ANY -> remote state
