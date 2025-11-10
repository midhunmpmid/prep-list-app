Weekly Prep List App

A tablet-optimized web application for managing daily kitchen prep lists with day-specific quantities and completion tracking.

🌟 Features

User App: Daily prep checklist for kitchen staff

Automatic day detection - opens to today
Click any day tab to view that day's preps
Check off items as completed
Three-column layout: Task, Quantity, Instructions
Completion tracking by date

Admin App: Management interface

Add/edit/delete prep items
Assign preps to specific days with day-specific quantities
Same prep can have different quantities on different days
Visual day assignment grid (Monday-Sunday)

prep-list-app/
├── user-app/ # Kitchen staff interface
│ ├── index.html
│ ├── style.css
│ └── app.js
├── admin-app/ # Management interface
│ ├── index.html
│ ├── style.css
│ └── admin.js
└── README.md
