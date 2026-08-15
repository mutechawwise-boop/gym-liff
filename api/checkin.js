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
      const body = await request.json();

const idToken = body.idToken;

const mode = String(
  body.mode || "checkin"
).trim();
      if (!idToken) {
        return json({ error: "ไม่พบ LINE ID token" }, 400);
      }

      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
      const lineChannelId = process.env.LINE_CHANNEL_ID;

      if (!supabaseUrl || !supabaseSecretKey || !lineChannelId) {
        return json(
          { error: "ตั้งค่า Environment Variables ไม่ครบ" },
          500
        );
      }

      // ตรวจสอบตัวตนกับ LINE
      const verifyBody = new URLSearchParams({
        id_token: idToken,
        client_id: lineChannelId
      });

      const verifyResponse = await fetch(
        "https://api.line.me/oauth2/v2.1/verify",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: verifyBody
        }
      );

      const lineProfile = await verifyResponse.json();

      if (!verifyResponse.ok || !lineProfile.sub) {
        return json(
          {
            error: "ยืนยันตัวตนกับ LINE ไม่สำเร็จ",
            details: lineProfile
          },
          401
        );
      }

      const lineUserId = lineProfile.sub;
      const displayName = lineProfile.name || "สมาชิก";
      const now = new Date().toISOString();

      function getThailandDateKey(dateValue) {
        const date = new Date(dateValue);

        const thailandTime = new Date(
          date.getTime() + 7 * 60 * 60 * 1000
        );

        return thailandTime.toISOString().slice(0, 10);
      }

      const commonHeaders = {
        apikey: supabaseSecretKey,
        Authorization: `Bearer ${supabaseSecretKey}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      };

      const todayThailand = getThailandDateKey(now);
// =====================================
// PROFILE MODE
// โหลดข้อมูลสมาชิกโดยไม่ต้องมีคลาสเปิด
// =====================================

if (mode === "profile") {
  const profileMemberResponse = await fetch(
    `${supabaseUrl}/rest/v1/members` +
      `?line_user_id=eq.${encodeURIComponent(lineUserId)}` +
      `&select=id,line_user_id,display_name,nickname,member_status,member_group,membership_plan,membership_start_date,membership_expiry_date,total_sessions,remaining_sessions,checkin_count` +
      `&limit=1`,
    {
      headers: commonHeaders
    }
  );

  if (!profileMemberResponse.ok) {
    const details =
      await profileMemberResponse.text();

    return json(
      {
        success: false,
        error: "อ่านข้อมูลสมาชิกไม่สำเร็จ",
        details
      },
      500
    );
  }

  const profileMembers =
    await profileMemberResponse.json();


  // ==============================
  // มี MEMBER แล้ว
  // ==============================

  if (profileMembers.length > 0) {
    const member = profileMembers[0];

    return json({
      success: true,
      state: "member",

      lineProfile: {
        displayName,
        pictureUrl:
          lineProfile.picture || null
      },

      member: {
        id: member.id,

        memberCode:
          `GJ-${String(member.id).padStart(
            4,
            "0"
          )}`,

        displayName:
          member.display_name ||
          displayName,

        nickname:
          member.nickname || null,

        memberStatus:
          member.member_status,

        memberGroup:
            member.member_group,

          membershipPlan:
          member.membership_plan,

        membershipStartDate:
          member.membership_start_date,

        membershipExpiryDate:
          member.membership_expiry_date,

        totalSessions:
          member.total_sessions,

        remainingSessions:
          member.remaining_sessions,

        checkinCount:
          Number(
            member.checkin_count || 0
          )
      }
    });
  }


  // ==============================
  // ยังไม่มี MEMBER
  // ตรวจคำขอสมัครที่ยัง pending
  // ==============================

  const registrationResponse =
    await fetch(
      `${supabaseUrl}/rest/v1/member_registration` +
        `?line_user_id=eq.${encodeURIComponent(lineUserId)}` +
        `&registration_status=eq.pending` +
        `&select=id,registration_status,created_at,membership_plan` +
        `&order=created_at.desc` +
        `&limit=1`,
      {
        headers: commonHeaders
      }
    );

  if (!registrationResponse.ok) {
    const details =
      await registrationResponse.text();

    return json(
      {
        success: false,
        error:
          "ตรวจสอบคำขอสมัครสมาชิกไม่สำเร็จ",
        details
      },
      500
    );
  }

  const registrations =
    await registrationResponse.json();


  // ==============================
  // สมัครแล้ว แต่รอ Owner อนุมัติ
  // ==============================

  if (registrations.length > 0) {
    return json({
      success: true,
      state: "pending",

      lineProfile: {
        displayName,
        pictureUrl:
          lineProfile.picture || null
      },

      registration:
        registrations[0]
    });
  }


  // ==============================
  // ยังไม่เคยสมัคร
  // ==============================

  return json({
    success: true,
    state: "not_registered",

    lineProfile: {
      displayName,
      pictureUrl:
        lineProfile.picture || null
    }
  });
}
// =====================================
// HISTORY MODE
// โหลดประวัติการเข้าเรียนของสมาชิก
// =====================================

if (mode === "history") {
  const memberResponse = await fetch(
    `${supabaseUrl}/rest/v1/members` +
      `?line_user_id=eq.${encodeURIComponent(lineUserId)}` +
      `&select=id,display_name,nickname` +
      `&limit=1`,
    {
      headers: commonHeaders
    }
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

  if (members.length === 0) {
    return json(
      {
        error: "ยังไม่พบข้อมูลสมาชิก"
      },
      404
    );
  }

  const member = members[0];

  const attendanceResponse = await fetch(
    `${supabaseUrl}/rest/v1/attendance` +
      `?member_id=eq.${member.id}` +
      `&select=id,session_id,checked_in_at,checkin_method,note` +
      `&order=checked_in_at.desc` +
      `&limit=50`,
    {
      headers: commonHeaders
    }
  );

  if (!attendanceResponse.ok) {
    const details = await attendanceResponse.text();

    return json(
      {
        error: "โหลดประวัติการเข้าเรียนไม่สำเร็จ",
        details
      },
      500
    );
  }

  const attendance = await attendanceResponse.json();

  return json({
    success: true,
    mode: "history",
    member: {
      id: member.id,
      displayName:
        member.display_name ||
        member.nickname ||
        displayName
    },
    history: attendance
  });
}
      // หา Session ที่เปิดอยู่ของวันนี้
      const sessionResponse = await fetch(
        `${supabaseUrl}/rest/v1/class_sessions` +
          `?session_date=eq.${todayThailand}` +
          `&status=eq.open` +
          `&select=id,class_id,session_date,start_time,end_time` +
          `&order=start_time.asc` +
          `&limit=1`,
        {
          headers: commonHeaders
        }
      );

      if (!sessionResponse.ok) {
        const details = await sessionResponse.text();

        return json(
          {
            error: "ไม่สามารถอ่านข้อมูลคลาสวันนี้",
            details
          },
          500
        );
      }

      const sessions = await sessionResponse.json();

      if (sessions.length === 0) {
        return json(
          {
            error: "วันนี้ยังไม่ได้เปิดคลาส"
          },
          400
        );
      }

      const sessionId = sessions[0].id;

      // ค้นหาสมาชิกจาก LINE User ID
      const memberResponse = await fetch(
        `${supabaseUrl}/rest/v1/members` +
         `?line_user_id=eq.${encodeURIComponent(lineUserId)}` +
`&select=id,line_user_id,display_name,checkin_count,last_checkin,member_status,membership_plan,membership_start_date,membership_expiry_date,total_sessions,remaining_sessions` +
`&limit=1`,
        {
          headers: commonHeaders
        }
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
      let currentMember;

      // สร้างสมาชิกใหม่ หากยังไม่มีในระบบ
      if (members.length === 0) {
  return json(
    {
      error: "ยังไม่พบข้อมูลสมาชิก",
      message:
  "กรุณาสมัครสมาชิกและรอการอนุมัติก่อนเช็กชื่อ"
    },
    403
  );
}

currentMember = members[0];

if (currentMember.member_status !== "active") {
  return json(
    {
      error: "สมาชิกยังไม่พร้อมใช้งาน",
      message:
  "กรุณาติดต่อยิมเพื่อตรวจสอบสถานะสมาชิก"
    },
    403
  );
}
if (
  currentMember.membership_start_date &&
  todayThailand <
    currentMember.membership_start_date
) {
  return json(
    {
      error: "สมาชิกยังไม่ถึงวันเริ่มใช้งาน",
      message:
        "สิทธิ์สมาชิกของคุณยังไม่เริ่มใช้งาน"
    },
    403
  );
}

if (
  currentMember.membership_expiry_date &&
  todayThailand >
    currentMember.membership_expiry_date
) {
  return json(
    {
      error: "สมาชิกหมดอายุแล้ว",
      message:
        "กรุณาต่ออายุสมาชิกก่อนเข้าเรียน"
    },
    403
  );
}
      // ตรวจสอบว่าคลาสนี้มีการเช็กชื่อแล้วหรือยัง
      const attendanceResponse = await fetch(
        `${supabaseUrl}/rest/v1/attendance` +
          `?session_id=eq.${sessionId}` +
          `&member_id=eq.${currentMember.id}` +
          `&select=id,checked_in_at,checkin_method` +
          `&limit=1`,
        {
          headers: commonHeaders
        }
      );

      if (!attendanceResponse.ok) {
        const details = await attendanceResponse.text();

        return json(
          {
            error: "ตรวจสอบประวัติการเช็กชื่อไม่สำเร็จ",
            details
          },
          500
        );
      }

      const attendanceRecords = await attendanceResponse.json();

      // ครูหรือนักเรียนเช็กคลาสนี้ไปแล้ว
    if (attendanceRecords.length > 0) {
  return json({
    success: true,
    alreadyCheckedIn: true,
    message: "คลาสนี้เช็กชื่อเรียบร้อยแล้ว",

    displayName:
      currentMember.display_name || displayName,

    checkinCount:
      Number(currentMember.checkin_count || 0),

    checkedInAt:
      attendanceRecords[0].checked_in_at,

    checkinMethod:
      attendanceRecords[0].checkin_method,

    sessionId,
     memberId: currentMember.id,

     memberStatus:
     currentMember.member_status,

     membershipStartDate:
     currentMember.membership_start_date,

     membershipExpiryDate:
      currentMember.membership_expiry_date,
    membershipPlan:
      currentMember.membership_plan || null,

    totalSessions:
      currentMember.total_sessions ?? null,

    remainingSessions:
      currentMember.remaining_sessions ?? null
  });
}
const membershipPlan = String(
  currentMember.membership_plan || ""
);

const isClassPass =
  membershipPlan.startsWith("class_pass_");

let newRemainingSessions = null;

if (isClassPass) {
  const remainingSessions =
    Number(currentMember.remaining_sessions ?? 0);

  if (remainingSessions <= 0) {
    return json(
      {
        error: "สิทธิ์เข้าเรียนครบแล้ว",
        message:
          "Class Pass ของคุณถูกใช้ครบจำนวนครั้งแล้ว กรุณาติดต่อโค้ชเพื่อต่อแพ็กเกจ",
        membershipPlan,
        remainingSessions: 0
      },
      403
    );
  }

  newRemainingSessions =
    remainingSessions - 1;
}
      // บันทึกประวัติการเข้าเรียน
      const attendanceInsertResponse = await fetch(
        `${supabaseUrl}/rest/v1/attendance`,
        {
          method: "POST",
          headers: {
            ...commonHeaders,
            Prefer: "return=representation"
          },
          body: JSON.stringify({
            session_id: sessionId,
            member_id: currentMember.id,
            checked_in_at: now,
            checkin_method: "student",
            checked_in_by: lineUserId
          })
        }
      );

      if (!attendanceInsertResponse.ok) {
        const details = await attendanceInsertResponse.text();

        return json(
          {
            error: "บันทึกประวัติการเข้าเรียนไม่สำเร็จ",
            details
          },
          500
        );
      }

      const lastCheckinThailand = currentMember.last_checkin
        ? getThailandDateKey(currentMember.last_checkin)
        : null;

      const oldCount = Number(currentMember.checkin_count || 0);

      // ป้องกันการนับซ้ำขณะย้ายจากระบบเก่า
      const newCount =
        lastCheckinThailand === todayThailand
          ? oldCount
          : oldCount + 1;

      // อัปเดตข้อมูลสรุปของสมาชิก
      const updateResponse = await fetch(
        `${supabaseUrl}/rest/v1/members?id=eq.${currentMember.id}`,
        {
          method: "PATCH",
          headers: {
            ...commonHeaders,
            Prefer: "return=representation"
          },
          body: JSON.stringify({
  display_name: displayName,
  last_checkin: now,
  checkin_count: newCount,
  updated_at: now,

  ...(isClassPass
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
            error: "อัปเดตข้อมูลสมาชิกไม่สำเร็จ",
            details
          },
          500
        );
      }

      const updatedMembers = await updateResponse.json();
      const member = updatedMembers[0];

      return json({
  success: true,
  alreadyCheckedIn: false,
  message: "เช็กอินสำเร็จ",
  displayName: member.display_name,
  checkinCount: member.checkin_count,
  checkedInAt: member.last_checkin,
  checkinMethod: "student",
  sessionId,
  memberId: currentMember.id,

memberStatus:
  currentMember.member_status,

membershipStartDate:
  currentMember.membership_start_date,

membershipExpiryDate:
  currentMember.membership_expiry_date,

  membershipPlan:
  currentMember.membership_plan || null,

totalSessions:
  isClassPass
    ? currentMember.total_sessions
    : null,

remainingSessions:
  isClassPass
    ? member.remaining_sessions
    : null
});
    } catch (error) {
      return json(
        {
          error: "ระบบเกิดข้อผิดพลาด",
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