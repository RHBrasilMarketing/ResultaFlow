import { useState } from "react";
import { Zap, Loader2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { CampaignData, MetaTotals } from "@/types/campaign";
import { metaResponseToCampaigns, mergeDaily, type MetaSyncResponse } from "@/lib/meta-to-campaigns";

interface Props {
  onSynced: (campaigns: CampaignData[], syncedAt: string, totals?: MetaTotals) => void;
  compact?: boolean;
}

export function MetaAdsSync({ onSynced, compact = false }: Props) {
  const [loading, setLoading] = useState(false);
  const [datePreset, setDatePreset] = useState<string>("this_month");

  const sync = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke<MetaSyncResponse>("meta-ads-sync", {
        body: { datePreset },
      });
      if (error) {
        const msg = (error as any).context ? await (error as any).context.text() : error.message;
        throw new Error(msg);
      }
      if (!data) throw new Error("Sem resposta do servidor");
      const campaigns = metaResponseToCampaigns(data);
      const totals: MetaTotals = {
        totalReach: data.accounts.reduce((s, a) => s + (a.accountReach ?? 0), 0),
        totalMessages: data.accounts.reduce((s, a) => s + (a.accountMessages ?? 0), 0),
        daily: mergeDaily(data),
      };
      onSynced(campaigns, data.syncedAt, totals);
      const errCount = data.errors?.length ?? 0;
      const totalAccts = data.accounts.length + errCount;
      toast.success(
        `Sincronizado com sucesso: ${campaigns.length} conjuntos de ${data.accounts.length}/${totalAccts} contas`,
      );
      if (errCount) {
        toast.warning(`${errCount} conta(s) com erro: ${data.errors.map((e) => `${e.accountId} (${e.error})`).join("; ")}`);
      }
    } catch (e) {
      toast.error("Erro ao sincronizar Meta Ads", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Select value={datePreset} onValueChange={setDatePreset}>
          <SelectTrigger className="h-8 text-xs w-[140px] bg-secondary/40">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="this_month">Este Mês (Atual)</SelectItem>
            <SelectItem value="last_7d">Últimos 7 dias</SelectItem>
            <SelectItem value="last_30d">Últimos 30 dias</SelectItem>
            <SelectItem value="last_month">Mês Passado</SelectItem>
            <SelectItem value="last_90d">Últimos 90 dias</SelectItem>
            <SelectItem value="maximum">Máximo (Geral)</SelectItem>
          </SelectContent>
        </Select>
        <Button
          onClick={sync}
          disabled={loading}
          variant="outline"
          size="sm"
          className="gap-1 text-xs"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-primary" />}
          {loading ? "Sincronizando..." : "Sincronizar"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
            <Calendar className="w-3.5 h-3.5" /> Período da sincronização:
          </label>
          <Select value={datePreset} onValueChange={setDatePreset}>
            <SelectTrigger className="w-full bg-secondary/50 text-sm">
              <SelectValue placeholder="Selecione o período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this_month">📅 Este mês (Recomendado - Mais rápido e sem estourar limites)</SelectItem>
              <SelectItem value="last_7d">⚡ Últimos 7 dias (Ultra rápido)</SelectItem>
              <SelectItem value="last_30d">📆 Últimos 30 dias</SelectItem>
              <SelectItem value="last_month">🗓️ Mês Passado</SelectItem>
              <SelectItem value="last_90d">📆 Últimos 90 dias</SelectItem>
              <SelectItem value="maximum">📂 Histórico Completo (Maximum)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button
        onClick={sync}
        disabled={loading}
        className="w-full font-medium"
      >
        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
        {loading ? "Sincronizando contas do Meta Ads..." : "Sincronizar Meta Ads"}
      </Button>
    </div>
  );
}
