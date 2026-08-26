import { useState, useMemo, useEffect } from "react";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  SlidersHorizontal,
  Bell,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Zap,
  DollarSign,
  ShieldAlert,
  Flame,
  Clock,
  Sparkles,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import type {
  CampaignData,
  AlertItem,
  AlertSeverity,
  AlertCategory,
  AlertThresholds,
} from "@/types/campaign";

interface AutomatedAlertsTabProps {
  campaigns: CampaignData[];
  dailyRows?: CampaignData[];
  totalBudget?: number;
}

const DEFAULT_THRESHOLDS: AlertThresholds = {
  cpaAnomalyPct: 35,       // +35% acima da média móvel
  ctrDropPct: 30,          // -30% de queda no CTR
  maxFrequency: 2.8,       // Frequência limite para fadiga
  maxSpendZeroResult: 20,  // R$ 20 gastos sem resultado
  budgetPacingWarnPct: 85, // 85% do budget consumido com ritmo acelerado
};

const brl = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const SEVERITY_STYLES: Record<AlertSeverity, { bg: string; text: string; border: string; badge: string; icon: any }> = {
  critical: {
    bg: "bg-destructive/5",
    text: "text-destructive",
    border: "border-destructive/30 border-l-4 border-l-destructive",
    badge: "bg-destructive/15 text-destructive border-destructive/30",
    icon: AlertTriangle,
  },
  warning: {
    bg: "bg-amber-500/5",
    text: "text-amber-500",
    border: "border-amber-500/30 border-l-4 border-l-amber-500",
    badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    icon: AlertCircle,
  },
  info: {
    bg: "bg-primary/5",
    text: "text-primary",
    border: "border-primary/30 border-l-4 border-l-primary",
    badge: "bg-primary/15 text-primary border-primary/30",
    icon: Info,
  },
};

const CATEGORY_LABELS: Record<AlertCategory, { label: string; icon: any }> = {
  cpa_anomaly: { label: "Anomalia de CPA", icon: TrendingUp },
  ctr_drop: { label: "Queda de CTR", icon: TrendingDown },
  accelerated_spend: { label: "Gasto sem Retorno", icon: Flame },
  creative_fatigue: { label: "Fadiga Criativa", icon: Zap },
  budget_pacing: { label: "Pacing de Orçamento", icon: DollarSign },
  learning_phase: { label: "Fase de Aprendizado", icon: Sparkles },
  policy_delivery: { label: "Entrega e Políticas", icon: ShieldAlert },
};

