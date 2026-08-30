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
  attendanceResponse,
  beltLevelsResponse,
  currentBeltsResponse,
  beltHistoryResponse
] = await Promise.all([
 supabase.request(
  "members?select=id,display_name,nickname,member_status,member_group,membership_plan,membership_start_date,membership_expiry_date,total_sessions,remaining_sessions,is_guest,created_at"
),

  supabase.request(
    `class_sessions?select=id,start_time,end_time,class_id,classes(id,name)&session_date=eq.${today}`
  ),

  supabase.request(
    "attendance?select=id,session_id,member_id"
  ),

  supabase.request(
    "belt_levels" +
      "?active=eq.true" +
      "&select=id,code,name_th,rank_order,color_hex" +
      "&order=rank_order.asc"
  ),
supabase.request(
  "member_current_belts" +
    "?select=member_id,belt_level_id,belt_code,belt_name,color_hex,stripe_count,awarded_date"
),

supabase.request(
  "member_belt_history" +
    "?select=id,member_id,belt_level_id,stripe_count,awarded_date,awarded_by,note,belt_levels(id,code,name_th,color_hex)" +
    "&order=awarded_date.desc,id.desc"
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
if (!beltLevelsResponse.ok) {
  const errorText =
    await beltLevelsResponse.text();

  return json(
    {
      success: false,
      error: "โหลดระดับสายไม่สำเร็จ",
      details: errorText
    },
    500
  );
}
      const members = await membersResponse.json();
      const sessions = await sessionsResponse.json();
      const attendance = await attendanceResponse.json();
      const beltLevels = await beltLevelsResponse.json();
      if (!currentBeltsResponse.ok) {
  const errorText =
    await currentBeltsResponse.text();

  return json(
    {
      success: false,
      error:
        "โหลดข้อมูลสายปัจจุบันของสมาชิกไม่สำเร็จ",
      details: errorText
    },
    500
  );
}

const currentBelts =
  await currentBeltsResponse.json();
  if (!beltHistoryResponse.ok) {
  const details =
    await beltHistoryResponse.text();

  return json(
    {
      success: false,
      error:
        "โหลดประวัติระดับสายไม่สำเร็จ",
      details
    },
    500
  );
}

const beltHistory =
  await beltHistoryResponse.json();

const beltByMemberId = new Map(
  currentBelts.map((belt) => [
    Number(belt.member_id),
    belt
  ])
);

const membersWithBelts =
  members.map((member) => ({
    ...member,
    current_belt:
      beltByMemberId.get(Number(member.id)) ||
      null
  }));
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
// ==============================
// Dashboard การเงิน
// รวมสมัครสมาชิกใหม่ + ต่ออายุ
// ==============================

let finance = {
  todayRevenue: 0,
  monthRevenue: 0,
  todayCash: 0,
  todayTransfer: 0
};
let recentPayments = [];
let paymentHistory = [];

if (isOwner) {
  const [
    renewalFinanceResponse,
    registrationFinanceResponse
  ] = await Promise.all([
    // รายรับจากการต่ออายุ
    supabase.request(
  "membership_transactions" +
    "?payment_status=eq.paid" +
    "&select=id,member_id,amount,payment_method,approved_at,membership_plan,members(display_name,nickname)"
),
    // รายรับจากการสมัครสมาชิกใหม่
   supabase.request(
  "member_registration" +
  "?registration_status=eq.approved" +
  "&select=id,member_id,payment_amount,payment_method,approved_at,membership_plan,line_display_name,nickname,first_name,last_name"
)
  ]);

  if (!renewalFinanceResponse.ok) {
    const details =
      await renewalFinanceResponse.text();

    return json(
      {
        success: false,
        error:
          "โหลดข้อมูลการเงินจากการต่ออายุไม่สำเร็จ",
        details
      },
      500
    );
  }

  if (!registrationFinanceResponse.ok) {
    const details =
      await registrationFinanceResponse.text();

    return json(
      {
        success: false,
        error:
          "โหลดข้อมูลการเงินจากการสมัครสมาชิกไม่สำเร็จ",
        details
      },
      500
    );
  }

  const renewalTransactions =
    await renewalFinanceResponse.json();

  const registrationTransactions =
    await registrationFinanceResponse.json();

  // รวมข้อมูลให้อยู่ในรูปแบบเดียวกัน
const allTransactions = [
  ...renewalTransactions.map((item) => ({
    id: `renewal-${item.id}`,
    type: "renewal",
    memberId:
  Number(item.member_id),
    memberName:
      item.members?.display_name ||
      item.members?.nickname ||
      "สมาชิก",
    membershipPlan:
      item.membership_plan || "-",
    amount:
      Number(item.amount || 0),
    paymentMethod:
      item.payment_method || "",
    approvedAt:
      item.approved_at || null
  })),

  ...registrationTransactions.map((item) => ({
    id: `registration-${item.id}`,
    type: "registration",
    memberId:
    Number(item.member_id),
    memberName:
      item.nickname ||
      item.line_display_name ||
      [item.first_name, item.last_name]
        .filter(Boolean)
        .join(" ") ||
      "สมาชิก",
    membershipPlan:
      item.membership_plan || "-",
    amount:
      Number(item.payment_amount || 0),
    paymentMethod:
      item.payment_method || "",
    approvedAt:
      item.approved_at || null
  }))
];

  const currentMonth =
    today.slice(0, 7);

  finance = allTransactions.reduce(
    (summary, transaction) => {
      if (
        !transaction.amount ||
        !transaction.approvedAt
      ) {
        return summary;
      }

      const approvedDate =
        new Intl.DateTimeFormat(
          "en-CA",
          {
            timeZone: "Asia/Bangkok",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
          }
        ).format(
          new Date(
            transaction.approvedAt
          )
        );

      const approvedMonth =
        approvedDate.slice(0, 7);

      // รายรับเดือนนี้
      if (
        approvedMonth === currentMonth
      ) {
        summary.monthRevenue +=
          transaction.amount;
      }

      // รายรับวันนี้
      if (approvedDate === today) {
        summary.todayRevenue +=
          transaction.amount;

        if (
          transaction.paymentMethod ===
          "cash"
        ) {
          summary.todayCash +=
            transaction.amount;
        }

        if (
          transaction.paymentMethod ===
          "transfer"
        ) {
          summary.todayTransfer +=
            transaction.amount;
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
 recentPayments =
allTransactions
 .filter(
 (transaction) =>
 transaction.approvedAt
 ).sort(
(a, b) =>
 new Date(b.approvedAt) -
 new Date(a.approvedAt)
 )
.slice(0, 10);
paymentHistory =
  allTransactions
    .filter(
      (transaction) =>
        transaction.approvedAt &&
        transaction.memberId
    )
    .sort(
      (a, b) =>
        new Date(b.approvedAt) -
        new Date(a.approvedAt)
    );
}
   
return json({
        success: true,
        today,
        members: membersWithBelts.filter(
  (member) => !member.is_guest
),

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

recentPayments,

paymentHistory,

beltLevels,

beltHistory,

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