// Gera sugestoes IA por superficie (okrs, team, financial, rituals, vision).
// Recebe { tenant_id, surface }, valida membership, monta contexto,
// chama Lovable AI Gateway com tool calling e persiste em ai_suggestions.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Surface = "okrs" | "team" | "financial" | "rituals" | "vision";

const TOOLS: Record<Surface, any> = {
  okrs: {
    name: "submit_okrs",
    description: "Sugere objetivos, KRs e KPIs para o trimestre.",
    parameters: {
      type: "object", additionalProperties: false,
      properties: {
        diagnostico: { type: "string", description: "2-3 frases sobre estado atual de OKRs e foco." },
        objetivos: {
          type: "array", description: "3 objetivos para o proximo trimestre",
          items: {
            type: "object", additionalProperties: false,
            properties: {
              titulo: { type: "string" },
              por_que: { type: "string", description: "Conexao com a meta financeira/visao" },
              key_results: {
                type: "array",
                items: {
                  type: "object", additionalProperties: false,
                  properties: {
                    kr: { type: "string", description: "Mensuravel, com numero" },
                    baseline: { type: "string" },
                    meta: { type: "string" },
                    kpi_acompanhamento: { type: "string", description: "KPI semanal de leading indicator" },
                  },
                  required: ["kr", "meta", "kpi_acompanhamento"],
                },
              },
            },
            required: ["titulo", "por_que", "key_results"],
          },
        },
      },
      required: ["diagnostico", "objetivos"],
    },
  },
  team: {
    name: "submit_team",
    description: "Roadmap de contratacoes priorizado.",
    parameters: {
      type: "object", additionalProperties: false,
      properties: {
        diagnostico: { type: "string" },
        contratacoes: {
          type: "array",
          items: {
            type: "object", additionalProperties: false,
            properties: {
              papel: { type: "string" },
              area: { type: "string", enum: ["commercial","ops","finance","product","other"] },
              seniority: { type: "string", enum: ["junior","pleno","senior","head","c_level"] },
              janela: { type: "string", enum: ["0-6m","6-12m","12-24m"] },
              por_que: { type: "string", description: "Gargalo que destrava (receita, processo, etc)" },
              prioridade: { type: "string", enum: ["urgente","alta","media","baixa"] },
            },
            required: ["papel","area","seniority","janela","por_que","prioridade"],
          },
        },
      },
      required: ["diagnostico","contratacoes"],
    },
  },
  financial: {
    name: "submit_financial",
    description: "Leitura critica das premissas e cenario ideal 1/3/5 anos.",
    parameters: {
      type: "object", additionalProperties: false,
      properties: {
        diagnostico: { type: "string", description: "As premissas atuais sao realistas? Diga claramente." },
        riscos: { type: "array", items: { type: "string" } },
        alavancas: { type: "array", items: { type: "string" }, description: "Top alavancas para acelerar receita/margem" },
        cenario_ideal: {
          type: "object", additionalProperties: false,
          properties: {
            premissas_recomendadas: { type: "string" },
            ano_1: { type: "object", additionalProperties: false, properties: {
              receita_meta: { type: "string" }, margem_alvo: { type: "string" }, foco: { type: "string" },
            }, required: ["receita_meta","margem_alvo","foco"] },
            ano_3: { type: "object", additionalProperties: false, properties: {
              receita_meta: { type: "string" }, margem_alvo: { type: "string" }, foco: { type: "string" },
            }, required: ["receita_meta","margem_alvo","foco"] },
            ano_5: { type: "object", additionalProperties: false, properties: {
              receita_meta: { type: "string" }, margem_alvo: { type: "string" }, foco: { type: "string" },
            }, required: ["receita_meta","margem_alvo","foco"] },
          },
          required: ["premissas_recomendadas","ano_1","ano_3","ano_5"],
        },
      },
      required: ["diagnostico","riscos","alavancas","cenario_ideal"],
    },
  },
  rituals: {
    name: "submit_rituals",
    description: "Quais rituais ativar e em que ordem.",
    parameters: {
      type: "object", additionalProperties: false,
      properties: {
        diagnostico: { type: "string" },
        rituais: {
          type: "array",
          items: {
            type: "object", additionalProperties: false,
            properties: {
              ritual: { type: "string" },
              cadencia: { type: "string" },
              participantes: { type: "string" },
              ordem_implantacao: { type: "integer" },
              por_que: { type: "string" },
            },
            required: ["ritual","cadencia","participantes","ordem_implantacao","por_que"],
          },
        },
      },
      required: ["diagnostico","rituais"],
    },
  },
  vision: {
    name: "submit_vision",
    description: "Refino de visao 5/3/1 ano conectado a meta financeira.",
    parameters: {
      type: "object", additionalProperties: false,
      properties: {
        diagnostico: { type: "string" },
        horizonte_5: { type: "object", additionalProperties: false, properties: {
          north_star: { type: "string" }, missao: { type: "string" }, meta_financeira: { type: "string" }, valores: { type: "array", items: { type: "string" } },
        }, required: ["north_star","missao","meta_financeira","valores"] },
        horizonte_3: { type: "object", additionalProperties: false, properties: {
          north_star: { type: "string" }, missao: { type: "string" }, meta_financeira: { type: "string" },
        }, required: ["north_star","missao","meta_financeira"] },
        horizonte_1: { type: "object", additionalProperties: false, properties: {
          north_star: { type: "string" }, missao: { type: "string" }, meta_financeira: { type: "string" },
        }, required: ["north_star","missao","meta_financeira"] },
      },
      required: ["diagnostico","horizonte_5","horizonte_3","horizonte_1"],
    },
  },
};

