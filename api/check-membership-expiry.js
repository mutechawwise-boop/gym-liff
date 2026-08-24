import {
  pushLineMessage,
  pushMemberCard
} from "./lib/line.js";

import { supabase } from "./lib/supabase.js";


function getBangkokDateString() {
  const parts =
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());

  const values =
    Object.fromEntries(
      parts.map((part) => [
        part.type,
        part.value
      ])
    );

  return `${values.year}-${values.month}-${values.day}`;
}


function calculateDaysRemaining(
  expiryDate,
  todayDate
) {
  const expiry =
    new Date(`${expiryDate}T00:00:00Z`);

  const today =
    new Date(`${todayDate}T00:00:00Z`);

  return Math.round(
    (expiry.getTime() - today.getTime()) /
      (1000 * 60 * 60 * 24)
  );
}


function getSessionCountFromPlan(
  membershipPlan
) {
  const plan =
    String(membershipPlan || "").trim();

  const match =
    plan.match(/^class_pass_(\d+)$/);

  if (!match) {
    return null;
  }

  const sessions =
    Number(match[1]);

  if (
    !Number.isInteger(sessions) ||
    sessions <= 0
  ) {
    return null;
  }

  return sessions;
}


async function updateMember(
  memberId,
  payload
) {
  const response =
    await supabase.request(
      `members?id=eq.${encodeURIComponent(
        memberId
      )}`,
      {
        method: "PATCH",
        headers: {
          Prefer: "return=representation"
        },
        body: JSON.stringify(payload)
      }
    );

  if (!response.ok) {
    const details =
      await response.text();

    throw new Error(
      `อัปเดตสมาชิกไม่สำเร็จ: ${details}`
    );
  }

  const rows =
    await response.json();

  return rows[0] || null;
}


async function updateTransaction(
  transactionId,
  payload
) {
  const response =
    await supabase.request(
      `membership_transactions?id=eq.${encodeURIComponent(
        transactionId
      )}`,
      {
        method: "PATCH",
        headers: {
          Prefer: "return=representation"
        },
        body: JSON.stringify(payload)
      }
    );

  if (!response.ok) {
    const details =
      await response.text();

    throw new Error(
      `อัปเดตรายการต่ออายุไม่สำเร็จ: ${details}`
    );
  }

  const rows =
    await response.json();

  return rows[0] || null;
}


async function updateNotificationDate(
  memberId,
  columnName
) {
  const response =
    await supabase.request(
      `members?id=eq.${encodeURIComponent(
        memberId
      )}`,
      {
        method: "PATCH",
        headers: {
          Prefer: "return=minimal"
        },
        body: JSON.stringify({
          [columnName]:
            new Date().toISOString()
        })
      }
    );

  if (!response.ok) {
    const errorText =
      await response.text();

    throw new Error(
      `อัปเดต ${columnName} ไม่สำเร็จ: ${errorText}`
    );
  }
}


/* =====================================
   ACTIVATE SCHEDULED RENEWALS
===================================== */

