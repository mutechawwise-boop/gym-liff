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
            const response = await supabase.request(
    "members?select=id,display_name,line_user_id,membership_expiry_date,expiry_7_day_notified_at,expiry_1_day_notified_at,expiry_expired_notified_at"
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

return json({
    success: true,
    count: members.length,
    members
});
        } catch (error) {

            return json({
                success: false,
                error: error.message
            },500);

        }
    }
};