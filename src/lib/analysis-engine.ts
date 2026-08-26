import type { CampaignData, DiagnosticIssue, AnalysisResult } from "@/types/campaign";

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export function analyzeCampaigns(
  campaigns: CampaignData[],
  overrides?: { totalReach?: number; totalMessages?: number },
): AnalysisResult {
  const issues: DiagnosticIssue[] = [];

  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const totalConversions = campaigns.reduce((s, c) => s + c.conversions, 0);
  const summedReach = campaigns.reduce((s, c) => s + c.reach, 0);
  const totalReach = overrides?.totalReach && overrides.totalReach > 0 ? overrides.totalReach : summedReach;
  const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0);
  const totalLinkClicks = campaigns.reduce((s, c) => s + c.linkClicks, 0);

  // Differentiate message results vs click results
  const isMsg = (c: CampaignData) => c.resultCategory ? c.resultCategory === "mensagens" : /mensag|message|messag/i.test(c.resultType);
  const isClk = (c: CampaignData) => c.resultCategory ? c.resultCategory === "cliques" : /clique|click|link/i.test(c.resultType);
  const messageResults = campaigns.filter(isMsg);
  const clickResults = campaigns.filter(isClk);
  const summedMessages = messageResults.reduce((s, c) => s + (c.messages ?? c.conversions), 0);
  const totalMessageResults = overrides?.totalMessages && overrides.totalMessages > 0 ? overrides.totalMessages : summedMessages;
  const totalClickResults = clickResults.reduce((s, c) => s + c.conversions, 0);

  // CPR médio ponderado: gasto total das campanhas com resultado / total de resultados
  const validCPRCampaigns = campaigns.filter(c => c.conversions > 0 && c.costPerResult >= 0.5);
  const validSpend = validCPRCampaigns.reduce((s, c) => s + c.spend, 0);
  const validResults = validCPRCampaigns.reduce((s, c) => s + c.conversions, 0);
  const avgCPR = validResults > 0 ? validSpend / validResults : 0;
  const avgFrequency = campaigns.length > 0
    ? campaigns.reduce((s, c) => s + c.frequency, 0) / campaigns.length
    : 0;
  const avgCPM = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;


  campaigns.forEach((c) => {
    // CPR alto: > R$5 já é ruim, > R$10 é inaceitável
    if (c.costPerResult >= 0.5 && c.costPerResult > 5 && c.conversions > 0) {
      issues.push({
        id: generateId(),
        severity: c.costPerResult > 10 ? "critical" : "warning",
        category: "performance",
        title: `Custo por resultado alto: ${c.adSetName}`,
        description: `Custo de R$${c.costPerResult.toFixed(2)} por resultado. ${c.costPerResult > 10 ? "Acima do aceitável (R$10)." : "Acima da faixa OK (R$5)."}`,
        suggestion: "Revise o criativo e a segmentação. Teste novos públicos ou criativos com mensagens mais diretas.",
        affectedCampaigns: [c.campaignName],
        metric: "Custo/Resultado",
        currentValue: c.costPerResult,
        idealValue: 2,
      });
    }

    if (c.conversions === 0 && c.spend > 5) {
      issues.push({
        id: generateId(),
        severity: c.spend > 20 ? "critical" : "warning",
        category: "performance",
        title: `Sem resultados: ${c.adSetName}`,
        description: `R$${c.spend.toFixed(2)} gastos sem nenhum resultado.`,
        suggestion: "Pause este conjunto. Revise segmentação, criativo e página de destino.",
        affectedCampaigns: [c.campaignName],
        metric: "Resultados",
        currentValue: 0,
        idealValue: Math.ceil(c.spend / (avgCPR || 10)),
      });
    }

    if (c.frequency > 2.5) {
      issues.push({
        id: generateId(),
        severity: c.frequency > 4 ? "critical" : "warning",
        category: "creative",
        title: `Frequência alta: ${c.adSetName}`,
        description: `Frequência de ${c.frequency.toFixed(2)} — fadiga de criativo.`,
        suggestion: "Renove os criativos, amplie o público-alvo ou pause e crie novas variações.",
        affectedCampaigns: [c.campaignName],
        metric: "Frequência",
        currentValue: c.frequency,
        idealValue: 2,
      });
    }

    if (c.cpm > 20 && c.impressions > 1000) {
      issues.push({
        id: generateId(),
        severity: c.cpm > 30 ? "warning" : "info",
        category: "segmentation",
        title: `CPM elevado: ${c.adSetName}`,
        description: `CPM de R$${c.cpm.toFixed(2)} indica público competitivo.`,
        suggestion: "Amplie o público-alvo ou teste novos interesses.",
        affectedCampaigns: [c.campaignName],
        metric: "CPM",
        currentValue: c.cpm,
        idealValue: 15,
      });
    }

    if (c.status === "not_delivering") {
      issues.push({
        id: generateId(),
        severity: "info",
        category: "budget",
        title: `Não veiculando: ${c.adSetName}`,
        description: `Pode ter terminado ou estar com orçamento esgotado.`,
        suggestion: "Verifique período, orçamento e aprovação do Meta.",
        affectedCampaigns: [c.campaignName],
      });
    }
  });

  const criticalCount = issues.filter((i) => i.severity === "critical").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const overallScore = Math.max(0, Math.min(100, 100 - criticalCount * 15 - warningCount * 6));

  const summary = overallScore >= 80
    ? "Suas campanhas estão com bom desempenho geral. Pequenos ajustes podem melhorar ainda mais."
    : overallScore >= 50
    ? "Existem problemas significativos. Foque nos itens críticos para melhorar o ROI."
    : "Atenção urgente! Várias campanhas apresentam problemas graves.";

  return {
    overallScore,
    issues: issues.sort((a, b) => {
      const sev = { critical: 0, warning: 1, info: 2 };
      return sev[a.severity] - sev[b.severity];
    }),
    summary,
    totalSpend,
    totalConversions,
    totalReach,
    totalImpressions,
    totalLinkClicks,
    totalMessageResults,
    totalClickResults,
    avgCPR,
    avgFrequency,
    avgCPM,
  };
}
