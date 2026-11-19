GAMBIT Coach identity audit Preview merge

Changes: admin.html, js/auth.js, api/checkin.js, api/admin-overview.js.
Preserves per-class Coach check-ins and Private classes.
After deploy, log out and log in as Coach again to populate display name.
Coach teacher check-in RPC already receives p_checked_in_by=coach:<id> from verified server session.
Existing attendance records without a recorded actor cannot be attributed retrospectively.
Test on Preview branch only. Do not upload this README or setup SQL as website code.
