import { pushLineMessage } from "./lib/line.js";

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

            const body = await request.json();
            const lineUserId = body?.lineUserId;

            if (!lineUserId) {
                return json(
                    { error: "กรุณาระบุ lineUserId" },
                    400
                );
            }

            await pushLineMessage(
                lineUserId,
                "ทดสอบระบบแจ้งเตือนจาก GAMBIT JIUJITSU 🥋"
            );

            return json({
                success: true,
                message: "ส่งข้อความทดสอบเรียบร้อยแล้ว"
            });
        } catch (error) {
            console.error(
                "LINE notification error:",
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