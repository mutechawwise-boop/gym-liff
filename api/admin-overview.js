export default {
  async fetch(request) {
    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store"
        }
      });

    if (request.method !== "GET") {
      return json({ error: "Method not allowed" }, 405);
    }

    try {
      const adminKey = request.headers.get("x-admin-key");
      const expectedAdminKey = process.env.ADMIN_KEY;

      if (!expectedAdminKey) {
        return json(
          { error: "ยังไม่ได้ตั้งค่า ADMIN_KEY" },
          500
        );
      }

      if (!adminKey || adminKey !== expectedAdminKey) {
        return json(
          { error: "ไม่มีสิทธิ์ใช้งานหน้า Admin" },
          401
        );
      }

      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseSecretKey =
        process.env.SUPABASE_SECRET_KEY;

      if (!supabaseUrl || !supabaseSecretKey) {
        return json(
          {
            error:
              "ตั้งค่า Supabase Environment Variables ไม่ครบ"
          },
          500
        );
      }

      const headers = {
        apikey: supabaseSecretKey,
        Authorization: `Bearer ${supabaseSecretKey}`,
        Accept: "application/json"
      };

      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(new Date());

      // ดึงคลาสที่เปิดวันนี้
      const sessionsResponse = await fetch(
        `${supabaseUrl}/rest/v1/class_sessions` +
          `?session_date=eq.${today}` +
          `&status=eq.open` +
          `&select=id,session_date,start_time,end_time,status,note,classes(id,name)` +
          `&order=start_time.asc`,
        { headers }
      );

      if (!sessionsResponse.ok) {
        const details = await sessionsResponse.text();

        return json(
          {
            error: "อ่านข้อมูลคลาสไม่สำเร็จ",
            details
          },
          500
        );
      }

      const sessions = await sessionsResponse.json();

      // ดึงสมาชิกทั้งหมด
      const membersResponse = await fetch(
        `${supabaseUrl}/rest/v1/members` +
          `?select=id,display_name,full_name,nickname,phone,member_status,is_guest` +
          `&order=display_name.asc`,
        { headers }
      );

      if (!membersResponse.ok) {
        const details = await membersResponse.text();

        return json(
          {
            error: "อ่านข้อมูลสมาชิกไม่สำเร็จ",
            details
          },
          500
        );
      }

      const rawMembers = await membersResponse.json();

      // ดึงข้อมูลสายปัจจุบันของสมาชิก
      const beltsResponse = await fetch(
        `${supabaseUrl}/rest/v1/member_current_belts` +
          `?select=member_id,belt_level_id,belt_code,belt_name,rank_order,color_hex,awarded_date,awarded_by,note`,
        { headers }
      );

      if (!beltsResponse.ok) {
        const details = await beltsResponse.text();

        return json(
          {
            error: "อ่านข้อมูลสายของสมาชิกไม่สำเร็จ",
            details
          },
          500
        );
      }

      const currentBelts = await beltsResponse.json();

      const beltByMemberId = new Map(
        currentBelts.map((belt) => [
          belt.member_id,
          belt
        ])
      );

      // รวมข้อมูลสมาชิกกับสายปัจจุบัน
      const members = rawMembers.map((member) => ({
        ...member,
        current_belt:
          beltByMemberId.get(member.id) || null
      }));
// ดึงระดับสายทั้งหมดสำหรับแบบฟอร์มเปลี่ยนสาย
const beltLevelsResponse = await fetch(
  `${supabaseUrl}/rest/v1/belt_levels` +
    `?active=eq.true` +
    `&select=id,code,name_th,rank_order,color_hex` +
    `&order=rank_order.asc`,
  { headers }
);

if (!beltLevelsResponse.ok) {
  const details = await beltLevelsResponse.text();

  return json(
    {
      error: "อ่านรายการระดับสายไม่สำเร็จ",
      details
    },
    500
  );
}

const beltLevels = await beltLevelsResponse.json();
      // ดึงการเช็กชื่อของคลาสวันนี้
      const sessionIds = sessions.map(
        (session) => session.id
      );

      let attendance = [];

      if (sessionIds.length > 0) {
        const attendanceResponse = await fetch(
          `${supabaseUrl}/rest/v1/attendance` +
            `?session_id=in.(${sessionIds.join(",")})` +
            `&select=id,session_id,member_id,checked_in_at,checkin_method,checked_in_by,note`,
          { headers }
        );

        if (!attendanceResponse.ok) {
          const details =
            await attendanceResponse.text();

          return json(
            {
              error:
                "อ่านข้อมูลการเช็กชื่อไม่สำเร็จ",
              details
            },
            500
          );
        }

        attendance =
          await attendanceResponse.json();
      }

     return json({
  success: true,
  date: today,
  sessions,
  members,
  attendance,
  beltLevels
});
    } catch (error) {
      return json(
        {
          error: "ระบบ Admin เกิดข้อผิดพลาด",
          details:
            error instanceof Error
              ? error.message
              : String(error)
        },
        500
      );
    }
  }
};