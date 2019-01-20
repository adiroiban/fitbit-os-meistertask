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

You can't (yet) add tasks from the device.

Battery status is updated every minute together with the clock.
Battery status might be removed as is not critical... is there just as a
reminder that when battery is low, Fitbit OS will show something here.
So the app should not place anything critical there.

A red X is show when device is not connected to the companion.

A blue '@' is show when the device has sent a message and is waiting for a
response from the companion.


## UI/UX

Click on an item to mark as done(completed) or not-done(active).

Completed items go to the bottom, for easy undo.

Press the right-down button to go to the next section.

In the simulator I was able to emulate a swipe left or right action to
go to previous section, but the swipe actions are crashing the app on the
device.

Press the right-up button to refresh the list.

Drag the first item down to refresh the list. Tries to imitate the Android
drag refresh.


## Conflict resolution

It is possible for the same task to be updated independently on the device and
on the remote API.

For now, there is no conflict resolution and if the task was updated on the
device, it will overwrite the state on the remote API.


## Development

This is not yet public.
You can create your own MeisterTask API key and add it to common/constant.js


# Screenshots

Main app page with tasks list for a section.

![main-app-screenshot](screenshots/device.png?raw=true "Main App")

Notification on top of the page.

![notification-screenshot](screenshots/notification.png?raw=true "Main App")


Settings page.

![settings-screenshot](screenshots/settings.png?raw=true "Settings Page")


# Credits

* UI header inspired by https://github.com/abhijitvalluri/fitbit-todo-list
