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
  },

  async createSignedUrl(bucket, filePath, expiresIn = 3600) {
    if (!bucket || !filePath) {
      return null;
    }

    const encodedPath = String(filePath)
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/");

    const response = await fetch(
      `${supabaseUrl}/storage/v1/object/sign/${bucket}/${encodedPath}`,
      {
        method: "POST",
        headers: {
          apikey: supabaseSecretKey,
          Authorization: `Bearer ${supabaseSecretKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expiresIn
        })
      }
    );

    if (!response.ok) {
      const details = await response.text();

      console.error(
        "Create signed URL failed:",
        details
      );

      return null;
    }

    const data = await response.json();

    if (!data.signedURL) {
      return null;
    }

    return `${supabaseUrl}/storage/v1${data.signedURL}`;
  }
};