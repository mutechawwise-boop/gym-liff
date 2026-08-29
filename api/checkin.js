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

  // ==============================
  // อ่านระดับสายปัจจุบัน
  // ==============================

  const beltResponse = await fetch(
    `${supabaseUrl}/rest/v1/member_current_belts` +
      `?member_id=eq.${member.id}` +
      `&select=` +
      `member_id,` +
      `belt_level_id,` +
      `belt_code,` +
      `belt_name,` +
      `color_hex,` +
      `awarded_date,` +
      `stripe_count` +
      `&limit=1`,
    {
      headers: commonHeaders
    }
  );

  if (!beltResponse.ok) {
    const details =
      await beltResponse.text();

    return json(
      {
        success: false,
        error:
          "อ่านข้อมูลระดับสายไม่สำเร็จ",
        details
      },
      500
    );
  }

  const beltRows =
    await beltResponse.json();

  const currentBelt =
    beltRows[0] || null;

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
          ),

belt: currentBelt
  ? {
      levelId:
        currentBelt.belt_level_id,

      code:
        currentBelt.belt_code,

      name:
        currentBelt.belt_name,

      color:
        currentBelt.color_hex,

      stripeCount:
        Number(
          currentBelt.stripe_count || 0
        ),

      awardedDate:
        currentBelt.awarded_date
    }
  : null
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
      `&select=` +
  `id,` +
  `session_id,` +
  `checked_in_at,` +
  `checkin_method,` +
  `note,` +
  `class_sessions(` +
    `id,` +
    `session_date,` +
    `start_time,` +
    `end_time,` +
    `class_id,` +
    `classes(` +
      `id,` +
      `name` +
    `)` +
  `)` +
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
// =====================================
// PAYMENT HISTORY MODE
// โหลดประวัติการชำระเงินของสมาชิก
// =====================================

if (mode === "payment_history") {
  // หาสมาชิกจาก LINE ที่ Login อยู่
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
    const details =
      await memberResponse.text();

    return json(
      {
        error: "อ่านข้อมูลสมาชิกไม่สำเร็จ",
        details
      },
      500
    );
  }

  const members =
    await memberResponse.json();

  if (!members.length) {
    return json(
      {
        error: "ไม่พบข้อมูลสมาชิก"
      },
      404
    );
  }

  const member = members[0];

  // อ่านประวัติการชำระเงิน
  const paymentResponse = await fetch(
    `${supabaseUrl}/rest/v1/membership_transactions` +
      `?member_id=eq.${member.id}` +
      `&select=` +
        `id,` +
        `transaction_type,` +
        `membership_plan,` +
        `amount,` +
        `payment_method,` +
        `payment_status,` +
        `requested_at,` +
        `approved_at,` +
        `note` +
      `&order=requested_at.desc`,
    {
      headers: commonHeaders
    }
  );

  if (!paymentResponse.ok) {
    const details =
      await paymentResponse.text();

    return json(
      {
        error:
          "โหลดประวัติการชำระเงินไม่สำเร็จ",
        details
      },
      500
    );
  }

  const payments =
    await paymentResponse.json();

  return json({
    success: true,
    mode: "payment_history",

    member: {
      id: member.id,
      displayName:
        member.display_name ||
        member.nickname ||
        displayName
    },

    payments
  });
}
// =====================================
// RENEW MODE
// ส่งคำขอต่ออายุสมาชิก
// =====================================

