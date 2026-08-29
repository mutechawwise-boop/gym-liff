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
      const accessKey =
        request.headers.get("x-admin-key");

      const isAdmin =
        process.env.ADMIN_KEY &&
        accessKey === process.env.ADMIN_KEY;

      const isOwner =
        process.env.OWNER_KEY &&
        accessKey === process.env.OWNER_KEY;

      if (!isAdmin && !isOwner) {
        return json(
          {
            error:
              "ไม่มีสิทธิ์เปลี่ยนสายของนักเรียน"
          },
          401
        );
      }

      const {
        memberId,
        beltLevelId,
        stripeCount,
        awardedDate,
        awardedBy,
        note
      } = await request.json();

      const parsedMemberId =
        Number(memberId);

      const parsedBeltLevelId =
        Number(beltLevelId);

      const parsedStripeCount =
        Number(stripeCount);

      if (
        !Number.isInteger(parsedMemberId) ||
        parsedMemberId <= 0
      ) {
        return json(
          { error: "ข้อมูลสมาชิกไม่ถูกต้อง" },
          400
        );
      }

      if (
        !Number.isInteger(
          parsedBeltLevelId
        ) ||
        parsedBeltLevelId <= 0
      ) {
        return json(
          { error: "กรุณาเลือกสาย" },
          400
        );
      }

      if (
        !Number.isInteger(
          parsedStripeCount
        ) ||
        parsedStripeCount < 0 ||
        parsedStripeCount > 4
      ) {
        return json(
          {
            error:
              "Rank Bar ต้องอยู่ระหว่าง 0–4 ขีด"
          },
          400
        );
      }

      if (
        !awardedDate ||
        !/^\d{4}-\d{2}-\d{2}$/.test(
          awardedDate
        )
      ) {
        return json(
          {
            error:
              "วันที่ได้รับสายไม่ถูกต้อง"
          },
          400
        );
      }

      const supabaseUrl =
        process.env.SUPABASE_URL;

      const secretKey =
        process.env.SUPABASE_SECRET_KEY;

      if (!supabaseUrl || !secretKey) {
        return json(
          {
            error:
              "ตั้งค่า Supabase ไม่ครบ"
          },
          500
        );
      }

      const headers = {
        apikey: secretKey,
        Authorization:
          `Bearer ${secretKey}`,
        "Content-Type":
          "application/json",
        Accept: "application/json"
      };

      // ตรวจสอบ Member
      const memberResponse =
        await fetch(
          `${supabaseUrl}/rest/v1/members` +
            `?id=eq.${parsedMemberId}` +
            `&select=id,display_name,full_name,nickname` +
            `&limit=1`,
          { headers }
        );

      if (!memberResponse.ok) {
        const details =
          await memberResponse.text();

        return json(
          {
            error:
              "ตรวจสอบข้อมูลสมาชิกไม่สำเร็จ",
            details
          },
          500
        );
      }

      const members =
        await memberResponse.json();

      if (!members.length) {
        return json(
          { error: "ไม่พบสมาชิก" },
          404
        );
      }

      // ตรวจสอบ Belt
      const beltResponse =
        await fetch(
          `${supabaseUrl}/rest/v1/belt_levels` +
            `?id=eq.${parsedBeltLevelId}` +
            `&active=eq.true` +
            `&select=id,code,name_th,rank_order,color_hex` +
            `&limit=1`,
          { headers }
        );

      if (!beltResponse.ok) {
        const details =
          await beltResponse.text();

        return json(
          {
            error:
              "ตรวจสอบข้อมูลสายไม่สำเร็จ",
            details
          },
          500
        );
      }

      const belts =
        await beltResponse.json();

      if (!belts.length) {
        return json(
          {
            error:
              "ไม่พบระดับสายที่เลือก"
          },
          404
        );
      }

      // เก็บประวัติสาย + Rank Bar
      const insertResponse =
        await fetch(
          `${supabaseUrl}/rest/v1/member_belt_history`,
          {
            method: "POST",
            headers: {
              ...headers,
              Prefer:
                "return=representation"
            },
            body: JSON.stringify({
              member_id:
                parsedMemberId,

              belt_level_id:
                parsedBeltLevelId,

              stripe_count:
                parsedStripeCount,

              awarded_date:
                awardedDate,

              awarded_by:
                String(
                  awardedBy || ""
                ).trim() ||
                (isOwner
                  ? "Owner"
                  : "Admin"),

              note:
                String(
                  note || ""
                ).trim() ||
                null
            })
          }
        );

      if (!insertResponse.ok) {
        const details =
          await insertResponse.text();

        return json(
          {
            error:
              "บันทึกระดับสายไม่สำเร็จ",
            details
          },
          500
        );
      }

      const historyRows =
        await insertResponse.json();

      return json({
        success: true,

        message:
          "บันทึกระดับสายและ Rank Bar เรียบร้อยแล้ว",

        member:
          members[0],

        belt:
          belts[0],

        stripeCount:
          parsedStripeCount,

        history:
          historyRows[0]
      });

    } catch (error) {
      return json(
        {
          error:
            "ระบบเปลี่ยนสายเกิดข้อผิดพลาด",

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