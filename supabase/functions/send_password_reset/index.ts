import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    // Find user by email
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();

    if (userError) {
      return new Response(
        JSON.stringify({ error: "Failed to find user" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const user = users.find(u => u.email === email);

    if (!user) {
      // Don't reveal if email exists or not for security
      return new Response(
        JSON.stringify({ message: "If an account exists, a reset link has been sent to your email" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Generate reset token
    const token = crypto.getRandomValues(new Uint8Array(32));
    const tokenString = Array.from(token)
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    // Store reset token (valid for 1 hour)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const { error: insertError } = await supabase
      .from("password_reset_tokens")
      .insert({
        user_id: user.id,
        email: email,
        token: tokenString,
        expires_at: expiresAt,
      });

    if (insertError) {
      return new Response(
        JSON.stringify({ error: "Failed to create reset token" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Here you would send an email with the reset link
    // For now, just return success
    console.log(`Password reset token created for ${email}: ${tokenString}`);

    return new Response(
      JSON.stringify({ message: "If an account exists, a reset link has been sent to your email" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
