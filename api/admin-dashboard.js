import { supabase } from "./lib/supabase.js";

function getBangkokDateString() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function calculateDaysRemaining(expiryDate, todayDate) {
  const expiry = new Date(`${expiryDate}T00:00:00Z`);
  const today = new Date(`${todayDate}T00:00:00Z`);

  return Math.round(
    (expiry.getTime() - today.getTime()) /
      (1000 * 60 * 60 * 24)
  );
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

    if (request.method !== "GET") {
      return json({ error: "Method not allowed" }, 405);
    }

    try {
      const adminKey = request.headers.get("x-admin-key");

const isCoach =
  process.env.ADMIN_KEY &&
  adminKey === process.env.ADMIN_KEY;

const isOwner =
  process.env.OWNER_KEY &&
  adminKey === process.env.OWNER_KEY;

if (!isCoach && !isOwner) {
  return json(
    {
      success: false,
      error: "ไม่มีสิทธิ์ใช้งาน"
    },
    401
  );
}

      const today = getBangkokDateString();

      const [
        membersResponse,
        sessionsResponse,
        attendanceResponse
      ] = await Promise.all([
        supabase.request(
          "members?select=id,display_name,membership_expiry_date,is_guest,created_at"
        ),
        supabase.request(
  `class_sessions?select=id,start_time,end_time,class_id,classes(id,name)&session_date=eq.${today}`
),
        supabase.request(
          "attendance?select=id,session_id,member_id"
        )
      ]);

      if (!membersResponse.ok) {
        const errorText = await membersResponse.text();

        return json(
          {
            success: false,
            error: errorText
          },
          500
        );
      }

      if (!sessionsResponse.ok) {
        const errorText = await sessionsResponse.text();

        return json(
          {
            success: false,
            error: errorText
          },
          500
        );
      }

      if (!attendanceResponse.ok) {
        const errorText = await attendanceResponse.text();

        return json(
          {
            success: false,
            error: errorText
          },
          500
        );
      }

      const members = await membersResponse.json();
      const sessions = await sessionsResponse.json();
      const attendance = await attendanceResponse.json();
      let pendingRegistrations = [];

if (isOwner) {
  const registrationResponse = await supabase.request(
    "member_registration" +
      "?select=" +
      [
        "id",
        "created_at",
        "line_user_id",
        "line_display_name",
        "line_picture_url",
        "first_name",
        "last_name",
        "nickname",
        "phone",
        "email",
        "birth_date",
        "gender",
        "medical_conditions",
        "allergies",
        "emergency_contact_name",
        "emergency_contact_relationship",
        "emergency_contact_phone",
        "membership_plan",
        "payment_method",
        "payment_status",
        "registration_status",
        "slip_url",
        "payment_amount"
      ].join(",") +
      "&registration_status=eq.pending" +
      "&order=created_at.desc"
  );

  if (!registrationResponse.ok) {
    const errorText =
      await registrationResponse.text();

    return json(
      {
        success: false,
        error:
          "โหลดคำขอสมัครสมาชิกไม่สำเร็จ",
        details: errorText
      },
      500
    );
  }

  const registrationRows =
  await registrationResponse.json();

pendingRegistrations =
  await Promise.all(
    registrationRows.map(async (registration) => {
      let slipSignedUrl = null;

      if (registration.slip_url) {
        slipSignedUrl =
          await supabase.createSignedUrl(
            "payment-slips",
            registration.slip_url,
            3600
          );
      }

      return {
        ...registration,
        slip_signed_url: slipSignedUrl
      };
    })
  );
}

      let activeMembers = 0;
      let expiringSoon = 0;
      let expiredMembers = 0;

      for (const member of members) {
        if (
          member.is_guest ||
          !member.membership_expiry_date
        ) {
          continue;
        }

        const daysRemaining = calculateDaysRemaining(
          member.membership_expiry_date,
          today
        );

        if (daysRemaining < 0) {
          expiredMembers += 1;
        } else {
          activeMembers += 1;

          if (daysRemaining <= 7) {
            expiringSoon += 1;
          }
        }
      }

      const expiringMembers = members
        .filter((member) => {
          if (
            member.is_guest ||
            !member.membership_expiry_date
          ) {
            return false;
          }

          const daysLeft = calculateDaysRemaining(
            member.membership_expiry_date,
            today
          );

          return daysLeft >= 0 && daysLeft <= 7;
        })
        .map((member) => ({
          id: member.id,
          name: member.display_name,
          expiry_date: member.membership_expiry_date,
          daysLeft: calculateDaysRemaining(
            member.membership_expiry_date,
            today
          )
        }));

      const todayNewMemberCount = members.filter((member) => {
        if (member.is_guest || !member.created_at) {
          return false;
        }

        return member.created_at.slice(0, 10) === today;
      }).length;

      const todaySessionIds = new Set(
        sessions.map((session) => Number(session.id))
      );

      const todayAttendance = attendance.filter((record) =>
        todaySessionIds.has(Number(record.session_id))
      );

      const classes = sessions.map((session) => {
        const attendanceCount = todayAttendance.filter(
          (record) =>
            Number(record.session_id) === Number(session.id)
        ).length;

        return {
          id: session.id,
          name:
            session.classes?.name ||
            `คลาส ${session.class_id || ""}`.trim(),
          startTime: session.start_time,
          endTime: session.end_time,
          attendanceCount
        };
      });
let pendingRenewals = [];

if (isOwner) {
  const renewalResponse = await supabase.request(
    "membership_transactions" +
      "?transaction_type=eq.renewal" +
      "&payment_status=eq.pending" +
      "&select=" +
      [
        "id",
        "member_id",
        "line_user_id",
        "transaction_type",
        "membership_plan",
        "amount",
        "payment_method",
        "payment_status",
        "slip_url",
        "requested_at",
        "members(id,display_name,nickname,member_group)"
      ].join(",") +
      "&order=requested_at.asc"
  );

  if (!renewalResponse.ok) {
    const details =
      await renewalResponse.text();

    return json(
      {
        success: false,
        error:
          "โหลดคำขอต่ออายุสมาชิกไม่สำเร็จ",
        details
      },
      500
    );
  }

 const renewalRows =
  await renewalResponse.json();

pendingRenewals =
  await Promise.all(
    renewalRows.map(async (renewal) => {
      let slipSignedUrl = null;

      if (renewal.slip_url) {
        slipSignedUrl =
          await supabase.createSignedUrl(
            "payment-slips",
            renewal.slip_url,
            3600
          );
      }

      return {
        ...renewal,
        slip_signed_url: slipSignedUrl
      };
    })
  );
}
let finance = {
  todayRevenue: 0,
  monthRevenue: 0,
  todayCash: 0,
  todayTransfer: 0
};

if (isOwner) {
  const monthStart =
    `${today.slice(0, 7)}-01`;

  const financeResponse =
    await supabase.request(
      "membership_transactions" +
        "?payment_status=eq.paid" +
        `&approved_at=gte.${monthStart}T00:00:00+07:00` +
        "&select=id,amount,payment_method,approved_at,transaction_type"
    );

  if (!financeResponse.ok) {
    const details =
      await financeResponse.text();

    return json(
      {
        success: false,
        error: "โหลดข้อมูลการเงินไม่สำเร็จ",
        details
      },
      500
    );
  }

  const financeTransactions =
    await financeResponse.json();

  finance =
    financeTransactions.reduce(
      (summary, transaction) => {
        const amount =
          Number(transaction.amount || 0);

        if (!amount) {
          return summary;
        }

        const approvedDate =
          transaction.approved_at
            ? new Intl.DateTimeFormat(
                "en-CA",
                {
                  timeZone: "Asia/Bangkok",
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit"
                }
              ).format(
                new Date(
                  transaction.approved_at
                )
              )
            : null;

        summary.monthRevenue += amount;

        if (approvedDate === today) {
          summary.todayRevenue += amount;

          if (
            transaction.payment_method ===
            "cash"
          ) {
            summary.todayCash += amount;
          }

          if (
            transaction.payment_method ===
            "transfer"
          ) {
            summary.todayTransfer += amount;
          }
        }

        return summary;
      },
      {
        todayRevenue: 0,
        monthRevenue: 0,
        todayCash: 0,
        todayTransfer: 0
      }
    );
}
      return json({
        success: true,
        today,

        totalMembers: members.filter(
          (member) => !member.is_guest
        ).length,
        activeMembers,
        expiringSoon,
        expiredMembers,
        expiringMembers,

        todayClassCount: sessions.length,
        todayAttendanceCount: todayAttendance.length,
        todayNewMemberCount,
        todayExpiringCount: expiringMembers.length,
        pendingRegistrationCount:
         pendingRegistrations.length,

       pendingRegistrations,
       pendingRenewalCount:
  pendingRenewals.length,

pendingRenewals,

finance,

classes
      });
    } catch (error) {
      console.error("Admin dashboard error:", error);

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