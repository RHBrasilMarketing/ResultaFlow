import type { CampaignData } from "@/types/campaign";
import { extractAdSetMetadata, normalizeMetaDay } from "@/lib/csv-parser";

export interface MetaSyncRow {
  id: string;
  campaignName: string;
  adSetName: string;
  adName: string;
  status: string;
  spend: number;
  impressions: number;
  reach: number;
  frequency: number;
  clicks: number;
  linkClicks: number;
  cpm: number;
  ctr: number;
  conversions: number;
  messages?: number;
  costPerResult: number;
  resultType: string;
  campaignBudget?: number;
  adsetBudget?: number;
  dailyBudget?: number;
  lifetimeBudget?: number;
  budgetRemaining?: number;
  scheduleStart?: string;
  scheduleEnd?: string;
  day: string;
  startDate: string;
  endDate: string;
}

export interface MetaSyncAccount {
  account: string;
  accountId: string;
  rowCount: number;
  rows: MetaSyncRow[];
  accountReach?: number;
  accountMessages?: number;
  dailyTotals?: { day: string; reach: number; messages: number; spend: number }[];
}

export interface MetaSyncResponse {
  accounts: MetaSyncAccount[];
  errors: { accountId: string; error: string }[];
  syncedAt: string;
}

export function mergeDaily(data: MetaSyncResponse): { day: string; reach: number; messages: number; spend: number }[] {
  const map = new Map<string, { day: string; reach: number; messages: number; spend: number }>();
  for (const acct of data.accounts) {
    for (const d of acct.dailyTotals ?? []) {
      const cur = map.get(d.day) ?? { day: d.day, reach: 0, messages: 0, spend: 0 };
      cur.reach += d.reach;
      cur.messages += d.messages;
      cur.spend += d.spend;
      map.set(d.day, cur);
    }
  }
  return [...map.values()].sort((a, b) => a.day.localeCompare(b.day));
}

function mapStatus(s: string): CampaignData["status"] {
  const v = s.toLowerCase();
  if (v === "paused") return "paused";
  if (v === "inactive") return "inactive";
  if (v === "not_delivering") return "not_delivering";
  if (v === "recently_completed") return "recently_completed";
  if (v === "error") return "error";
  return "active";
}

export function metaResponseToCampaigns(resp: MetaSyncResponse): CampaignData[] {
  const out: CampaignData[] = [];
  for (const acct of resp.accounts) {
    for (const r of acct.rows) {
      const meta = extractAdSetMetadata(r.adSetName, r.campaignName, r.adName || "");
      const cpm = r.impressions > 0 ? (r.spend / r.impressions) * 1000 : r.cpm;
      const freq = r.frequency || (r.reach > 0 ? r.impressions / r.reach : 0);
      const messages = r.messages ?? 0;
      // Preferimos "mensagens" quando existirem — é a métrica principal do negócio.
      const conversions = messages > 0 ? messages : r.conversions;
      const rawType = messages > 0 ? "onsite_conversion.messaging_conversation_started" : r.resultType;
      const isMsg = messages > 0 || /messag|mensag/i.test(rawType);
      const isClick = !isMsg && /click|clique|link/i.test(rawType);
      const resultCategory: CampaignData["resultCategory"] = isMsg ? "mensagens" : isClick ? "cliques" : "outro";
      const resultType = isMsg ? "Mensagens" : isClick ? "Cliques" : (rawType || "—");
      const costPerResult = conversions > 0 ? r.spend / conversions : r.costPerResult;
      out.push({
        id: r.id,
        campaignName: r.campaignName,
        adSetName: r.adSetName,
        adName: r.adName || "—",
        status: mapStatus(r.status),
        objective: resultType || "—",
        spend: r.spend,
        impressions: r.impressions,
        clicks: r.clicks,
        linkClicks: r.linkClicks,
        ctr: r.ctr,
        cpc: r.linkClicks > 0 ? r.spend / r.linkClicks : 0,
        cpm,
        conversions,
        costPerResult,
        roas: 0,
        frequency: freq,
        reach: r.reach,
        relevanceScore: 0,
        resultType,
        resultCategory,
        messages,
        startDate: r.startDate,
        endDate: r.endDate,
        age: "—",
        gender: "—",
        day: normalizeMetaDay(r.day),
        account: acct.account,
        campaignBudget: r.campaignBudget ?? 0,
        adsetBudget: r.adsetBudget ?? 0,
        dailyBudget: r.dailyBudget ?? 0,
        lifetimeBudget: r.lifetimeBudget ?? 0,
        budgetRemaining: r.budgetRemaining ?? 0,
        scheduleStart: r.scheduleStart ?? "",
        scheduleEnd: r.scheduleEnd ?? "",
        ...meta,
      });
    }
  }
  return out;
}
