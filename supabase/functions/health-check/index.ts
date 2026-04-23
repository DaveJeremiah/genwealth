const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    
    return new Response(JSON.stringify({
      status: "healthy",
      timestamp: new Date().toISOString(),
      gemini_key_configured: !!GEMINI_API_KEY,
      method: req.method,
      auth_header: req.headers.get("authorization")?.substring(0, 20) + "..." || "none"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ 
      status: "error", 
      error: e instanceof Error ? e.message : "Unknown error" 
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
