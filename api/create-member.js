async function verifyLineIdToken(idToken, lineChannelId) {
  if (!idToken) {
    throw new Error("ไม่พบ LINE ID token");
  }

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
    const error = new Error(
      "ยืนยันตัวตนกับ LINE ไม่สำเร็จ"
    );

    error.details = lineProfile;
    throw error;
  }

  return {
    userId: lineProfile.sub,
    displayName: lineProfile.name || "สมาชิก",
    pictureUrl: lineProfile.picture || null
  };
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

    if (request.method !== "POST") {
      return json(
        { error: "Method not allowed" },
        405
      );
    }

    try {
      

      const supabaseUrl =
        process.env.SUPABASE_URL;

      const supabaseSecretKey =
        process.env.SUPABASE_SECRET_KEY;

      if (
        !supabaseUrl ||
        !supabaseSecretKey
      ) {
        return json(
          {
            error:
              "ตั้งค่า Supabase Environment Variables ไม่ครบ"
          },
          500
        );
      }

      const body = await request.json();
const mode = String(
  body.mode || "admin_create"
).trim();

if (mode !== "line_register") {
  const accessKey =
    request.headers.get("x-admin-key");

  const adminKey =
    process.env.ADMIN_KEY;

  const ownerKey =
    process.env.OWNER_KEY;

  if (mode === "owner_approve_registration") {
    if (
      !ownerKey ||
      !accessKey ||
      accessKey !== ownerKey
    ) {
      return json(
        {
          error:
            "ไม่มีสิทธิ์อนุมัติสมาชิก"
        },
        401
      );
    }
  } else {
    if (
      !adminKey ||
      !accessKey ||
      accessKey !== adminKey
    ) {
      return json(
        {
          error:
            "ไม่มีสิทธิ์ใช้งานหน้า Admin"
        },
        401
      );
    }
  }
}
  if (mode === "line_register") {
  const lineChannelId = process.env.LINE_CHANNEL_ID;

  if (!lineChannelId) {
    return json(
      { error: "ยังไม่ได้ตั้งค่า LINE_CHANNEL_ID" },
      500
    );
  }

  const idToken = String(body.idToken || "").trim();

  const lineProfile = await verifyLineIdToken(
    idToken,
    lineChannelId
  );

  const firstName = String(body.firstName || "").trim();
  const lastName = String(body.lastName || "").trim();
  const nickname = String(body.nickname || "").trim();
  const phone = String(body.phone || "").trim();
  const email = String(body.email || "").trim();
  const birthDate = String(body.birthDate || "").trim();
  const gender = String(body.gender || "").trim();

  const medicalConditions =
    String(body.medicalConditions || "").trim();

  const allergies =
    String(body.allergies || "").trim();

  const emergencyContactName =
    String(body.emergencyContactName || "").trim();

  const emergencyContactRelationship =
    String(body.emergencyContactRelationship || "").trim();

  const emergencyContactPhone =
    String(body.emergencyContactPhone || "").trim();

  const membershipPlan =
    String(body.membershipPlan || "").trim();

  const paymentMethod =
    String(body.paymentMethod || "").trim();

  if (!firstName || !lastName || !nickname || !phone) {
    return json(
      { error: "กรุณากรอกข้อมูลที่จำเป็นให้ครบ" },
      400
    );
  }

  if (!membershipPlan) {
    return json(
      { error: "กรุณาเลือกแผนสมาชิก" },
      400
    );
  }

  if (!["cash", "transfer"].includes(paymentMethod)) {
    return json(
      { error: "วิธีชำระเงินไม่ถูกต้อง" },
      400
    );
  }

  const supabaseHeaders = {
    apikey: supabaseSecretKey,
    Authorization: `Bearer ${supabaseSecretKey}`,
    "Content-Type": "application/json",
    Prefer: "return=representation"
  };

  const registrationResponse = await fetch(
    `${supabaseUrl}/rest/v1/member_registration`,
    {
      method: "POST",
      headers: supabaseHeaders,
      body: JSON.stringify({
        line_user_id: lineProfile.userId,
        line_display_name: lineProfile.displayName,
        line_picture_url: lineProfile.pictureUrl,
        first_name: firstName,
        last_name: lastName,
        nickname,
        phone,
        email: email || null,
        birth_date: birthDate || null,
        gender: gender || null,
        medical_conditions: medicalConditions || null,
        allergies: allergies || null,
        emergency_contact_name:
          emergencyContactName || null,
        emergency_contact_relationship:
          emergencyContactRelationship || null,
        emergency_contact_phone:
          emergencyContactPhone || null,
        membership_plan: membershipPlan,
        payment_method: paymentMethod,
        payment_status: "pending",
        registration_status: "pending",
        payment_amount: null,
        slip_url: null,
        slip_uploaded_at: null
      })
    }
  );

  if (!registrationResponse.ok) {
    const details = await registrationResponse.text();

    return json(
      {
        error: "บันทึกคำขอสมัครสมาชิกไม่สำเร็จ",
        details
      },
      500
    );
  }

  const registrations =
    await registrationResponse.json();

  return json({
    success: true,
    registration: registrations[0]
  });
}
if (mode === "owner_approve_registration") {
  const registrationId =
    Number(body.registrationId);

  const membershipStartDate =
    String(
      body.membershipStartDate || ""
    ).trim();

  const membershipExpiryDate =
    String(
      body.membershipExpiryDate || ""
    ).trim();

  const totalSessions =
    body.totalSessions === null ||
    body.totalSessions === "" ||
    body.totalSessions === undefined
      ? null
      : Number(body.totalSessions);

  const remainingSessions =
    body.remainingSessions === null ||
    body.remainingSessions === "" ||
    body.remainingSessions === undefined
      ? null
      : Number(body.remainingSessions);

  const ownerNote =
    String(body.ownerNote || "").trim();

  if (
    !Number.isInteger(registrationId) ||
    registrationId <= 0
  ) {
    return json(
      {
        error:
          "Registration ID ไม่ถูกต้อง"
      },
      400
    );
  }

  if (
    !membershipStartDate ||
    !membershipExpiryDate
  ) {
    return json(
      {
        error:
          "กรุณากำหนดวันที่เริ่มและวันที่หมดอายุ"
      },
      400
    );
  }

  if (
    membershipExpiryDate <
    membershipStartDate
  ) {
    return json(
      {
        error:
          "วันที่หมดอายุต้องไม่ก่อนวันที่เริ่มสมาชิก"
      },
      400
    );
  }

  const supabaseHeaders = {
    apikey: supabaseSecretKey,
    Authorization:
      `Bearer ${supabaseSecretKey}`,
    "Content-Type": "application/json",
    Prefer: "return=representation"
  };

  // อ่านคำขอสมัคร
  const registrationResponse = await fetch(
    `${supabaseUrl}/rest/v1/member_registration` +
      `?id=eq.${registrationId}` +
      `&select=*` +
      `&limit=1`,
    {
      headers: supabaseHeaders
    }
  );

  if (!registrationResponse.ok) {
    const details =
      await registrationResponse.text();

    return json(
      {
        error:
          "อ่านข้อมูลคำขอสมัครไม่สำเร็จ",
        details
      },
      500
    );
  }

  const registrationRows =
    await registrationResponse.json();

  const registration =
    registrationRows[0];

  if (!registration) {
    return json(
      {
        error:
          "ไม่พบคำขอสมัครสมาชิก"
      },
      404
    );
  }

  if (
    registration.registration_status !==
    "pending"
  ) {
    return json(
      {
        error:
          "คำขอนี้ไม่ได้อยู่ในสถานะรออนุมัติ"
      },
      400
    );
  }

  const membershipPlan =
    String(
      registration.membership_plan || ""
    ).trim();

  const isClassPass =
    membershipPlan.startsWith(
      "class_pass_"
    );

  if (isClassPass) {
    if (
      !Number.isInteger(totalSessions) ||
      totalSessions <= 0
    ) {
      return json(
        {
          error:
            "กรุณาระบุจำนวนครั้งทั้งหมด"
        },
        400
      );
    }

    if (
      !Number.isInteger(
        remainingSessions
      ) ||
      remainingSessions < 0 ||
      remainingSessions > totalSessions
    ) {
      return json(
        {
          error:
            "จำนวนครั้งคงเหลือไม่ถูกต้อง"
        },
        400
      );
    }
  }

  // เช็กว่ามีสมาชิก LINE คนนี้อยู่แล้วหรือไม่
  const existingMemberResponse =
    await fetch(
      `${supabaseUrl}/rest/v1/members` +
        `?line_user_id=eq.${encodeURIComponent(
          registration.line_user_id
        )}` +
        `&select=id` +
        `&limit=1`,
      {
        headers: supabaseHeaders
      }
    );

  if (!existingMemberResponse.ok) {
    const details =
      await existingMemberResponse.text();

    return json(
      {
        error:
          "ตรวจสอบสมาชิกเดิมไม่สำเร็จ",
        details
      },
      500
    );
  }

  const existingMembers =
    await existingMemberResponse.json();

  const memberPayload = {
    line_user_id:
      registration.line_user_id,

    display_name:
      registration.line_display_name ||
      [
        registration.first_name,
        registration.last_name
      ]
        .filter(Boolean)
        .join(" ") ||
      registration.nickname ||
      "สมาชิก",

    nickname:
      registration.nickname || null,

    phone:
      registration.phone || null,

    member_status: "active",

    membership_plan:
      membershipPlan || null,

    membership_start_date:
      membershipStartDate,

    membership_expiry_date:
      membershipExpiryDate,

    total_sessions:
      isClassPass
        ? totalSessions
        : null,

    remaining_sessions:
      isClassPass
        ? remainingSessions
        : null,

    is_guest: false,

    created_by: "owner"
  };

  let member;

  if (existingMembers.length > 0) {
    const memberId =
      existingMembers[0].id;

    const memberResponse = await fetch(
      `${supabaseUrl}/rest/v1/members` +
        `?id=eq.${memberId}`,
      {
        method: "PATCH",
        headers: supabaseHeaders,
        body: JSON.stringify(
          memberPayload
        )
      }
    );

    if (!memberResponse.ok) {
      const details =
        await memberResponse.text();

      return json(
        {
          error:
            "อัปเดตสมาชิกไม่สำเร็จ",
          details
        },
        500
      );
    }

    const rows =
      await memberResponse.json();

    member = rows[0];
  } else {
    const memberResponse = await fetch(
      `${supabaseUrl}/rest/v1/members`,
      {
        method: "POST",
        headers: supabaseHeaders,
        body: JSON.stringify(
          memberPayload
        )
      }
    );

    if (!memberResponse.ok) {
      const details =
        await memberResponse.text();

      return json(
        {
          error:
            "สร้างสมาชิกไม่สำเร็จ",
          details
        },
        500
      );
    }

    const rows =
      await memberResponse.json();

    member = rows[0];
  }

  if (!member?.id) {
    return json(
      {
        error:
          "อนุมัติแล้วแต่ไม่พบ Member ID"
      },
      500
    );
  }

  // ปิดคำขอสมัคร
  const approvalResponse = await fetch(
    `${supabaseUrl}/rest/v1/member_registration` +
      `?id=eq.${registrationId}`,
    {
      method: "PATCH",
      headers: supabaseHeaders,
      body: JSON.stringify({
        registration_status:
          "approved",

        approved_by:
          "owner",

        approved_at:
          new Date().toISOString(),

        coach_note:
          ownerNote || null
      })
    }
  );

  if (!approvalResponse.ok) {
    const details =
      await approvalResponse.text();

    return json(
      {
        error:
          "สร้างสมาชิกสำเร็จ แต่เปลี่ยนสถานะคำขอไม่สำเร็จ",
        member,
        details
      },
      500
    );
  }

  return json({
    success: true,
    message:
      "อนุมัติสมาชิกเรียบร้อยแล้ว",
    member
  });
}
const nickname =
        String(body.nickname || "").trim();

      const fullName =
        String(body.fullName || "").trim();

      const phone =
        String(body.phone || "").trim();

      const memberStatus =
        String(
          body.memberStatus || "active"
        ).trim();
        const membershipStartDate =
  String(body.membershipStartDate || "").trim();

const membershipExpiryDate =
  String(body.membershipExpiryDate || "").trim();

      const classIds = Array.isArray(
        body.classIds
      )
        ? body.classIds
            .map(Number)
            .filter(Number.isInteger)
        : [];

      if (!nickname && !fullName) {
        return json(
          {
            error:
              "กรุณากรอกชื่อเล่นหรือชื่อจริง"
          },
          400
        );
      }

      if (
        ![
          "active",
          "inactive",
          "suspended"
        ].includes(memberStatus)
      ) {
        return json(
          {
            error:
              "สถานะสมาชิกไม่ถูกต้อง"
          },
          400
        );
      }

      const supabaseHeaders = {
        apikey: supabaseSecretKey,
        Authorization:
          `Bearer ${supabaseSecretKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      };

      const memberResponse = await fetch(
        `${supabaseUrl}/rest/v1/members`,
        {
          method: "POST",
          headers: supabaseHeaders,
          body: JSON.stringify({
            nickname: nickname || null,
            full_name: fullName || null,
            phone: phone || null,
            member_status: memberStatus,
            membership_start_date:
            membershipStartDate || null,
            membership_expiry_date:
            membershipExpiryDate || null,
            is_guest: false
          })
        }
      );

      if (!memberResponse.ok) {
        const details =
          await memberResponse.text();

        return json(
          {
            error:
              "เพิ่มข้อมูลสมาชิกไม่สำเร็จ",
            details
          },
          500
        );
      }

      const createdMembers =
        await memberResponse.json();

      const member =
        createdMembers[0];

      if (!member?.id) {
        return json(
          {
            error:
              "เพิ่มสมาชิกแล้ว แต่ไม่พบ member id"
          },
          500
        );
      }

      let enrollments = [];

      if (classIds.length > 0) {
        const uniqueClassIds = [
          ...new Set(classIds)
        ];

        const enrollmentRows =
          uniqueClassIds.map(
            (classId) => ({
              member_id: member.id,
              class_id: classId,
              status: "active"
            })
          );

        const enrollmentResponse =
          await fetch(
            `${supabaseUrl}/rest/v1/member_classes`,
            {
              method: "POST",
              headers: supabaseHeaders,
              body: JSON.stringify(
                enrollmentRows
              )
            }
          );

        if (!enrollmentResponse.ok) {
          const details =
            await enrollmentResponse.text();

          return json(
            {
              error:
                "สร้างสมาชิกสำเร็จ แต่ลงทะเบียนคลาสไม่สำเร็จ",
              member,
              details
            },
            500
          );
        }

        enrollments =
          await enrollmentResponse.json();
      }

      return json({
        success: true,
        member,
        enrollments
      });
    } catch (error) {
  console.error("Create member error:", error);

  return json(
    {
      error: "ระบบเพิ่มสมาชิกเกิดข้อผิดพลาด",
      details:
        error && typeof error === "object" && "details" in error
          ? error.details
          : error instanceof Error
            ? error.message
            : String(error)
    },
    500
  );
}
  }
};