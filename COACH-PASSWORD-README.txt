GAMBIT Coach password + attendance preview — DO NOT MERGE TO MAIN YET.
1. Supabase SQL Editor: execute COACH-PASSWORD-SETUP.sql.
2. Vercel Preview env: set COACH_SESSION_SECRET to random 32+ character secret, then redeploy Preview.
3. Test Coach register -> Owner approval -> Coach login -> check-in/out -> Owner report.
4. Coach work attendance is one shift per Bangkok calendar day; any location, no GPS.
5. Passwords use PBKDF2 SHA-256 with random salt; session HMAC expires after 8 hours; permissions checked each API request.
6. Password login is not yet production-hardened: add rate limits, login lockout, audit logging, and recovery flow before production.
7. Preview uses real Supabase unless you configure a separate database. Test registrations/check-ins create real records.
8. Keep Vercel Preview protection on except controlled testing. Do not merge this branch to main.
