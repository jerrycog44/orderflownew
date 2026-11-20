import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  let admin: any = null;
  let runId: string | null = null;

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const tavilyKey = Deno.env.get("TAVILY_API_KEY");

    if (!url || !anon || !service)
      return json({ error: "Supabase secrets are missing." }, 500);

    if (!tavilyKey)
      return json({ error: "TAVILY_API_KEY is not configured." }, 503);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader)
      return json({ error: "Authentication required." }, 401);

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user)
      return json({ error: "Invalid session." }, 401);

    const { data: allowed } = await userClient.rpc("rh_is_staff");
    if (!allowed)
      return json({ error: "Staff access required." }, 403);

    const body = await req.json();
    const leadType = body.leadType;
    const area = String(body.area || "Ibadan").trim().slice(0, 100);

    if (!["rider", "company", "both"].includes(leadType))
      return json({ error: "Choose rider, company, or both." }, 400);

    admin = createClient(url, service);

    const { data: run, error: runError } = await admin
      .from("rh_discovery_runs")
      .insert({
        agent_name: "tavily_public_source_discovery",
        lead_type: leadType,
        search_area: area,
        status: "running",
        started_by: userData.user.id,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (runError) throw runError;
    runId = run.id;

    const searches = leadType === "both"
      ? [
          {
            type: "company",
            query: `delivery logistics dispatch companies ${area} Nigeria official website`,
          },
          {
            type: "rider",
            query: `motorcycle dispatch rider delivery services ${area} Nigeria public directory`,
          },
        ]
      : leadType === "company"
      ? [{
          type: "company",
          query: `delivery logistics dispatch companies ${area} Nigeria official website`,
        }]
      : [{
          type: "rider",
          query: `motorcycle dispatch rider delivery services ${area} Nigeria public directory`,
        }];

    const sources: any[] = [];

    for (const search of searches) {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: tavilyKey,
          query: search.query,
          search_depth: "advanced",
          max_results: 8,
          include_answer: false,
        }),
      });

      if (!response.ok)
        throw new Error(`Tavily search failed (${response.status}).`);

      const data = await response.json();

      for (const result of data.results || []) {
        if (!result.url || !result.title || !result.content) continue;

        sources.push({
          run_id: run.id,
          lead_type: search.type,
          source_url: result.url,
          source_title: String(result.title).slice(0, 500),
          evidence_summary: String(result.content).slice(0, 1500),
          search_query: search.query,
          review_status: "pending",
        });
      }
    }

    const unique = [
      ...new Map(sources.map((s) => [s.source_url, s])).values(),
    ].slice(0, 16);

    if (unique.length) {
      const { error } = await admin
        .from("rh_discovery_sources")
        .insert(unique);

      if (error) throw error;
    }

    await admin.from("rh_discovery_runs").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      leads_found: 0,
      search_summary:
        `Tavily returned ${unique.length} public source pages. These are unverified sources, not confirmed riders or companies.`,
    }).eq("id", run.id);

    return json({
      runId: run.id,
      sourcesFound: unique.length,
      candidatesFound: 0,
      message:
        "Public sources saved for human review. No rider identities or contact details were guessed.",
    });
  } catch (error) {
    if (admin && runId) {
      await admin.from("rh_discovery_runs").update({
        status: "failed",
        completed_at: new Date().toISOString(),
        search_summary: "Discovery failed. Please check configuration and retry.",
      }).eq("id", runId);
    }

    return json({
      error: error instanceof Error ? error.message : "Discovery failed.",
    }, 500);
  }
});
