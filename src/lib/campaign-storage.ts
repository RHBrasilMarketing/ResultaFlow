import { supabase } from "@/integrations/supabase/client";
import type { CampaignData } from "@/types/campaign";
import type { MetaTotals } from "@/components/MetaAdsSync";

export interface StoredCampaignSnapshot {
  campaigns: CampaignData[];
  source: "meta" | "csv";
  syncedAt: string;
  totals?: MetaTotals | null;
}

const LOCAL_STORAGE_PREFIX = "resultaflow_snapshot_";

export async function saveCampaignSnapshot(
  userId: string,
  campaigns: CampaignData[],
  source: "meta" | "csv",
  syncedAt: string,
  totals?: MetaTotals | null
): Promise<void> {
  const payload: StoredCampaignSnapshot = {
    campaigns,
    source,
    syncedAt,
    totals: totals ?? null,
  };

  // 1. Instant local persistence for zero-latency resume
  try {
    localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${userId}`, JSON.stringify(payload));
  } catch (err) {
    console.warn("Could not save to localStorage", err);
  }

  // 2. Cloud database persistence (Supabase)
  try {
    const { error } = await supabase.from("synced_campaign_cache").upsert(
      {
        user_id: userId,
        source,
        synced_at: syncedAt,
        totals: (totals as any) ?? null,
        campaign_data: campaigns as any,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    if (error) {
      console.warn("Cloud persistence warning:", error.message);
    }
  } catch (err) {
    console.warn("Cloud persistence network error:", err);
  }
}

export function getLocalCampaignSnapshot(userId: string): StoredCampaignSnapshot | null {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.campaigns) && parsed.campaigns.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn("Error reading from localStorage", err);
  }
  return null;
}

export async function loadCampaignSnapshot(
  userId: string
): Promise<StoredCampaignSnapshot | null> {
  // 1. Check local storage first for immediate rendering
  const localData = getLocalCampaignSnapshot(userId);

  // 2. Query cloud database to ensure we have the authoritative synced data
  try {
    const { data, error } = await supabase
      .from("synced_campaign_cache")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!error && data && Array.isArray(data.campaign_data) && data.campaign_data.length > 0) {
      const cloudSnapshot: StoredCampaignSnapshot = {
        campaigns: data.campaign_data as unknown as CampaignData[],
        source: (data.source as "meta" | "csv") || "meta",
        syncedAt: data.synced_at || new Date().toISOString(),
        totals: data.totals as unknown as MetaTotals | null,
      };

      // Keep local storage up to date with cloud
      try {
        localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${userId}`, JSON.stringify(cloudSnapshot));
      } catch (storageErr) {
        console.warn("Could not sync local cache with cloud snapshot", storageErr);
      }

      return cloudSnapshot;
    }
  } catch (err) {
    console.warn("Error fetching cloud cache:", err);
  }

  return localData;
}

export async function clearCampaignSnapshot(userId?: string): Promise<void> {
  if (userId) {
    try {
      localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}${userId}`);
      await supabase.from("synced_campaign_cache").delete().eq("user_id", userId);
    } catch (err) {
      console.warn("Error clearing cache:", err);
    }
  }
}
