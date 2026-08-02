const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl) {
    throw new Error("SUPABASE_URL is missing");
}

if (!supabaseSecretKey) {
    throw new Error("SUPABASE_SECRET_KEY is missing");
}
const defaultHeaders = {
    apikey: supabaseSecretKey,
    "Content-Type": "application/json"
};

export const supabase = {
    async request(path, options = {}) {
        const response = await fetch(
            `${supabaseUrl}/rest/v1/${path}`,
            {
                ...options,
                headers: {
                    ...defaultHeaders,
                    ...(options.headers || {})
                }
            }
        );

        return response;
    }
};