if (mode === "renew") {
  const membershipPlan =
    String(body.membershipPlan || "").trim();

  const paymentMethod =
    String(body.paymentMethod || "").trim();

const slipBase64 =
  String(body.slipBase64 || "").trim();

const slipMimeType =
  String(body.slipMimeType || "").trim();

const slipFileName =
  String(body.slipFileName || "").trim();

  if (!membershipPlan) {
    return json(
      { error: "กรุณาเลือกแพ็กเกจ" },
      400
    );
  }

  if (
    paymentMethod !== "cash" &&
    paymentMethod !== "transfer"
  ) {
    return json(
      { error: "กรุณาเลือกวิธีชำระเงิน" },
      400
    );
  }

const allowedPlans = [
  "drop_in",
  "adult_monthly",
  "kids_monthly",
  "class_pass_4",
  "class_pass_8",
  "class_pass_12"
];

  if (!allowedPlans.includes(membershipPlan)) {
    return json(
      { error: "แพ็กเกจไม่ถูกต้อง" },
      400
    );
  }

  // หาสมาชิกจาก LINE ที่ Login อยู่
  const memberResponse = await fetch(
    `${supabaseUrl}/rest/v1/members` +
      `?line_user_id=eq.${encodeURIComponent(lineUserId)}` +
      `&select=id,line_user_id,display_name` +
      `&limit=1`,
    {
      headers: commonHeaders
    }
  );

  if (!memberResponse.ok) {
    const details =
      await memberResponse.text();

    return json(
      {
        error: "อ่านข้อมูลสมาชิกไม่สำเร็จ",
        details
      },
      500
    );
  }

  const members =
    await memberResponse.json();

  if (members.length === 0) {
    return json(
      { error: "ไม่พบข้อมูลสมาชิก" },
      404
    );
  }

  const member = members[0];
  const registrationResponse = await fetch(
  `${supabaseUrl}/rest/v1/member_registration` +
    `?line_user_id=eq.${encodeURIComponent(lineUserId)}` +
    `&registration_status=eq.approved` +
    `&select=nationality` +
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
      error: "อ่านข้อมูลสัญชาติสมาชิกไม่สำเร็จ",
      details
    },
    500
  );
}

const registrations =
  await registrationResponse.json();

const nationality =
  String(
    registrations[0]?.nationality || ""
  ).trim();

if (
  nationality !== "thai" &&
  nationality !== "foreigner"
) {
  return json(
    {
      error:
        "ไม่พบข้อมูลสัญชาติของสมาชิก กรุณาติดต่อยิม"
    },
    400
  );
}

const MEMBERSHIP_PRICES = {
  thai: {
    drop_in: 500,
    class_pass_4: 1500,
    class_pass_8: 2000,
    class_pass_12: 2500,
    adult_monthly: 2900,
    kids_monthly: 2900
  },

  foreigner: {
    drop_in: 500,
    class_pass_12: 3000,
    adult_monthly: 3500,
    kids_monthly: 3500
  }
};

const nationalityPrices =
  MEMBERSHIP_PRICES[nationality];

if (
  !Object.prototype.hasOwnProperty.call(
    nationalityPrices,
    membershipPlan
  )
) {
  return json(
    {
      error:
        "แพ็กเกจนี้ไม่สามารถใช้กับสัญชาติของสมาชิกได้"
    },
    400
  );
}

const paymentAmount =
  nationalityPrices[membershipPlan];

  // กันการกดส่งคำขอซ้ำ
  const pendingResponse = await fetch(
    `${supabaseUrl}/rest/v1/membership_transactions` +
      `?member_id=eq.${member.id}` +
      `&transaction_type=eq.renewal` +
      `&payment_status=eq.pending` +
      `&select=id` +
      `&limit=1`,
    {
      headers: commonHeaders
    }
  );

  if (!pendingResponse.ok) {
    const details =
      await pendingResponse.text();

    return json(
      {
        error: "ตรวจสอบคำขอต่ออายุไม่สำเร็จ",
        details
      },
      500
    );
  }

  const pendingTransactions =
    await pendingResponse.json();

  if (pendingTransactions.length > 0) {
    return json(
      {
        error:
          "คุณมีคำขอต่ออายุที่กำลังรอตรวจสอบอยู่แล้ว"
      },
      409
    );
  }
let slipPath = null;

