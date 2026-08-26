import type { CampaignData } from "@/types/campaign";

/**
 * A sincronização do Meta traz uma linha por conjunto POR DIA (necessário para o
 * filtro de período funcionar). Para as telas que mostram "conjuntos de anúncios"
 * consolidamos essas linhas diárias em uma linha por conjunto.
 */
export function aggregateAdSets(rows: CampaignData[]): CampaignData[] {
  const map = new Map<string, CampaignData>();

  for (const r of rows) {
    const key = `${r.account}||${r.campaignName}||${r.adSetName}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...r, id: key });
      continue;
    }
    prev.spend += r.spend;
    prev.impressions += r.impressions;
    prev.clicks += r.clicks;
    prev.linkClicks += r.linkClicks;
    prev.reach += r.reach;
    prev.conversions += r.conversions;
    prev.messages = (prev.messages ?? 0) + (r.messages ?? 0);
    if (r.day && (!prev.day || r.day < prev.day)) prev.day = r.day;
    if (r.day && (!prev.endDate || r.day > prev.endDate)) prev.endDate = r.day;
    if (r.status === "active") prev.status = "active";
  }

  for (const c of map.values()) {
    c.cpm = c.impressions > 0 ? (c.spend / c.impressions) * 1000 : 0;
    c.ctr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0;
    c.cpc = c.linkClicks > 0 ? c.spend / c.linkClicks : 0;
    c.frequency = c.reach > 0 ? c.impressions / c.reach : 0;
    c.costPerResult = c.conversions > 0 ? c.spend / c.conversions : 0;
    if (!c.startDate || (c.day && c.day < c.startDate)) c.startDate = c.day;
  }

  return [...map.values()];
}

/** Menor e maior dia presentes nos dados. */
export function dataDayRange(rows: CampaignData[]): { min?: string; max?: string } {
  let min: string | undefined;
  let max: string | undefined;
  for (const r of rows) {
    if (!r.day) continue;
    if (!min || r.day < min) min = r.day;
    if (!max || r.day > max) max = r.day;
  }
  return { min, max };
}
