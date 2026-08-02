import { supabase } from "./lib/supabase.js";

function getBangkokDateString() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

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

      if (
        !process.env.ADMIN_KEY ||
        adminKey !== process.env.ADMIN_KEY
      ) {
        return json(
          {
            success: false,
            error: "ไม่มีสิทธิ์ใช้งานหน้า Owner"
          },
          401
        );
      }

      const today = getBangkokDateString();

      const [
        sessionsResponse,
        attendanceResponse,
        membersResponse
      ] = await Promise.all([
        supabase.request(
          `sessions?select=id,start_time,end_time,classes(id,name)&session_date=eq.${today}`
        ),
        supabase.request(
          `attendance?select=id,session_id,member_id&checked_in_at=gte.${today}T00:00:00+07:00&checked_in_at=lt.${today}T23:59:59+07:00`
        ),
        supabase.request(
          `members?select=id,created_at,membership_expiry_date,is_guest`
        )
      ]);

      if (
        !sessionsResponse.ok ||
        !attendanceResponse.ok ||
        !membersResponse.ok
      ) {
        return json(
          {
            success: false,
            error: "โหลดข้อมูล Owner Dashboard ไม่สำเร็จ"
          },
          500
        );
      }

      const sessions = await sessionsResponse.json();
      const attendance = await attendanceResponse.json();
      const members = await membersResponse.json();

      const todayNewMembers = members.filter((member) => {
        if (!member.created_at || member.is_guest) return false;

        return member.created_at.slice(0, 10) === today;
      });

      const expiringMembers = members.filter((member) => {
        if (
          member.is_guest ||
          !member.membership_expiry_date
        ) {
          return false;
        }

        const expiry = new Date(
          `${member.membership_expiry_date}T00:00:00+07:00`
        );

        const current = new Date(
          `${today}T00:00:00+07:00`
        );

        const daysLeft = Math.ceil(
          (expiry.getTime() - current.getTime()) /
          (1000 * 60 * 60 * 24)
        );

        return daysLeft >= 0 && daysLeft <= 7;
      });

      const classSummary = sessions.map((session) => {
        const attendanceCount = attendance.filter(
          (record) =>
            Number(record.session_id) === Number(session.id)
        ).length;

        return {
          id: session.id,
          name: session.classes?.name || "ไม่ระบุชื่อคลาส",
          startTime: session.start_time,
          endTime: session.end_time,
          attendanceCount
        };
      });

      return json({
        success: true,
        today,
        todayClassCount: sessions.length,
        todayAttendanceCount: attendance.length,
        todayNewMemberCount: todayNewMembers.length,
        todayExpiringCount: expiringMembers.length,
        classes: classSummary
      });
    } catch (error) {
      console.error("Owner dashboard error:", error);

      return json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "เกิดข้อผิดพลาด"
        },
        500
      );
    }
  }
};