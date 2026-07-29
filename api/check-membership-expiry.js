import { supabase } from "./lib/supabase.js";
import { pushLineMessage } from "./lib/line.js";

export default {
    async fetch(request) {
        const json = (data, status = 200) =>
            new Response(JSON.stringify(data), {
                status,
                headers: {
                    "Content-Type": "application/json; charset=utf-8"
                }
            });

        try {
            return json({
                success: true,
                message: "Membership expiry engine พร้อมใช้งาน"
            });

        } catch (error) {

            return json({
                success: false,
                error: error.message
            },500);

        }
    }
};