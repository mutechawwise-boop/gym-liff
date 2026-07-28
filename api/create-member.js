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
            error:
              "ไม่มีสิทธิ์ใช้งานหน้า Admin"
          },
          401
        );
      }

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