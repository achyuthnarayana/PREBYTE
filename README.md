# PREBYTE — Campus Food, Zero Queue

## Project Files
- `index.html` — Main HTML page
- `styles.css` — CSS styling & responsive layout
- `app.js` — Core application logic with Firebase & EmailJS resilience

## What Was Fixed
1. **Firebase Authentication Error (Student Login)**:
   - Dummy/placeholder Firebase API keys have been sanitized so they no longer trigger `auth/invalid-credential` errors.
   - PREBYTE now features automatic local fallback for demo and local student accounts.
   - Added 1-Click Demo Login shortcuts (`Student Demo`, `Vendor (Uni-Centre)`, `Admin Console`) on the login card.

2. **EmailJS Free Token Protection & Quota Exhaustion**:
   - Demo domain emails (`@prebyte.demo`) are now simulated locally, preserving your free monthly EmailJS tokens (200 limit).
   - Added support for all common template parameter aliases (`to_email`, `email`, `user_email`, `student_name`, `order_number`, `canteen`, `pickup_slot`, `total`, `message`, `summary`).
   - Added "Token Saver Mode" toggle in Admin → Integrations.
   - Added real notification email input during student checkout so real emails can be delivered to actual personal inboxes (e.g. Gmail).

## How to Run
Create a folder, paste the 4 files into it, and open `index.html` with VS Code Live Server or double-click to open in any web browser.