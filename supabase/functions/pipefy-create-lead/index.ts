// Cria card no Pipefy após signup. Não bloqueia signup em caso de falha.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PIPE_ID = "304018800";
const TARGET_PHASE_NAME = "Eventos";
const ORIGEM_LEAD = "G4 São Paulo - 6 de Maio";
const TIPO_ORIGEM = "Eventos";

const PIPEFY_URL = "https://api.pipefy.com/graphql";

type FieldMap = { id: string; label: string };

let cachedSchema:
  | { phaseId: string | null; fields: FieldMap[]; fetchedAt: number }
  | null = null;

async function pipefy(token: string, query: string, variables?: unknown) {
  const r = await fetch(PIPEFY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await r.json();
  if (!r.ok || json.errors) {
    throw new Error(
      `Pipefy ${r.status}: ${JSON.stringify(json.errors ?? json)}`,
    );
  }
  return json.data;
}

async function getSchema(token: string) {
  if (cachedSchema && Date.now() - cachedSchema.fetchedAt < 10 * 60 * 1000) {
    return cachedSchema;
  }
  const data = await pipefy(
    token,
    `query($id: ID!){ pipe(id:$id){ phases{ id name } start_form_fields{ id label } } }`,
    { id: PIPE_ID },
  );
  const phases: Array<{ id: string; name: string }> = data.pipe.phases ?? [];
  const fields: FieldMap[] = data.pipe.start_form_fields ?? [];
  const phase = phases.find(
    (p) => p.name.trim().toLowerCase() === TARGET_PHASE_NAME.toLowerCase(),
  );
  cachedSchema = {
    phaseId: phase?.id ?? null,
    fields,
    fetchedAt: Date.now(),
  };
  return cachedSchema;
}

function findFieldId(fields: FieldMap[], candidates: string[]): string | null {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  for (const c of candidates.map(norm)) {
    const m = fields.find((f) => norm(f.label) === c);
    if (m) return m.id;
    const partial = fields.find((f) => norm(f.label).includes(c));
    if (partial) return partial.id;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const respond = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return respond(401, { ok: false, error: "Unauthorized" });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const PIPEFY_TOKEN = Deno.env.get("PIPEFY_API_TOKEN");

    if (!PIPEFY_TOKEN) {
      return respond(200, { ok: false, error: "PIPEFY_API_TOKEN missing" });
    }

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return respond(401, { ok: false, error: "Invalid token" });
    }
    const userId = userData.user.id;
    const email = userData.user.email ?? undefined;

    const admin = createClient(SUPABASE_URL, SERVICE);

    const { data: profile } = await admin
      .from("user_profiles")
      .select("full_name, phone")
      .eq("id", userId)
      .maybeSingle();

    const { data: tenantRow } = await admin
      .from("memberships")
      .select("tenant_id, tenants(name)")
      .eq("user_id", userId)
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const fullName = profile?.full_name ?? email ?? "Lead";
    const phone = profile?.phone ?? "";
    const companyName =
      (tenantRow?.tenants as { name?: string } | null)?.name ?? "";
    const tenantId = tenantRow?.tenant_id ?? null;

    const schema = await getSchema(PIPEFY_TOKEN);

    const fId = {
      nome: findFieldId(schema.fields, ["Nome", "Nome completo", "Name"]),
      email: findFieldId(schema.fields, ["E-mail", "Email"]),
      telefone: findFieldId(schema.fields, ["Telefone", "Phone", "WhatsApp"]),
      empresa: findFieldId(schema.fields, ["Empresa", "Company"]),
      tipoOrigem: findFieldId(schema.fields, [
        "Tipo de Origem do lead",
        "Tipo de origem",
        "Tipo de Origem",
      ]),
      origem: findFieldId(schema.fields, [
        "Origem do lead",
        "Origem",
        "Lead source",
      ]),
    };

    const fieldsAttrs: Array<{ field_id: string; field_value: string }> = [];
    if (fId.nome) fieldsAttrs.push({ field_id: fId.nome, field_value: fullName });
    if (fId.email && email)
      fieldsAttrs.push({ field_id: fId.email, field_value: email });
    if (fId.telefone && phone)
      fieldsAttrs.push({ field_id: fId.telefone, field_value: phone });
    if (fId.empresa && companyName)
      fieldsAttrs.push({ field_id: fId.empresa, field_value: companyName });
    if (fId.tipoOrigem)
      fieldsAttrs.push({ field_id: fId.tipoOrigem, field_value: TIPO_ORIGEM });
    if (fId.origem)
      fieldsAttrs.push({ field_id: fId.origem, field_value: ORIGEM_LEAD });

    const mutation = `
      mutation($input: CreateCardInput!){
        createCard(input: $input){ card { id title } }
      }`;

    const input: Record<string, unknown> = {
      pipe_id: PIPE_ID,
      title: `${fullName}${companyName ? " · " + companyName : ""}`,
      fields_attributes: fieldsAttrs,
    };
    if (schema.phaseId) input.phase_id = schema.phaseId;

    const result = await pipefy(PIPEFY_TOKEN, mutation, { input });
    const cardId = result?.createCard?.card?.id;

    if (tenantId) {
      try {
        await admin.from("audit_log").insert({
          tenant_id: tenantId,
          user_id: userId,
          action: "pipefy_card_created",
          entity_type: "pipefy_card",
          entity_id: null,
          payload_json: { card_id: cardId, phase: TARGET_PHASE_NAME },
        });
      } catch (_) { /* ignore */ }
    }

    return respond(200, { ok: true, card_id: cardId });
  } catch (err) {
    console.error("pipefy-create-lead error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    // Best-effort audit
    try {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
      const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const authHeader = req.headers.get("Authorization") ?? "";
      const token = authHeader.replace("Bearer ", "");
      if (token) {
        const admin = createClient(SUPABASE_URL, SERVICE);
        const userClient = createClient(
          SUPABASE_URL,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } },
        );
        const { data: ud } = await userClient.auth.getUser();
        const uid = ud?.user?.id;
        if (uid) {
          const { data: tr } = await admin
            .from("memberships")
            .select("tenant_id")
            .eq("user_id", uid)
            .limit(1)
            .maybeSingle();
          if (tr?.tenant_id) {
            await admin.from("audit_log").insert({
              tenant_id: tr.tenant_id,
              user_id: uid,
              action: "pipefy_card_failed",
              entity_type: "pipefy_card",
              payload_json: { error: msg },
            });
          }
        }
      }
    } catch (_) { /* ignore */ }
    return respond(200, { ok: false, error: msg });
  }
});
