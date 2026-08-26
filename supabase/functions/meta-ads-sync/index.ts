// Meta Ads sync — fetches adset-level insights for all ad accounts of a user
// and returns raw rows to the client (client normalizes to CampaignData).
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const GRAPH = "https://graph.facebook.com/v21.0";

interface MetaInsightRow {
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  impressions?: string;
  reach?: string;
  frequency?: string;
  spend?: string;
  clicks?: string;
  inline_link_clicks?: string;
  cpm?: string;
  ctr?: string;
  date_start?: string;
  date_stop?: string;
  actions?: { action_type: string; value: string }[];
  cost_per_action_type?: { action_type: string; value: string }[];
}

interface AdsetStatusRow {
  id: string;
  status?: string;
  effective_status?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  budget_remaining?: string;
  start_time?: string;
  end_time?: string;
  campaign_id?: string;
}

interface CampaignRow {
  id: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  stop_time?: string;
}

const INSIGHT_FIELDS = [
  "campaign_id",
  "campaign_name",
  "adset_id",
  "adset_name",
  "impressions",
  "reach",
  "frequency",
  "spend",
  "clicks",
  "inline_link_clicks",
  "cpm",
  "ctr",
  "actions",
  "cost_per_action_type",
].join(",");

// Prioridade — mensagens são a métrica principal do negócio.
const RESULT_ACTION_PRIORITY = [
  "onsite_conversion.messaging_conversation_started_7d",
  "onsite_conversion.messaging_conversation_started",
  "messaging_conversation_started_7d",
  "messaging_conversation_started",
  "lead",
  "offsite_conversion.fb_pixel_lead",
  "link_click",
  "landing_page_view",
];

// Somente a variante canônica de "conversas iniciadas" — outras (first_reply, block,
// total_messaging_connection) medem coisas diferentes e inflavam o total.
const MESSAGE_ACTION_TYPES_PRIORITY = [
  "onsite_conversion.messaging_conversation_started_7d",
  "onsite_conversion.messaging_conversation_started",
  "messaging_conversation_started_7d",
  "messaging_conversation_started",
];

function pickResult(row: MetaInsightRow): { conversions: number; costPerResult: number; resultType: string; messages: number } {
  let messages = 0;
  if (row.actions) {
    for (const type of MESSAGE_ACTION_TYPES_PRIORITY) {
      const found = row.actions.find((a) => a.action_type === type);
      if (found) { messages = parseFloat(found.value) || 0; break; }
    }
  }

  if (!row.actions) return { conversions: 0, costPerResult: 0, resultType: "—", messages };

  for (const type of RESULT_ACTION_PRIORITY) {
    const found = row.actions.find((a) => a.action_type === type);
    if (found) {
      const val = parseFloat(found.value) || 0;
      const cost = row.cost_per_action_type?.find((a) => a.action_type === type);
      return {
        conversions: val,
        costPerResult: cost ? parseFloat(cost.value) || 0 : 0,
        resultType: type,
        messages,
      };
    }
  }
  return { conversions: 0, costPerResult: 0, resultType: "—", messages };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url: string, retries = 2, initialDelayMs = 1000): Promise<any> {
  let currentUrl = url;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(currentUrl);
      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(`Resposta não-JSON do Meta (Status ${res.status}): ${text.slice(0, 100)}`);
      }

      if (json && json.error) {
        const errCode = json.error.code;
        const subCode = json.error.error_subcode;
        const errMsg = (json.error.message || "").toLowerCase();

        // Erros de autenticação / sessão / permissão NÃO devem ser retentados (fail-fast imediato)
        const isAuthOrPermissionError =
          res.status === 401 ||
          res.status === 403 ||
          errCode === 190 ||
          errCode === 100 ||
          errCode === 200 ||
          errCode === 294 ||
          errCode === 2635 ||
          errMsg.includes("access token") ||
          errMsg.includes("session has been invalidated") ||
          errMsg.includes("changed their password") ||
          errMsg.includes("permission");

        if (isAuthOrPermissionError) {
          throw new Error(json.error.message || `Erro de autenticação Meta (${errCode})`);
        }

        // Se Meta pedir para reduzir quantidade de dados (Erro 1, subcódigo 99 ou "reduce data")
        if (errCode === 1 || subCode === 99 || errMsg.includes("reduce the amount of data") || errMsg.includes("reduce data")) {
          if (currentUrl.includes("limit=250")) {
            console.warn(`[Meta Reduce Data] Reduzindo limit=250 para limit=100 em ${currentUrl}`);
            currentUrl = currentUrl.replace("limit=250", "limit=100");
            await sleep(200);
            continue;
          }
          if (currentUrl.includes("limit=100")) {
            console.warn(`[Meta Reduce Data] Reduzindo limit=100 para limit=25 em ${currentUrl}`);
            currentUrl = currentUrl.replace("limit=100", "limit=25");
            await sleep(200);
            continue;
          }
        }

        const isRateLimit =
          res.status === 429 ||
          errCode === 17 ||
          errCode === 613 ||
          errCode === 4 ||
          errCode === 32 ||
          errCode === 80004 ||
          errMsg.includes("request limit") ||
          errMsg.includes("rate limit") ||
          errMsg.includes("too many calls");

        if (isRateLimit) {
          if (attempt < retries) {
            const waitTime = Math.min(5000, initialDelayMs * Math.pow(2, attempt - 1));
            console.warn(`[Meta Rate Limit] Tentativa ${attempt}/${retries}. Aguardando ${waitTime}ms...`);
            await sleep(waitTime);
            continue;
          }
        }

        throw new Error(json.error.message || `Meta API error ${res.status}`);
      }

      if (!res.ok) {
        throw new Error(`Meta API HTTP ${res.status}`);
      }

      return json;
    } catch (e: any) {
      const msg = (e.message || "").toLowerCase();
      const isAuthOrPermissionError =
        msg.includes("access token") ||
        msg.includes("session has been invalidated") ||
        msg.includes("changed their password") ||
        msg.includes("permission");

      if (isAuthOrPermissionError) {
        throw e;
      }

      const isRateLimit = msg.includes("request limit") || msg.includes("rate limit") || msg.includes("too many calls");
      if (attempt < retries) {
        const waitTime = isRateLimit ? 1500 * attempt : 800 * attempt;
        console.warn(`[Meta Fetch Error] Tentativa ${attempt}/${retries} (${e.message}). Aguardando ${waitTime}ms...`);
        await sleep(waitTime);
        continue;
      }
      throw e;
    }
  }
}