if (paymentMethod === "transfer") {
  if (!slipBase64 || !slipMimeType) {
    return json(
      {
        error: "กรุณาแนบหลักฐานการโอน"
      },
      400
    );
  }

  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];

  if (!allowedMimeTypes.includes(slipMimeType)) {
    return json(
      {
        error:
          "รองรับเฉพาะไฟล์ JPG, PNG หรือ WEBP"
      },
      400
    );
  }

  const base64Data =
    slipBase64.includes(",")
      ? slipBase64.split(",").pop()
      : slipBase64;

  const binaryString =
    atob(base64Data);

  const bytes =
    new Uint8Array(binaryString.length);

  for (
    let index = 0;
    index < binaryString.length;
    index += 1
  ) {
    bytes[index] =
      binaryString.charCodeAt(index);
  }

  if (bytes.byteLength > 5 * 1024 * 1024) {
    return json(
      {
        error: "ไฟล์สลิปมีขนาดเกิน 5 MB"
      },
      400
    );
  }

  const extensionMap = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
  };

  const extension =
    extensionMap[slipMimeType];

  const safeUserId =
    lineUserId.replace(
      /[^a-zA-Z0-9_-]/g,
      "_"
    );

  const storageFileName =
    `${safeUserId}/renewal-${Date.now()}.${extension}`;

  const uploadResponse = await fetch(
    `${supabaseUrl}/storage/v1/object/payment-slips/` +
      encodeURIComponent(storageFileName)
        .replace(/%2F/g, "/"),
    {
      method: "POST",
      headers: {
        apikey: supabaseSecretKey,
        Authorization:
          `Bearer ${supabaseSecretKey}`,
        "Content-Type": slipMimeType,
        "x-upsert": "false"
      },
      body: bytes
    }
  );

  if (!uploadResponse.ok) {
    const details =
      await uploadResponse.text();

    return json(
      {
        error:
          "อัปโหลดหลักฐานการโอนไม่สำเร็จ",
        details
      },
      500
    );
  }

  slipPath = storageFileName;
}
  // สร้างคำขอต่ออายุ
  const transactionResponse = await fetch(
    `${supabaseUrl}/rest/v1/membership_transactions`,
    {
      method: "POST",
      headers: {
        ...commonHeaders,
        Prefer: "return=representation"
      },
   body: JSON.stringify({
  member_id: member.id,
  line_user_id: lineUserId,
  transaction_type: "renewal",
  membership_plan: membershipPlan,
  amount: paymentAmount,
  payment_method: paymentMethod,
  payment_status: "pending",
  slip_url:
    paymentMethod === "transfer"
      ? slipPath
      : null
})
    }
  );

  if (!transactionResponse.ok) {
    const details =
      await transactionResponse.text();

    return json(
      {
        error: "ส่งคำขอต่ออายุไม่สำเร็จ",
        details
      },
      500
    );
  }

  const transactions =
    await transactionResponse.json();

  return json({
    success: true,
    mode: "renew",
    message:
      "ส่งคำขอต่ออายุเรียบร้อยแล้ว",
    transaction: transactions[0]
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

const isDropIn =
  membershipPlan === "drop_in";

const isSessionBased =
  isClassPass || isDropIn;

let newRemainingSessions = null;

if (isSessionBased) {
  const remainingSessions =
    Number(currentMember.remaining_sessions ?? 0);


 if (remainingSessions <= 0) {
  return json(
    {
      error: "สิทธิ์เข้าเรียนครบแล้ว",
      message: isDropIn
        ? "สิทธิ์ Drop-in ถูกใช้แล้ว กรุณาซื้อ Drop-in ใหม่หรือต่อแพ็กเกจ"
        : "Class Pass ของคุณถูกใช้ครบจำนวนครั้งแล้ว กรุณาต่อแพ็กเกจ",
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

  ...(isSessionBased
    ? {
        remaining_sessions:
          newRemainingSessions,

        member_status:
          newRemainingSessions <= 0
            ? "inactive"
            : "active"
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
  member.member_status,

membershipStartDate:
  currentMember.membership_start_date,

membershipExpiryDate:
  currentMember.membership_expiry_date,

  membershipPlan:
  currentMember.membership_plan || null,

totalSessions:
  isSessionBased
    ? currentMember.total_sessions
    : null,

remainingSessions:
  isSessionBased
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