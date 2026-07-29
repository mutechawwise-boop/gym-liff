import { supabase } from "./lib/supabase.js";
import { pushLineMessage } from "./lib/line.js";

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

async function updateNotificationDate(memberId, columnName) {
    const response = await supabase.request(
        `members?id=eq.${encodeURIComponent(memberId)}`,
        {
            method: "PATCH",
            headers: {
                Prefer: "return=minimal"
            },
            body: JSON.stringify({
                [columnName]: new Date().toISOString()
            })
        }
    );

    if (!response.ok) {
        const errorText = await response.text();

        throw new Error(
            `อัปเดต ${columnName} ไม่สำเร็จ: ${errorText}`
        );
    }
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

        try {
            const response = await supabase.request(
                "members?select=id,display_name,full_name,nickname,line_user_id,membership_expiry_date,expiry_7_day_notified_at,expiry_1_day_notified_at,expiry_expired_notified_at"
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

            const results = {
                checked: members.length,
                sent7Days: 0,
                sent1Day: 0,
                sentExpired: 0,
                skipped: 0,
                errors: []
            };

            for (const member of members) {
                if (
                    !member.line_user_id ||
                    !member.membership_expiry_date
                ) {
                    results.skipped += 1;
                    continue;
                }

                const daysRemaining = calculateDaysRemaining(
                    member.membership_expiry_date,
                    today
                );

                const memberName =
                    member.nickname ||
                    member.display_name ||
                    member.full_name ||
                    "สมาชิก";

                try {
                    if (
                        daysRemaining === 7 &&
                        !member.expiry_7_day_notified_at
                    ) {
                        await pushLineMessage(
                            member.line_user_id,
                            `🥋 GAMBIT JIUJITSU\n\nสวัสดีคุณ ${memberName}\nสมาชิกของคุณจะหมดอายุในอีก 7 วัน\nวันที่หมดอายุ: ${member.membership_expiry_date}\n\nกรุณาติดต่อยิมเพื่อต่ออายุสมาชิกครับ`
                        );

                        await updateNotificationDate(
                            member.id,
                            "expiry_7_day_notified_at"
                        );

                        results.sent7Days += 1;
                        continue;
                    }

                    if (
                        daysRemaining === 1 &&
                        !member.expiry_1_day_notified_at
                    ) {
                        await pushLineMessage(
                            member.line_user_id,
                            `🥋 GAMBIT JIUJITSU\n\nสวัสดีคุณ ${memberName}\nสมาชิกของคุณจะหมดอายุในวันพรุ่งนี้\nวันที่หมดอายุ: ${member.membership_expiry_date}\n\nกรุณาติดต่อยิมเพื่อต่ออายุสมาชิกครับ`
                        );

                        await updateNotificationDate(
                            member.id,
                            "expiry_1_day_notified_at"
                        );

                        results.sent1Day += 1;
                        continue;
                    }

                    if (
                        daysRemaining <= 0 &&
                        !member.expiry_expired_notified_at
                    ) {
                        await pushLineMessage(
                            member.line_user_id,
                            `🥋 GAMBIT JIUJITSU\n\nสวัสดีคุณ ${memberName}\nสมาชิกของคุณหมดอายุแล้ว\nวันที่หมดอายุ: ${member.membership_expiry_date}\n\nกรุณาติดต่อยิมเพื่อต่ออายุสมาชิกครับ`
                        );

                        await updateNotificationDate(
                            member.id,
                            "expiry_expired_notified_at"
                        );

                        results.sentExpired += 1;
                        continue;
                    }

                    results.skipped += 1;
                } catch (memberError) {
                    results.errors.push({
                        memberId: member.id,
                        error:
                            memberError instanceof Error
                                ? memberError.message
                                : "เกิดข้อผิดพลาด"
                    });
                }
            }

            return json({
                success: results.errors.length === 0,
                today,
                ...results
            });
        } catch (error) {
            console.error(
                "Membership expiry error:",
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