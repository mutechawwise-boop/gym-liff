import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl) {
    throw new Error("SUPABASE_URL is missing");
}

if (!supabaseKey) {
    throw new Error("SUPABASE_SECRET_KEY is missing");
}

export const supabase = createClient(
    supabaseUrl,
    supabaseKey
);