async function activateScheduledRenewals(
  today,
  results
) {
  const response =
    await supabase.request(
      "membership_transactions" +
        "?transaction_type=eq.renewal" +
        "&payment_status=eq.paid" +
        "&activated_at=is.null" +
        "&membership_start_date=not.is.null" +
        "&membership_expiry_date=not.is.null" +
        `&membership_start_date=lte.${today}` +
        "&select=*" +
        "&order=membership_start_date.asc,id.asc"
    );

  if (!response.ok) {
    const details =
      await response.text();

    throw new Error(
      `โหลดแพ็กที่รอเริ่มไม่สำเร็จ: ${details}`
    );
  }

  const renewals =
    await response.json();

  results.scheduledRenewals =
    renewals.length;

  for (const renewal of renewals) {
    try {
      const membershipPlan =
        String(
          renewal.membership_plan || ""
        ).trim();

      if (!membershipPlan) {
        throw new Error(
          "รายการต่ออายุไม่มี membership_plan"
        );
      }

      const isClassPass =
        membershipPlan.startsWith(
          "class_pass_"
        );

      let totalSessions = null;
      let remainingSessions = null;

      if (isClassPass) {
        const sessions =
          getSessionCountFromPlan(
            membershipPlan
          );

        if (!sessions) {
          throw new Error(
            "ไม่สามารถอ่านจำนวนครั้งจากแพ็กเกจ"
          );
        }

        totalSessions = sessions;
        remainingSessions = sessions;
      }

      const updatedMember =
        await updateMember(
          renewal.member_id,
          {
            member_status: "active",

            membership_plan:
              membershipPlan,

            membership_start_date:
              renewal.membership_start_date,

            membership_expiry_date:
              renewal.membership_expiry_date,

            total_sessions:
              isClassPass
                ? totalSessions
                : null,

            remaining_sessions:
              isClassPass
                ? remainingSessions
                : null,

            // เริ่มแพ็กใหม่
            // จึงเปิดรอบแจ้งเตือนใหม่ด้วย
            expiry_7_day_notified_at:
              null,

            expiry_1_day_notified_at:
              null,

            expiry_expired_notified_at:
              null
          }
        );

      // ต้องเปิดแพ็กสำเร็จก่อน
      // ถึงค่อยประทับ activated_at
      await updateTransaction(
        renewal.id,
        {
          activated_at:
            new Date().toISOString()
        }
      );

      results.activatedRenewals += 1;

      if (
        updatedMember &&
        renewal.line_user_id
      ) {
        try {
          await pushMemberCard(
            renewal.line_user_id,
            updatedMember,
            "✅ แพ็กสมาชิกใหม่เริ่มใช้งานแล้ว"
          );
        } catch (lineError) {
          results.errors.push({
            type: "activation_line",
            transactionId:
              renewal.id,
            memberId:
              renewal.member_id,
            error:
              lineError instanceof Error
                ? lineError.message
                : String(lineError)
          });
        }
      }

    } catch (renewalError) {
      results.errors.push({
        type: "activation",
        transactionId:
          renewal.id,
        memberId:
          renewal.member_id,
        error:
          renewalError instanceof Error
            ? renewalError.message
            : String(renewalError)
      });
    }
  }
}


/* =====================================
   CHECK CURRENT MEMBERSHIPS
===================================== */