async function fetchAllPages(url: string, maxPages = 20): Promise<any[]> {
  const results: any[] = [];
  let next: string | null = url;
  let page = 0;
  while (next && page < maxPages) {
    page++;
    const json = await fetchWithRetry(next);
    if (!json || !json.data) break;
    if (Array.isArray(json.data)) results.push(...json.data);
    next = json.paging?.next ?? null;
    if (next) await sleep(50);
  }
  return results;
}

// Meta returns budgets in the account currency's minor units (centavos). Convert once here.
function centsToUnits(raw?: string): number {
  if (!raw) return 0;
  const n = parseFloat(raw);
  if (!isFinite(n)) return 0;
  return n / 100;
}

function pickMessages(actions: any): number {
  if (!Array.isArray(actions)) return 0;
  for (const type of MESSAGE_ACTION_TYPES_PRIORITY) {
    const f = actions.find((a: any) => a.action_type === type);
    if (f) return parseFloat(f.value) || 0;
  }
  return 0;
}

function normalizeAccountId(raw: string) {
  const clean = String(raw || "").trim();
  if (!clean) return "";
  return clean.startsWith("act_") ? clean : `act_${clean}`;
}

/** Alcance ÚNICO (não somável) de uma conta em um intervalo específico. */
async function fetchRangeReach(token: string, accountIdRaw: string, since: string, until: string) {
  const accountId = normalizeAccountId(accountIdRaw);
  if (!accountId || accountId === "act_") return { accountId: accountIdRaw, reach: 0, messages: 0 };

  const url =
    `${GRAPH}/${accountId}/insights?level=account` +
    `&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}` +
    `&use_unified_attribution_setting=true&fields=reach,actions&access_token=${token}`;
  const rows = await fetchAllPages(url).catch(() => []);
  let reach = 0;
  let messages = 0;
  for (const r of rows) {
    reach += parseInt(r.reach ?? "0") || 0;
    messages += pickMessages(r.actions);
  }
  return { accountId, reach, messages };
}

