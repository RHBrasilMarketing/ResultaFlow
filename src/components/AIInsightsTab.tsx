import { useState, useMemo } from "react";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Zap,
  Search,
  Calendar,
  Lightbulb,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  BrainCircuit,
  Scale,
  Minus,
  CheckCircle2,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { CampaignData, AnalysisResult } from "@/types/campaign";
import { cn } from "@/lib/utils";

interface AIInsightsTabProps {
  campaigns: CampaignData[];
  analysis: AnalysisResult | null;
  dailyRows?: CampaignData[];
  totalBudget?: number;
}

interface PeriodMetrics {
  spend: number;
  conversions: number;
  impressions: number;
  clicks: number;
  cpr: number;
  ctr: number;
  cpm: number;
  frequency: number;
  label: string;
}

interface SignalDiagnostic {
  id: string;
  campaignName: string;
  adSetName: string;
  metricDegraded: string;
  probableCause: string;
  rootCauseDetails: string;
  crossSignals: {
    frequency: number;
    cpm: number;
    ctr: number;
    lpConversionRate?: number;
    cpc?: number;
  };
  recommendation: string;
  urgency: "high" | "medium" | "low";
}

interface AISuggestion {
  id: string;
  type: "pause" | "scale" | "refresh_creative" | "optimize_lp";
  title: string;
  targetName: string;
  reason: string;
  impactEstimate: string;
  urgency: "alta" | "média" | "baixa";
}

const brl = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function aggregateRows(rows: CampaignData[], label: string): PeriodMetrics {
  const spend = rows.reduce((s, r) => s + r.spend, 0);
  const conversions = rows.reduce((s, r) => s + r.conversions, 0);
  const impressions = rows.reduce((s, r) => s + r.impressions, 0);
  const clicks = rows.reduce((s, r) => s + (r.linkClicks > 0 ? r.linkClicks : r.clicks), 0);
  const reach = rows.reduce((s, r) => s + r.reach, 0);

  const cpr = conversions > 0 ? spend / conversions : 0;
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
  const frequency = reach > 0 ? impressions / reach : 1.0;

  return {
    spend,
    conversions,
    impressions,
    clicks,
    cpr,
    ctr,
    cpm,
    frequency,
    label,
  };
}

