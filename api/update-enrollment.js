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
      const expectedAdminKey = process.env.ADMIN_KEY;

      if (!expectedAdminKey) {
        return json(
          { error: "ยังไม่ได้ตั้งค่า ADMIN_KEY" },
          500
        );
      }

      if (!adminKey || adminKey !== expectedAdminKey) {
        return json(
          { error: "ไม่มีสิทธิ์ใช้งาน" },
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

      const body = await request.json();
     const mode = String(
  body.mode || "update_class"
).trim();
if (mode === "approve_renewal") {
  const renewalId = Number(body.renewalId);

  if (!Number.isInteger(renewalId) || renewalId <= 0) {
    return json(
      { error: "Renewal ID ไม่ถูกต้อง" },
      400
    );
  }

  const headers = {
    apikey: supabaseSecretKey,
    Authorization: `Bearer ${supabaseSecretKey}`,
    "Content-Type": "application/json",
    Prefer: "return=representation"
  };

  // อ่านคำขอต่ออายุ
  const renewalResponse = await fetch(
    `${supabaseUrl}/rest/v1/membership_transactions` +
      `?id=eq.${renewalId}` +
      `&transaction_type=eq.renewal` +
      `&select=*` +
      `&limit=1`,
    {
      headers
    }
  );

  if (!renewalResponse.ok) {
    const details = await renewalResponse.text();

    return json(
      {
        error: "อ่านคำขอต่ออายุไม่สำเร็จ",
        details
      },
      500
    );
  }

  const renewalRows =
    await renewalResponse.json();

  const renewal = renewalRows[0];

  if (!renewal) {
    return json(
      { error: "ไม่พบคำขอต่ออายุ" },
      404
    );
  }

  if (renewal.payment_status !== "pending") {
    return json(
      {
        error:
          "คำขอต่ออายุนี้ไม่ได้อยู่ในสถานะรอตรวจสอบ"
      },
      400
    );
  }

  const membershipPlan =
    String(
      renewal.membership_plan || ""
    ).trim();

  const isClassPass =
    membershipPlan.startsWith("class_pass_");

  let totalSessions = null;
  let remainingSessions = null;

  if (isClassPass) {
    const sessionMatch =
      membershipPlan.match(/^class_pass_(\d+)$/);

    const sessions =
      sessionMatch
        ? Number(sessionMatch[1])
        : 0;

    if (!Number.isInteger(sessions) || sessions <= 0) {
      return json(
        {
          error:
            "ไม่สามารถอ่านจำนวนครั้งจากแพ็กเกจได้"
        },
        400
      );
    }

    totalSessions = sessions;
    remainingSessions = sessions;
  }

  // อ่าน Member ปัจจุบัน
  const memberResponse = await fetch(
    `${supabaseUrl}/rest/v1/members` +
      `?id=eq.${renewal.member_id}` +
      `&select=*` +
      `&limit=1`,
    {
      headers
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

  const memberRows =
    await memberResponse.json();

  const member = memberRows[0];

  if (!member) {
    return json(
      { error: "ไม่พบข้อมูลสมาชิก" },
      404
    );
  }

  const today = new Date();

  const startDate =
    today.toISOString().slice(0, 10);

  const expiryDateObj =
    new Date(today);

  expiryDateObj.setMonth(
    expiryDateObj.getMonth() + 1
  );

  const expiryDate =
    expiryDateObj.toISOString().slice(0, 10);

  // อัปเดตสมาชิก
  const updateMemberResponse = await fetch(
    `${supabaseUrl}/rest/v1/members` +
      `?id=eq.${renewal.member_id}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        member_status: "active",
        membership_plan: membershipPlan,
        membership_start_date: startDate,
        membership_expiry_date: expiryDate,
        total_sessions: isClassPass
          ? totalSessions
          : null,
        remaining_sessions: isClassPass
          ? remainingSessions
          : null
      })
    }
  );

  if (!updateMemberResponse.ok) {
    const details =
      await updateMemberResponse.text();

    return json(
      {
        error:
          "อัปเดตข้อมูลสมาชิกไม่สำเร็จ",
        details
      },
      500
    );
  }

  // ปิดคำขอต่ออายุ
  const approveResponse = await fetch(
    `${supabaseUrl}/rest/v1/membership_transactions` +
      `?id=eq.${renewalId}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        payment_status: "paid",
        approved_at:
          new Date().toISOString(),
        approved_by: "owner"
      })
    }
  );

  if (!approveResponse.ok) {
    const details =
      await approveResponse.text();

    return json(
      {
        error:
          "ต่ออายุสมาชิกสำเร็จ แต่เปลี่ยนสถานะรายการไม่สำเร็จ",
        details
      },
      500
    );
  }

  return json({
    success: true,
    message:
      "อนุมัติการต่ออายุสมาชิกเรียบร้อยแล้ว"
  });
}
      const memberId = Number(body.memberId);
      const classId = Number(body.classId);
      const status = body.status;

      if (!memberId || !classId) {
        return json(
          {
            error:
              "memberId หรือ classId ไม่ถูกต้อง"
          },
          400
        );
      }

      if (!["active", "inactive"].includes(status)) {
        return json(
          {
            error:
              "สถานะต้องเป็น active หรือ inactive"
          },
          400
        );
      }

      const headers = {
        apikey: supabaseSecretKey,
        Authorization: `Bearer ${supabaseSecretKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation"
      };

      const response = await fetch(
        `${supabaseUrl}/rest/v1/member_classes` +
          `?on_conflict=member_id,class_id`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            member_id: memberId,
            class_id: classId,
            status
          })
        }
      );

      if (!response.ok) {
        const details = await response.text();

        return json(
          {
            error:
              "บันทึกการลงทะเบียนคลาสไม่สำเร็จ",
            details
          },
          500
        );
      }

      const enrollment = await response.json();

      return json({
        success: true,
        enrollment
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