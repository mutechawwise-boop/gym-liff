PREVIEW ONLY: test-coach-line-login branch. DO NOT upload to main.
1. Run COACH-CLASS-CHECKIN-SETUP.sql in Supabase SQL Editor first.
2. Upload admin.html, owner.html, api/admin-dashboard.js to the same paths in Preview branch.
3. Verify Coach login, today schedule, normal class check-in, Private class check-in, Owner monthly report.
4. Each check-in is one class; no checkout. Regular classes are unique per Coach/session. Private classes may have multiple entries.
5. Previous gym_coach_shifts data is preserved, but is not counted in the new per-class report. No historical class timestamps are inferred.
6. Preview and Production may share the same Supabase. Use test data only.
7. Note: member attendance audit/name is a separate change and is NOT included in this ZIP.
