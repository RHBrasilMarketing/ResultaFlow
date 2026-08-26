import { useState, useMemo } from "react";
import {
  Hash,
  Search,
  Filter,
  ArrowUpDown,
  DollarSign,
  MousePointerClick,
  MessageCircle,
  TrendingUp,
  Download,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Sparkles,
  Building2,
  User,
  MapPin,
  ExternalLink,
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CampaignData } from "@/types/campaign";
import { cn } from "@/lib/utils";

interface RequisitionsTabProps {
  campaigns: CampaignData[];
  dailyRows?: CampaignData[];
}

export interface RequisitionItem {
  code: string;
  is6Digits: boolean;
  company: string;
  analyst: string;
  rateio: string;
  contractType: string;
  agency: string;
  period: string;
  jobTitle: string;
  defaultMessage: string;
  adNames: string[];
  adSetNames: string[];
  spend: number;
  clicks: number;
  linkClicks: number;
  impressions: number;
  reach: number;
  conversions: number; // Conversas geradas
  costPerResult: number; // CPA / CPR
  cpc: number;
  conversionRate: number; // Cliques -> Conversas %
  status: "active" | "paused" | "inactive" | "not_delivering" | "recently_completed" | "error";
  adSetCount: number;
}

export function RequisitionsTab({ campaigns }: RequisitionsTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [only6Digits, setOnly6Digits] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"spend" | "conversions" | "clicks" | "cpr" | "cvr" | "code">("spend");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Agrega dados por Código de Requisição (ou por Nome do Anúncio / Conjunto se não houver código explícito)
  const requisitions = useMemo<RequisitionItem[]>(() => {
    const map = new Map<string, {
      code: string;
      is6Digits: boolean;
      company: string;
      analyst: string;
      rateio: string;
      contractType: string;
      defaultMessage: string;
      adNames: Set<string>;
      adSetNames: Set<string>;
      spend: number;
      clicks: number;
      linkClicks: number;
      impressions: number;
      reach: number;
      conversions: number;
      statuses: Set<CampaignData["status"]>;
      adSetCount: number;
    }>();

    campaigns.forEach((c) => {
      // Identifica ou deriva o código de requisição
      let code = c.requisitionCode || "";
      if (!code) {
        // Tenta regex de 6 dígitos no nome do anúncio ou conjunto
        const full = `${c.campaignName} ${c.adSetName} ${c.adName}`;
        const match6 = full.match(/\b(\d{6})\b/);
        if (match6) {
          code = match6[1];
        } else {
          const matchAny = full.match(/\b(\d{4,8})\b/);
          if (matchAny && !["2024", "2025", "2026"].includes(matchAny[1])) {
            code = matchAny[1];
          }
        }
      }

      // Se não houver código numérico, agrupa por nome do anúncio / vaga
      const fallbackKey = c.adName && c.adName !== "—" ? c.adName : c.adSetName;
      const key = code ? `REQ_${code}` : `NAME_${fallbackKey}`;
      const displayCode = code || "Sem Código";
      const is6 = /^\d{6}$/.test(code);

      // Mensagem padrão / texto do anúncio
      const defaultMsg = c.defaultAdMessage || (c.adName !== "—" ? c.adName : c.adSetName);

      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          code: displayCode,
          is6Digits: is6,
          company: c.company || "Desconhecida",
          analyst: c.analyst || "Desconhecido",
          rateio: c.rateio || "—",
          contractType: c.contractType || "desconhecido",
          agency: c.agency || "—",
          period: c.period || (c.isContinuous ? "FULL" : "—"),
          jobTitle: c.jobTitle || "",
          defaultMessage: defaultMsg,
          adNames: new Set(c.adName && c.adName !== "—" ? [c.adName] : []),
          adSetNames: new Set([c.adSetName]),
          spend: c.spend,
          clicks: c.clicks,
          linkClicks: c.linkClicks,
          impressions: c.impressions,
          reach: c.reach,
          conversions: c.conversions,
          statuses: new Set([c.status]),
          adSetCount: 1,
        });
      } else {
        existing.spend += c.spend;
        existing.clicks += c.clicks;
        existing.linkClicks += c.linkClicks;
        existing.impressions += c.impressions;
        existing.reach += c.reach;
        existing.conversions += c.conversions;
        if (c.adName && c.adName !== "—") existing.adNames.add(c.adName);
        existing.adSetNames.add(c.adSetName);
        existing.statuses.add(c.status);
        existing.adSetCount += 1;
        if (existing.company === "Desconhecida" && c.company !== "Desconhecida") existing.company = c.company;
        if (existing.analyst === "Desconhecido" && c.analyst !== "Desconhecido") existing.analyst = c.analyst;
        if (existing.rateio === "—" && c.rateio !== "—") existing.rateio = c.rateio;
        if (existing.agency === "—" && c.agency && c.agency !== "—") existing.agency = c.agency;
        if (!existing.jobTitle && c.jobTitle) existing.jobTitle = c.jobTitle;
        if (!existing.defaultMessage && defaultMsg) existing.defaultMessage = defaultMsg;
      }
    });

    return Array.from(map.values()).map((item) => {
      const bestClicks = item.linkClicks > 0 ? item.linkClicks : item.clicks;
      const cpc = bestClicks > 0 ? item.spend / bestClicks : 0;
      const costPerResult = item.conversions > 0 ? item.spend / item.conversions : (item.spend > 0 ? item.spend : 0);
      const conversionRate = bestClicks > 0 ? (item.conversions / bestClicks) * 100 : 0;
      const status: CampaignData["status"] = item.statuses.has("active") ? "active" : "paused";

      return {
        code: item.code,
        is6Digits: item.is6Digits,
        company: item.company,
        analyst: item.analyst,
        rateio: item.rateio,
        contractType: item.contractType,
        agency: item.agency,
        period: item.period,
        jobTitle: item.jobTitle,
        defaultMessage: item.defaultMessage || Array.from(item.adNames)[0] || Array.from(item.adSetNames)[0] || "—",
        adNames: Array.from(item.adNames),
        adSetNames: Array.from(item.adSetNames),
        spend: item.spend,
        clicks: item.clicks,
        linkClicks: item.linkClicks,
        impressions: item.impressions,
        reach: item.reach,
        conversions: item.conversions,
        costPerResult,
        cpc,
        conversionRate,
        status,
        adSetCount: item.adSetCount,
      };
    });
  }, [campaigns]);

  // Filtros e busca
  const filtered = useMemo(() => {
    return requisitions.filter((r) => {
      if (only6Digits && !r.is6Digits) return false;

      if (statusFilter === "active" && r.status !== "active") return false;
      if (statusFilter === "paused" && r.status === "active") return false;
      if (statusFilter === "good" && (r.conversions === 0 || r.costPerResult > 2)) return false;
      if (statusFilter === "ok" && (r.costPerResult <= 2 || r.costPerResult > 5)) return false;
      if (statusFilter === "warning" && (r.costPerResult <= 5 || r.costPerResult > 10)) return false;
      if (statusFilter === "no_result" && r.conversions > 0) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          r.code.toLowerCase().includes(q) ||
          r.company.toLowerCase().includes(q) ||
          r.analyst.toLowerCase().includes(q) ||
          r.rateio.toLowerCase().includes(q) ||
          r.agency.toLowerCase().includes(q) ||
          r.jobTitle.toLowerCase().includes(q) ||
          r.defaultMessage.toLowerCase().includes(q) ||
          r.adNames.some((n) => n.toLowerCase().includes(q))
        );
      }
      return true;
    }).sort((a, b) => {
      let vA = 0;
      let vB = 0;
      if (sortBy === "spend") { vA = a.spend; vB = b.spend; }
      else if (sortBy === "conversions") { vA = a.conversions; vB = b.conversions; }
      else if (sortBy === "clicks") { vA = a.linkClicks || a.clicks; vB = b.linkClicks || b.clicks; }
      else if (sortBy === "cpr") { vA = a.costPerResult; vB = b.costPerResult; }
      else if (sortBy === "cvr") { vA = a.conversionRate; vB = b.conversionRate; }
      else if (sortBy === "code") { return sortOrder === "asc" ? a.code.localeCompare(b.code) : b.code.localeCompare(a.code); }

      return sortOrder === "asc" ? vA - vB : vB - vA;
    });
  }, [requisitions, only6Digits, statusFilter, searchTerm, sortBy, sortOrder]);

  // Totais agregados
  const totals = useMemo(() => {
    const totalReqs = requisitions.length;
    const reqs6 = requisitions.filter((r) => r.is6Digits).length;
    const spend = requisitions.reduce((s, r) => s + r.spend, 0);
    const clicks = requisitions.reduce((s, r) => s + (r.linkClicks || r.clicks), 0);
    const conversions = requisitions.reduce((s, r) => s + r.conversions, 0);
    const avgCPR = conversions > 0 ? spend / conversions : 0;
    const avgCPC = clicks > 0 ? spend / clicks : 0;
    const cvr = clicks > 0 ? (conversions / clicks) * 100 : 0;

    return { totalReqs, reqs6, spend, clicks, conversions, avgCPR, avgCPC, cvr };
  }, [requisitions]);

  // Top 8 requisições para o gráfico
  const topChartData = useMemo(() => {
    return [...filtered]
      .filter((r) => r.spend > 0)
      .slice(0, 8)
      .map((r) => ({
        name: r.code !== "Sem Código" ? `Req #${r.code}` : r.company,
        code: r.code,
        company: r.company,
        spend: Number(r.spend.toFixed(2)),
        conversions: r.conversions,
        clicks: r.linkClicks || r.clicks,
        cpr: Number(r.costPerResult.toFixed(2)),
      }));
  }, [filtered]);

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const exportCSV = () => {
    const headers = [
      "Código Requisição",
      "É 6 Dígitos",
      "Empresa",
      "Analista",
      "Rateio",
      "Mensagem Padrão / Título do Anúncio",
      "Valor Investido (R$)",
      "Cliques",
      "Conversas Geradas",
      "Taxa Conversão Cliques->Conversas (%)",
      "CPA / CPR (R$)",
      "CPC (R$)",
      "Status",
    ];

    const rows = filtered.map((r) => [
      `"${r.code}"`,
      r.is6Digits ? "Sim" : "Não",
      `"${r.company}"`,
      `"${r.analyst}"`,
      `"${r.rateio}"`,
      `"${r.defaultMessage.replace(/"/g, '""')}"`,
      r.spend.toFixed(2),
      r.linkClicks || r.clicks,
      r.conversions,
      r.conversionRate.toFixed(2),
      r.costPerResult.toFixed(2),
      r.cpc.toFixed(2),
      r.status,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `requisicoes_meta_ads_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fade-in" id="requisitions-analysis-tab">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Hash className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
                Resultado por Requisição & Mensagens Padrão
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs px-2 py-0.5">
                  {totals.reqs6} requisições de 6 dígitos
                </Badge>
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Rastreamento individual de vagas e códigos de 6 dígitos: quantidade de cliques, conversas geradas, valor investido e mensagem padrão de envio.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} className="text-xs h-8 gap-1.5 border-border/80">
            <Download className="w-3.5 h-3.5" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="glass-card p-4 space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Hash className="w-3 h-3 text-primary" /> Requisições
          </p>
          <p className="text-2xl font-display font-bold text-foreground">{totals.totalReqs}</p>
          <p className="text-[10px] text-primary">{totals.reqs6} com 6 dígitos</p>
        </div>

        <div className="glass-card p-4 space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-emerald-400" /> Investimento Total
          </p>
          <p className="text-2xl font-display font-bold text-foreground">
            R$ {totals.spend.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-muted-foreground">Em todas as requisições</p>
        </div>

        <div className="glass-card p-4 space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <MousePointerClick className="w-3 h-3 text-blue-400" /> Total de Cliques
          </p>
          <p className="text-2xl font-display font-bold text-foreground">
            {totals.clicks.toLocaleString("pt-BR")}
          </p>
          <p className="text-[10px] text-muted-foreground">CPC Médio R$ {totals.avgCPC.toFixed(2)}</p>
        </div>

        <div className="glass-card p-4 space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <MessageCircle className="w-3 h-3 text-emerald-400" /> Conversas Geradas
          </p>
          <p className="text-2xl font-display font-bold text-emerald-400">
            {totals.conversions.toLocaleString("pt-BR")}
          </p>
          <p className="text-[10px] text-emerald-500 font-medium">Mensagens iniciadas</p>
        </div>

        <div className="glass-card p-4 space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-purple-400" /> Taxa de Conversão
          </p>
          <p className="text-2xl font-display font-bold text-foreground">
            {totals.cvr.toFixed(1)}%
          </p>
          <p className="text-[10px] text-muted-foreground">Cliques → Conversas</p>
        </div>

        <div className="glass-card p-4 space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" /> CPA / CPR Médio
          </p>
          <p className="text-2xl font-display font-bold text-foreground">
            R$ {totals.avgCPR.toFixed(2)}
          </p>
          <p className="text-[10px] text-muted-foreground">Custo por conversa</p>
        </div>
      </div>

      {/* Top Chart Section */}
      {topChartData.length > 0 && (
        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-display font-semibold text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Top Requisições: Investimento vs Conversas Geradas
            </h4>
            <span className="text-xs text-muted-foreground">Comparativo de performance</span>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topChartData} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
                <XAxis dataKey="name" tick={{ fill: "hsl(215, 15%, 65%)", fontSize: 11 }} angle={-15} textAnchor="end" height={45} />
                <YAxis yAxisId="left" orientation="left" stroke="hsl(var(--primary))" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
                <YAxis yAxisId="right" orientation="right" stroke="#10b981" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(220, 18%, 12%)",
                    border: "1px solid hsl(220, 14%, 20%)",
                    borderRadius: "8px",
                    color: "hsl(210, 20%, 92%)",
                    fontSize: "12px",
                  }}
                  formatter={(value: any, name: string) => {
                    if (name === "spend") return [`R$ ${Number(value).toFixed(2)}`, "Investido"];
                    if (name === "conversions") return [value, "Conversas Geradas"];
                    if (name === "clicks") return [value, "Cliques"];
                    return [value, name];
                  }}
                />
                <Bar yAxisId="left" dataKey="spend" name="spend" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="conversions" name="conversions" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="glass-card p-4 space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar código (ex: 123456), empresa, vaga..."
              className="pl-9 h-9 text-xs sm:text-sm bg-secondary/40 border-border/70"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Button
              variant={only6Digits ? "default" : "outline"}
              size="sm"
              onClick={() => setOnly6Digits(!only6Digits)}
              className={cn("h-8 text-xs gap-1.5", only6Digits ? "bg-primary text-primary-foreground font-semibold" : "border-border/80")}
            >
              <Hash className="w-3.5 h-3.5" />
              Apenas 6 Dígitos ({requisitions.filter((r) => r.is6Digits).length})
            </Button>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 text-xs rounded-md bg-secondary/60 border border-border/70 px-2.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">Todos os Status</option>
              <option value="active">Apenas Ativas</option>
              <option value="paused">Pausadas</option>
              <option value="good">CPR Ótimo (≤ R$ 2,00)</option>
              <option value="ok">CPR OK (R$ 2,01 - 5,00)</option>
              <option value="warning">CPR Atenção (R$ 5,01 - 10,00)</option>
              <option value="no_result">Sem Conversas Geradas</option>
            </select>
          </div>
        </div>
      </div>

      {/* High Density Table */}
      <div className="glass-card overflow-hidden border border-border/70">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm text-left">
            <thead className="bg-secondary/60 text-muted-foreground uppercase text-[11px] font-semibold border-b border-border/60">
              <tr>
                <th className="p-3 cursor-pointer hover:text-foreground" onClick={() => toggleSort("code")}>
                  <div className="flex items-center gap-1">
                    <span>Código / Vaga</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="p-3">Empresa & Analista</th>
                <th className="p-3">Mensagem Padrão de Envio</th>
                <th className="p-3 cursor-pointer hover:text-foreground text-right" onClick={() => toggleSort("spend")}>
                  <div className="flex items-center justify-end gap-1">
                    <span>Investido</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="p-3 cursor-pointer hover:text-foreground text-right" onClick={() => toggleSort("clicks")}>
                  <div className="flex items-center justify-end gap-1">
                    <span>Cliques</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="p-3 cursor-pointer hover:text-foreground text-right" onClick={() => toggleSort("conversions")}>
                  <div className="flex items-center justify-end gap-1">
                    <span>Conversas</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="p-3 cursor-pointer hover:text-foreground text-right" onClick={() => toggleSort("cvr")}>
                  <div className="flex items-center justify-end gap-1">
                    <span>Taxa (Cliques→Conv)</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="p-3 cursor-pointer hover:text-foreground text-right" onClick={() => toggleSort("cpr")}>
                  <div className="flex items-center justify-end gap-1">
                    <span>CPA / CPR</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    Nenhuma requisição encontrada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filtered.map((item, idx) => {
                  const is6 = item.is6Digits;
                  const cprColor =
                    item.conversions === 0
                      ? "text-destructive bg-destructive/10 border-destructive/30"
                      : item.costPerResult <= 2
                      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                      : item.costPerResult <= 5
                      ? "text-blue-400 bg-blue-500/10 border-blue-500/30"
                      : item.costPerResult <= 10
                      ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
                      : "text-rose-400 bg-rose-500/10 border-rose-500/30";

                  return (
                    <tr key={idx} className="hover:bg-secondary/30 transition-colors">
                      {/* Código da Requisição */}
                      <td className="p-3 font-medium">
                        <div className="flex items-center gap-1.5">
                          {is6 ? (
                            <span className="px-2 py-0.5 rounded-md bg-primary/15 border border-primary/30 text-primary font-mono font-bold text-xs">
                              #{item.code}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-secondary text-muted-foreground font-mono text-[11px]">
                              {item.code}
                            </span>
                          )}
                          {item.adSetCount > 1 && (
                            <span className="text-[10px] text-muted-foreground px-1.5 py-0.2 rounded-full bg-secondary">
                              {item.adSetCount} cjs
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[200px]" title={item.defaultMessage}>
                          {item.adSetNames[0] || item.adNames[0] || "—"}
                        </p>
                      </td>

                      {/* Empresa, Analista & Estrutura */}
                      <td className="p-3">
                        <div className="flex items-center gap-1 text-foreground font-medium">
                          <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="truncate max-w-[140px]" title={item.company}>{item.company}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3 shrink-0" />
                            <span>{item.analyst}</span>
                          </span>
                          {item.rateio !== "—" && (
                            <>
                              <span>•</span>
                              <span className="text-amber-500/90 font-medium">{item.rateio}</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-wrap mt-1 text-[10px]">
                          {item.agency && item.agency !== "—" && (
                            <span className="px-1.5 py-0.2 rounded bg-primary/10 text-primary font-medium border border-primary/20">
                              {item.agency}
                            </span>
                          )}
                          {item.contractType && item.contractType !== "desconhecido" && (
                            <span className={cn("px-1.5 py-0.2 rounded font-medium border", item.contractType === "efetivo" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20")}>
                              {item.contractType === "efetivo" ? "EF" : "TE"}
                            </span>
                          )}
                          {item.period && (
                            <span className={cn("px-1.5 py-0.2 rounded font-medium border", item.period === "FULL" ? "bg-purple-500/10 text-purple-400 border-purple-500/20" : "bg-muted text-muted-foreground border-border/50")}>
                              {item.period}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Mensagem Padrão de Envio */}
                      <td className="p-3">
                        <div className="max-w-[280px] group relative">
                          <p className="text-xs text-foreground/90 line-clamp-2 bg-secondary/40 p-2 rounded-lg border border-border/40 font-normal italic">
                            "{item.defaultMessage}"
                          </p>
                        </div>
                      </td>

                      {/* Valor Investido */}
                      <td className="p-3 text-right font-medium tabular-nums text-foreground">
                        R$ {item.spend.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Quantidade de Cliques */}
                      <td className="p-3 text-right tabular-nums">
                        <span className="font-semibold text-foreground">
                          {(item.linkClicks || item.clicks).toLocaleString("pt-BR")}
                        </span>
                        {item.cpc > 0 && (
                          <span className="block text-[10px] text-muted-foreground">
                            CPC R${item.cpc.toFixed(2)}
                          </span>
                        )}
                      </td>

                      {/* Conversas Geradas */}
                      <td className="p-3 text-right tabular-nums">
                        <span className={cn("font-bold text-sm", item.conversions > 0 ? "text-emerald-400" : "text-muted-foreground")}>
                          {item.conversions}
                        </span>
                        <span className="block text-[10px] text-muted-foreground">
                          {item.conversions === 1 ? "conversa" : "conversas"}
                        </span>
                      </td>

                      {/* Taxa de Conversão */}
                      <td className="p-3 text-right tabular-nums">
                        <span className="font-medium text-foreground">
                          {item.conversionRate.toFixed(1)}%
                        </span>
                      </td>

                      {/* CPA / CPR */}
                      <td className="p-3 text-right">
                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border", cprColor)}>
                          {item.conversions > 0 ? `R$ ${item.costPerResult.toFixed(2)}` : "Sem Conv."}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="p-3 text-center">
                        <Badge
                          variant={item.status === "active" ? "default" : "secondary"}
                          className={cn(
                            "text-[10px] px-2 py-0.5",
                            item.status === "active" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : "bg-secondary text-muted-foreground"
                          )}
                        >
                          {item.status === "active" ? "Ativa" : "Pausada"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
