import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { user_id, email, role, church_id, full_name, mobile, is_approved } = await req.json();

    if (!user_id || !email || !role) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    // Set role and church_id in app_metadata so JWT contains them (avoids RLS recursion)
    const { error: metaError } = await supabase.auth.admin.updateUserById(user_id, {
      app_metadata: {
        role,
        church_id: church_id || null,
        is_approved: is_approved ?? false,
      },
    });

    if (metaError) {
      console.error("Failed to update app_metadata:", metaError);
      // Continue anyway - profile creation is more important
    }

    // Create profile using service role (bypasses RLS)
    const { error: profileError } = await supabase.from("profiles").insert({
      id: user_id,
      email,
      mobile: mobile || "",
      role,
      church_id: church_id || null,
      full_name: full_name || "",
      is_approved: is_approved ?? false,
    });

    if (profileError) {
      // If profile already exists, try update instead
      if (profileError.code === "23505") {
        const { error: updateError } = await supabase.from("profiles").update({
          email,
          mobile: mobile || "",
          role,
          church_id: church_id || null,
          full_name: full_name || "",
          is_approved: is_approved ?? false,
        }).eq("id", user_id);

        if (updateError) {
          return new Response(
            JSON.stringify({ error: updateError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        return new Response(
          JSON.stringify({ error: profileError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ message: "Account created successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
