export interface CampaignData {
  id: string;
  campaignName: string;
  adSetName: string;
  adName: string;
  status: "active" | "paused" | "inactive" | "not_delivering" | "recently_completed" | "error";
  objective: string;
  spend: number;
  impressions: number;
  clicks: number;
  linkClicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  conversions: number;
  costPerResult: number;
  roas: number;
  frequency: number;
  reach: number;
  relevanceScore: number;
  resultType: string;
  startDate: string;
  endDate: string;
  age: string;
  gender: string;
  day: string;
  analyst: string;
  company: string;
  agency: string;
  contractType: "efetivo" | "temporario" | "desconhecido";
  account: string;
  rateio: string; // ex: "JOINVILLE", "ITAJAÍ", "—"
  sip?: string; // Código SIP (ex: "12345")
  jobTitle?: string; // Nome da vaga extraído (ex: "OPERADOR DE PRODUÇÃO")
  period?: string; // Período para rodar (ex: "01/02 A 15/02" ou "FULL")
  isContinuous?: boolean; // Se true, campanha contínua (FULL)
  year?: string; // Ano da campanha (ex: "2025")
  requisitionCode?: string; // Código de 6 dígitos da requisição / vaga (ex: "123456")
  defaultAdMessage?: string; // Mensagem padrão de envio / cópia do anúncio
  campaignBudget?: number;
  adsetBudget?: number;
  dailyBudget?: number;
  lifetimeBudget?: number;
  budgetRemaining?: number;
  scheduleStart?: string;
  scheduleEnd?: string;
  messages?: number;
  resultCategory?: "mensagens" | "cliques" | "outro";
}


export interface DiagnosticIssue {
  id: string;
  severity: "critical" | "warning" | "info";
  category: "performance" | "segmentation" | "creative" | "budget";
  title: string;
  description: string;
  suggestion: string;
  affectedCampaigns: string[];
  metric?: string;
  currentValue?: number;
  idealValue?: number;
}

export interface AnalysisResult {
  overallScore: number;
  issues: DiagnosticIssue[];
  summary: string;
  totalSpend: number;
  totalConversions: number;
  totalReach: number;
  totalImpressions: number;
  totalLinkClicks: number;
  totalMessageResults: number;
  totalClickResults: number;
  avgCPR: number;
  avgFrequency: number;
  avgCPM: number;
}

export interface DashboardFilters {
  dateRange: { start: string; end: string } | null;
  analysts: string[];
  companies: string[];
  agencies: string[];
  contractTypes: string[];
  resultTypes: string[];
  statuses: string[];
  accounts: string[];
  rateios: string[];
  veiculationTypes?: string[];
}

// Performance grading colors (Verde / Azul / Amarelo / Vermelho)
export type PerfGrade = "great" | "ok" | "warn" | "bad";

export const gradeColors: Record<PerfGrade, { bg: string; text: string; border: string; label: string }> = {
  great: { bg: "bg-success/10", text: "text-success", border: "border-success/30", label: "Ótimo" },
  ok:    { bg: "bg-info/10",    text: "text-info",    border: "border-info/30",    label: "OK" },
  warn:  { bg: "bg-warning/10", text: "text-warning", border: "border-warning/30", label: "Atenção" },
  bad:   { bg: "bg-destructive/10", text: "text-destructive", border: "border-destructive/30", label: "Ruim" },
};

// Faixas oficiais de CPR (Custo por Resultado):
// 0,00 – 2,00  → ótimo (verde)
// 2,01 – 5,00  → ok (azul)
// 5,01 – 10,00 → atenção/ruim (amarelo)
// 10,01+       → inaceitável (vermelho)
export function gradeCPR(cpr: number): PerfGrade {
  if (cpr <= 0) return "ok";
  if (cpr <= 2) return "great";
  if (cpr <= 5) return "ok";
  if (cpr <= 10) return "warn";
  return "bad";
}