async function checkCurrentMemberships(
  today,
  results
) {
  const response =
    await supabase.request(
      "members?select=" +
        [
          "id",
          "display_name",
          "full_name",
          "nickname",
          "line_user_id",
          "member_status",
          "membership_plan",
          "membership_start_date",
          "membership_expiry_date",
          "total_sessions",
          "remaining_sessions",
          "expiry_7_day_notified_at",
          "expiry_1_day_notified_at",
          "expiry_expired_notified_at"
        ].join(",")
    );

  if (!response.ok) {
    const errorText =
      await response.text();

    throw new Error(errorText);
  }

  const members =
    await response.json();

  results.checked =
    members.length;

  for (const member of members) {
    try {
      if (
        !member.membership_expiry_date
      ) {
        results.skipped += 1;
        continue;
      }

      const membershipPlan =
        String(
          member.membership_plan || ""
        );

      const isClassPass =
        membershipPlan.startsWith(
          "class_pass_"
        );

      const remainingSessions =
        Number(
          member.remaining_sessions ?? 0
        );

      const daysRemaining =
        calculateDaysRemaining(
          member.membership_expiry_date,
          today
        );

      /*
       * Class Pass หมดทันทีเมื่อ:
       * - ใช้ครบจำนวนครั้ง
       * หรือ
       * - ถึงวันหมดอายุ
       */
      const sessionsFinished =
        isClassPass &&
        remainingSessions <= 0;

      const dateExpired =
        daysRemaining <= 0;

      const membershipExpired =
        sessionsFinished ||
        dateExpired;

      const memberName =
        member.nickname ||
        member.display_name ||
        member.full_name ||
        "สมาชิก";


      /* =========================
         หมดสิทธิ์แล้ว
      ========================= */

      if (membershipExpired) {
        if (
          member.member_status !==
          "inactive"
        ) {
          await updateMember(
            member.id,
            {
              member_status: "inactive"
            }
          );
        }

        if (
          member.line_user_id &&
          !member.expiry_expired_notified_at
        ) {
          let reasonText =
            `สมาชิกของคุณหมดอายุแล้ว\nวันที่หมดอายุ: ${member.membership_expiry_date}`;

          if (
            sessionsFinished &&
            !dateExpired
          ) {
            reasonText =
              "แพ็กเกจของคุณใช้ครบจำนวนครั้งแล้ว";
          }

          await pushLineMessage(
            member.line_user_id,
            `🥋 GAMBIT JIUJITSU\n\n` +
              `สวัสดีคุณ ${memberName}\n` +
              `${reasonText}\n\n` +
              `หากมีแพ็กเกจใหม่ที่อนุมัติไว้แล้ว ระบบจะเปิดให้ตามวันที่เริ่มที่กำหนดครับ`
          );

          await updateNotificationDate(
            member.id,
            "expiry_expired_notified_at"
          );

          results.sentExpired += 1;
        }

        results.expiredMembers += 1;
        continue;
      }


      /* =========================
         ยังไม่หมดอายุ
      ========================= */

      if (
        member.member_status !==
        "active"
      ) {
        await updateMember(
          member.id,
          {
            member_status: "active"
          }
        );
      }


      /* =========================
         แจ้งก่อนหมด 7 วัน
      ========================= */

      if (
        daysRemaining === 7 &&
        !member.expiry_7_day_notified_at
      ) {
        if (member.line_user_id) {
          await pushLineMessage(
            member.line_user_id,
            `🥋 GAMBIT JIUJITSU\n\n` +
              `สวัสดีคุณ ${memberName}\n` +
              `สมาชิกของคุณจะหมดอายุในอีก 7 วัน\n` +
              `วันที่หมดอายุ: ${member.membership_expiry_date}\n\n` +
              `สามารถต่ออายุสมาชิกผ่านระบบได้ครับ`
          );

          await updateNotificationDate(
            member.id,
            "expiry_7_day_notified_at"
          );

          results.sent7Days += 1;
        }

        continue;
      }


      /* =========================
         แจ้งก่อนหมด 1 วัน
      ========================= */

      if (
        daysRemaining === 1 &&
        !member.expiry_1_day_notified_at
      ) {
        if (member.line_user_id) {
          await pushLineMessage(
            member.line_user_id,
            `🥋 GAMBIT JIUJITSU\n\n` +
              `สวัสดีคุณ ${memberName}\n` +
              `สมาชิกของคุณจะหมดอายุในวันพรุ่งนี้\n` +
              `วันที่หมดอายุ: ${member.membership_expiry_date}\n\n` +
              `สามารถต่ออายุสมาชิกผ่านระบบได้ครับ`
          );

          await updateNotificationDate(
            member.id,
            "expiry_1_day_notified_at"
          );

          results.sent1Day += 1;
        }

        continue;
      }

      results.skipped += 1;

    } catch (memberError) {
      results.errors.push({
        type: "membership_check",
        memberId: member.id,
        error:
          memberError instanceof Error
            ? memberError.message
            : String(memberError)
      });
    }
  }
}


export default {
  async fetch(request) {
    const json =
      (data, status = 200) =>
        new Response(
          JSON.stringify(data),
          {
            status,
            headers: {
              "Content-Type":
                "application/json; charset=utf-8",

              "Cache-Control":
                "no-store"
            }
          }
        );

    try {
      const today =
        getBangkokDateString();

      const results = {
        today,

        // Scheduled Renewal
        scheduledRenewals: 0,
        activatedRenewals: 0,

        // Current Membership
        checked: 0,
        expiredMembers: 0,
        sent7Days: 0,
        sent1Day: 0,
        sentExpired: 0,
        skipped: 0,

        errors: []
      };


      /*
       * สำคัญ:
       * เปิดแพ็กใหม่ก่อน
       * แล้วค่อยเช็กการหมดอายุ
       *
       * เช่นแพ็กเก่าหมด 31/08
       * และแพ็กใหม่เริ่ม 01/09
       * วันที่ 01/09 ระบบจะเปิดแพ็กใหม่ก่อน
       * จึงไม่ส่งข้อความหมดอายุของแพ็กเก่าซ้ำ
       */
      await activateScheduledRenewals(
        today,
        results
      );

      await checkCurrentMemberships(
        today,
        results
      );


      return json({
        success:
          results.errors.length === 0,

        ...results
      });

    } catch (error) {
      console.error(
        "Membership expiry / activation error:",
        error
      );

      return json(
        {
          success: false,

          error:
            error instanceof Error
              ? error.message
              : "เกิดข้อผิดพลาด"
        },
        500
      );
    }
  }
};