# Coffee Shop App Report

This report is written for school operators, shop leads, and power users who need to understand what the Coffee Shop app does, how it supports daily service, and where it is most useful in practice.

## Executive Summary

Coffee Shop is a Microsoft Teams app for running a school coffee and snack ordering workflow inside the place staff and students already use every day.

The app is designed to:
- let students place orders quickly without queueing at the counter
- help staff manage preparation and collection flow in one place
- give admins control over windows, capacity, stock, roles, and reporting
- reduce missed pickups by using status tracking and Teams notifications

In plain terms, it acts like a lightweight operational hub for a small campus food-and-drink service.

## Primary User Groups

### Students

Students use the app to:
- browse the menu
- place orders
- choose a pickup window
- pay with a student card or pay at collection
- track order progress
- confirm collection
- receive Teams notifications as their order moves through the workflow

### Staff

Staff use the app to:
- watch the live order queue
- move orders through preparation states
- mark items ready for pickup
- manage the pickup grid
- watch inventory risk and load alerts
- receive notifications when new orders arrive

### Admins

Admins can do everything staff can, plus:
- manage staff roles
- control pickup windows and window capacity
- manage inventory and menu availability
- review balance and reporting views
- tune shop settings that affect ordering behavior

## Core Student Experience

### 1. Browse and Build Orders

Students can browse menu categories, view item details, and build an order directly inside Teams. The experience is designed to stay simple and fast rather than looking like a full restaurant marketplace.

What stands out:
- category-based browsing
- item quantity controls
- clear pricing
- a cart that stays within the same Teams experience

### 2. Choose a Pickup Window

Students choose from available pickup periods. The app shows whether a window is:
- free
- busy
- near capacity
- over capacity
- closed

This helps spread demand across collection times instead of overloading a single rush period.

### 3. Pay and Submit

The app supports:
- student card payment
- pay-at-collect

This gives schools flexibility if they are not ready for a single payment method.

### 4. Track Order Progress

Students can see their orders move through the full lifecycle:
- confirmed
- preparing
- ready
- collected
- cancelled

This is one of the most important usability wins in the app, because it replaces uncertainty with a visible workflow.

### 5. Receive Notifications

Students can now receive Teams activity notifications for:
- order confirmed
- order being prepared
- order ready

These are meant to reduce no-shows, reduce repeated “is my order ready?” questions, and pull students back into the app only when something meaningful changes.

## Core Staff Experience

### 1. Queue Management

The queue is the operational center for staff.

It allows staff to:
- see new incoming orders
- filter and review active work
- move orders from confirmed to preparing
- move orders from preparing to ready
- mark orders collected
- cancel active orders when needed

This gives staff a single progression path and makes the shop’s live workload visible.

### 2. Pickup Grid Support

When an order becomes ready, the app supports a collection-grid style workflow. This is useful where drinks or snacks are placed in numbered slots for student pickup.

This helps:
- reduce verbal handoff overhead
- organize ready orders
- make peak periods easier to handle

### 3. Inventory Monitoring

Staff can manage inventory and receive low-stock warnings. This is especially useful for premade items and anything that can run out during the day.

Operational value:
- fewer surprises during service
- better visibility into what should be restocked or hidden
- better confidence in what students see on the menu

### 4. Capacity Awareness

The app watches pickup-window load and can surface:
- busy windows
- near-capacity windows
- over-capacity windows

This supports a more realistic workload picture for staff and admins, especially during short break periods.

## Admin Features

### 1. Pickup Window Control

Admins can define and manage collection periods, including the order cap for made-to-order demand.

This matters because:
- some periods are naturally busier than others
- some periods should be closed or restricted
- windows can be used to shape demand instead of simply reacting to it

### 2. Staff Role Management

Admins can add and manage staff members and assign the correct role. That makes it easier to separate frontline work from higher-trust admin actions.

### 3. Settings Control

Admins can tune order rules such as:
- whether window capacity is enforced
- order-size limits
- total-value limits

This makes the app adaptable for different school policies and staffing levels.

### 4. Reporting

The app includes reporting views for balances and totals, giving admins a practical summary of what has happened during service.

This helps with:
- tracking amounts due
- monitoring order volume
- reviewing activity without diving into raw records

## Notification Value

Notifications are one of the strongest practical features in the current app.

### Staff notifications help with:
- spotting new orders quickly
- reducing queue lag
- keeping frontline workers inside Teams instead of checking another system

### Student notifications help with:
- reassuring students that an order was accepted
- reducing uncertainty while waiting
- prompting collection at the right time

### Important operational note

For Teams notifications to work reliably:
- the user must have the current version of the app installed
- the tenant app entry must be approved and up to date

Once that is in place, the app is much stronger as a real operational tool, not just a tab interface.

## What The App Does Well

### Clear role separation

Students, staff, and admins each get a focused experience rather than one overloaded interface.

### Good fit for school operations

The app is well aligned to break periods, limited capacity, queue visibility, and pickup handoff, which are the real pain points in a school coffee setup.

### Teams-native convenience

Using Teams lowers the barrier to adoption because users do not need to learn a separate standalone tool.

### Actionable operational visibility

The queue, pickup windows, stock alerts, and dashboard create a useful day-of-service picture for staff.

## Current Operational Limitations

These are not failures, but they are worth understanding.

### App update visibility in the Teams store

If the tenant catalog is not refreshed or approved promptly, users can end up seeing an older app listing. This is an operations and release-management issue more than a product issue.

### Notification reliability depends on app installation state

If a student or staff user still has an older app instance installed, Teams notifications may fail until the correct app is installed.

### Average order metrics should be interpreted carefully

As with any shop reporting view, summary numbers are helpful, but staff should still pair them with common-sense understanding of rush periods and collection behavior.

## Best Use Cases

This app is strongest when used for:
- short school break ordering
- managed pickup windows
- limited-capacity made-to-order service
- a small team handling both prep and collection
- schools that already rely on Teams for communication

## Recommended Operational Playbook

### For students

- install the current Coffee Shop app in Teams
- place orders through the app rather than ad hoc messages
- rely on order status and notifications instead of checking at the counter repeatedly

### For staff

- keep the queue open during service
- progress orders consistently through the defined states
- use the pickup grid view when ready orders begin to stack up

### For admins

- review pickup window caps regularly
- keep staff roles accurate
- watch low-stock and window-load patterns over time
- use reports to adjust staffing, stock, and window sizing

## Overall Assessment

Coffee Shop is a solid operational app for a school-based ordering workflow inside Teams. Its biggest strengths are clarity, practical workflow support, and fit for a real school service environment.

It is not trying to be a huge commerce platform. That is a good thing. It is best understood as a focused service-management app that helps a school coffee shop run more predictably, with better communication and less queue friction.

For a school or student-run shop already living in Teams, this is a useful and credible day-to-day operations tool.
