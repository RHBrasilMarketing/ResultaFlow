import type { CampaignData, DashboardFilters } from "@/types/campaign";

export function applyFilters(campaigns: CampaignData[], filters: DashboardFilters): CampaignData[] {
  return campaigns.filter((c) => {
    if (filters.dateRange) {
      if (c.day && (c.day < filters.dateRange.start || c.day > filters.dateRange.end)) return false;
    }
    if (filters.analysts.length > 0 && !filters.analysts.includes(c.analyst)) return false;
    if (filters.companies.length > 0 && !filters.companies.includes(c.company)) return false;
    if (filters.agencies.length > 0 && !filters.agencies.includes(c.agency)) return false;
    if (filters.contractTypes.length > 0) {
      const label = c.contractType === "efetivo" ? "Efetivo" : c.contractType === "temporario" ? "Temporário" : null;
      if (!label || !filters.contractTypes.includes(label)) return false;
    }
    if (filters.resultTypes.length > 0 && !filters.resultTypes.includes(c.resultType)) return false;
    if (filters.statuses && filters.statuses.length > 0) {
      const isRunning = c.status === "active";
      const label = isRunning ? "Em veiculação" : "Pausada/Concluída";
      if (!filters.statuses.includes(label)) return false;
    }
    if (filters.accounts && filters.accounts.length > 0 && !filters.accounts.includes(c.account)) return false;
    if (filters.rateios && filters.rateios.length > 0 && !filters.rateios.includes(c.rateio)) return false;
    if (filters.veiculationTypes && filters.veiculationTypes.length > 0) {
      const isCont = !!c.isContinuous || c.period === "FULL";
      const matchesCont = filters.veiculationTypes.includes("Contínua (FULL)") && isCont;
      const matchesPeriod = filters.veiculationTypes.includes("Pontual / Período") && !isCont;
      if (!matchesCont && !matchesPeriod) return false;
    }
    return true;
  });
}
