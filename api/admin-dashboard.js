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
                    "Content-Type":
                        "application/json; charset=utf-8",
                    "Cache-Control": "no-store"
                }
            });

        if (request.method !== "GET") {
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

            const response = await supabase.request(
                "members?select=id,membership_expiry_date,is_guest"
            );

            if (!response.ok) {
                const errorText = await response.text();

                return json(
                    {
                        success: false,
                        error: errorText
                    },
                    500
                );
            }

            const members = await response.json();
            const today = getBangkokDateString();

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
  .filter(member => {
    if (!member.membership_expiry_date) return false;

    const expiry = new Date(member.membership_expiry_date);
    const todayDate = new Date();

    const daysLeft = Math.ceil(
      (expiry - todayDate) / (1000 * 60 * 60 * 24)
    );

    return daysLeft >= 0 && daysLeft <= 7;
  })
  .map(member => {
    const expiry = new Date(member.membership_expiry_date);
    const todayDate = new Date();

    const daysLeft = Math.ceil(
      (expiry - todayDate) / (1000 * 60 * 60 * 24)
    );

    return {
      id: member.id,
      name: member.name,
      expiry_date: member.membership_expiry_date,
      daysLeft
    };
  });
   return json({
  success: true,
  today,
  totalMembers: members.filter(
  member => !member.is_guest
).length,
  activeMembers,
  expiringSoon,
  expiredMembers,
  expiringMembers
});
        } catch (error) {
            console.error(
                "Admin dashboard error:",
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