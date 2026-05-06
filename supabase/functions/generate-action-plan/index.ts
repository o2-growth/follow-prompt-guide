// Gera plano de ação estratégico via Lovable AI Gateway com tool calling.
// Recebe { tenant_id }, valida membership, monta contexto a partir do banco,
// chama IA com schema estruturado e persiste em ai_action_plans.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const tenant_id = String(body.tenant_id ?? "");
    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // verifica membership via RPC
    const { data: isMember } = await admin.rpc("is_member", { _tenant: tenant_id, _user: user.id });
    if (!isMember) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // marca como generating
    const { data: planRow, error: insErr } = await admin
      .from("ai_action_plans")
      .insert({ tenant_id, status: "generating", model: "google/gemini-2.5-pro" })
      .select()
      .single();
    if (insErr) throw insErr;
    const planId = planRow.id;

    // Coleta contexto
    const [tenantRes, visionRes, okrRes, maturityRes, recRes, projRes] = await Promise.all([
      admin.from("tenants").select("name,sector,size_band,revenue_band").eq("id", tenant_id).single(),
      admin.from("vision_plans").select("year_horizon,north_star,mission,values_json").eq("tenant_id", tenant_id),
      admin.from("okrs_objectives").select("title,quarter,key_results(title,target,current,unit)").eq("tenant_id", tenant_id),
      admin.from("maturity_assessments").select("dimension,score,taken_at").eq("tenant_id", tenant_id).order("taken_at", { ascending: false }),
      admin.from("maturity_recommendations").select("dimension,recommendation_md,priority").eq("tenant_id", tenant_id),
      admin.from("financial_projections").select("scenario,horizon_years,inputs_json").eq("tenant_id", tenant_id),
    ]);

    const latestMaturity: Record<string, number> = {};
    (maturityRes.data ?? []).forEach((a: any) => {
      if (latestMaturity[a.dimension] === undefined) latestMaturity[a.dimension] = a.score;
    });

    const context = {
      empresa: tenantRes.data,
      maturidade: latestMaturity,
      visao: visionRes.data ?? [],
      okrs: okrRes.data ?? [],
      recomendacoes_iniciais: recRes.data ?? [],
      projecoes_atuais: projRes.data ?? [],
    };

    const systemPrompt = `Voce e um estrategista senior do G4 Educacao + O2inc. Gera planos estrategicos PRATICOS e EXECUTIVOS para CEOs brasileiros. Tom: direto, formal, sem firula. Sempre em PT-BR. Foco em acao, numeros, prazos. Use frameworks consagrados (OKR, RACI, MEDDIC, SWOT, BSC, Eisenhower) quando relevante.`;

    const userPrompt = `Com base no contexto da empresa abaixo, gere um plano de acao estrategico completo. Use as pontuacoes de maturidade pra priorizar dimensoes fracas. Seja especifico: numeros, prazos, owners genericos (ex: "CEO", "Head Comercial"). Contexto:\n\n${JSON.stringify(context, null, 2)}`;

    const tool = {
      type: "function",
      function: {
        name: "submit_action_plan",
        description: "Submete o plano de acao estrategico estruturado",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            resumo_executivo: { type: "string", description: "Diagnostico em 3-5 frases sobre o estado atual e foco prioritario." },
            prioridades: {
              type: "array", description: "Top 5 prioridades estrategicas ordenadas",
              items: {
                type: "object", additionalProperties: false,
                properties: {
                  titulo: { type: "string" },
                  porque: { type: "string", description: "Por que e prioridade agora" },
                  impacto: { type: "string", enum: ["alto", "medio", "baixo"] },
                },
                required: ["titulo", "porque", "impacto"],
              },
            },
            frameworks_recomendados: {
              type: "array",
              items: {
                type: "object", additionalProperties: false,
                properties: {
                  nome: { type: "string", description: "Ex: OKR, RACI, MEDDIC, Eisenhower, SWOT, BSC" },
                  quando_usar: { type: "string" },
                  primeiro_passo: { type: "string" },
                },
                required: ["nome", "quando_usar", "primeiro_passo"],
              },
            },
            sugestoes_okrs: {
              type: "array", description: "OKRs sugeridos para o trimestre. Cada objetivo com KRs mensuraveis.",
              items: {
                type: "object", additionalProperties: false,
                properties: {
                  objetivo: { type: "string" },
                  por_que: { type: "string" },
                  key_results: {
                    type: "array",
                    items: {
                      type: "object", additionalProperties: false,
                      properties: {
                        kr: { type: "string", description: "KR mensuravel com numero e unidade" },
                        baseline: { type: "string" },
                        meta: { type: "string" },
                        kpi_acompanhamento: { type: "string" },
                      },
                      required: ["kr", "meta", "kpi_acompanhamento"],
                    },
                  },
                },
                required: ["objetivo", "por_que", "key_results"],
              },
            },
            sugestoes_visao: {
              type: "object", additionalProperties: false,
              properties: {
                north_star_refinado: { type: "string" },
                missao_refinada: { type: "string" },
                valores_sugeridos: { type: "array", items: { type: "string" } },
              },
              required: ["north_star_refinado", "missao_refinada", "valores_sugeridos"],
            },
            sugestoes_time: {
              type: "array", description: "Posicoes-chave a contratar/desenvolver nos proximos 6 meses",
              items: {
                type: "object", additionalProperties: false,
                properties: {
                  papel: { type: "string" },
                  area: { type: "string" },
                  por_que: { type: "string" },
                  prioridade: { type: "string", enum: ["urgente", "media", "baixa"] },
                },
                required: ["papel", "area", "por_que", "prioridade"],
              },
            },
            sugestoes_rituais: {
              type: "array",
              items: {
                type: "object", additionalProperties: false,
                properties: {
                  ritual: { type: "string" },
                  cadencia: { type: "string", description: "Ex: semanal segunda 9h" },
                  participantes: { type: "string" },
                  pauta_resumida: { type: "string" },
                },
                required: ["ritual", "cadencia", "participantes", "pauta_resumida"],
              },
            },
            projecao_ideal: {
              type: "object", additionalProperties: false,
              description: "Projecao financeira recomendada para os proximos 12 meses",
              properties: {
                premissas: { type: "string" },
                receita_meta_12m: { type: "string" },
                margem_ebitda_alvo: { type: "string" },
                principais_alavancas: { type: "array", items: { type: "string" } },
              },
              required: ["premissas", "receita_meta_12m", "margem_ebitda_alvo", "principais_alavancas"],
            },
            plano_90_dias: {
              type: "array", description: "Acoes executaveis nos proximos 90 dias",
              items: {
                type: "object", additionalProperties: false,
                properties: {
                  semana: { type: "string", description: "Ex: Semanas 1-2, Semana 5, Mes 3" },
                  acao: { type: "string" },
                  owner_sugerido: { type: "string" },
                  resultado_esperado: { type: "string" },
                },
                required: ["semana", "acao", "owner_sugerido", "resultado_esperado"],
              },
            },
          },
          required: [
            "resumo_executivo", "prioridades", "frameworks_recomendados",
            "sugestoes_okrs", "sugestoes_visao", "sugestoes_time",
            "sugestoes_rituais", "projecao_ideal", "plano_90_dias",
          ],
        },
      },
    };

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "submit_action_plan" } },
      }),
    });

    if (!aiResp.ok) {
      const errTxt = await aiResp.text();
      const status = aiResp.status === 429 ? 429 : aiResp.status === 402 ? 402 : 500;
      const message = aiResp.status === 429
        ? "Limite de requisicoes atingido. Tente novamente em alguns minutos."
        : aiResp.status === 402
        ? "Creditos de IA esgotados. Adicione creditos ao workspace."
        : `Falha na IA: ${errTxt.slice(0, 300)}`;
      await admin.from("ai_action_plans")
        .update({ status: "failed", error_message: message })
        .eq("id", planId);
      return new Response(JSON.stringify({ error: message }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    const argsStr = toolCall?.function?.arguments;
    if (!argsStr) {
      await admin.from("ai_action_plans")
        .update({ status: "failed", error_message: "IA nao retornou tool_call" })
        .eq("id", planId);
      throw new Error("IA nao retornou tool_call");
    }
    const parsed = JSON.parse(argsStr);

    await admin.from("ai_action_plans")
      .update({ status: "ready", content_json: parsed, generated_at: new Date().toISOString() })
      .eq("id", planId);

    return new Response(JSON.stringify({ id: planId, status: "ready", content: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-action-plan error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
