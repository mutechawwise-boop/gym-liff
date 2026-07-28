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