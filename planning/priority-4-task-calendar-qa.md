# Priority 4 — Task Calendar QA

## Scope
- Day / week / month / list views
- Task create / edit / delete
- Owner, department, deadline, time, priority, status, scope, progress
- Filters: keyword, owner, status, scope
- Google / Outlook sync status display
- Shared VoiceFlow session authentication

## API
- GET /api/v1/tasks
- POST /api/v1/tasks
- PATCH /api/v1/tasks/:id
- DELETE /api/v1/tasks/:id
- GET /api/v1/tasks/sync/status

## Expected behavior
1. Logged-in user can open work-calendar.html and see tasks.
2. Clicking a task opens the edit modal.
3. Saving changes persists to data/tasks.json.
4. Completing a task is reflected across calendar views.
5. Creating a task with a deadline places it on that date.
6. Owner/status/scope filters update all views.
7. Unauthorized writes are rejected.
8. Google/Outlook show configured/not configured without exposing secrets.

## Deployment note
Task Calendar Service defaults to port 4176 and should be routed so `/api/v1/tasks*` reaches it after validation. It shares the same persistent data directory as VoiceFlow so existing tasks/users/sessions remain compatible.

## Next integration
- Google Calendar event create/update/delete adapter
- Microsoft Graph calendar adapter
- Event envelope emission for Total ERP
- Department/company permission mapper
- Drag/drop date move in month/week view
