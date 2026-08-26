import { useState, useMemo } from "react";
import {
  Filter,
  Eye,
  MousePointerClick,
  MessageCircle,
  TrendingDown,
  TrendingUp,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Building2,
  ArrowDown,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CampaignData } from "@/types/campaign";
import { cn } from "@/lib/utils";

interface ConversionFunnelTabProps {
  campaigns: CampaignData[];
  dailyRows?: CampaignData[];
}

export function ConversionFunnelTab({ campaigns }: ConversionFunnelTabProps) {
  const [selectedCompany, setSelectedCompany] = useState<string>("all");

  // Filtra por empresa selecionada (se houver)
  const filteredData = useMemo(() => {
    if (selectedCompany === "all") return campaigns;
    return campaigns.filter((c) => c.company === selectedCompany);
  }, [campaigns, selectedCompany]);

  // Lista de empresas com contagem
  const companiesList = useMemo(() => {
    const set = new Set<string>();
    campaigns.forEach((c) => {
      if (
        c.company &&
        c.company !== "Desconhecida" &&
        !/^\(?\d+\)?$/.test(c.company.trim()) &&
        !/^\d+$/.test(c.company.trim()) &&
        !/^SIP\b/i.test(c.company.trim())
      ) {
        set.add(c.company);
      }
    });
    return Array.from(set).sort();
  }, [campaigns]);

  // Métricas do Funil Global
  const metrics = useMemo(() => {
    const totalSpend = filteredData.reduce((s, c) => s + c.spend, 0);
    const impressions = filteredData.reduce((s, c) => s + c.impressions, 0);
    const reach = filteredData.reduce((s, c) => s + c.reach, 0);
    const linkClicks = filteredData.reduce((s, c) => s + (c.linkClicks || 0), 0);
    const totalClicks = filteredData.reduce((s, c) => s + c.clicks, 0);
    const bestClicks = linkClicks > 0 ? linkClicks : totalClicks;
    const conversions = filteredData.reduce((s, c) => s + c.conversions, 0);

    // Taxas de passagem (Porcentagens)
    const ctr = impressions > 0 ? (bestClicks / impressions) * 100 : 0;
    const clickToConversationRate = bestClicks > 0 ? (conversions / bestClicks) * 100 : 0;
    const overallConversionRate = impressions > 0 ? (conversions / impressions) * 100 : 0;

    // Custos por etapa
    const cpm = impressions > 0 ? (totalSpend / impressions) * 1000 : 0;
    const cpc = bestClicks > 0 ? totalSpend / bestClicks : 0;
    const cpa = conversions > 0 ? totalSpend / conversions : (totalSpend > 0 ? totalSpend : 0);

    // Perdas (Drop-offs)
    const dropOffImpressionsToClicks = 100 - ctr;
    const dropOffClicksToConversions = 100 - clickToConversationRate;

    return {
      totalSpend,
      impressions,
      reach,
      clicks: bestClicks,
      totalClicks,
      conversions,
      ctr,
      clickToConversationRate,
      overallConversionRate,
      cpm,
      cpc,
      cpa,
      dropOffImpressionsToClicks,
      dropOffClicksToConversions,
    };
  }, [filteredData]);

  const [breakdownDimension, setBreakdownDimension] = useState<"company" | "agency" | "contractType" | "veiculation" | "rateio">("company");
  const [breakdownSort, setBreakdownSort] = useState<"spend_desc" | "spend_asc" | "conv_desc" | "conv_asc" | "cpa_asc" | "cpa_desc" | "ctr_desc">("spend_desc");
  const [expandBreakdown, setExpandBreakdown] = useState(false);

  // Comparativo do Funil por Dimensão Selecionada (Empresa, Agência, Modalidade, Veiculação, Rateio)
  const breakdownFunnels = useMemo(() => {
    const map = new Map<string, {
      dimensionName: string;
      spend: number;
      impressions: number;
      clicks: number;
      conversions: number;
      adSetCount: number;
    }>();

    campaigns.forEach((c) => {
      let key = "";
      if (breakdownDimension === "company") {
        key = c.company || "Desconhecida";
      } else if (breakdownDimension === "agency") {
        key = c.agency && c.agency !== "—" ? c.agency : "Não identificada";
      } else if (breakdownDimension === "contractType") {
        key = c.contractType === "efetivo" ? "Efetivo [EF]" : c.contractType === "temporario" ? "Temporário [TE]" : "Não informado";
      } else if (breakdownDimension === "veiculation") {
        key = (c.isContinuous || c.period === "FULL") ? "Contínua (FULL)" : "Pontual";
      } else if (breakdownDimension === "rateio") {
        key = c.rateio && c.rateio !== "—" ? c.rateio : "Sem Rateio";
      }

      const existing = map.get(key) ?? {
        dimensionName: key,
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        adSetCount: 0,
      };

      existing.spend += c.spend;
      existing.impressions += c.impressions;
      existing.clicks += (c.linkClicks > 0 ? c.linkClicks : c.clicks);
      existing.conversions += c.conversions;
      existing.adSetCount += 1;
      map.set(key, existing);
    });

    const list = Array.from(map.values()).map((item) => {
      const ctr = item.impressions > 0 ? (item.clicks / item.impressions) * 100 : 0;
      const cvr = item.clicks > 0 ? (item.conversions / item.clicks) * 100 : 0;
      const cpa = item.conversions > 0 ? item.spend / item.conversions : (item.spend > 0 ? item.spend : 0);

      return {
        ...item,
        ctr,
        cvr,
        cpa,
      };
    });

    return list.sort((a, b) => {
      if (breakdownSort === "spend_desc") return b.spend - a.spend;
      if (breakdownSort === "spend_asc") return a.spend - b.spend;
      if (breakdownSort === "conv_desc") return b.conversions - a.conversions;
      if (breakdownSort === "conv_asc") return a.conversions - b.conversions;
      if (breakdownSort === "cpa_asc") {
        if (a.conversions === 0) return 1;
        if (b.conversions === 0) return -1;
        return a.cpa - b.cpa;
      }
      if (breakdownSort === "cpa_desc") return b.cpa - a.cpa;
      if (breakdownSort === "ctr_desc") return b.ctr - a.ctr;
      return b.spend - a.spend;
    });
  }, [campaigns, breakdownDimension, breakdownSort]);

  // Diagnóstico automático do funil
  const diagnostics = useMemo(() => {
    const list: { type: "good" | "warning" | "danger"; title: string; desc: string }[] = [];

    if (metrics.ctr < 1.0 && metrics.impressions > 500) {
      list.push({
        type: "warning",
        title: "Gargalo no Topo do Funil (CTR Baixo)",
        desc: `O CTR está em ${metrics.ctr.toFixed(2)}% (ideal > 1.5%). Seus criativos ou públicos podem estar desgastados. Considere testar novos ganchos visuais e copys.`,
      });
    } else if (metrics.ctr >= 1.5) {
      list.push({
        type: "good",
        title: "Excelente Atração de Cliques",
        desc: `O CTR está em ${metrics.ctr.toFixed(2)}%, demonstrando boa ressonância dos criativos com o público-alvo.`,
      });
    }

    if (metrics.clickToConversationRate < 8.0 && metrics.clicks > 50) {
      list.push({
        type: "danger",
        title: "Queda na Conversão (Cliques → Conversas)",
        desc: `Apenas ${metrics.clickToConversationRate.toFixed(1)}% dos usuários que clicaram iniciaram uma conversa (ideal > 12%). Revise a mensagem padrão de saudação do anúncio ou o direcionamento para o WhatsApp.`,
      });
    } else if (metrics.clickToConversationRate >= 15.0) {
      list.push({
        type: "good",
        title: "Alta Taxa de Conversas Iniciadas",
        desc: `${metrics.clickToConversationRate.toFixed(1)}% dos cliques viram conversas diretas, mantendo o CPA baixo e a qualificação alta.`,
      });
    }

    if (metrics.cpa <= 3.0 && metrics.conversions > 0) {
      list.push({
        type: "good",
        title: "CPA / CPR Altamente Saudável",
        desc: `O custo por conversa está em R$ ${metrics.cpa.toFixed(2)}, dentro da faixa verde de alta lucratividade (R$ 0 - 5).`,
      });
    } else if (metrics.cpa > 8.0 && metrics.conversions > 0) {
      list.push({
        type: "danger",
        title: "Alerta de CPA Elevado",
        desc: `O custo por conversa está em R$ ${metrics.cpa.toFixed(2)} (acima da média segura de R$ 5,00). Otimize os conjuntos com CPR elevado para economizar verba.`,
      });
    }

    return list;
  }, [metrics]);

  return (
    <div className="space-y-6 animate-fade-in" id="conversion-funnel-tab">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Filter className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
                Funil de Conversão
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs px-2 py-0.5">
                  Exposição → Cliques → Conversas
                </Badge>
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Acompanhe a retenção entre cada etapa do anúncio, as taxas de passagem (%) e o CPA (Custo por Conversa Gerada).
              </p>
            </div>
          </div>
        </div>

        {/* Filtro de Empresa */}
        {companiesList.length > 1 && (
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="h-8 text-xs rounded-md bg-secondary/60 border border-border/70 px-2.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">Todas as Empresas ({campaigns.length} cjs)</option>
              {companiesList.map((comp) => (
                <option key={comp} value={comp}>
                  {comp}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 3-Step Visual Funnel Architecture */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ETAPA 1: IMPRESSÕES / EXPOSIÇÃO */}
        <div className="glass-card p-5 border-l-4 border-l-blue-500 flex flex-col justify-between space-y-4 relative overflow-hidden">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                <Eye className="w-4 h-4" /> Etapa 1: Topo do Funil
              </span>
              <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px]">
                100% Exposição
              </Badge>
            </div>
            <h4 className="text-xl font-display font-bold text-foreground">
              Impressões & Alcance
            </h4>
            <p className="text-3xl font-display font-bold text-blue-400">
              {metrics.impressions.toLocaleString("pt-BR")}
            </p>
            <p className="text-xs text-muted-foreground">
              {metrics.reach.toLocaleString("pt-BR")} pessoas únicas alcançadas
            </p>
          </div>

          <div className="pt-3 border-t border-border/50 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Custo por Mil (CPM):</span>
            <span className="font-semibold text-foreground">R$ {metrics.cpm.toFixed(2)}</span>
          </div>
        </div>

        {/* ETAPA 2: CLIQUES */}
        <div className="glass-card p-5 border-l-4 border-l-purple-500 flex flex-col justify-between space-y-4 relative overflow-hidden">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                <MousePointerClick className="w-4 h-4" /> Etapa 2: Meio do Funil
              </span>
              <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-[10px]">
                CTR {metrics.ctr.toFixed(2)}%
              </Badge>
            </div>
            <h4 className="text-xl font-display font-bold text-foreground">
              Cliques Gerados
            </h4>
            <p className="text-3xl font-display font-bold text-purple-400">
              {metrics.clicks.toLocaleString("pt-BR")}
            </p>
            <p className="text-xs text-muted-foreground">
              Taxa de passagem do anúncio: <strong className="text-foreground">{metrics.ctr.toFixed(2)}%</strong>
            </p>
          </div>

          <div className="pt-3 border-t border-border/50 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Custo por Clique (CPC):</span>
            <span className="font-semibold text-foreground">R$ {metrics.cpc.toFixed(2)}</span>
          </div>
        </div>

        {/* ETAPA 3: CONVERSAS GERADAS */}
        <div className="glass-card p-5 border-l-4 border-l-emerald-500 flex flex-col justify-between space-y-4 relative overflow-hidden">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4" /> Etapa 3: Fundo do Funil
              </span>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
                Conv. {metrics.clickToConversationRate.toFixed(1)}%
              </Badge>
            </div>
            <h4 className="text-xl font-display font-bold text-foreground">
              Conversas Geradas
            </h4>
            <p className="text-3xl font-display font-bold text-emerald-400">
              {metrics.conversions.toLocaleString("pt-BR")}
            </p>
            <p className="text-xs text-muted-foreground">
              Cliques que viraram conversas: <strong className="text-emerald-400">{metrics.clickToConversationRate.toFixed(1)}%</strong>
            </p>
          </div>

          <div className="pt-3 border-t border-border/50 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">CPA / Custo por Conversa:</span>
            <span className="font-bold text-emerald-400 text-sm">
              {metrics.conversions > 0 ? `R$ ${metrics.cpa.toFixed(2)}` : "Sem conversão"}
            </span>
          </div>
        </div>
      </div>

      {/* Visual Step-Down Conversion Funnel Display */}
      <div className="glass-card p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-display font-semibold text-base text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Taxas de Passagem & Retenção do Funil
            </h4>
            <p className="text-xs text-muted-foreground">
              Visualização de fluxo do impacto dos anúncios até o início das conversas
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-muted-foreground">Investimento Total:</span>
            <p className="text-lg font-display font-bold text-foreground">
              R$ {metrics.totalSpend.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Funnel Flow Graphic */}
        <div className="space-y-3 max-w-4xl mx-auto py-2">
          {/* Top Stage */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium flex items-center gap-1.5 text-blue-400">
                <Eye className="w-4 h-4" /> 1. Impressões (Visualizações do Anúncio)
              </span>
              <span className="font-bold">{metrics.impressions.toLocaleString("pt-BR")} (100%)</span>
            </div>
            <div className="w-full h-8 bg-blue-500/20 rounded-lg overflow-hidden flex items-center px-3 border border-blue-500/30">
              <div className="h-full bg-blue-500 rounded-md" style={{ width: "100%" }} />
            </div>
          </div>

          {/* Pass-through Connector 1 */}
          <div className="flex items-center justify-center gap-3 py-1">
            <div className="h-4 w-px bg-border/80" />
            <span className="px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-400 text-xs font-semibold flex items-center gap-1">
              <ArrowDown className="w-3.5 h-3.5" />
              {metrics.ctr.toFixed(2)}% clicam no anúncio (CTR) · CPC R$ {metrics.cpc.toFixed(2)}
            </span>
            <div className="h-4 w-px bg-border/80" />
          </div>

          {/* Middle Stage */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium flex items-center gap-1.5 text-purple-400">
                <MousePointerClick className="w-4 h-4" /> 2. Cliques no Link / Anúncio
              </span>
              <span className="font-bold">{metrics.clicks.toLocaleString("pt-BR")} ({metrics.ctr.toFixed(2)}% do topo)</span>
            </div>
            <div className="w-full h-8 bg-purple-500/20 rounded-lg overflow-hidden flex items-center px-3 border border-purple-500/30">
              <div
                className="h-full bg-purple-500 rounded-md transition-all duration-500"
                style={{ width: `${Math.max(8, Math.min(100, metrics.ctr * 15))}%` }}
              />
            </div>
          </div>

          {/* Pass-through Connector 2 */}
          <div className="flex items-center justify-center gap-3 py-1">
            <div className="h-4 w-px bg-border/80" />
            <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-1">
              <ArrowDown className="w-3.5 h-3.5" />
              {metrics.clickToConversationRate.toFixed(1)}% iniciam conversa · CPA R$ {metrics.cpa.toFixed(2)}
            </span>
            <div className="h-4 w-px bg-border/80" />
          </div>

          {/* Bottom Stage */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium flex items-center gap-1.5 text-emerald-400">
                <MessageCircle className="w-4 h-4" /> 3. Conversas Geradas (Leads / WhatsApp)
              </span>
              <span className="font-bold text-emerald-400">
                {metrics.conversions.toLocaleString("pt-BR")} ({metrics.clickToConversationRate.toFixed(1)}% dos cliques)
              </span>
            </div>
            <div className="w-full h-8 bg-emerald-500/20 rounded-lg overflow-hidden flex items-center px-3 border border-emerald-500/30">
              <div
                className="h-full bg-emerald-500 rounded-md transition-all duration-500"
                style={{ width: `${Math.max(6, Math.min(100, metrics.clickToConversationRate * 2.5))}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Diagnostics and Insights */}
      {diagnostics.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {diagnostics.map((diag, i) => (
            <div
              key={i}
              className={cn(
                "glass-card p-4 flex items-start gap-3 border",
                diag.type === "good"
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : diag.type === "warning"
                  ? "border-amber-500/30 bg-amber-500/5"
                  : "border-destructive/30 bg-destructive/5"
              )}
            >
              {diag.type === "good" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : diag.type === "warning" ? (
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <h5 className="font-semibold text-xs text-foreground">{diag.title}</h5>
                <p className="text-xs text-muted-foreground leading-relaxed">{diag.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Funnel Performance by Dimension */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h4 className="font-display font-semibold text-sm flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              Desempenho do Funil por Dimensão ({breakdownFunnels.length})
            </h4>
            <span className="text-xs text-muted-foreground">Comparativo de retenção, conversão e CPA</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Seletor de Ordenação */}
            <div className="flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
              <select
                value={breakdownSort}
                onChange={(e: any) => setBreakdownSort(e.target.value)}
                className="h-8 text-xs rounded-md bg-secondary/60 border border-border/70 px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="spend_desc">Maior Investimento</option>
                <option value="spend_asc">Menor Investimento</option>
                <option value="conv_desc">Mais Conversões</option>
                <option value="conv_asc">Menos Conversões</option>
                <option value="cpa_asc">Menor CPA (Mais Eficiente)</option>
                <option value="cpa_desc">Maior CPA</option>
                <option value="ctr_desc">Maior CTR</option>
              </select>
            </div>

            <div className="flex items-center gap-1 bg-secondary/40 p-0.5 rounded-lg border border-border/50">
              <button
                onClick={() => setBreakdownDimension("company")}
                className={cn("px-2 py-1 rounded text-xs font-medium transition-colors", breakdownDimension === "company" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground")}
              >
                Empresa
              </button>
              <button
                onClick={() => setBreakdownDimension("agency")}
                className={cn("px-2 py-1 rounded text-xs font-medium transition-colors", breakdownDimension === "agency" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground")}
              >
                Agência
              </button>
              <button
                onClick={() => setBreakdownDimension("contractType")}
                className={cn("px-2 py-1 rounded text-xs font-medium transition-colors", breakdownDimension === "contractType" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground")}
              >
                Modalidade
              </button>
              <button
                onClick={() => setBreakdownDimension("veiculation")}
                className={cn("px-2 py-1 rounded text-xs font-medium transition-colors", breakdownDimension === "veiculation" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground")}
              >
                Veiculação
              </button>
              <button
                onClick={() => setBreakdownDimension("rateio")}
                className={cn("px-2 py-1 rounded text-xs font-medium transition-colors", breakdownDimension === "rateio" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground")}
              >
                Rateio
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm text-left">
            <thead className="bg-secondary/60 text-muted-foreground uppercase text-[11px] font-semibold border-b border-border/60">
              <tr>
                <th className="p-3">
                  {breakdownDimension === "company" ? "Empresa" : breakdownDimension === "agency" ? "Agência" : breakdownDimension === "contractType" ? "Modalidade (EF/TE)" : breakdownDimension === "veiculation" ? "Tipo de Veiculação" : "Rateio"}
                </th>
                <th className="p-3 text-right">Investimento</th>
                <th className="p-3 text-right">Impressões</th>
                <th className="p-3 text-right">Cliques (CTR)</th>
                <th className="p-3 text-right">Conversas (% Conv.)</th>
                <th className="p-3 text-right">CPA / CPR</th>
                <th className="p-3 text-center">Status Funil</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {(expandBreakdown ? breakdownFunnels : breakdownFunnels.slice(0, 3)).map((item, idx) => {
                const cpaStatus =
                  item.conversions === 0
                    ? { label: "Sem Conversas", color: "bg-destructive/15 text-destructive border-destructive/30" }
                    : item.cpa <= 2.5
                    ? { label: "Alta Eficiência", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" }
                    : item.cpa <= 6.0
                    ? { label: "Saudável", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" }
                    : { label: "CPA Alto", color: "bg-amber-500/15 text-amber-400 border-amber-500/30" };

                return (
                  <tr key={idx} className="hover:bg-secondary/30 transition-colors">
                    <td className="p-3 font-medium">
                      <div className="flex items-center gap-1.5">
                        <span className="text-foreground font-semibold">{item.dimensionName}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{item.adSetCount} conjuntos</span>
                    </td>

                    <td className="p-3 text-right tabular-nums font-medium text-foreground">
                      R$ {item.spend.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    <td className="p-3 text-right tabular-nums text-muted-foreground">
                      {item.impressions.toLocaleString("pt-BR")}
                    </td>

                    <td className="p-3 text-right tabular-nums">
                      <span className="font-semibold text-foreground">{item.clicks.toLocaleString("pt-BR")}</span>
                      <span className="block text-[10px] text-purple-400 font-medium">{item.ctr.toFixed(2)}% CTR</span>
                    </td>

                    <td className="p-3 text-right tabular-nums">
                      <span className={cn("font-bold text-sm", item.conversions > 0 ? "text-emerald-400" : "text-muted-foreground")}>
                        {item.conversions}
                      </span>
                      <span className="block text-[10px] text-muted-foreground">{item.cvr.toFixed(1)}% conv.</span>
                    </td>

                    <td className="p-3 text-right tabular-nums">
                      <span className={cn("font-bold", item.cpa <= 3 ? "text-emerald-400" : item.cpa <= 7 ? "text-blue-400" : "text-amber-400")}>
                        {item.conversions > 0 ? `R$ ${item.cpa.toFixed(2)}` : "—"}
                      </span>
                    </td>

                    <td className="p-3 text-center">
                      <Badge variant="outline" className={cn("text-[10px] px-2 py-0.5", cpaStatus.color)}>
                        {cpaStatus.label}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {breakdownFunnels.length > 3 && (
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpandBreakdown(!expandBreakdown)}
              className="text-xs gap-1.5"
            >
              {expandBreakdown ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" /> Mostrar menos (Top 3)
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" /> Ver todas as {breakdownFunnels.length} dimensões
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
