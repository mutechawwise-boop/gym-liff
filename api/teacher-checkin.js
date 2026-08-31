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

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    try {
      const adminKey = request.headers.get("x-admin-key");

      if (
        !process.env.ADMIN_KEY ||
        adminKey !== process.env.ADMIN_KEY
      ) {
        return json(
          { error: "ไม่มีสิทธิ์เช็กชื่อแทนนักเรียน" },
          401
        );
      }

      const { sessionId, memberId } = await request.json();

      if (!sessionId || !memberId) {
        return json(
          { error: "ข้อมูลคลาสหรือสมาชิกไม่ครบ" },
          400
        );
      }

      const supabaseUrl = process.env.SUPABASE_URL;
      const secretKey = process.env.SUPABASE_SECRET_KEY;

      if (!supabaseUrl || !secretKey) {
        return json(
          { error: "ตั้งค่า Supabase ไม่ครบ" },
          500
        );
      }

      const headers = {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      };

      // ตรวจว่ามีการเช็กชื่อในคลาสนี้แล้วหรือยัง
      const existingResponse = await fetch(
        `${supabaseUrl}/rest/v1/attendance` +
          `?session_id=eq.${Number(sessionId)}` +
          `&member_id=eq.${Number(memberId)}` +
          `&select=id,checked_in_at,checkin_method` +
          `&limit=1`,
        { headers }
      );

      if (!existingResponse.ok) {
        const details = await existingResponse.text();

        return json(
          {
            error: "ตรวจสอบการเช็กชื่อไม่สำเร็จ",
            details
          },
          500
        );
      }

      const existingRecords = await existingResponse.json();

      if (existingRecords.length > 0) {
        return json({
          success: true,
          alreadyCheckedIn: true,
          message: "นักเรียนเช็กชื่อคลาสนี้แล้ว",
          attendance: existingRecords[0]
        });
      }
// อ่านข้อมูลสมาชิก + สิทธิ์คงเหลือ

const memberResponse = await fetch(
  `${supabaseUrl}/rest/v1/members` +
    `?id=eq.${Number(memberId)}` +
    `&select=id,member_status,membership_plan,remaining_sessions,checkin_count` +
    `&limit=1`,
  { headers }
);

      if (!memberResponse.ok) {
        const details = await memberResponse.text();

        return json(
          {
            error: "อ่านข้อมูลสมาชิกไม่สำเร็จ",
            details
          },
          500
        );
      }

      const members = await memberResponse.json();

      if (!members.length) {
        return json({ error: "ไม่พบสมาชิก" }, 404);
      }
const member = members[0];

if (member.member_status !== "active") {
  return json(
    {
      error: "สมาชิกไม่ได้อยู่ในสถานะ Active"
    },
    403
  );
}

const membershipPlan =
  String(member.membership_plan || "");

const isClassPass =
  membershipPlan.startsWith("class_pass_");

const isDropIn =
  membershipPlan === "drop_in";

const isSessionBased =
  isClassPass || isDropIn;

if (
  isSessionBased &&
  Number(member.remaining_sessions || 0) <= 0
) {
  return json(
    {
      error: "สิทธิ์เข้าเรียนหมดแล้ว"
    },
    403
  );
}

const newRemainingSessions =
  isSessionBased
    ? Number(member.remaining_sessions) - 1
    : null;
    // =====================================
// ตรวจว่าสมาชิกมีสิทธิ์ในคลาสนี้จริง
// =====================================

// อ่าน class_id ของ session
const sessionResponse = await fetch(
  `${supabaseUrl}/rest/v1/class_sessions` +
    `?id=eq.${Number(sessionId)}` +
    `&status=eq.open` +
    `&select=id,class_id` +
    `&limit=1`,
  { headers }
);

if (!sessionResponse.ok) {
  const details =
    await sessionResponse.text();

  return json(
    {
      error: "ตรวจสอบข้อมูลคลาสไม่สำเร็จ",
      details
    },
    500
  );
}

const sessionRows =
  await sessionResponse.json();

if (!sessionRows.length) {
  return json(
    {
      error:
        "ไม่พบคลาส หรือคลาสนี้ถูกยกเลิกแล้ว"
    },
    404
  );
}

const session =
  sessionRows[0];

const classAccessResponse = await fetch(
  `${supabaseUrl}/rest/v1/member_classes` +
    `?member_id=eq.${Number(memberId)}` +
    `&class_id=eq.${Number(session.class_id)}` +
    `&status=eq.active` +
    `&select=id` +
    `&limit=1`,
  { headers }
);

if (!classAccessResponse.ok) {
  const details =
    await classAccessResponse.text();

  return json(
    {
      error:
        "ตรวจสอบสิทธิ์เข้าเรียนไม่สำเร็จ",
      details
    },
    500
  );
}

const classAccess =
  await classAccessResponse.json();

if (!classAccess.length) {
  return json(
    {
      error:
        "สมาชิกไม่มีสิทธิ์เข้าเรียนคลาสนี้"
    },
    403
  );
}
const now = new Date().toISOString();
      // เพิ่มประวัติการเข้าเรียน
      const insertResponse = await fetch(
        `${supabaseUrl}/rest/v1/attendance`,
        {
          method: "POST",
          headers: {
            ...headers,
            Prefer: "return=representation"
          },
          body: JSON.stringify({
            session_id: Number(sessionId),
            member_id: Number(memberId),
            checked_in_at: now,
            checkin_method: "teacher",
            checked_in_by: "admin"
          })
        }
      );

      if (!insertResponse.ok) {
        const details = await insertResponse.text();

        return json(
          {
            error: "ครูเช็กชื่อไม่สำเร็จ",
            details
          },
          500
        );
      }

      const insertedAttendance = await insertResponse.json();


     const newCount =
  Number(member.checkin_count || 0) + 1;

      // อัปเดตยอดสะสม
      const updateResponse = await fetch(
        `${supabaseUrl}/rest/v1/members?id=eq.${Number(
          memberId
        )}`,
        {
          method: "PATCH",
          headers: {
            ...headers,
            Prefer: "return=representation"
          },
          body: JSON.stringify({
  last_checkin: now,
  checkin_count: newCount,
  updated_at: now,
  ...(isSessionBased
    ? {
        remaining_sessions:
          newRemainingSessions
      }
    : {})
})
        }
      );

      if (!updateResponse.ok) {
        const details = await updateResponse.text();

        return json(
          {
            error: "อัปเดตยอดเข้าเรียนไม่สำเร็จ",
            details
          },
          500
        );
      }

      return json({
        success: true,
        alreadyCheckedIn: false,
        message: "ครูเช็กชื่อให้เรียบร้อยแล้ว",
        attendance: insertedAttendance[0]
      });
    } catch (error) {
      return json(
        {
          error: "ระบบเช็กชื่อของครูเกิดข้อผิดพลาด",
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