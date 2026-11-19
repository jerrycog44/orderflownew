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

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const tavilyKey = Deno.env.get("TAVILY_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (!tavilyKey || !openaiKey) {
      return json({ error: "Search and AI secrets are not configured." }, 503);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Authentication required." }, 401);

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) return json({ error: "Invalid session." }, 401);

    const { data: allowed } = await userClient.rpc("rh_is_staff");
    if (!allowed) return json({ error: "Staff access required." }, 403);

    const body = await req.json();
    const leadType = body.leadType;
    const area = String(body.area || "Ibadan").slice(0, 100);

    if (!["rider", "company", "both"].includes(leadType)) {
      return json({ error: "Choose rider, company, or both." }, 400);
    }

    const admin = createClient(url, service);
    const { data: run, error: runError } = await admin
      .from("rh_discovery_runs")
      .insert({
        agent_name: "public_web_discovery",
        lead_type: leadType,
        search_area: area,
        status: "running",
        started_by: userData.user.id,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (runError) throw runError;

    const searches = leadType === "both"
      ? [
          `delivery logistics companies dispatch services ${area} Nigeria official website`,
          `motorcycle delivery rider dispatch service ${area} Nigeria public business listing`,
        ]
      : leadType === "company"
      ? [`delivery logistics companies dispatch services ${area} Nigeria official website`]
      : [`motorcycle delivery rider dispatch service ${area} Nigeria public business listing`];

    const results: any[] = [];
    for (const query of searches) {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: tavilyKey,
          query,
          search_depth: "advanced",
          max_results: 8,
          include_answer: false,
        }),
      });
      if (!response.ok) throw new Error("Search provider request failed.");
      const data = await response.json();
      results.push(...(data.results || []));
    }

    const sources = results
      .filter((r) => r.url && r.title && r.content)
      .slice(0, 16)
      .map((r) => ({
        url: r.url,
        title: r.title,
        content: String(r.content).slice(0, 2500),
      }));

    if (!sources.length) {
      await admin.from("rh_discovery_runs").update({
        status: "completed",
        completed_at: new Date().toISOString(),
        search_summary: "No usable public sources found.",
      }).eq("id", run.id);
      return json({ runId: run.id, candidatesFound: 0 });
    }

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `Extract only real, clearly evidenced delivery recruitment prospects in ${area}, Nigeria.
Return JSON: {"candidates":[...]}.
Each candidate must have lead_type (rider or company), full_name, business_name, area,
public_phone, public_email, website, source_url, source_title, evidence_summary.
Use null for unknown fields. Never guess, infer, or fabricate details.
Only use the supplied source URLs. Do not use social media profiles, private personal details,
or scraped personal contact information. A rider is eligible only when the source explicitly
presents them as a delivery/dispatch service or publicly invites professional contact.
A company must have clear evidence of logistics, dispatch, or delivery services.
Exclude irrelevant, uncertain, duplicate, or unsupported results.`
          },
          {
            role: "user",
            content: JSON.stringify({ requestedType: leadType, sources }),
          },
        ],
      }),
    });

    if (!aiResponse.ok) throw new Error("AI verification request failed.");
    const aiData = await aiResponse.json();
    const parsed = JSON.parse(aiData.choices?.[0]?.message?.content || "{}");
    const sourceUrls = new Set(sources.map((s) => s.url));

    const candidates = (parsed.candidates || [])
      .filter((c: any) =>
        ["rider", "company"].includes(c.lead_type) &&
        sourceUrls.has(c.source_url) &&
        c.evidence_summary &&
        (c.lead_type === "rider" ? c.full_name : c.business_name)
      )
      .map((c: any) => ({
        run_id: run.id,
        lead_type: c.lead_type,
        full_name: c.lead_type === "rider" ? c.full_name : null,
        business_name: c.lead_type === "company" ? c.business_name : null,
        city: area,
        area: c.area || null,
        public_phone: null,
        public_email: null,
        website: c.website || null,
        source_type: "approved_directory",
        source_url: c.source_url,
        source_title: c.source_title || null,
        evidence_summary: String(c.evidence_summary).slice(0, 1000),
        verification_status: "pending",
        review_status: "pending",
      }));

    const { error: insertError } = candidates.length
      ? await admin.from("rh_discovery_candidates").insert(candidates)
      : { error: null };

    if (insertError) throw insertError;

    await admin.from("rh_discovery_runs").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      leads_found: candidates.length,
      search_summary: `Reviewed ${sources.length} public sources; queued ${candidates.length} candidates.`,
    }).eq("id", run.id);

    return json({ runId: run.id, sourcesReviewed: sources.length, candidatesFound: candidates.length });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Discovery failed." }, 500);
  }
});
