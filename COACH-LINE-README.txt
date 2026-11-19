GAMBIT COACH LINE LOGIN - integration candidate (NOT production certified)

Changed existing APIs: admin-dashboard, admin-overview, checkin, create-session, update-belt, update-enrollment.
Added shared helper api/lib/coach-auth.js (NOT a new serverless endpoint).
Changed frontend: admin.html, js/auth.js, class-detail.html, js/members.js, owner.html.

IMPORTANT BEFORE DEPLOY:
1. Confirm LINE LIFF ID 2010879060-PKqAwFmt is permitted to initialize at /admin.html and /class-detail.html (LIFF endpoint URL / scope).
2. Verify gym_coaches table exists, and LINE_CHANNEL_ID, SUPABASE_URL, SUPABASE_SECRET_KEY, OWNER_KEY are set.
3. Test Owner login, Coach request/approval, revocation, teacher check-in, create/edit/cancel class, belt and enrollment operations in a preview deployment.
4. No live Supabase / LINE / Vercel integration tests were possible here. Do not replace production without testing.
5. Existing owner finance endpoints remain Owner-key protected. Legacy ADMIN_KEY is not accepted for the modified Coach APIs.
6. Other API endpoints (e.g. create-member) may still use legacy ADMIN_KEY for unrelated legacy flows and require separate security audit.
