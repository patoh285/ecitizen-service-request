# County eCitizen: Public Service Request System

I built this for the County ICT assessment. The idea is simple: instead of walking to a county office or calling someone, a citizen can report a problem like a broken streetlight, a burst water pipe or uncollected garbage from their phone or laptop, then follow it until it's fixed. On the other side, county staff get one dashboard where they can see every report, update its status and reply to the person who sent it.

**Try it here:** https://patoh285.github.io/ecitizen-service-requests/

It's plain HTML, CSS and JavaScript. No framework, nothing to install, no server to run.

## What it does

**For citizens**
- Register and sign in with a National ID or email and a password
- Report an issue by choosing a category and sub-county, adding a location and description, and attaching a photo if they have one
- Track each report as it moves from Pending to In Progress to Resolved, and read any reply from the county

**For administrators**
- See every report in one list, with urgent ones at the top
- Update the status and leave a short response for the citizen
- Search and filter by status, and download everything as a CSV file
- View simple analytics: how many cases are pending, in progress and resolved, how many are still open, the resolution rate, and which categories get the most reports
- Add other administrators

**Extras I added beyond the brief**
- An urgent flag for serious issues
- A status timeline on every request
- Photos get shrunk before saving so the browser doesn't run out of storage
- Works on phones, and switches to dark mode if your device uses it

## How to run it

The easiest way is to download or clone the repo and open `index.html` in your browser. That's all.


## Trying it out

1. Click the **Admin** tab and create the first administrator account. This only works while no admin exists yet.
2. Go to **Register** and create a citizen account.
3. As the citizen, submit a request. You'll get a reference number like `REQ-1A2B3C`.
4. Sign out and sign back in as the admin. Change the request to In Progress and add a note.
5. Sign in as the citizen again and you'll see the update on your request.

## How the code is organised

`
ecitizen-service-requests/
├── index.html        the page layout
├── css/styles.css    colours, layout and dark mode
└── js/script.js      all the app logic

I kept the three concerns separate so each file is easy to read on its own. Inside `script.js` the code is split into six commented sections: config, core helpers, authentication, the citizen side, the admin side, and the starting point that decides which screen to show.

Data is saved in the browser's `localStorage` under three keys: `ecitizen.users`, `ecitizen.requests` and `ecitizen.session`. Passwords are hashed before they're stored, and anything a user types is escaped before it's shown on the page so it can't run as code.

## Things to know

This is a front-end project, so there's no real backend. Everything is stored in the browser you're using, which means a request submitted on one device won't appear on another. Also, whoever opens the app first on a fresh browser can create the admin account. That's fine for a demo, but a real system would need proper server-side login and a way to approve new admins.

## What I'd add next

- A real backend and database (PHP with MySQL, or Node.js) with secure server-side authentication
- SMS or email alerts when a request changes status
- A map of where issues are reported
- Reports per sub-county and automated tests

## About me

Njoroge Patrick Chege
BSc Information Technology, Karatina University
