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
const mode = String(body.mode || "admin_create").trim();
if (mode !== "line_register") {
  const adminKey =
    request.headers.get("x-admin-key");

  const expectedAdminKey =
    process.env.ADMIN_KEY;

  if (!expectedAdminKey) {
    return json(
      { error: "ยังไม่ได้ตั้งค่า ADMIN_KEY" },
      500
    );
  }

  if (
    !adminKey ||
    adminKey !== expectedAdminKey
  ) {
    return json(
      {
        error: "ไม่มีสิทธิ์ใช้งานหน้า Admin"
      },
      401
    );
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
      return json(
        {
          error:
            "ระบบเพิ่มสมาชิกเกิดข้อผิดพลาด",
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