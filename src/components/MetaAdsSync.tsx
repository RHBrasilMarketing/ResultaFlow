import { useState, useEffect } from "react";
import { Zap, Loader2, Calendar, KeyRound, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { CampaignData, MetaTotals } from "@/types/campaign";
import { metaResponseToCampaigns, mergeDaily, type MetaSyncResponse } from "@/lib/meta-to-campaigns";
import { MetaCredentialsDialog } from "./MetaCredentialsDialog";
import { fetchMetaDirectly } from "@/lib/meta-graph-api";

interface Props {
  onSynced: (campaigns: CampaignData[], syncedAt: string, totals?: MetaTotals) => void;
  compact?: boolean;
  userId?: string | null;
}

export function MetaAdsSync({ onSynced, compact = false, userId }: Props) {
  const [loading, setLoading] = useState(false);
  const [datePreset, setDatePreset] = useState<string>("this_month");
  const [openCreds, setOpenCreds] = useState(false);
  const [hasCreds, setHasCreds] = useState(false);

  const checkCreds = () => {
    const local = localStorage.getItem("meta_ads_credentials");
    if (local) {
      try {
        const p = JSON.parse(local);
        if (p.access_token && (p.ad_account_ids?.length || p.ad_account_id)) {
          setHasCreds(true);
          return;
        }
      } catch {}
    }
    setHasCreds(false);
  };

  useEffect(() => {
    checkCreds();
  }, [userId]);

  const sync = async () => {
    setLoading(true);
    try {
      let campaigns: CampaignData[] = [];
      let totals: MetaTotals | undefined;
      let accountsCount = 0;
      let totalAccts = 0;
      let errors: { accountId: string; error: string }[] = [];

      // 1. Tenta Edge Function do Supabase se estiver configurada
      let edgeSuccess = false;
      try {
        const { data, error } = await supabase.functions.invoke<MetaSyncResponse>("meta-ads-sync", {
          body: { datePreset },
        });

        if (!error && data?.accounts?.length) {
          campaigns = metaResponseToCampaigns(data);
          totals = {
            totalReach: data.accounts.reduce((s, a) => s + (a.accountReach ?? 0), 0),
            totalMessages: data.accounts.reduce((s, a) => s + (a.accountMessages ?? 0), 0),
            daily: mergeDaily(data),
          };
          accountsCount = data.accounts.length;
          totalAccts = data.accounts.length + (data.errors?.length ?? 0);
          errors = data.errors || [];
          edgeSuccess = true;
        }
      } catch {
        // Fallback silencioso para consulta direta
      }

      // 2. Se a Edge Function não retornou dados, consulta a Meta Graph API diretamente
      if (!edgeSuccess) {
        let creds: { access_token?: string; ad_account_ids?: string[]; ad_account_id?: string } | null = null;
        const local = localStorage.getItem("meta_ads_credentials");
        if (local) {
          try {
            creds = JSON.parse(local);
          } catch {}
        }

        if (!creds?.access_token && userId) {
          const { data: dbCreds } = await supabase
            .from("user_meta_credentials")
            .select("access_token, ad_account_ids")
            .eq("user_id", userId)
            .maybeSingle()
            .catch(() => ({ data: null }));
          if (dbCreds?.access_token) {
            creds = dbCreds;
          }
        }

        if (!creds?.access_token) {
          setOpenCreds(true);
          toast.info("Por favor, informe seu Access Token e Contas de Anúncio para sincronizar.");
          setLoading(false);
          return;
        }

        const ids = creds.ad_account_ids?.length
          ? creds.ad_account_ids
          : creds.ad_account_id
          ? [creds.ad_account_id]
          : [];

        if (!ids.length) {
          setOpenCreds(true);
          toast.info("Nenhuma conta de anúncio configurada. Adicione o ID da conta.");
          setLoading(false);
          return;
        }

        const direct = await fetchMetaDirectly({
          accessToken: creds.access_token,
          adAccountIds: ids,
          datePreset,
        });

        campaigns = direct.campaigns;
        totals = direct.totals;
        accountsCount = direct.accountsCount;
        totalAccts = direct.accountsCount + direct.errors.length;
        errors = direct.errors;
      }

      if (!campaigns.length && errors.length > 0) {
        throw new Error(errors.map((e) => `${e.accountId}: ${e.error}`).join("; "));
      }

      onSynced(campaigns, new Date().toISOString(), totals);
      toast.success(
        `Sincronizado com sucesso: ${campaigns.length} conjuntos de ${accountsCount}/${totalAccts || 1} contas`
      );

      if (errors.length > 0) {
        toast.warning(`${errors.length} conta(s) com erro: ${errors.map((e) => `${e.accountId} (${e.error})`).join("; ")}`);
      }
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao sincronizar Meta Ads", {
        description: e?.message || "Verifique o token e as permissões da conta.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <>
        <div className="flex items-center gap-1.5">
          <Select value={datePreset} onValueChange={setDatePreset}>
            <SelectTrigger className="h-8 text-xs w-[130px] sm:w-[145px] bg-secondary/40">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this_month">Este Mês</SelectItem>
              <SelectItem value="last_7d">Últimos 7 dias</SelectItem>
              <SelectItem value="last_30d">Últimos 30 dias</SelectItem>
              <SelectItem value="last_month">Mês Passado</SelectItem>
              <SelectItem value="last_90d">Últimos 90 dias</SelectItem>
              <SelectItem value="maximum">Máximo Geral</SelectItem>
            </SelectContent>
          </Select>

          <Button
            onClick={sync}
            disabled={loading}
            variant="outline"
            size="sm"
            className="h-8 gap-1 text-xs bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
            title="Sincronizar dados da Meta Ads"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            <span className="hidden xs:inline">{loading ? "Sincronizando..." : "Sincronizar"}</span>
          </Button>

          <Button
            onClick={() => setOpenCreds(true)}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
            title="Configurar Chaves da Meta Ads"
          >
            <KeyRound className="w-3.5 h-3.5" />
          </Button>
        </div>

        <MetaCredentialsDialog
          open={openCreds}
          onClose={() => {
            setOpenCreds(false);
            checkCreds();
          }}
          userId={userId}
          onSaved={() => checkCreds()}
        />
      </>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-primary" /> Período da Sincronização:
            </label>
            <Select value={datePreset} onValueChange={setDatePreset}>
              <SelectTrigger className="w-full bg-secondary/50 text-sm h-10">
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this_month">📅 Este Mês (Recomendado — Rápido e Atual)</SelectItem>
                <SelectItem value="last_7d">⚡ Últimos 7 dias (Ultra rápido)</SelectItem>
                <SelectItem value="last_30d">📆 Últimos 30 dias</SelectItem>
                <SelectItem value="last_month">🗓️ Mês Passado</SelectItem>
                <SelectItem value="last_90d">📆 Últimos 90 dias</SelectItem>
                <SelectItem value="maximum">📂 Histórico Completo (Maximum)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={() => setOpenCreds(true)}
            variant="outline"
            size="sm"
            className="h-10 text-xs gap-1.5 border-border/80 hover:bg-secondary shrink-0"
          >
            <KeyRound className="w-4 h-4 text-primary" />
            <span>{hasCreds ? "Credenciais Configuradas" : "Configurar Chave Meta"}</span>
            {hasCreds && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 ml-1" />}
          </Button>
        </div>

        <Button
          onClick={sync}
          disabled={loading}
          className="w-full h-11 text-sm font-semibold bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-md transition-all"
        >
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
          {loading ? "Conectando e baixando campanhas da Meta..." : "Sincronizar Agora com a Meta Ads"}
        </Button>
      </div>

      <MetaCredentialsDialog
        open={openCreds}
        onClose={() => {
          setOpenCreds(false);
          checkCreds();
        }}
        userId={userId}
        onSaved={() => checkCreds()}
      />
    </>
  );
}