export function AutomatedAlertsTab({ campaigns, dailyRows = [], totalBudget = 0 }: AutomatedAlertsTabProps) {
  const [thresholds, setThresholds] = useState<AlertThresholds>(() => {
    try {
      const saved = localStorage.getItem("meta_alert_thresholds");
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn("Could not read alert thresholds from storage", e);
    }
    return DEFAULT_THRESHOLDS;
  });

  const [filterSeverity, setFilterSeverity] = useState<"all" | AlertSeverity>("all");
  const [filterCategory, setFilterCategory] = useState<"all" | AlertCategory>("all");
  const [configOpen, setConfigOpen] = useState(false);
  const [tempThresholds, setTempThresholds] = useState<AlertThresholds>(thresholds);

  // Salvar thresholds no localStorage
  const saveThresholds = () => {
    setThresholds(tempThresholds);
    try {
      localStorage.setItem("meta_alert_thresholds", JSON.stringify(tempThresholds));
      toast.success("Limites de alerta atualizados com sucesso!");
    } catch {
      toast.error("Erro ao salvar configurações");
    }
    setConfigOpen(false);
  };

  const resetThresholds = () => {
    setTempThresholds(DEFAULT_THRESHOLDS);
    setThresholds(DEFAULT_THRESHOLDS);
    try {
      localStorage.setItem("meta_alert_thresholds", JSON.stringify(DEFAULT_THRESHOLDS));
      toast.info("Limites restaurados para o padrão");
    } catch (e) {
      console.warn("Could not save default thresholds to storage", e);
    }
  };

  // Motor de detecção inteligente de alertas
  const detectedAlerts = useMemo(() => {
    const alerts: AlertItem[] = [];
    const nowStr = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    // Médias globais da conta
    const validCPRList = campaigns.filter((c) => c.conversions > 0 && c.costPerResult >= 0.5);
    const avgAccountCPR = validCPRList.length > 0
      ? validCPRList.reduce((s, c) => s + c.costPerResult, 0) / validCPRList.length
      : 10;
    const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0);
    const totalClicks = campaigns.reduce((s, c) => s + (c.linkClicks > 0 ? c.linkClicks : c.clicks), 0);
    const avgAccountCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 1.2;
    const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);

    campaigns.forEach((c) => {
      // 1. Anomalia de CPA (> threshold % acima da média)
      if (c.conversions > 0 && c.costPerResult >= 0.5) {
        const cpaDiffPct = ((c.costPerResult - avgAccountCPR) / avgAccountCPR) * 100;
        if (cpaDiffPct >= thresholds.cpaAnomalyPct) {
          alerts.push({
            id: `cpa-${c.id}`,
            severity: cpaDiffPct >= 80 ? "critical" : "warning",
            category: "cpa_anomaly",
            title: `Anomalia de CPA Alto (+${cpaDiffPct.toFixed(0)}% vs. média)`,
            description: `O conjunto está com CPA de ${brl(c.costPerResult)}, significativamente acima da média da conta (${brl(avgAccountCPR)}).`,
            campaignName: c.campaignName,
            adSetName: c.adSetName,
            triggerMetric: "CPA Atual",
            currentValue: brl(c.costPerResult),
            benchmarkValue: `Média ${brl(avgAccountCPR)}`,
            timestamp: `Hoje às ${nowStr}`,
            recommendation: "Revise o público e renove o criativo imediatamente para reduzir o custo de aquisição.",
          });
        }
      }

      // 2. Queda abrupta de CTR (> threshold % abaixo da média)
      if (c.impressions >= 500 && c.ctr > 0) {
        const ctrDrop = ((avgAccountCTR - c.ctr) / avgAccountCTR) * 100;
        if (ctrDrop >= thresholds.ctrDropPct) {
          alerts.push({
            id: `ctr-${c.id}`,
            severity: ctrDrop >= 50 ? "critical" : "warning",
            category: "ctr_drop",
            title: `Queda Abrupta de CTR (-${ctrDrop.toFixed(0)}% vs. média)`,
            description: `CTR de ${c.ctr.toFixed(2)}% está bem abaixo da média da conta (${avgAccountCTR.toFixed(2)}%). Poucos usuários estão clicando.`,
            campaignName: c.campaignName,
            adSetName: c.adSetName,
            triggerMetric: "CTR",
            currentValue: `${c.ctr.toFixed(2)}%`,
            benchmarkValue: `Média ${avgAccountCTR.toFixed(2)}%`,
            timestamp: `Hoje às ${nowStr}`,
            recommendation: "Teste novas copys, ganchos visuais nos primeiros 3 segundos e thumbnails mais contrastantes.",
          });
        }
      }

      // 3. Gasto acelerado sem retorno (Spend > threshold e 0 conversões)
      if (c.conversions === 0 && c.spend >= thresholds.maxSpendZeroResult) {
        alerts.push({
          id: `spend-zero-${c.id}`,
          severity: c.spend >= thresholds.maxSpendZeroResult * 2 ? "critical" : "warning",
          category: "accelerated_spend",
          title: `Gasto Sem Conversão (${brl(c.spend)} consumidos)`,
          description: `O conjunto já consumiu ${brl(c.spend)} de orçamento sem gerar nenhuma conversão ou mensagem.`,
          campaignName: c.campaignName,
          adSetName: c.adSetName,
          triggerMetric: "Gasto s/ Resultado",
          currentValue: brl(c.spend),
          benchmarkValue: "0 conversões",
          timestamp: `Hoje às ${nowStr}`,
          recommendation: "Pause o conjunto imediatamente para estancar o desperdício de verba e revise o funil.",
        });
      }

      // 4. Fadiga Criativa (Frequência alta + queda de CTR)
      if (c.frequency >= thresholds.maxFrequency) {
        alerts.push({
          id: `fatigue-${c.id}`,
          severity: c.frequency >= 4.0 ? "critical" : "warning",
          category: "creative_fatigue",
          title: `Fadiga Criativa Detectada (Freq: ${c.frequency.toFixed(2)})`,
          description: `O público já viu o anúncio em média ${c.frequency.toFixed(2)} vezes. O desgaste da audiência encarece o leilão.`,
          campaignName: c.campaignName,
          adSetName: c.adSetName,
          triggerMetric: "Frequência",
          currentValue: `${c.frequency.toFixed(2)}x`,
          benchmarkValue: `< ${thresholds.maxFrequency}x`,
          timestamp: `Hoje às ${nowStr}`,
          recommendation: "Substitua as artes e vídeos por novas variações ou expanda o tamanho do público-alvo.",
        });
      }

      // 5. Fase de Aprendizado (Learning Phase status)
      if (c.status === "active") {
        if (c.conversions < 20 && c.spend > 40) {
          alerts.push({
            id: `learning-limited-${c.id}`,
            severity: "warning",
            category: "learning_phase",
            title: "Aprendizado Limitado (Volume Insuficiente)",
            description: `O conjunto gerou apenas ${c.conversions} eventos. O algoritmo do Meta precisa de ~50 conversões/semana para estabilizar.`,
            campaignName: c.campaignName,
            adSetName: c.adSetName,
            triggerMetric: "Eventos/Semana",
            currentValue: `${c.conversions} eventos`,
            benchmarkValue: "50 necessários",
            timestamp: `Hoje às ${nowStr}`,
            recommendation: "Considere migrar para um evento de topo/meio de funil mais frequente (ex: Cliques ou Visualizações de Página) ou agrupar conjuntos.",
          });
        } else if (c.conversions >= 50) {
          alerts.push({
            id: `learning-graduated-${c.id}`,
            severity: "info",
            category: "learning_phase",
            title: "Saiu da Fase de Aprendizado (Otimizado)",
            description: `Conjunto atingiu ${c.conversions} conversões com estabilidade no leilão.`,
            campaignName: c.campaignName,
            adSetName: c.adSetName,
            triggerMetric: "Status Algoritmo",
            currentValue: "Otimizado",
            benchmarkValue: "Meta atingida",
            timestamp: `Hoje às ${nowStr}`,
            recommendation: "Evite alterações bruscas de orçamento (>20%/dia) para não reiniciar o aprendizado.",
          });
        }
      }

      // 6. Anúncios com baixa entrega ou rejeitados por política
      if (c.status === "not_delivering" || c.status === "error") {
        alerts.push({
          id: `policy-${c.id}`,
          severity: "critical",
          category: "policy_delivery",
          title: c.status === "error" ? "Anúncio com Erro / Rejeitado por Política" : "Baixa Entrega / Não Veiculando",
          description: `O anúncio está marcado com status "${c.status}". Verifique conformidade com as diretrizes do Meta Ads.`,
          campaignName: c.campaignName,
          adSetName: c.adSetName,
          triggerMetric: "Status de Entrega",
          currentValue: c.status,
          benchmarkValue: "Ativo",
          timestamp: `Hoje às ${nowStr}`,
          recommendation: "Acesse o Gerenciador de Anúncios, solicite análise manual ou edite o texto para liberar veiculação.",
        });
      }
    });

    // 7. Pacing de Orçamento Geral
    if (totalBudget > 0) {
      const budgetConsumedPct = (totalSpend / totalBudget) * 100;
      if (budgetConsumedPct > 95) {
        alerts.unshift({
          id: "budget-over",
          severity: "critical",
          category: "budget_pacing",
          title: `Risco de Estouro de Orçamento (${budgetConsumedPct.toFixed(1)}% consumido)`,
          description: `Você já consumiu ${brl(totalSpend)} da meta de ${brl(totalBudget)}. Ritmo acelerado pode paralisar as contas antes do fim do período.`,
          campaignName: "Todas as Contas",
          triggerMetric: "Consumo de Budget",
          currentValue: `${budgetConsumedPct.toFixed(1)}%`,
          benchmarkValue: "100% Meta",
          timestamp: `Hoje às ${nowStr}`,
          recommendation: "Reduza os orçamentos diários dos conjuntos menos eficientes para garantir veiculação contínua.",
        });
      } else if (budgetConsumedPct < 40 && campaigns.length > 5) {
        alerts.push({
          id: "budget-under",
          severity: "info",
          category: "budget_pacing",
          title: `Subutilização de Orçamento (${budgetConsumedPct.toFixed(1)}% consumido)`,
          description: `Apenas ${brl(totalSpend)} foi investido de ${brl(totalBudget)}. As contas estão entregando abaixo do potencial.`,
          campaignName: "Todas as Contas",
          triggerMetric: "Consumo de Budget",
          currentValue: `${budgetConsumedPct.toFixed(1)}%`,
          benchmarkValue: "Meta Período",
          timestamp: `Hoje às ${nowStr}`,
          recommendation: "Aumente os lances ou amplie o público dos conjuntos campeões para acelerar resultados.",
        });
      }
    }

    return alerts.sort((a, b) => {
      const weight = { critical: 0, warning: 1, info: 2 };
      return weight[a.severity] - weight[b.severity];
    });
  }, [campaigns, totalBudget, thresholds]);

  // Alertas filtrados pela UI
  const filteredAlerts = useMemo(() => {
    return detectedAlerts.filter((a) => {
      if (filterSeverity !== "all" && a.severity !== filterSeverity) return false;
      if (filterCategory !== "all" && a.category !== filterCategory) return false;
      return true;
    });
  }, [detectedAlerts, filterSeverity, filterCategory]);

  const counts = useMemo(() => {
    return {
      critical: detectedAlerts.filter((a) => a.severity === "critical").length,
      warning: detectedAlerts.filter((a) => a.severity === "warning").length,
      info: detectedAlerts.filter((a) => a.severity === "info").length,
    };
  }, [detectedAlerts]);

  return (
    <div className="space-y-6 animate-fade-in" id="automated-alerts-module">
      {/* Top Header & Settings Button */}
      <div className="glass-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-lg">Alertas e Monitoramento Automático</h3>
            <p className="text-xs text-muted-foreground">
              Monitoramento contínuo de anomalias, saturação criativa e risco de orçamento
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setTempThresholds(thresholds);
              setConfigOpen(true);
            }}
            className="text-xs h-8 gap-1.5"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" /> Configurar Limites
          </Button>
        </div>
      </div>

      {/* Severity Filter Badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilterSeverity("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            filterSeverity === "all"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-secondary/40 text-muted-foreground hover:text-foreground border-border/50"
          }`}
        >
          Todos ({detectedAlerts.length})
        </button>

        <button
          onClick={() => setFilterSeverity("critical")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all ${
            filterSeverity === "critical"
              ? "bg-destructive text-destructive-foreground border-destructive"
              : "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20"
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" /> Críticos ({counts.critical})
        </button>

        <button
          onClick={() => setFilterSeverity("warning")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all ${
            filterSeverity === "warning"
              ? "bg-amber-500 text-black border-amber-500 font-bold"
              : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5" /> Atenção ({counts.warning})
        </button>

        <button
          onClick={() => setFilterSeverity("info")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all ${
            filterSeverity === "info"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
          }`}
        >
          <Info className="w-3.5 h-3.5" /> Informativos ({counts.info})
        </button>
      </div>

      {/* Lista de Cards de Alerta */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="glass-card p-8 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <h4 className="font-semibold text-sm text-foreground">Nenhuma anomalia detectada nesta categoria</h4>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Todas as campanhas analisadas estão operando dentro dos limites de tolerância configurados.
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const style = SEVERITY_STYLES[alert.severity];
            const catInfo = CATEGORY_LABELS[alert.category] || { label: alert.category, icon: AlertCircle };
            const Icon = style.icon;
            const CatIcon = catInfo.icon;

            return (
              <div
                key={alert.id}
                className={`glass-card p-4.5 rounded-xl border transition-all duration-200 hover:shadow-md ${style.border} ${style.bg}`}
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    {/* Linha de Categoria e Severidade */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] font-bold ${style.badge}`}>
                        <Icon className="w-3 h-3 mr-1" />
                        {alert.severity === "critical" ? "Crítico" : alert.severity === "warning" ? "Atenção" : "Informativo"}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] text-muted-foreground gap-1 bg-secondary/60">
                        <CatIcon className="w-3 h-3 text-primary" />
                        {catInfo.label}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1 ml-auto md:ml-0">
                        <Clock className="w-3 h-3" /> {alert.timestamp}
                      </span>
                    </div>

                    {/* Título e Descrição */}
                    <h4 className="font-semibold text-sm text-foreground">{alert.title}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">{alert.description}</p>

                    {/* Nome do Conjunto e Campanha com Tags de Estrutura */}
                    <div className="flex items-center gap-1.5 pt-1 text-[11px] text-muted-foreground flex-wrap">
                      <span className="font-medium text-foreground">Campanha:</span>
                      <span className="bg-background/80 px-2 py-0.5 rounded border border-border/50 truncate max-w-[200px]" title={alert.campaignName}>
                        {alert.campaignName}
                      </span>
                      {alert.adSetName && (
                        <>
                          <span className="font-medium text-foreground">· Conjunto:</span>
                          <span className="bg-background/80 px-2 py-0.5 rounded border border-border/50 truncate max-w-[200px]" title={alert.adSetName}>
                            {alert.adSetName}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Tags estruturadas (Agência, Modalidade, Período, Rateio, Vaga/Req) */}
                    {(() => {
                      const matched = campaigns.find((c) => c.adSetName === alert.adSetName || c.campaignName === alert.campaignName);
                      if (!matched) return null;
                      return (
                        <div className="flex items-center gap-1 flex-wrap pt-0.5 text-[10px]">
                          {matched.agency && matched.agency !== "—" && (
                            <span className="px-1.5 py-0.2 rounded bg-primary/10 text-primary font-medium border border-primary/20">
                              {matched.agency}
                            </span>
                          )}
                          {matched.contractType && matched.contractType !== "desconhecido" && (
                            <span className={cn("px-1.5 py-0.2 rounded font-medium border", matched.contractType === "efetivo" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20")}>
                              {matched.contractType === "efetivo" ? "EF" : "TE"}
                            </span>
                          )}
                          {matched.period && (
                            <span className={cn("px-1.5 py-0.2 rounded font-medium border", matched.period === "FULL" ? "bg-purple-500/10 text-purple-400 border-purple-500/20" : "bg-muted text-muted-foreground border-border/50")}>
                              {matched.period}
                            </span>
                          )}
                          {matched.rateio && matched.rateio !== "—" && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 font-medium border border-amber-500/20">
                              {matched.rateio}
                            </span>
                          )}
                          {(matched.requisitionCode || matched.jobTitle) && (
                            <span className="text-muted-foreground font-mono bg-secondary/50 px-1.5 py-0.2 rounded">
                              {matched.requisitionCode ? `#${matched.requisitionCode}` : matched.jobTitle}
                            </span>
                          )}
                        </div>
                      );
                    })()}

                    {/* Sugestão / Recomendação de Ação */}
                    <div className="flex items-start gap-2 pt-2 text-xs">
                      <ChevronRight className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      <p className="text-foreground/90">
                        <strong className="text-primary">Ação sugerida:</strong> {alert.recommendation}
                      </p>
                    </div>
                  </div>

                  {/* Gatilho e Valores */}
                  <div className="md:text-right bg-background/50 p-2.5 rounded-lg border border-border/40 shrink-0 min-w-[150px] space-y-1">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                      {alert.triggerMetric}
                    </span>
                    <div className="text-base font-display font-bold text-foreground">{alert.currentValue}</div>
                    {alert.benchmarkValue && (
                      <div className="text-[11px] text-muted-foreground">{alert.benchmarkValue}</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal de Configuração de Limites (Thresholds) */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-base">
              <SlidersHorizontal className="w-4 h-4 text-primary" /> Configurar Limites de Alerta
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-3">
            {/* Anomalia de CPA */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <Label>Anomalia de CPA (% acima da média)</Label>
                <span className="font-bold text-primary">+{tempThresholds.cpaAnomalyPct}%</span>
              </div>
              <Slider
                value={[tempThresholds.cpaAnomalyPct]}
                min={15}
                max={100}
                step={5}
                onValueChange={([val]) => setTempThresholds((prev) => ({ ...prev, cpaAnomalyPct: val }))}
              />
              <p className="text-[10px] text-muted-foreground">Dispara quando o CPA excede a média por esta margem.</p>
            </div>

            {/* Queda de CTR */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <Label>Queda Crítica de CTR (% abaixo da média)</Label>
                <span className="font-bold text-primary">-{tempThresholds.ctrDropPct}%</span>
              </div>
              <Slider
                value={[tempThresholds.ctrDropPct]}
                min={15}
                max={80}
                step={5}
                onValueChange={([val]) => setTempThresholds((prev) => ({ ...prev, ctrDropPct: val }))}
              />
              <p className="text-[10px] text-muted-foreground">Dispara quando o CTR cai bruscamente vs. média.</p>
            </div>

            {/* Frequência Máxima de Fadiga */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <Label>Frequência Máxima (Fadiga Criativa)</Label>
                <span className="font-bold text-primary">{tempThresholds.maxFrequency.toFixed(1)}x</span>
              </div>
              <Slider
                value={[tempThresholds.maxFrequency * 10]}
                min={15}
                max={50}
                step={1}
                onValueChange={([val]) => setTempThresholds((prev) => ({ ...prev, maxFrequency: val / 10 }))}
              />
              <p className="text-[10px] text-muted-foreground">Alerta quando o mesmo usuário vê o anúncio muitas vezes.</p>
            </div>

            {/* Gasto Sem Conversão */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <Label>Limite de Gasto Sem Conversão (R$)</Label>
                <span className="font-bold text-primary">R$ {tempThresholds.maxSpendZeroResult}</span>
              </div>
              <Slider
                value={[tempThresholds.maxSpendZeroResult]}
                min={10}
                max={100}
                step={5}
                onValueChange={([val]) => setTempThresholds((prev) => ({ ...prev, maxSpendZeroResult: val }))}
              />
              <p className="text-[10px] text-muted-foreground">Alerta conjuntos consumindo verba sem resultados.</p>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <Button variant="ghost" size="sm" onClick={resetThresholds} className="text-xs text-muted-foreground gap-1">
              <RotateCcw className="w-3.5 h-3.5" /> Restaurar Padrão
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfigOpen(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={saveThresholds}>
                Salvar Limites
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
