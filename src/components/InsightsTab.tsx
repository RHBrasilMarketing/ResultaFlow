import { useMemo, useState } from "react";
import { Lightbulb, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, ChevronDown, Layers } from "lucide-react";
import type { CampaignData, AnalysisResult } from "@/types/campaign";
import { cn } from "@/lib/utils";

interface InsightsTabProps {
  campaigns: CampaignData[];
  analysis: AnalysisResult;
}

interface Insight {
  icon: React.ReactNode;
  title: string;
  description: string;
  type: "great" | "ok" | "warn" | "bad";
  priority: number;
  relatedCampaigns: CampaignData[];
}

const typeStyles = {
  great: { bg: "bg-success/5", border: "border-success/30", icon: "text-success", dot: "bg-success" },
  ok:    { bg: "bg-info/5",    border: "border-info/30",    icon: "text-info",    dot: "bg-info" },
  warn:  { bg: "bg-warning/5", border: "border-warning/30", icon: "text-warning", dot: "bg-warning" },
  bad:   { bg: "bg-destructive/5", border: "border-destructive/30", icon: "text-destructive", dot: "bg-destructive" },
};

export function InsightsTab({ campaigns, analysis }: InsightsTabProps) {
  const [expanded, setExpanded] = useState<number | null>(null);

  const insights = useMemo(() => {
    const result: Insight[] = [];
    const totalSpend = analysis.totalSpend;
    const validCPR = (c: CampaignData) => c.costPerResult >= 0.5;

    const withResults = campaigns.filter((c) => c.conversions > 0);
    const withoutResults = campaigns.filter((c) => c.conversions === 0 && c.spend > 0);
    const wastedSpend = withoutResults.reduce((s, c) => s + c.spend, 0);

    const conversionRate = (withResults.length / Math.max(campaigns.length, 1)) * 100;
    result.push({
      icon: conversionRate > 60 ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />,
      title: `${conversionRate.toFixed(0)}% dos conjuntos geram resultados`,
      description: `${withResults.length} de ${campaigns.length} conjuntos de anúncios estão convertendo. ${conversionRate < 50 ? "Considere pausar os que não convertem." : "Boa taxa."}`,
      type: conversionRate > 70 ? "great" : conversionRate > 50 ? "ok" : conversionRate > 30 ? "warn" : "bad",
      priority: 1,
      relatedCampaigns: withResults,
    });

    if (wastedSpend > 0) {
      const pct = (wastedSpend / totalSpend) * 100;
      result.push({
        icon: <TrendingDown className="w-5 h-5" />,
        title: `R$${wastedSpend.toFixed(2)} gastos sem retorno (${pct.toFixed(0)}%)`,
        description: `${withoutResults.length} conjuntos consumiram orçamento sem nenhum resultado. Pause-os.`,
        type: pct > 30 ? "bad" : pct > 15 ? "warn" : "ok",
        priority: 2,
        relatedCampaigns: withoutResults,
      });
    }

    const validForBest = withResults.filter(validCPR);
    if (validForBest.length > 0) {
      const best = validForBest.reduce((a, b) => a.costPerResult < b.costPerResult ? a : b);
      result.push({
        icon: <TrendingUp className="w-5 h-5" />,
        title: `Melhor conjunto: CPR R$${best.costPerResult.toFixed(2)}`,
        description: `"${best.adSetName}" — ${best.conversions} resultados. Considere escalar.`,
        type: "great",
        priority: 3,
        relatedCampaigns: [best],
      });
    }

    const highFreq = campaigns.filter((c) => c.frequency > 2.5);
    if (highFreq.length > 0) {
      const avgFreq = highFreq.reduce((s, c) => s + c.frequency, 0) / highFreq.length;
      result.push({
        icon: <AlertTriangle className="w-5 h-5" />,
        title: `${highFreq.length} conjuntos com frequência alta (média ${avgFreq.toFixed(1)})`,
        description: "Frequência > 2.5 indica fadiga de criativo. Renove ou expanda a segmentação.",
        type: avgFreq > 3.5 ? "bad" : "warn",
        priority: 4,
        relatedCampaigns: highFreq,
      });
    }

    const highCPMSets = campaigns.filter((c) => c.cpm > 20 && c.impressions > 1000);
    result.push({
      icon: <Lightbulb className="w-5 h-5" />,
      title: `CPM médio dos conjuntos: R$${analysis.avgCPM.toFixed(2)}`,
      description: analysis.avgCPM > 30 ? "CPM muito alto. Reveja segmentação." : analysis.avgCPM > 20 ? "CPM elevado, teste públicos mais amplos." : analysis.avgCPM > 10 ? "CPM dentro da faixa normal." : "CPM excelente.",
      type: analysis.avgCPM > 30 ? "bad" : analysis.avgCPM > 20 ? "warn" : analysis.avgCPM > 10 ? "ok" : "great",
      priority: 5,
      relatedCampaigns: highCPMSets,
    });

    const scalable = validForBest.filter((c) => analysis.avgCPR > 0 && c.costPerResult < analysis.avgCPR * 0.7 && c.conversions >= 3);
    if (scalable.length > 0) {
      result.push({
        icon: <TrendingUp className="w-5 h-5" />,
        title: `${scalable.length} conjuntos com potencial de escala`,
        description: "CPR significativamente abaixo da média e volume consistente. Aumente o orçamento gradualmente.",
        type: "great",
        priority: 6,
        relatedCampaigns: scalable,
      });
    }

    return result.sort((a, b) => a.priority - b.priority);
  }, [campaigns, analysis]);

  const actionPlan = useMemo(() => {
    const actions: { text: string; type: Insight["type"] }[] = [];
    const validCPR = (c: CampaignData) => c.costPerResult >= 0.5;
    const withoutResults = campaigns.filter((c) => c.conversions === 0 && c.spend > 5);
    const highCPR = campaigns.filter((c) => validCPR(c) && c.costPerResult > 20 && c.conversions > 0);
    const highFreq = campaigns.filter((c) => c.frequency > 3);
    const bestPerformers = campaigns.filter((c) => c.conversions > 0 && validCPR(c)).sort((a, b) => a.costPerResult - b.costPerResult).slice(0, 3);

    if (withoutResults.length > 0) actions.push({ text: `Pausar ${withoutResults.length} conjuntos sem resultados (economia R$${withoutResults.reduce((s, c) => s + c.spend, 0).toFixed(2)})`, type: "bad" });
    if (highCPR.length > 0) actions.push({ text: `Otimizar ${highCPR.length} conjuntos com CPR > R$20`, type: "warn" });
    if (highFreq.length > 0) actions.push({ text: `Renovar criativos de ${highFreq.length} conjuntos com frequência alta`, type: "warn" });
    if (bestPerformers.length > 0) actions.push({ text: `Escalar orçamento dos top ${bestPerformers.length} conjuntos mais eficientes`, type: "great" });
    actions.push({ text: "Revisar segmentação dos conjuntos com CPM acima de R$20", type: "ok" });
    return actions;
  }, [campaigns]);

  const stats = useMemo(() => {
    const withResults = campaigns.filter((c) => c.conversions > 0).length;
    const wasted = campaigns.filter((c) => c.conversions === 0 && c.spend > 0).reduce((s, c) => s + c.spend, 0);
    const fatigue = campaigns.filter((c) => c.frequency > 2.5).length;
    return { withResults, wasted, fatigue, total: campaigns.length };
  }, [campaigns]);

  const counts = useMemo(() => ({
    great: insights.filter((i) => i.type === "great").length,
    ok: insights.filter((i) => i.type === "ok").length,
    warn: insights.filter((i) => i.type === "warn").length,
    bad: insights.filter((i) => i.type === "bad").length,
  }), [insights]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="glass-card p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 shrink-0">
            <Layers className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-lg">Insights por Conjunto de Anúncios</h3>
            <p className="text-sm text-muted-foreground">Clique em um card para ver exatamente quais conjuntos ele representa.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(["great", "ok", "warn", "bad"] as const).map((t) => (
            <div key={t} className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px]", typeStyles[t].bg, typeStyles[t].border)}>
              <span className={cn("w-2 h-2 rounded-full", typeStyles[t].dot)} />
              <span className="text-muted-foreground">{t === "great" ? "Ótimo" : t === "ok" ? "OK" : t === "warn" ? "Atenção" : "Ruim"}</span>
              <strong className={typeStyles[t].icon}>{counts[t]}</strong>
            </div>
          ))}
        </div>
      </div>

      {/* Resumo rápido */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass-card p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Conjuntos analisados</p>
          <p className="text-2xl font-display font-bold mt-1">{stats.total}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Gerando resultados</p>
          <p className="text-2xl font-display font-bold text-success mt-1">{stats.withResults}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Gasto sem retorno</p>
          <p className="text-2xl font-display font-bold text-destructive mt-1 break-words leading-tight">
            R$ {stats.wasted.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="glass-card p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Fadiga de criativo</p>
          <p className={cn("text-2xl font-display font-bold mt-1", stats.fatigue > 0 ? "text-warning" : "text-success")}>{stats.fatigue}</p>
        </div>
      </div>


      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {insights.map((insight, i) => {
          const styles = typeStyles[insight.type];
          const isOpen = expanded === i;
          const hasCampaigns = insight.relatedCampaigns.length > 0;
          return (
            <div
              key={i}
              className={cn("glass-card border animate-fade-in transition-all", styles.bg, styles.border, hasCampaigns && "cursor-pointer hover:scale-[1.01]")}
              style={{ animationDelay: `${i * 60}ms` }}
              onClick={() => hasCampaigns && setExpanded(isOpen ? null : i)}
            >
              <div className="p-5">
                <div className="flex items-start gap-3">
                  <div className={cn("mt-0.5 shrink-0", styles.icon)}>{insight.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-display font-semibold text-sm">{insight.title}</h4>
                      {hasCampaigns && <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform shrink-0", isOpen && "rotate-180")} />}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-1">{insight.description}</p>
                    {hasCampaigns && (
                      <p className="text-[10px] text-muted-foreground mt-2 font-medium">
                        {insight.relatedCampaigns.length} {insight.relatedCampaigns.length === 1 ? "conjunto" : "conjuntos"} de anúncios • clique para ver
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {isOpen && hasCampaigns && (
                <div className="border-t border-border/50 max-h-72 overflow-y-auto">
                  {insight.relatedCampaigns.slice(0, 50).map((c) => (
                    <div key={c.id} className="px-5 py-2.5 border-b border-border/30 last:border-0 hover:bg-secondary/40">
                      <p className="text-xs font-medium truncate" title={c.adSetName}>{c.adSetName}</p>
                      <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground flex-wrap">
                        <span className="font-medium text-foreground/80">{c.company}</span>
                        <span>•</span><span>{c.analyst}</span>
                        <span>•</span><span>R${c.spend.toFixed(2)}</span>
                        <span>•</span><span>{c.conversions} resultados</span>
                        {c.costPerResult >= 0.5 && <><span>•</span><span>CPR R${c.costPerResult.toFixed(2)}</span></>}
                      </div>
                    </div>
                  ))}
                  {insight.relatedCampaigns.length > 50 && (
                    <p className="px-5 py-2 text-[10px] text-muted-foreground text-center">+{insight.relatedCampaigns.length - 50} outros</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="glass-card p-5">
        <h4 className="font-display font-semibold text-sm mb-4 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-warning" /> Plano de Ação Recomendado
        </h4>
        <div className="space-y-3">
          {actionPlan.map((action, i) => (
            <div key={i} className="flex items-start gap-3 animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
              <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5", typeStyles[action.type].bg, typeStyles[action.type].icon)}>
                {i + 1}
              </div>
              <p className="text-sm text-muted-foreground">{action.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
