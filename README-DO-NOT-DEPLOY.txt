GAMBIT Coach LINE Login - Stage 4 REVIEW ONLY (DO NOT DEPLOY)

Includes three existing API functions (no new serverless endpoint):
- api/admin-dashboard.js: Owner coach approval/request actions (POST ?mode=coach-access)
- api/admin-overview.js: verified LINE Coach auth for overview
- api/checkin.js: verified LINE Coach auth for teacher_checkin, records coach:<LINE user id>

IMPORTANT:
- This is NOT production-ready. Shared ADMIN_KEY remains a temporary bypass.
- Other Coach-facing endpoints and frontend must be migrated and tested together.
- Confirm gym_checkin_atomic p_checked_in_by accepts coach:<LINE user id> length.
- Owner finance remains protected by OWNER_KEY.
- Do not upload or deploy until the remaining endpoints and UI are reviewed.
