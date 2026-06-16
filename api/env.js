export default function handler(req, res) {
  // Returns the environment variables to the frontend securely via Vercel Serverless Function
  res.status(200).json({
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  });
}