const SURFACE_PROMPT: Record<Surface, string> = {
  okrs: "Gere 3 objetivos trimestrais. Cada um com 2-4 KRs mensuraveis (numero+unidade), baseline, meta e KPI de acompanhamento semanal. Conecte os objetivos a meta financeira realista do tenant.",
  team: "Gere roadmap de contratacoes para 0-6m, 6-12m e 12-24m. Priorize gargalos que destravam a meta financeira. Maximo 8 papeis no total.",
  financial: "Faca leitura critica e direta das premissas atuais. Se irrealista, fale. Sugira cenario ideal para 1, 3 e 5 anos com receita_meta e margem coerentes com o setor e estagio.",
  rituals: "Recomende quais rituais ativar primeiro e em que ordem, baseado em maturidade de rituais e tamanho de time. Maximo 6.",
  vision: "Refine North Star, Missao, Valores em 3 horizontes (5/3/1), conectando explicitamente cada um a meta financeira do horizonte.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const tenant_id = String(body.tenant_id ?? "");
    const surface = String(body.surface ?? "") as Surface;
    if (!tenant_id || !TOOLS[surface]) {
      return new Response(JSON.stringify({ error: "tenant_id and valid surface required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: isMember } = await admin.rpc("is_member", { _tenant: tenant_id, _user: user.id });
    if (!isMember) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // upsert pending
    await admin.from("ai_suggestions")
      .upsert({ tenant_id, surface, status: "generating", model: "google/gemini-2.5-pro", error_message: null }, { onConflict: "tenant_id,surface" });

    // Coleta contexto
    const [tenantRes, visionRes, okrRes, maturityRes, projRes, rolesRes, ritualsRes] = await Promise.all([
      admin.from("tenants").select("name,sector,size_band,revenue_band").eq("id", tenant_id).single(),
      admin.from("vision_plans").select("year_horizon,north_star,mission,values_json").eq("tenant_id", tenant_id),
      admin.from("okrs_objectives").select("title,quarter,key_results(title,target,current,unit)").eq("tenant_id", tenant_id),
      admin.from("maturity_assessments").select("dimension,score,taken_at").eq("tenant_id", tenant_id).order("taken_at", { ascending: false }),
      admin.from("financial_projections").select("scenario,horizon_years,inputs_json").eq("tenant_id", tenant_id),
      admin.from("rituals").select("kind,name,active").eq("tenant_id", tenant_id),
      admin.from("role_templates").select("area,role_name,seniority").limit(50),
    ]);

    const latestMaturity: Record<string, number> = {};
    (maturityRes.data ?? []).forEach((a: any) => {
      if (latestMaturity[a.dimension] === undefined) latestMaturity[a.dimension] = a.score;
    });

    const context = {
      empresa: tenantRes.data,
      maturidade: latestMaturity,
      visao_atual: visionRes.data ?? [],
      okrs_atuais: okrRes.data ?? [],
      projecoes: projRes.data ?? [],
      rituais_ativos: (ritualsRes.data ?? []).filter((r: any) => r.active),
      catalogo_papeis: rolesRes.data ?? [],
    };

    const systemPrompt = `Voce e um estrategista senior do G4 Educacao + O2inc para CEOs brasileiros. Tom direto, executivo, formal. Sempre PT-BR. Foque em numeros, prazos, owners genericos. Use frameworks consagrados quando fizer sentido.`;
    const userPrompt = `${SURFACE_PROMPT[surface]}\n\nContexto da empresa:\n${JSON.stringify(context, null, 2)}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{ type: "function", function: TOOLS[surface] }],
        tool_choice: { type: "function", function: { name: TOOLS[surface].name } },
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
      await admin.from("ai_suggestions")
        .update({ status: "failed", error_message: message })
        .eq("tenant_id", tenant_id).eq("surface", surface);
      return new Response(JSON.stringify({ error: message }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiJson = await aiResp.json();
    const argsStr = aiJson?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!argsStr) {
      await admin.from("ai_suggestions")
        .update({ status: "failed", error_message: "IA nao retornou tool_call" })
        .eq("tenant_id", tenant_id).eq("surface", surface);
      throw new Error("IA nao retornou tool_call");
    }
    const parsed = JSON.parse(argsStr);

    await admin.from("ai_suggestions")
      .update({ status: "ready", content_json: parsed, generated_at: new Date().toISOString() })
      .eq("tenant_id", tenant_id).eq("surface", surface);

    return new Response(JSON.stringify({ status: "ready", surface, content: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-suggest error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