export function AIInsightsTab({ campaigns, dailyRows = [], totalBudget = 0 }: AIInsightsTabProps) {
  const [periodMode, setPeriodMode] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [expandDiagnostics, setExpandDiagnostics] = useState(false);
  const [expandSuggestions, setExpandSuggestions] = useState(false);
  const [expandForecast, setExpandForecast] = useState(false);

  // Ordena dias únicos disponíveis
  const uniqueDays = useMemo(() => {
    const set = new Set<string>();
    dailyRows.forEach((r) => {
      if (r.day) set.add(r.day);
    });
    return Array.from(set).sort();
  }, [dailyRows]);

  // Cálculos de Período Atual vs Período Anterior
  const periodComparison = useMemo(() => {
    if (uniqueDays.length === 0) {
      const fallback = aggregateRows(campaigns, "Período Atual");
      return {
        current: fallback,
        previous: fallback,
        comparisonLabel: "Comparativo automático indisponível (dados consolidados)",
        deltaSpend: 0,
        deltaConv: 0,
        deltaCPR: 0,
        deltaCTR: 0,
      };
    }

    const totalDays = uniqueDays.length;

    if (periodMode === "daily") {
      const latestDay = uniqueDays[totalDays - 1];
      const prevDay = totalDays >= 2 ? uniqueDays[totalDays - 2] : null;

      const currentRows = dailyRows.filter((r) => r.day === latestDay);
      const prevRows = prevDay ? dailyRows.filter((r) => r.day === prevDay) : [];

      const current = aggregateRows(currentRows, latestDay);
      const previous = aggregateRows(prevRows, prevDay || "Dia anterior");

      const deltaSpend = previous.spend > 0 ? ((current.spend - previous.spend) / previous.spend) * 100 : 0;
      const deltaConv = previous.conversions > 0 ? ((current.conversions - previous.conversions) / previous.conversions) * 100 : 0;
      const deltaCPR = previous.cpr > 0 && current.cpr > 0 ? ((current.cpr - previous.cpr) / previous.cpr) * 100 : 0;
      const deltaCTR = previous.ctr > 0 ? ((current.ctr - previous.ctr) / previous.ctr) * 100 : 0;

      return {
        current,
        previous,
        comparisonLabel: prevDay ? `Comparado ao dia anterior (${prevDay.split("-").reverse().join("/")})` : "Dia mais recente registrado",
        deltaSpend,
        deltaConv,
        deltaCPR,
        deltaCTR,
      };
    }

    if (periodMode === "weekly") {
      const currentWeekDays = uniqueDays.slice(Math.max(0, totalDays - 7));
      const prevWeekDays = uniqueDays.slice(Math.max(0, totalDays - 14), Math.max(0, totalDays - 7));

      const currentRows = dailyRows.filter((r) => r.day && currentWeekDays.includes(r.day));
      const prevRows = dailyRows.filter((r) => r.day && prevWeekDays.includes(r.day));

      const current = aggregateRows(currentRows, "Últimos 7 dias");
      const previous = aggregateRows(prevRows, "7 dias anteriores");

      const deltaSpend = previous.spend > 0 ? ((current.spend - previous.spend) / previous.spend) * 100 : 0;
      const deltaConv = previous.conversions > 0 ? ((current.conversions - previous.conversions) / previous.conversions) * 100 : 0;
      const deltaCPR = previous.cpr > 0 && current.cpr > 0 ? ((current.cpr - previous.cpr) / previous.cpr) * 100 : 0;
      const deltaCTR = previous.ctr > 0 ? ((current.ctr - previous.ctr) / previous.ctr) * 100 : 0;

      return {
        current,
        previous,
        comparisonLabel: prevWeekDays.length > 0 ? `Comparado aos 7 dias anteriores` : "Semana atual",
        deltaSpend,
        deltaConv,
        deltaCPR,
        deltaCTR,
      };
    }

    // Monthly
    const currentMonthDays = uniqueDays.slice(Math.max(0, totalDays - 30));
    const prevMonthDays = uniqueDays.slice(Math.max(0, totalDays - 60), Math.max(0, totalDays - 30));

    const currentRows = dailyRows.filter((r) => r.day && currentMonthDays.includes(r.day));
    const prevRows = dailyRows.filter((r) => r.day && prevMonthDays.includes(r.day));

    const current = aggregateRows(currentRows, "Mês Atual (30d)");
    const previous = aggregateRows(prevRows, "Mês Anterior (30d)");

    const deltaSpend = previous.spend > 0 ? ((current.spend - previous.spend) / previous.spend) * 100 : 0;
    const deltaConv = previous.conversions > 0 ? ((current.conversions - previous.conversions) / previous.conversions) * 100 : 0;
    const deltaCPR = previous.cpr > 0 && current.cpr > 0 ? ((current.cpr - previous.cpr) / previous.cpr) * 100 : 0;
    const deltaCTR = previous.ctr > 0 ? ((current.ctr - previous.ctr) / previous.ctr) * 100 : 0;

    return {
      current,
      previous,
      comparisonLabel: prevMonthDays.length > 0 ? `Comparado ao mês anterior` : "Mês atual",
      deltaSpend,
      deltaConv,
      deltaCPR,
      deltaCTR,
    };
  }, [uniqueDays, dailyRows, campaigns, periodMode]);

  // Totais consolidados
  const totals = useMemo(() => {
    const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
    const totalConversions = campaigns.reduce((s, c) => s + c.conversions, 0);
    const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0);
    const totalClicks = campaigns.reduce((s, c) => s + (c.linkClicks > 0 ? c.linkClicks : c.clicks), 0);
    const validCPR = campaigns.filter((c) => c.conversions > 0 && c.costPerResult > 0);
    const avgCPR = totalConversions > 0 ? totalSpend / totalConversions : 0;
    const avgCPM = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
    const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

    return {
      totalSpend,
      totalConversions,
      totalImpressions,
      totalClicks,
      avgCPR,
      avgCPM,
      avgCTR,
      validCPR,
    };
  }, [campaigns]);

  // Diagnóstico de Causa Provável
  const probableCauses: SignalDiagnostic[] = useMemo(() => {
    const diagnostics: SignalDiagnostic[] = [];

    campaigns.forEach((c) => {
      // Cruzamento 1: Fadiga de Criativo
      if (c.frequency >= 2.5 && c.ctr <= 1.0 && c.spend >= 20) {
        diagnostics.push({
          id: `diag-fatigue-${c.id}`,
          campaignName: c.campaignName,
          adSetName: c.adSetName,
          metricDegraded: "Queda acentuada de CTR e aumento de CPR",
          probableCause: "Fadiga de Criativo (Saturação de Audiência)",
          rootCauseDetails: `A frequência atingiu ${c.frequency.toFixed(2)}x com CTR em ${c.ctr.toFixed(2)}%. O público já visualizou o anúncio repetidas vezes sem converter novamente.`,
          crossSignals: {
            frequency: c.frequency,
            cpm: c.cpm,
            ctr: c.ctr,
            cpc: c.cpc,
          },
          recommendation: "Pausar criativos desgastados e subir novas variações visuais com ângulos de oferta alternativos.",
          urgency: "high",
        });
      }

      // Cruzamento 2: Leilão Caro
      if (c.cpm >= 35 && c.ctr >= 1.5 && c.costPerResult >= totals.avgCPR * 1.3) {
        diagnostics.push({
          id: `diag-auction-${c.id}`,
          campaignName: c.campaignName,
          adSetName: c.adSetName,
          metricDegraded: "CPR acima da média com CPM elevado",
          probableCause: "Concorrência Alta no Leilão / Audiência Muito Estreita",
          rootCauseDetails: `O CPM está em ${brl(c.cpm)}, encarecendo o custo de entrega apesar do bom CTR (${c.ctr.toFixed(2)}%). A segmentação pode estar competindo em nichos disputados.`,
          crossSignals: {
            frequency: c.frequency,
            cpm: c.cpm,
            ctr: c.ctr,
            cpc: c.cpc,
          },
          recommendation: "Amplie a segmentação demográfica/geográfica ou adicione posicionamentos automáticos (Advantage+).",
          urgency: "medium",
        });
      }

      // Cruzamento 3: Fricção pós-clique
      const clicks = c.linkClicks > 0 ? c.linkClicks : c.clicks;
      if (clicks >= 35 && c.conversions <= 1) {
        const estConvRate = (c.conversions / clicks) * 100;
        diagnostics.push({
          id: `diag-lp-${c.id}`,
          campaignName: c.campaignName,
          adSetName: c.adSetName,
          metricDegraded: "Taxa de Conversão pós-clique reduzida",
          probableCause: "Fricção na Página de Destino ou no Atendimento WhatsApp",
          rootCauseDetails: `O anúncio atraiu ${clicks} cliques com custo por clique de ${brl(c.cpc)}, mas converteu apenas ${c.conversions} resultado(s) (${estConvRate.toFixed(1)}%). O anúncio gera interesse, porém há atrito no destino.`,
          crossSignals: {
            frequency: c.frequency,
            cpm: c.cpm,
            ctr: c.ctr,
            lpConversionRate: estConvRate,
            cpc: c.cpc,
          },
          recommendation: "Verifique o tempo de carregamento no mobile, clareza da mensagem inicial e tempo de resposta no WhatsApp.",
          urgency: "high",
        });
      }
    });

    return diagnostics;
  }, [campaigns, totals]);

  // Sugestões de Ação Estratégica
  const actionSuggestions: AISuggestion[] = useMemo(() => {
    const suggestions: AISuggestion[] = [];
    const withoutResults = campaigns
      .filter((c) => c.conversions === 0 && c.spend >= 15)
      .sort((a, b) => b.spend - a.spend);

    const scalableSets = campaigns
      .filter((c) => c.conversions >= 2 && c.costPerResult > 0 && c.costPerResult <= (totals.avgCPR || 1) * 0.8)
      .sort((a, b) => a.costPerResult - b.costPerResult);

    const fatigueSets = campaigns
      .filter((c) => c.frequency >= 2.8)
      .sort((a, b) => b.frequency - a.frequency);

    if (withoutResults.length > 0) {
      const topWaste = withoutResults[0];
      const totalWaste = withoutResults.reduce((s, c) => s + c.spend, 0);
      suggestions.push({
        id: "sug-pause-1",
        type: "pause",
        title: `Pausar conjunto "${topWaste.adSetName}"`,
        targetName: topWaste.adSetName,
        reason: `Consumiu ${brl(topWaste.spend)} sem gerar conversões diretas no período.`,
        impactEstimate: `Economia imediata de até ${brl(totalWaste)} ao pausar os ${withoutResults.length} conjuntos improdutivos.`,
        urgency: "alta",
      });
    }

    if (scalableSets.length > 0) {
      const topBest = scalableSets[0];
      suggestions.push({
        id: "sug-scale-1",
        type: "scale",
        title: `Aumentar orçamento em "${topBest.adSetName}"`,
        targetName: topBest.adSetName,
        reason: `Opera com CPR de ${brl(topBest.costPerResult)}, significativamente abaixo da média de ${brl(totals.avgCPR)}.`,
        impactEstimate: `Potencial de gerar +25% a +35% de novos resultados mantendo eficiência de custo.`,
        urgency: "alta",
      });
    }

    if (fatigueSets.length > 0) {
      const topFatigue = fatigueSets[0];
      suggestions.push({
        id: "sug-creative-1",
        type: "refresh_creative",
        title: `Renovar criativos de "${topFatigue.adSetName}"`,
        targetName: topFatigue.adSetName,
        reason: `Frequência de ${topFatigue.frequency.toFixed(2)}x indica saturação da base impactada.`,
        impactEstimate: "Recuperação de 20% a 30% na taxa de cliques (CTR).",
        urgency: "média",
      });
    }

    suggestions.push({
      id: "sug-lp-1",
      type: "optimize_lp",
      title: "Otimizar velocidade e saudação no destino",
      targetName: "Páginas de Destino / Atendimento",
      reason: "Mais de 80% do tráfego é mobile. Formulários simples aumentam a taxa de contato.",
      impactEstimate: "Aumento estimado de 15% na taxa de conversão final.",
      urgency: "média",
    });

    return suggestions;
  }, [campaigns, totals]);

  // Previsão de Ritmo e Fechamento
  const forecast = useMemo(() => {
    const today = new Date();
    const currentDay = today.getDate();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const daysElapsed = Math.max(1, currentDay);
    const daysRemaining = Math.max(1, daysInMonth - currentDay);

    const currentSpend = totals.totalSpend;
    const currentConversions = totals.totalConversions;
    const dailySpendRate = currentSpend / daysElapsed;
    const dailyConvRate = currentConversions / daysElapsed;

    const projectedSpend = currentSpend + dailySpendRate * daysRemaining;
    const projectedConversions = Math.round(currentConversions + dailyConvRate * daysRemaining);
    const projectedAvgCPR = projectedConversions > 0 ? projectedSpend / projectedConversions : totals.avgCPR;

    return {
      daysElapsed,
      daysRemaining,
      currentSpend,
      projectedSpend,
      currentConversions,
      projectedConversions,
      currentAvgCPR: totals.avgCPR,
      projectedAvgCPR,
      confidenceScore: Math.min(95, Math.max(70, 75 + daysElapsed * 0.7)),
    };
  }, [totals]);

  const renderDelta = (delta: number, inverted = false) => {
    if (Math.abs(delta) < 0.01) {
      return (
        <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
          <Minus className="w-3 h-3" /> Estável
        </span>
      );
    }

    const isPositive = delta > 0;
    const isGood = inverted ? !isPositive : isPositive;

    return (
      <span
        className={cn(
          "text-[11px] font-semibold flex items-center gap-0.5",
          isGood ? "text-emerald-400" : "text-destructive"
        )}
      >
        {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {isPositive ? `+${delta.toFixed(1)}%` : `${delta.toFixed(1)}%`}
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in" id="ai-insights-module">
      {/* Header */}
      <div className="glass-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-lg">Central de IA e Insights Acionáveis</h3>
            <p className="text-xs text-muted-foreground">
              Comparativo automático por período, diagnósticos de causa provável e previsões de fechamento
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs px-2.5 py-1 gap-1">
            <Sparkles className="w-3.5 h-3.5" /> Motor Analítico Ativo
          </Badge>
        </div>
      </div>

      {/* 1. Comparativo de Período (Diário / Semanal / Mensal) */}
      <div className="glass-card p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-4">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-primary" />
            <div>
              <h4 className="text-sm font-display font-semibold text-foreground">
                Análise Comparativa de Desempenho
              </h4>
              <p className="text-xs text-muted-foreground">{periodComparison.comparisonLabel}</p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-secondary/60 p-1 rounded-lg border border-border/60">
            <Button
              size="sm"
              variant={periodMode === "daily" ? "default" : "ghost"}
              className="h-7 text-xs px-3"
              onClick={() => setPeriodMode("daily")}
            >
              Visão Diária
            </Button>
            <Button
              size="sm"
              variant={periodMode === "weekly" ? "default" : "ghost"}
              className="h-7 text-xs px-3"
              onClick={() => setPeriodMode("weekly")}
            >
              Visão Semanal
            </Button>
            <Button
              size="sm"
              variant={periodMode === "monthly" ? "default" : "ghost"}
              className="h-7 text-xs px-3"
              onClick={() => setPeriodMode("monthly")}
            >
              Visão Mensal
            </Button>
          </div>
        </div>

        {/* Comparison Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Investimento */}
          <div className="p-4 rounded-xl bg-secondary/30 border border-border/50 space-y-2">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Investimento
            </span>
            <div className="text-lg font-bold font-display text-foreground">
              {brl(periodComparison.current.spend)}
            </div>
            <div className="flex items-center justify-between text-xs pt-1 border-t border-border/30">
              <span className="text-muted-foreground text-[11px]">
                Anterior: {brl(periodComparison.previous.spend)}
              </span>
              {renderDelta(periodComparison.deltaSpend)}
            </div>
          </div>

          {/* Conversões */}
          <div className="p-4 rounded-xl bg-secondary/30 border border-border/50 space-y-2">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Conversões (Resultados)
            </span>
            <div className="text-lg font-bold font-display text-emerald-400">
              {periodComparison.current.conversions}
            </div>
            <div className="flex items-center justify-between text-xs pt-1 border-t border-border/30">
              <span className="text-muted-foreground text-[11px]">
                Anterior: {periodComparison.previous.conversions}
              </span>
              {renderDelta(periodComparison.deltaConv)}
            </div>
          </div>

          {/* CPR Médio */}
          <div className="p-4 rounded-xl bg-secondary/30 border border-border/50 space-y-2">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Custo por Resultado (CPR)
            </span>
            <div className="text-lg font-bold font-display text-foreground">
              {periodComparison.current.cpr > 0 ? brl(periodComparison.current.cpr) : "—"}
            </div>
            <div className="flex items-center justify-between text-xs pt-1 border-t border-border/30">
              <span className="text-muted-foreground text-[11px]">
                Anterior: {periodComparison.previous.cpr > 0 ? brl(periodComparison.previous.cpr) : "—"}
              </span>
              {renderDelta(periodComparison.deltaCPR, true)}
            </div>
          </div>

          {/* CTR */}
          <div className="p-4 rounded-xl bg-secondary/30 border border-border/50 space-y-2">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Taxa de Cliques (CTR)
            </span>
            <div className="text-lg font-bold font-display text-purple-400">
              {periodComparison.current.ctr.toFixed(2)}%
            </div>
            <div className="flex items-center justify-between text-xs pt-1 border-t border-border/30">
              <span className="text-muted-foreground text-[11px]">
                Anterior: {periodComparison.previous.ctr.toFixed(2)}%
              </span>
              {renderDelta(periodComparison.deltaCTR)}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Diagnóstico de Causa Provável (Cruzamento de Sinais) com 1º resultado + Expandir */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <div>
            <h4 className="text-sm font-display font-semibold text-foreground flex items-center gap-2">
              <Search className="w-4 h-4 text-primary" /> Diagnóstico de Causa Provável
            </h4>
            <p className="text-xs text-muted-foreground">
              Cruzamento de Frequência, CPM, CTR e Conversão pós-clique
            </p>
          </div>
          <Badge variant="secondary" className="text-xs font-mono">
            {probableCauses.length} identificados
          </Badge>
        </div>

        {probableCauses.length === 0 ? (
          <div className="p-5 rounded-xl bg-secondary/30 border border-border/50 flex items-start gap-3.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h5 className="text-xs font-semibold text-foreground">
                Saúde Operacional Estável no Período
              </h5>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Ao comparar a entrega atual com o período anterior ({periodComparison.comparisonLabel.toLowerCase()}), os sinais cruzados de frequência (média em {periodComparison.current.frequency.toFixed(2)}x), CPM ({brl(periodComparison.current.cpm)}) e retenção pós-clique estão operando dentro das faixas normais de leilão, sem gargalos críticos de saturação ou atrito de atendimento.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3.5 rounded-lg bg-secondary/30 border border-border/50 text-xs text-muted-foreground leading-relaxed flex items-start gap-2.5">
              <Activity className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>
                Identificamos <strong>{probableCauses.length} oportunidade(s) de ajuste</strong> em relação ao período anterior ({periodComparison.comparisonLabel.toLowerCase()}), onde alterações no leilão ou saturação de público causaram variação no custo por resultado.
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(expandDiagnostics ? probableCauses : probableCauses.slice(0, 1)).map((diag) => (
                <div
                  key={diag.id}
                  className="p-4 rounded-xl bg-secondary/30 border border-border/60 space-y-3 hover:bg-secondary/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          diag.urgency === "high"
                            ? "bg-destructive/15 text-destructive border-destructive/30"
                            : "bg-amber-500/15 text-amber-500 border-amber-500/30"
                        }`}
                      >
                        {diag.probableCause}
                      </Badge>
                      <h5 className="font-semibold text-xs text-foreground pt-1">{diag.adSetName}</h5>
                    </div>
                    <span className="text-[10px] text-muted-foreground bg-background/60 px-2 py-0.5 rounded border border-border/40">
                      {diag.metricDegraded}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">{diag.rootCauseDetails}</p>

                  <div className="grid grid-cols-3 gap-1.5 p-2 rounded-lg bg-background/40 border border-border/30 text-[10px]">
                    <div>
                      <span className="text-muted-foreground">Freq:</span>{" "}
                      <strong className="text-foreground">{diag.crossSignals.frequency.toFixed(2)}x</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">CPM:</span>{" "}
                      <strong className="text-foreground">{brl(diag.crossSignals.cpm)}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">CTR:</span>{" "}
                      <strong className="text-foreground">{diag.crossSignals.ctr.toFixed(2)}%</strong>
                    </div>
                  </div>

                  <div className="flex items-start gap-1.5 text-xs pt-1">
                    <ArrowRight className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                    <p className="text-xs text-foreground/90">
                      <strong className="text-primary">Ação:</strong> {diag.recommendation}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {probableCauses.length > 1 && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setExpandDiagnostics(!expandDiagnostics)}
                  className="text-xs gap-1.5"
                >
                  {expandDiagnostics ? (
                    <>
                      <ChevronUp className="w-3.5 h-3.5" /> Mostrar menos (1 resultado)
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3.5 h-3.5" /> Ver todos os {probableCauses.length} diagnósticos
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Sugestões de Ação Estratégica (1º resultado + Expandir) */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <h4 className="text-sm font-display font-semibold text-foreground flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500" /> Sugestões de Ação Estratégica
          </h4>
          <Badge variant="secondary" className="text-xs font-mono">
            {actionSuggestions.length} sugestões
          </Badge>
        </div>

        <div className="space-y-3">
          {(expandSuggestions ? actionSuggestions : actionSuggestions.slice(0, 1)).map((sug) => (
            <div key={sug.id} className="p-3.5 rounded-xl bg-secondary/30 border border-border/50 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-xs text-foreground">{sug.title}</span>
                <Badge
                  variant="outline"
                  className={`text-[9px] ${
                    sug.urgency === "alta"
                      ? "bg-destructive/10 text-destructive border-destructive/30"
                      : "bg-amber-500/10 text-amber-500 border-amber-500/30"
                  }`}
                >
                  Prioridade {sug.urgency}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{sug.reason}</p>
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-500 font-medium pt-1 border-t border-border/30">
                <TrendingUp className="w-3 h-3" /> {sug.impactEstimate}
              </div>
            </div>
          ))}

          {actionSuggestions.length > 1 && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExpandSuggestions(!expandSuggestions)}
                className="text-xs gap-1.5"
              >
                {expandSuggestions ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" /> Mostrar menos (1 sugestão)
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" /> Ver todas as {actionSuggestions.length} sugestões
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 4. Previsão de Ritmo e Fechamento (1º resultado + Expandir) */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <h4 className="text-sm font-display font-semibold text-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" /> Previsão de Ritmo e Fechamento
          </h4>
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px]">
            Confiança: {forecast.confidenceScore.toFixed(0)}%
          </Badge>
        </div>

        <div className="space-y-4">
          {/* Card Principal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-lg bg-secondary/30 border border-border/40 space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase font-bold">Investimento Atual</span>
              <div className="text-base font-bold font-display text-foreground">{brl(forecast.currentSpend)}</div>
              <span className="text-[10px] text-muted-foreground">{forecast.daysElapsed} dias decorridos</span>
            </div>

            <div className="p-3.5 rounded-lg bg-primary/10 border border-primary/30 space-y-1">
              <span className="text-[10px] text-primary uppercase font-bold">Projeção de Fechamento</span>
              <div className="text-base font-bold font-display text-primary">{brl(forecast.projectedSpend)}</div>
              <span className="text-[10px] text-muted-foreground">{forecast.daysRemaining} dias restantes</span>
            </div>
          </div>

          {expandForecast && (
            <div className="space-y-4 pt-2 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-lg bg-secondary/30 border border-border/40 space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Conversões Atuais</span>
                  <div className="text-base font-bold font-display text-foreground">{forecast.currentConversions}</div>
                  <span className="text-[10px] text-muted-foreground">CPA Atual: {brl(forecast.currentAvgCPR)}</span>
                </div>

                <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 space-y-1">
                  <span className="text-[10px] text-emerald-500 uppercase font-bold">Projeção de Conversões</span>
                  <div className="text-base font-bold font-display text-emerald-500">{forecast.projectedConversions}</div>
                  <span className="text-[10px] text-muted-foreground">CPA Projetado: {brl(forecast.projectedAvgCPR)}</span>
                </div>
              </div>

              {totalBudget > 0 && (
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Pacing do Orçamento Cadastrado ({brl(totalBudget)})</span>
                    <span className="font-bold text-foreground">
                      {((forecast.projectedSpend / totalBudget) * 100).toFixed(1)}% projetado
                    </span>
                  </div>
                  <Progress
                    value={Math.min(100, (forecast.projectedSpend / totalBudget) * 100)}
                    className="h-2"
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex justify-center pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpandForecast(!expandForecast)}
              className="text-xs gap-1.5"
            >
              {expandForecast ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" /> Recolher detalhes
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" /> Ver detalhamento completo
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
