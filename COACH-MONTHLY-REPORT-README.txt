GAMBIT Coach monthly attendance and class report — PREVIEW ONLY

1. In Supabase SQL Editor, run the ADDITIONAL gym_coach_shift_classes block at the end of COACH-PASSWORD-SETUP.sql. It is additive; does not delete existing data. Do not expose this table to anon/authenticated.
2. Deploy files ONLY to test-coach-line-login branch. Do not merge into main until verified.
3. In Coach admin, choose a class from today's OPEN class_sessions and click check-in. If teaching more classes that day, choose another and click Add class. Check-out records the actual end of work.
4. In Owner > Manage Coach, select month and Coach, then Load report. Working days are unique shift days; class count is the number of selected class sessions; working hours are calculated from check-in to check-out, NOT class teaching duration.
5. Existing check-ins before this update will show work days but no linked class. The system does not infer which classes were taught historically.
6. Preview uses live Supabase. Test only with authorized test records. Preview must be protected after testing.
7. Note: daily shift model supports one check-in/check-out per Coach per day. It does not support multiple independent shifts in the same day.
