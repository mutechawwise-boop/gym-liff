// Shared server-side Coach authorization; never trust client-supplied user IDs.
export async function activeCoach(request) {
  const token = request.headers.get("x-line-id-token");
  if (!token || token.length > 8192 || !process.env.LINE_CHANNEL_ID) return null;
  const verified = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST", headers: {"Content-Type":"application/x-www-form-urlencoded"},
    body: new URLSearchParams({id_token:token, client_id:process.env.LINE_CHANNEL_ID})
  });
  if (!verified.ok) return null;
  const claims = await verified.json();
  if (!claims.sub || String(claims.aud) !== String(process.env.LINE_CHANNEL_ID)) return null;
  const url = process.env.SUPABASE_URL, secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("Supabase environment missing");
  const response = await fetch(`${url}/rest/v1/gym_coaches?line_user_id=eq.${encodeURIComponent(claims.sub)}&is_active=eq.true&select=id,display_name,role&limit=1`, {
    headers:{apikey:secret,Authorization:`Bearer ${secret}`}
  });
  if (!response.ok) throw new Error("Coach permission lookup failed");
  const rows = await response.json();
  return rows[0] || null;
}
