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

      if (
        !process.env.ADMIN_KEY ||
        adminKey !== process.env.ADMIN_KEY
      ) {
        return json(
          { error: "ไม่มีสิทธิ์ใช้งาน" },
          401
        );
      }

      const channelAccessToken =
        process.env.LINE_CHANNEL_ACCESS_TOKEN;

      if (!channelAccessToken) {
        return json(
          {
            error:
              "ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN"
          },
          500
        );
      }

      const body = await request.json();

      const lineUserId =
        String(body.lineUserId || "").trim();

      if (!lineUserId) {
        return json(
          { error: "กรุณาระบุ LINE user ID" },
          400
        );
      }

      const lineResponse = await fetch(
        "https://api.line.me/v2/bot/message/push",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization:
              `Bearer ${channelAccessToken}`
          },
          body: JSON.stringify({
            to: lineUserId,
            messages: [
              {
                type: "text",
                text:
                  "🥋 GAMBIT JIUJITSU\n\n" +
                  "ทดสอบระบบแจ้งเตือนสำเร็จครับ"
              }
            ]
          })
        }
      );

      if (!lineResponse.ok) {
        const details =
          await lineResponse.text();

        return json(
          {
            error:
              "LINE ส่งข้อความไม่สำเร็จ",
            details
          },
          lineResponse.status
        );
      }

      return json({
        success: true,
        message:
          "ส่งข้อความทดสอบเรียบร้อยแล้ว"
      });
    } catch (error) {
      return json(
        {
          error:
            "ระบบทดลองส่ง LINE เกิดข้อผิดพลาด",
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