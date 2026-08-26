import { useEffect, useState, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import {
  DollarSign,
  Users,
  Eye,
  BarChart3,
  Zap,
  RefreshCw,
  Sparkles,
  MessageCircle,
  LogOut,
  ShieldCheck,
  Filter,
  Clock,
  Scale,
  TrendingUp,
  ListFilter,
  Layers,
  ChevronLeft,
  ChevronRight,
  Building2,
  ArrowRight,
  AlertTriangle,
  Activity,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ChatAssistant } from "@/components/ChatAssistant";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/MetricCard";
import { ComparativeTab } from "@/components/ComparativeTab";
import { EfficiencyTab } from "@/components/EfficiencyTab";
import { CampaignTable } from "@/components/CampaignTable";
import { type CompanyBudget } from "@/components/AlertsPanel";
import { ConversionFunnelTab } from "@/components/ConversionFunnelTab";
import { HourlyHeatmapTab } from "@/components/HourlyHeatmapTab";
import { AIInsightsTab } from "@/components/AIInsightsTab";
import { MetaAdsSync } from "@/components/MetaAdsSync";
import { BudgetForecastTab } from "@/components/BudgetForecastTab";
import { aggregateAdSets } from "@/lib/aggregate";
import { DashboardFiltersBar } from "@/components/DashboardFilters";
import { applyFilters } from "@/lib/filter-utils";
import { AccountComparisonTab } from "@/components/AccountComparisonTab";
import { analyzeCampaigns } from "@/lib/analysis-engine";
import type { CampaignData, DashboardFilters, MetaTotals } from "@/types/campaign";
import { metaResponseToCampaigns, mergeDaily, type MetaSyncResponse } from "@/lib/meta-to-campaigns";
import { rehydrateCampaignMetadata } from "@/lib/csv-parser";
import {
  saveCampaignSnapshot,
  loadCampaignSnapshot,
  getLocalCampaignSnapshot,
  clearCampaignSnapshot,
} from "@/lib/campaign-storage";

const defaultFilters: DashboardFilters = {
  dateRange: null,
  analysts: [],
  companies: [],
  agencies: [],
  contractTypes: [],
  resultTypes: [],
  statuses: [],
  accounts: [],
  rateios: [],
};

export default function Index() {
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "overview" | "funnel" | "heatmap" | "ai_insights" | "comparative" | "accounts" | "efficiency" | "budget" | "campaigns"
  >("overview");
  const [filters, setFilters] = useState<DashboardFilters>(defaultFilters);
  const [isAdmin, setIsAdmin] = useState(false);
  const [username, setUsername] = useState<string>("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [source, setSource] = useState<"meta" | "csv" | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [metaTotals, setMetaTotals] = useState<MetaTotals | null>(null);
  const [hasMetaCreds, setHasMetaCreds] = useState(false);
  const [companyBudgets, setCompanyBudgets] = useState<CompanyBudget[]>([]);
  const [totalBudget, setTotalBudget] = useState(0);
  const [rangeTotals, setRangeTotals] = useState<{ reach: number; messages: number } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) return;
      const uid = sess.session.user.id;
      setCurrentUserId(uid);

      // Renderização instantânea imediata a partir do cache local se disponível
      const localCached = getLocalCampaignSnapshot(uid);
      if (localCached && localCached.campaigns.length > 0) {
        const hydrated = rehydrateCampaignMetadata(localCached.campaigns);
        setCampaigns(hydrated);
        setSource(localCached.source);
        setLastSyncAt(localCached.syncedAt);
        setMetaTotals(localCached.totals ?? null);
      }

      const [{ data: roles }, { data: profile }, { data: budgets }, { data: acct }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", uid),
        supabase.from("profiles").select("username").eq("id", uid).maybeSingle(),
        supabase.from("company_settings").select("company_name, monthly_budget"),
        supabase.from("account_settings").select("total_budget").maybeSingle(),
      ]);
      setIsAdmin(roles?.some((r) => r.role === "admin") ?? false);
      setUsername(profile?.username || sess.session.user.email?.split("@")[0] || "");
      setCompanyBudgets((budgets ?? []) as CompanyBudget[]);
      setTotalBudget(Number(acct?.total_budget ?? 0));
      const { data: cred } = await supabase
        .from("user_meta_credentials")
        .select("user_id")
        .eq("user_id", uid)
        .maybeSingle();
      setHasMetaCreds(!!cred);

      // Carrega os dados salvos previamente no banco/cache local para evitar re-sincronização demorada ao entrar
      const saved = await loadCampaignSnapshot(uid);
      if (saved && saved.campaigns && saved.campaigns.length > 0) {
        const hydrated = rehydrateCampaignMetadata(saved.campaigns);
        setCampaigns(hydrated);
        setSource(saved.source);
        setLastSyncAt(saved.syncedAt);
        setMetaTotals(saved.totals ?? null);
      }
    })();
  }, []);

  // Auto-refresh Meta Ads a cada 30 min (intervalo configurado) quando os dados vieram do Meta
  useEffect(() => {
    if (source !== "meta") return;
    const interval = setInterval(async () => {
      try {
        const { data } = await supabase.functions.invoke<MetaSyncResponse>("meta-ads-sync", {
          body: { datePreset: "this_month" },
        });
        if (data?.accounts) {
          const camps = metaResponseToCampaigns(data);
          const totals: MetaTotals = {
            totalReach: data.accounts.reduce((s, a) => s + (a.accountReach ?? 0), 0),
            totalMessages: data.accounts.reduce((s, a) => s + (a.accountMessages ?? 0), 0),
            daily: mergeDaily(data),
          };
          setCampaigns(camps);
          setLastSyncAt(data.syncedAt);
          setMetaTotals(totals);

          if (currentUserId) {
            saveCampaignSnapshot(currentUserId, camps, "meta", data.syncedAt, totals);
          }
        }
      } catch { /* silent */ }
    }, 30 * 60 * 1000); // 30 minutos
    return () => clearInterval(interval);
  }, [source, currentUserId]);

  // `campaigns` guarda uma linha por conjunto POR DIA (necessário para o filtro de período).
  const filteredDaily = useMemo(() => applyFilters(campaigns, filters), [campaigns, filters]);
  const filteredCampaigns = useMemo(() => aggregateAdSets(filteredDaily), [filteredDaily]);
  const allAdSets = useMemo(() => aggregateAdSets(campaigns), [campaigns]);

  // Filtros que reduzem o conjunto de conjuntos de anúncios (aí os totais de conta não valem).
  const hasNonDateFilters = useMemo(() => (
    filters.analysts.length + filters.companies.length + filters.agencies.length +
    filters.contractTypes.length + filters.resultTypes.length + filters.statuses.length +
    filters.accounts.length + (filters.rateios?.length ?? 0) > 0
  ), [filters]);

  // Alcance único real do Meta para o intervalo selecionado (não é somável por dia).
  useEffect(() => {
    if (source !== "meta" || !filters.dateRange) { setRangeTotals(null); return; }
    let cancelled = false;
    const { start, end } = filters.dateRange;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke<{ totalReach: number; totalMessages: number }>(
          "meta-ads-sync",
          { body: { mode: "reach", since: start, until: end } },
        );
        if (!cancelled && data) setRangeTotals({ reach: data.totalReach ?? 0, messages: data.totalMessages ?? 0 });
      } catch { /* mantém fallback diário */ }
    })();
    return () => { cancelled = true; };
  }, [source, filters.dateRange]);

  const analysis = useMemo(() => {
    if (filteredCampaigns.length === 0) return null;
    let overrides: { totalReach?: number; totalMessages?: number } | undefined;
    if (source === "meta" && metaTotals && !hasNonDateFilters) {
      if (!filters.dateRange) {
        overrides = { totalReach: metaTotals.totalReach, totalMessages: metaTotals.totalMessages };
      } else if (rangeTotals) {
        overrides = { totalReach: rangeTotals.reach, totalMessages: rangeTotals.messages };
      } else {
        const { start, end } = filters.dateRange;
        const inRange = metaTotals.daily.filter((d) => d.day >= start && d.day <= end);
        if (inRange.length > 0) {
          overrides = {
            totalReach: inRange.reduce((s, d) => s + d.reach, 0),
            totalMessages: inRange.reduce((s, d) => s + d.messages, 0),
          };
        }
      }
    }
    return analyzeCampaigns(filteredCampaigns, overrides);
  }, [filteredCampaigns, source, hasNonDateFilters, metaTotals, filters.dateRange, rangeTotals]);

  const runningCount = useMemo(() => filteredCampaigns.filter((c) => c.status === "active").length, [filteredCampaigns]);
  const stoppedCount = filteredCampaigns.length - runningCount;

  const tabsRef = useRef<HTMLDivElement>(null);

  const scrollTabs = (direction: "left" | "right") => {
    if (tabsRef.current) {
      tabsRef.current.scrollBy({
        left: direction === "left" ? -240 : 240,
        behavior: "smooth",
      });
    }
  };

  // Resumo de CPR por Empresa para exibição na Visão Geral
  const companyCprSummary = useMemo(() => {
    const map = new Map<string, { company: string; spend: number; conv: number }>();
    filteredCampaigns.forEach((c) => {
      const comp = c.company || "Desconhecida";
      if (/^\d+$/.test(comp.trim()) || /^SIP\b/i.test(comp.trim())) return;
      const cur = map.get(comp) ?? { company: comp, spend: 0, conv: 0 };
      cur.spend += c.spend;
      cur.conv += c.conversions;
      map.set(comp, cur);
    });

    return Array.from(map.values())
      .filter((c) => c.spend > 0)
      .map((c) => ({
        ...c,
        cpr: c.conv > 0 ? c.spend / c.conv : 0,
        tier: c.conv === 0 ? "critical" : c.spend / c.conv <= 2 ? "good" : c.spend / c.conv <= 5 ? "acceptable" : c.spend / c.conv <= 10 ? "attention" : "critical",
      }))
      .sort((a, b) => b.spend - a.spend);
  }, [filteredCampaigns]);

  const loadCampaigns = (data: CampaignData[], src: "meta" | "csv", syncedAt?: string, totals?: MetaTotals) => {
    const timestamp = syncedAt || new Date().toISOString();
    setAnalyzing(true);
    setTimeout(() => {
      setCampaigns(data);
      setFilters(defaultFilters);
      setAnalyzing(false);
      setActiveTab("overview");
      setSource(src);
      setLastSyncAt(timestamp);
      setMetaTotals(totals ?? null);

      if (currentUserId) {
        saveCampaignSnapshot(currentUserId, data, src, timestamp, totals);
      }
    }, 300);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/30">
      {/* Sticky Top Header */}
      <header className="border-b border-border/60 backdrop-blur-xl bg-background/85 sticky top-0 z-50 transition-all">
        <div className="container max-w-7xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between gap-2">
          {/* Logo & Subtitle */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30 text-primary shrink-0 shadow-sm">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-primary animate-pulse-slow" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-base sm:text-lg font-display font-bold gradient-text tracking-tight truncate">
                  Resulta Flow
                </h1>
                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-primary/15 text-primary border border-primary/25 hidden xs:inline">
                  PRO
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate hidden sm:block">
                Inteligência de Tráfego & Meta Ads
              </p>
            </div>
          </div>

          {/* Active Data Controls & User Profile */}
          <div className="flex items-center gap-2">
            {campaigns.length > 0 && (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-xs text-muted-foreground hidden md:inline px-2 py-0.5 rounded-full bg-secondary/50 border border-border/50">
                  <strong className="text-foreground">{filteredCampaigns.length}</strong> de {allAdSets.length} conjuntos
                </span>
                {source === "meta" && lastSyncAt && (
                  <span className="text-[11px] font-medium text-emerald-400 hidden lg:flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    {new Date(lastSyncAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
                {source === "meta" && hasMetaCreds && (
                  <MetaAdsSync compact onSynced={(d, at, totals) => loadCampaigns(d, "meta", at, totals)} />
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setCampaigns([]); setActiveTab("overview"); setFilters(defaultFilters); setSource(null); }}
                  className="h-8 text-xs border-border/70 hover:bg-secondary"
                  title="Carregar outros dados ou nova análise"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />
                  <span className="hidden sm:inline">Nova análise</span>
                </Button>
              </div>
            )}

            <div className="flex items-center gap-1.5 border-l border-border/60 pl-2 sm:pl-3 ml-1">
              {username && (
                <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground bg-secondary/40 px-2 py-1 rounded-md">
                  <span className="text-foreground font-medium truncate max-w-[120px]">{username}</span>
                </div>
              )}
              {isAdmin && (
                <Link to="/admin">
                  <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" title="Painel Admin">
                    <ShieldCheck className="w-4 h-4 sm:mr-1 text-primary" />
                    <span className="hidden sm:inline">Admin</span>
                  </Button>
                </Link>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                title="Sair"
                onClick={async () => { await supabase.auth.signOut(); window.location.href = "/auth"; }}
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="container max-w-7xl mx-auto px-3 sm:px-4 py-6 flex-1">
        {campaigns.length === 0 && !analyzing && (
          <div className="max-w-4xl mx-auto space-y-8 animate-fade-in py-4">
            {/* Hero Header */}
            <div className="text-center space-y-3 max-w-2xl mx-auto">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-semibold mb-1 shadow-sm">
                <Sparkles className="w-3.5 h-3.5" />
                Painel Analítico de Alta Precisão
              </div>
              <h2 className="text-2xl sm:text-4xl font-display font-bold tracking-tight text-foreground">
                Decisões de Tráfego com <span className="gradient-text">Diagnóstico Completo</span>
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                Conecte suas contas do Meta Ads em tempo real para visualizar funis de conversão, mapas de horários 7x24, projeção de verba e alertas inteligentes de anomalias.
              </p>
            </div>

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="glass-card p-3.5 space-y-1.5">
                <div className="p-2 w-fit rounded-lg bg-blue-500/10 text-blue-400">
                  <Filter className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-xs text-foreground">Funil de 5 Etapas</h3>
                <p className="text-[11px] text-muted-foreground leading-snug">Identifique gargalos do anúncio à conversão com cálculo de queda.</p>
              </div>
              <div className="glass-card p-3.5 space-y-1.5">
                <div className="p-2 w-fit rounded-lg bg-purple-500/10 text-purple-400">
                  <Clock className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-xs text-foreground">Mapa 7x24</h3>
                <p className="text-[11px] text-muted-foreground leading-snug">Descubra os melhores horários para investir e programar lances.</p>
              </div>
              <div className="glass-card p-3.5 space-y-1.5">
                <div className="p-2 w-fit rounded-lg bg-amber-500/10 text-amber-400">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-xs text-foreground">Alertas Automáticos</h3>
                <p className="text-[11px] text-muted-foreground leading-snug">Fadiga de criativos, oscilações de CTR e estouro de verba.</p>
              </div>
              <div className="glass-card p-3.5 space-y-1.5">
                <div className="p-2 w-fit rounded-lg bg-emerald-500/10 text-emerald-400">
                  <DollarSign className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-xs text-foreground">Pacing de Verba</h3>
                <p className="text-[11px] text-muted-foreground leading-snug">Projeção de fim de mês e ritmo diário por empresa e conta.</p>
              </div>
            </div>

            {/* Ingestion Cards */}
            <div className="max-w-2xl mx-auto w-full">
              <div className="glass-card p-6 sm:p-7 space-y-5 border-primary/30 relative overflow-hidden shadow-lg">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2.5 rounded-xl bg-primary/15 text-primary border border-primary/25">
                        <Activity className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-display font-semibold text-base sm:text-lg">Sincronização Meta Ads</h3>
                        <p className="text-xs text-muted-foreground">Sincronize com a API oficial do Meta Ads</p>
                      </div>
                    </div>
                    <span className="text-[11px] bg-primary/15 text-primary border border-primary/25 px-2.5 py-0.5 rounded-full font-medium">
                      Auto: a cada 30 min
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                    Selecione o período desejado e clique em sincronizar. Seus dados serão processados com máxima velocidade e salvos na nuvem para consultas instantâneas.
                  </p>
                </div>
                <div className="pt-2">
                  <MetaAdsSync onSynced={(d, at, totals) => loadCampaigns(d, "meta", at, totals)} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading Spinner State */}
        {analyzing && (
          <div className="flex flex-col items-center justify-center py-24 animate-fade-in space-y-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
              <Sparkles className="w-5 h-5 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-foreground">Processando e normalizando dados...</p>
              <p className="text-xs text-muted-foreground">Calculando métricas de CPR, alcance único e anomalias de veiculação</p>
            </div>
          </div>
        )}

        {/* Active Analysis Dashboard */}
        {analysis && !analyzing && (
          <div className="space-y-5 animate-fade-in">
            {/* Global Filters */}
            <DashboardFiltersBar campaigns={campaigns} filters={filters} onFiltersChange={setFilters} />

            {/* Seamless Horizontal Scrollable Tab Bar with Navigation Controls */}
            <div className="relative group/tabs flex items-center">
              {/* Left Scroll Button */}
              <button
                type="button"
                onClick={() => scrollTabs("left")}
                aria-label="Rolar abas para a esquerda"
                className="hidden sm:flex items-center justify-center absolute left-1 z-10 w-7 h-7 rounded-full bg-background/90 hover:bg-background border border-border shadow-md text-foreground transition-all duration-150 active:scale-95"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Scrollable Tabs Container */}
              <div
                ref={tabsRef}
                className="w-full overflow-x-auto no-scrollbar scroll-smooth p-1 bg-secondary/40 border border-border/60 rounded-xl shadow-inner flex items-center gap-1 sm:px-9"
              >
                {(() => {
                  const accountCount = new Set(allAdSets.map((c) => c.account)).size;

                  const tabs: {
                    key: typeof activeTab;
                    label: string;
                    icon: React.ComponentType<{ className?: string }>;
                    badge?: string | number;
                  }[] = [
                    { key: "overview", label: "Visão Geral", icon: Eye },
                    { key: "funnel", label: "Funil de Conversão", icon: Filter },
                    { key: "heatmap", label: "Mapa de Horários", icon: Clock },
                    { key: "ai_insights", label: "IA & Insights", icon: Sparkles },
                    { key: "comparative", label: "Comparativo", icon: Scale },
                    ...(accountCount > 1 ? [{ key: "accounts" as const, label: "Contas", icon: Layers, badge: accountCount }] : []),
                    { key: "efficiency", label: "Eficiência", icon: TrendingUp },
                    { key: "budget", label: "Orçamento", icon: DollarSign },
                    { key: "campaigns", label: "Campanhas", icon: ListFilter, badge: filteredCampaigns.length },
                  ];

                  return tabs.map(({ key, label, icon: Icon, badge }) => {
                    const isActive = activeTab === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setActiveTab(key)}
                        className={`flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all duration-150 whitespace-nowrap select-none shrink-0 ${
                          isActive
                            ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                            : "text-muted-foreground hover:text-foreground hover:bg-secondary/70"
                        }`}
                      >
                        <Icon className={`w-3.5 h-3.5 ${isActive ? "text-primary-foreground" : "text-muted-foreground"}`} />
                        <span>{label}</span>
                        {badge !== undefined && (
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold leading-tight ${
                              isActive
                                ? "bg-primary-foreground/20 text-primary-foreground"
                                : "bg-secondary text-muted-foreground"
                            }`}
                          >
                            {badge}
                          </span>
                        )}
                      </button>
                    );
                  });
                })()}
              </div>

              {/* Right Scroll Button */}
              <button
                type="button"
                onClick={() => scrollTabs("right")}
                aria-label="Rolar abas para a direita"
                className="hidden sm:flex items-center justify-center absolute right-1 z-10 w-7 h-7 rounded-full bg-background/90 hover:bg-background border border-border shadow-md text-foreground transition-all duration-150 active:scale-95"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* TAB: VISÃO GERAL */}
            {activeTab === "overview" && (
              <div className="space-y-5">
                {/* KPI Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <MetricCard
                    title="Gasto Total"
                    value={`R$ ${analysis.totalSpend.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    icon={<DollarSign className="w-4 h-4" />}
                  />
                  <MetricCard
                    title="Mensagens / Leads"
                    value={analysis.totalMessageResults.toLocaleString("pt-BR")}
                    icon={<MessageCircle className="w-4 h-4" />}
                    variant={analysis.totalMessageResults > 0 ? "success" : "danger"}
                  />
                  <MetricCard
                    title="CPR Médio"
                    value={`R$${analysis.avgCPR.toFixed(2)}`}
                    icon={<BarChart3 className="w-4 h-4" />}
                    variant={analysis.avgCPR > 15 ? "danger" : analysis.avgCPR > 8 ? "warning" : "success"}
                  />
                  <MetricCard
                    title="Alcance Único"
                    value={analysis.totalReach.toLocaleString("pt-BR")}
                    icon={<Users className="w-4 h-4" />}
                  />
                  <MetricCard
                    title="Impressões"
                    value={analysis.totalImpressions.toLocaleString("pt-BR")}
                    icon={<Eye className="w-4 h-4" />}
                  />
                  <MetricCard
                    title="Freq. Média"
                    value={analysis.avgFrequency.toFixed(2)}
                    icon={<Zap className="w-4 h-4" />}
                    variant={analysis.avgFrequency > 2.5 ? "warning" : "default"}
                  />
                </div>

                {/* Seção de CPR Médio por Empresa na Visão Geral */}
                {companyCprSummary.length > 0 && (
                  <div className="glass-card p-5 space-y-3 border border-border/70">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <h3 className="font-display font-semibold text-sm sm:text-base flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-primary" />
                          CPR Médio por Empresa Cadastrada
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Desempenho de Custo por Resultado (CPR) das principais empresas no período.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveTab("efficiency")}
                        className="text-xs h-8 gap-1.5 text-primary border-primary/30 hover:bg-primary/10 self-start sm:self-auto"
                      >
                        Ver análise completa na Eficiência
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                      {companyCprSummary.slice(0, 4).map((c, i) => {
                        const tierColor =
                          c.tier === "good"
                            ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400"
                            : c.tier === "acceptable"
                            ? "border-blue-500/30 bg-blue-500/5 text-blue-400"
                            : c.tier === "attention"
                            ? "border-amber-500/30 bg-amber-500/5 text-amber-400"
                            : "border-destructive/30 bg-destructive/5 text-destructive";

                        const tierBadge =
                          c.tier === "good"
                            ? "🟢 Bom"
                            : c.tier === "acceptable"
                            ? "🔵 Aceitável"
                            : c.tier === "attention"
                            ? "🟡 Atenção"
                            : "🔴 Crítico";

                        return (
                          <div
                            key={i}
                            onClick={() => setActiveTab("efficiency")}
                            className={`p-3.5 rounded-xl border transition-all hover:scale-[1.01] cursor-pointer ${tierColor}`}
                          >
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="font-semibold text-xs text-foreground truncate max-w-[130px]" title={c.company}>
                                {c.company}
                              </span>
                              <span className="text-[10px] font-medium">{tierBadge}</span>
                            </div>
                            <div className="flex items-baseline justify-between mt-2">
                              <div>
                                <p className="text-[10px] text-muted-foreground uppercase">CPR Médio</p>
                                <p className="text-base font-bold font-display">
                                  {c.conv > 0 ? `R$ ${c.cpr.toFixed(2)}` : "Sem Conv."}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] text-muted-foreground uppercase">Investido</p>
                                <p className="text-xs font-semibold text-foreground">
                                  R$ {c.spend.toFixed(2)}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* OTHER TABS */}
            {activeTab === "funnel" && <ConversionFunnelTab campaigns={filteredCampaigns} dailyRows={filteredDaily} />}
            {activeTab === "heatmap" && <HourlyHeatmapTab campaigns={filteredCampaigns} />}
            {activeTab === "ai_insights" && <AIInsightsTab campaigns={filteredCampaigns} analysis={analysis} dailyRows={filteredDaily} totalBudget={totalBudget} />}
            {activeTab === "comparative" && <ComparativeTab campaigns={filteredCampaigns} />}
            {activeTab === "accounts" && <AccountComparisonTab campaigns={filteredCampaigns} />}
            {activeTab === "efficiency" && <EfficiencyTab campaigns={filteredCampaigns} />}
            {activeTab === "budget" && <BudgetForecastTab dailyRows={filteredDaily} campaigns={filteredCampaigns} />}
            {activeTab === "campaigns" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-semibold text-base sm:text-lg">
                    Dados das Campanhas ({filteredCampaigns.length})
                  </h3>
                  <span className="text-xs text-muted-foreground">Clique nas colunas para ordenar</span>
                </div>
                <CampaignTable campaigns={filteredCampaigns} />
              </div>
            )}
          </div>
        )}
      </main>

      {/* Floating Interactive AI Chat Assistant */}
      <ChatAssistant
        campaigns={filteredCampaigns}
        analysis={analysis}
        rawCampaigns={allAdSets}
        dailyRows={campaigns}
        dateRange={filters.dateRange}
      />
    </div>
  );
}
