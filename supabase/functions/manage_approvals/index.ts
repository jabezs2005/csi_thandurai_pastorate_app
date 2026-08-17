import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // GET: list pending or all accounts
    if (req.method === "GET") {
      let query = supabase.from("profiles").select("*, church:churches(*)");

      if (action === "list") {
        // Only pending church admin accounts
        query = query
          .eq("is_approved", false)
          .eq("role", "church_admin")
          .order("created_at", { ascending: false });
      } else if (action === "list_all") {
        // All admin accounts
        query = query.order("role").order("full_name");
      } else {
        // Default: pending only
        query = query
          .eq("is_approved", false)
          .eq("role", "church_admin")
          .order("created_at", { ascending: false });
      }

      const { data, error } = await query;

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ accounts: data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST: approve or reject
    if (req.method === "POST") {
      const { action: postAction, account_id, admin_id } = await req.json();

      if (!account_id || !postAction) {
        return new Response(
          JSON.stringify({ error: "Missing required fields" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (postAction === "approve") {
        // Get the profile to find church_id
        const { data: profile } = await supabase
          .from("profiles")
          .select("email, church_id, role")
          .eq("id", account_id)
          .maybeSingle();

        // Update profile approval
        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            is_approved: true,
            approved_by: admin_id || null,
            approved_at: new Date().toISOString(),
          })
          .eq("id", account_id);

        if (updateError) {
          return new Response(
            JSON.stringify({ error: updateError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Update app_metadata to reflect approval
        if (profile) {
          await supabase.auth.admin.updateUserById(account_id, {
            app_metadata: {
              role: profile.role || "church_admin",
              church_id: profile.church_id || null,
              is_approved: true,
            },
          });
        }

        return new Response(
          JSON.stringify({ message: "Account approved successfully" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (postAction === "reject") {
        // Delete profile
        const { error: deleteError } = await supabase
          .from("profiles")
          .delete()
          .eq("id", account_id);

        if (deleteError) {
          return new Response(
            JSON.stringify({ error: deleteError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Delete auth user
        try {
          await supabase.auth.admin.deleteUser(account_id);
        } catch {
          // User may already be deleted
        }

        return new Response(
          JSON.stringify({ message: "Account rejected and deleted" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Invalid action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
