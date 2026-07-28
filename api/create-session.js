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
          { error: "ไม่มีสิทธิ์เปิดคลาส" },
          401
        );
      }

      const {
        classId,
        startTime,
        endTime,
        note
      } = await request.json();

      const parsedClassId = Number(classId);

      if (
        !Number.isInteger(parsedClassId) ||
        parsedClassId <= 0
      ) {
        return json(
          { error: "กรุณาเลือกประเภทคลาส" },
          400
        );
      }

      if (
        !startTime ||
        !/^\d{2}:\d{2}$/.test(startTime)
      ) {
        return json(
          { error: "เวลาเริ่มไม่ถูกต้อง" },
          400
        );
      }

      if (
        !endTime ||
        !/^\d{2}:\d{2}$/.test(endTime)
      ) {
        return json(
          { error: "เวลาสิ้นสุดไม่ถูกต้อง" },
          400
        );
      }

      if (endTime <= startTime) {
        return json(
          { error: "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม" },
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

      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(new Date());

      // ตรวจว่ามีคลาสชนิดเดียวกัน เวลาเดียวกันแล้วหรือยัง
      const existingResponse = await fetch(
        `${supabaseUrl}/rest/v1/class_sessions` +
          `?class_id=eq.${parsedClassId}` +
          `&session_date=eq.${today}` +
          `&start_time=eq.${startTime}` +
          `&select=id,status` +
          `&limit=1`,
        { headers }
      );

      if (!existingResponse.ok) {
        const details = await existingResponse.text();

        return json(
          {
            error: "ตรวจสอบคลาสเดิมไม่สำเร็จ",
            details
          },
          500
        );
      }

      const existingSessions =
        await existingResponse.json();

      if (existingSessions.length > 0) {
        return json(
          {
            error: "คลาสนี้ถูกสร้างไว้แล้วในวันนี้"
          },
          409
        );
      }

      const insertResponse = await fetch(
        `${supabaseUrl}/rest/v1/class_sessions`,
        {
          method: "POST",
          headers: {
            ...headers,
            Prefer: "return=representation"
          },
          body: JSON.stringify({
            class_id: parsedClassId,
            session_date: today,
            start_time: startTime,
            end_time: endTime,
            status: "open",
            note: String(note || "").trim() || null
          })
        }
      );

      if (!insertResponse.ok) {
        const details = await insertResponse.text();

        return json(
          {
            error: "เปิดคลาสไม่สำเร็จ",
            details
          },
          500
        );
      }

      const createdSessions =
        await insertResponse.json();

      return json({
        success: true,
        message: "เปิดคลาสเรียบร้อยแล้ว",
        session: createdSessions[0]
      });
    } catch (error) {
      return json(
        {
          error: "ระบบเปิดคลาสเกิดข้อผิดพลาด",
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