export function gradeFrequency(freq: number): PerfGrade {
  if (freq < 1.8) return "great";
  if (freq < 2.5) return "ok";
  if (freq < 3.5) return "warn";
  return "bad";
}

export function gradeCPM(cpm: number): PerfGrade {
  if (cpm <= 0) return "ok";
  if (cpm < 10) return "great";
  if (cpm < 20) return "ok";
  if (cpm < 35) return "warn";
  return "bad";
}

// -------------------------------------------------------------
// 1. Tipos para Funil Visual de Conversão
// -------------------------------------------------------------
export interface FunnelStage {
  id: "impressions" | "clicks" | "landingPageViews" | "addToCart" | "conversions";
  name: string;
  count: number;
  rateFromPrevious: number; // % que converteu da etapa anterior
  rateFromTotal: number;    // % em relação às impressões
  costPerStage: number;     // Custo unitário nesta etapa (ex: CPM, CPC, etc.)
  dropOffRate: number;      // % de perda
  isBottleneck?: boolean;   // Marcação de maior gargalo de queda
  previousCount?: number;   // Contagem no período anterior comparativo
  changePct?: number;       // Variação % em relação ao período anterior
}

// -------------------------------------------------------------
// 2. Tipos para Mapa de Calor de Horários (7x24)
// -------------------------------------------------------------
export type HeatmapMetric = "cpa" | "roas" | "ctr" | "spend";

export interface HeatmapCell {
  dayOfWeek: number; // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
  hour: number;      // 0 a 23
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpa: number;
  roas: number;
  intensity: number; // 0 a 1 normalizado para cor
}

// -------------------------------------------------------------
// 3. Tipos para Alertas e Monitoramento Automático
// -------------------------------------------------------------
export type AlertSeverity = "critical" | "warning" | "info";
export type AlertCategory =
  | "cpa_anomaly"
  | "ctr_drop"
  | "accelerated_spend"
  | "creative_fatigue"
  | "budget_pacing"
  | "learning_phase"
  | "policy_delivery";

export interface AlertItem {
  id: string;
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  description: string;
  campaignName: string;
  adSetName?: string;
  triggerMetric: string;
  currentValue: number | string;
  benchmarkValue?: number | string;
  timestamp: string;
  recommendation: string;
}

export interface AlertThresholds {
  cpaAnomalyPct: number;    // Ex: +35% acima da média
  ctrDropPct: number;       // Ex: -30% abaixo da média
  maxFrequency: number;     // Ex: 3.0 para fadiga
  maxSpendZeroResult: number; // Ex: R$ 20 sem conversão
  budgetPacingWarnPct: number; // Ex: 80% do orçamento
}

// -------------------------------------------------------------
// 4. Tipos para IA e Insights
// -------------------------------------------------------------
export interface AIDiagnosticItem {
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
    cpc: number;
  };
  recommendation: string;
  urgency: "high" | "medium" | "low";
}

export interface AISuggestion {
  id: string;
  type: "pause" | "scale" | "refresh_creative" | "adjust_bid" | "optimize_lp";
  title: string;
  targetName: string;
  reason: string;
  impactEstimate: string;
  urgency: "alta" | "média" | "baixa";
}

export interface AIPeriodSummary {
  periodType: "daily" | "weekly";
  title: string;
  overviewText: string;
  highlights: string[];
  biggestWinner: string;
  biggestConcern: string;
  keyActionItem: string;
}

export interface MetaTotals {
  totalReach: number;
  totalMessages: number;
  daily: { day: string; reach: number; messages: number; spend: number }[];
}

export interface ForecastResult {
  daysElapsed: number;
  daysRemaining: number;
  currentSpend: number;
  projectedSpend: number;
  currentConversions: number;
  projectedConversions: number;
  currentAvgCPR: number;
  projectedAvgCPR: number;
  budgetStatus: "within_budget" | "over_budget" | "under_budget";
  confidenceScore: number;
}