async function syncAccount(token: string, accountIdRaw: string, datePreset: string) {
  const accountId = normalizeAccountId(accountIdRaw);
  if (!accountId || accountId === "act_" || accountId.length < 5) {
    throw new Error(`ID de conta inválido: ${accountIdRaw}`);
  }

  // Account meta com verificação e fallback seguro
  let accountName: string = accountId;
  try {
    const acctJson = await fetchWithRetry(`${GRAPH}/${accountId}?fields=name,currency&access_token=${token}`, 1, 500);
    if (acctJson?.name) accountName = acctJson.name;
  } catch (e: any) {
    const msg = (e.message || "").toLowerCase();
    if (
      msg.includes("access token") ||
      msg.includes("session has been invalidated") ||
      msg.includes("changed their password") ||
      msg.includes("permission")
    ) {
      throw e;
    }
    console.warn(`[Meta Sync] Usando ID padrão para nome da conta ${accountId}:`, e.message);
  }

  const insightsUrl =
    `${GRAPH}/${accountId}/insights` +
    `?level=adset&date_preset=${datePreset}&limit=250&time_increment=1` +
    `&use_unified_attribution_setting=true` +
    `&fields=${INSIGHT_FIELDS}&access_token=${token}`;
  const acctInsightsUrl =
    `${GRAPH}/${accountId}/insights` +
    `?level=account&date_preset=${datePreset}` +
    `&use_unified_attribution_setting=true` +
    `&fields=reach,actions&access_token=${token}`;
  const dailyUrl =
    `${GRAPH}/${accountId}/insights` +
    `?level=account&date_preset=${datePreset}&time_increment=1&limit=250` +
    `&use_unified_attribution_setting=true` +
    `&fields=reach,spend,actions&access_token=${token}`;
  const statusUrl =
    `${GRAPH}/${accountId}/adsets?fields=id,status,effective_status,daily_budget,lifetime_budget,budget_remaining,start_time,end_time,campaign_id&limit=250&access_token=${token}`;
  const campUrl =
    `${GRAPH}/${accountId}/campaigns?fields=id,daily_budget,lifetime_budget,start_time,stop_time&limit=250&access_token=${token}`;

  // Executa as consultas com resiliência: se campanhas/adsets secundários falharem, insights principais são preservados
  const [insightsRes, acctInsightsRes, dailyRes, statusesRes, campsRes] = await Promise.all([
    fetchAllPages(insightsUrl),
    fetchAllPages(acctInsightsUrl).catch(() => []),
    fetchAllPages(dailyUrl).catch(() => []),
    fetchAllPages(statusUrl).catch(() => []),
    fetchAllPages(campUrl).catch(() => []),
  ]);

  const insights = (insightsRes || []) as MetaInsightRow[];

  // Alcance ÚNICO no nível da conta (não somável entre adsets)
  let accountReach = 0;
  let accountMessages = 0;
  for (const ai of acctInsightsRes) {
    accountReach += parseInt(ai.reach ?? "0") || 0;
    accountMessages += pickMessages(ai.actions);
  }

  // Totais diários no nível da conta
  const dailyTotals = dailyRes.map((d: any) => ({
    day: d.date_start ?? "",
    reach: parseInt(d.reach ?? "0") || 0,
    messages: pickMessages(d.actions),
    spend: parseFloat(d.spend ?? "0") || 0,
  }));

  const adsetMap = new Map<string, AdsetStatusRow>();
  for (const s of statusesRes as AdsetStatusRow[]) {
    if (s && s.id) adsetMap.set(s.id, s);
  }

  const campaignBudgetMap = new Map<string, number>();
  const campaignEndMap = new Map<string, string>();
  for (const c of campsRes as CampaignRow[]) {
    if (c && c.id) {
      const budget = centsToUnits(c.daily_budget) || centsToUnits(c.lifetime_budget);
      if (budget > 0) campaignBudgetMap.set(c.id, budget);
      if (c.stop_time) campaignEndMap.set(c.id, c.stop_time);
    }
  }

  const rows = insights.map((r, i) => {
    const impressions = parseInt(r.impressions ?? "0") || 0;
    const reach = parseInt(r.reach ?? "0") || 0;
    const spend = parseFloat(r.spend ?? "0") || 0;
    const clicks = parseInt(r.clicks ?? "0") || 0;
    const linkClicks = parseInt(r.inline_link_clicks ?? "0") || 0;
    const frequency = parseFloat(r.frequency ?? "0") || 0;
    const cpm = parseFloat(r.cpm ?? "0") || 0;
    const ctr = parseFloat(r.ctr ?? "0") || 0;
    const { conversions, costPerResult, resultType, messages } = pickResult(r);

    const adsetInfo = adsetMap.get(r.adset_id ?? "");

    // Status do adset
    const ownStatus = (adsetInfo?.status || "").toUpperCase();
    const effStatus = (adsetInfo?.effective_status || "").toUpperCase();
    let status = "active";
    if (ownStatus === "PAUSED" || effStatus === "ADSET_PAUSED" || effStatus === "PAUSED") status = "paused";
    else if (ownStatus === "DELETED" || ownStatus === "ARCHIVED" || effStatus.includes("DELETED") || effStatus.includes("ARCHIVED")) status = "inactive";
    else if (effStatus.includes("DISAPPROVED") || effStatus.includes("WITH_ISSUES") || effStatus.includes("PENDING")) status = "not_delivering";
    else if (ownStatus === "ACTIVE" || effStatus === "ACTIVE") status = "active";
    else if (!ownStatus && !effStatus) status = "active";
    else status = "recently_completed";

    const dailyBudget = centsToUnits(adsetInfo?.daily_budget);
    const lifetimeBudget = centsToUnits(adsetInfo?.lifetime_budget);
    const budgetRemaining = centsToUnits(adsetInfo?.budget_remaining);
    const adsetBudget = dailyBudget || lifetimeBudget;
    const campaignBudget = campaignBudgetMap.get(r.campaign_id ?? "") || 0;
    const scheduleEnd = adsetInfo?.end_time || campaignEndMap.get(r.campaign_id ?? "") || "";

    return {
      id: `${accountId}-${r.adset_id ?? i}-${r.date_start ?? i}`,
      campaignName: r.campaign_name ?? "—",
      adSetName: r.adset_name ?? "—",
      adName: "—",
      status,
      spend,
      impressions,
      reach,
      frequency,
      clicks,
      linkClicks,
      cpm,
      ctr,
      conversions,
      messages,
      costPerResult,
      resultType,
      campaignBudget,
      adsetBudget,
      dailyBudget,
      lifetimeBudget,
      budgetRemaining,
      scheduleStart: adsetInfo?.start_time ?? "",
      scheduleEnd,
      day: r.date_start ?? "",
      startDate: r.date_start ?? "",
      endDate: r.date_stop ?? "",
    };
  });

  return { account: accountName, accountId, rowCount: rows.length, rows, accountReach, accountMessages, dailyTotals };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");
    if (!jwt) throw new Error("Não autenticado");

    // Verify caller
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData.user) throw new Error("Sessão inválida");
    const callerId = userData.user.id;

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const targetUserId: string = body.userId || callerId;
    const datePreset: string = body.datePreset || "this_month";

    // If caller is targeting another user, require admin
    if (targetUserId !== callerId) {
      const { data: roles } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", callerId);
      if (!roles?.some((r) => r.role === "admin")) throw new Error("Apenas admin");
    }

    const { data: cred, error: credErr } = await admin
      .from("user_meta_credentials")
      .select("access_token, ad_account_ids")
      .eq("user_id", targetUserId)
      .maybeSingle();
    if (credErr) throw credErr;
    if (!cred) throw new Error("Nenhuma credencial Meta Ads cadastrada para este usuário");

    const sanitizedAccountIds = (cred.ad_account_ids || [])
      .map((id: string) => String(id).trim())
      .filter((id: string) => id.length > 0 && id !== "act_");

    if (sanitizedAccountIds.length === 0) {
      throw new Error("Nenhuma conta de anúncio válida cadastrada");
    }

    // Modo "reach": alcance único real do Meta para um intervalo específico.
    if (body.mode === "reach") {
      const since: string = body.since;
      const until: string = body.until;
      if (!since || !until) throw new Error("since/until obrigatórios");
      const results = await Promise.all(
        sanitizedAccountIds.map((id: string) =>
          fetchRangeReach(cred.access_token, id, since, until).catch(() => ({ accountId: id, reach: 0, messages: 0 })),
        ),
      );
      return new Response(
        JSON.stringify({
          totalReach: results.reduce((s, r) => s + r.reach, 0),
          totalMessages: results.reduce((s, r) => s + r.messages, 0),
          accounts: results,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Processa contas em lotes paralelos (concorrência de 3) para máxima velocidade e estabilidade
    const accounts: any[] = [];
    const errors: { accountId: string; error: string }[] = [];
    const BATCH_SIZE = 3;

    for (let i = 0; i < sanitizedAccountIds.length; i += BATCH_SIZE) {
      const chunk = sanitizedAccountIds.slice(i, i + BATCH_SIZE);
      const chunkResults = await Promise.all(
        chunk.map(async (accId: string) => {
          try {
            const data = await syncAccount(cred.access_token, accId, datePreset);
            return { ok: true, data, accountId: accId };
          } catch (e) {
            return { ok: false, error: (e as Error).message, accountId: accId };
          }
        })
      );

      for (const r of chunkResults) {
        if (r.ok && r.data) {
          accounts.push(r.data);
        } else {
          errors.push({ accountId: r.accountId, error: r.error || "Erro ao consultar conta" });
        }
      }

      if (i + BATCH_SIZE < sanitizedAccountIds.length) {
        await sleep(50);
      }
    }

    const status = accounts.length === 0 ? "failed" : errors.length ? "partial" : "ok";
    await admin
      .from("user_meta_credentials")
      .update({
        last_synced_at: new Date().toISOString(),
        last_sync_status: status,
        last_sync_error: errors.length ? JSON.stringify(errors) : null,
      })
      .eq("user_id", targetUserId);

    return new Response(
      JSON.stringify({ accounts, errors, syncedAt: new Date().toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("meta-ads-sync error:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
