import { supabase } from "./lib/supabase.js";

function getBangkokDateString() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map(part => [part.type, part.value])
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
      return json(
        { success: false, error: "Method not allowed" },
        405
      );
    }

    try {
      const adminKey = request.headers.get("x-admin-key");

      if (
        !process.env.ADMIN_KEY ||
        adminKey !== process.env.ADMIN_KEY
      ) {
        return json(
          { success: false, error: "ไม่มีสิทธิ์ใช้งาน" },
          401
        );
      }

      const today = getBangkokDateString();

      const members = await supabase.request(
        "GET",
        "/members?select=id,name,membership_expiry_date&membership_expiry_date=not.is.null&order=membership_expiry_date.asc"
      );

      const expiringMembers = members
        .map(member => {
          const daysLeft = calculateDaysRemaining(
            member.membership_expiry_date,
            today
          );

          return {
            id: member.id,
            name: member.name,
            expiry_date: member.membership_expiry_date,
            daysLeft
          };
        })
        .filter(member => member.daysLeft >= 0 && member.daysLeft <= 7);

      return json({
        success: true,
        today,
        members: expiringMembers
      });
    } catch (error) {
      console.error("Admin expiring members error:", error);

      return json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "ไม่สามารถโหลดสมาชิกใกล้หมดอายุได้"
        },
        500
      );
    }
  }
};