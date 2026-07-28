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
      const { idToken } = await request.json();

      if (!idToken) {
        return json({ error: "ไม่พบ LINE ID token" }, 400);
      }

      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
      const lineChannelId = process.env.LINE_CHANNEL_ID;

      if (!supabaseUrl || !supabaseSecretKey || !lineChannelId) {
        return json({ error: "ตั้งค่า Environment Variables ไม่ครบ" }, 500);
      }

      // ตรวจสอบ ID token กับ LINE
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

      const commonHeaders = {
        apikey: supabaseSecretKey,
        "Content-Type": "application/json",
        Accept: "application/json"
      };

      // ตรวจสอบว่าสมาชิกเคยมีข้อมูลหรือยัง
      const memberResponse = await fetch(
        `${supabaseUrl}/rest/v1/members?line_user_id=eq.${encodeURIComponent(
          lineUserId
        )}&select=id,line_user_id,display_name,checkin_count,last_checkin`,
        {
          headers: commonHeaders
        }
      );

      if (!memberResponse.ok) {
        const details = await memberResponse.text();
        return json({ error: "อ่านข้อมูลสมาชิกไม่สำเร็จ", details }, 500);
      }

      const members = await memberResponse.json();
      let member;

      if (members.length === 0) {
        // สมาชิกใหม่
        const insertResponse = await fetch(
          `${supabaseUrl}/rest/v1/members`,
          {
            method: "POST",
            headers: {
              ...commonHeaders,
              Prefer: "return=representation"
            },
            body: JSON.stringify({
              line_user_id: lineUserId,
              display_name: displayName,
              last_checkin: now,
              checkin_count: 1
            })
          }
        );

        if (!insertResponse.ok) {
          const details = await insertResponse.text();
          return json({ error: "เพิ่มสมาชิกไม่สำเร็จ", details }, 500);
        }

        [member] = await insertResponse.json();
      } else {
        // สมาชิกเดิม
        const oldMember = members[0];
        const newCount = Number(oldMember.checkin_count || 0) + 1;

        const updateResponse = await fetch(
          `${supabaseUrl}/rest/v1/members?id=eq.${oldMember.id}`,
          {
            method: "PATCH",
            headers: {
              ...commonHeaders,
              Prefer: "return=representation"
            },
            body: JSON.stringify({
              display_name: displayName,
              last_checkin: now,
              checkin_count: newCount
            })
          }
        );

        if (!updateResponse.ok) {
          const details = await updateResponse.text();
          return json({ error: "อัปเดตการเช็กอินไม่สำเร็จ", details }, 500);
        }

        [member] = await updateResponse.json();
      }

      return json({
        success: true,
        message: "เช็กอินสำเร็จ",
        displayName: member.display_name,
        checkinCount: member.checkin_count,
        checkedInAt: member.last_checkin
      });
    } catch (error) {
      return json(
        {
          error: "ระบบเกิดข้อผิดพลาด",
          details: error instanceof Error ? error.message : String(error)
        },
        500
      );
    }
  }
};