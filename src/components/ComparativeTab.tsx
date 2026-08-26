import { useMemo, useState } from "react";
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
import {
  Building2,
  TrendingUp,
  DollarSign,
  Users,
  Target,
  ArrowUpDown,
  Search,
} from "lucide-react";
import type { CampaignData } from "@/types/campaign";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { extractAdSetMetadata, sanitizeAndValidateCompany } from "@/lib/csv-parser";
import { cn } from "@/lib/utils";

interface ComparativeTabProps {
  campaigns: CampaignData[];
}

function resolveCompanyName(c: CampaignData): string {
  const comp = c.company;
  if (
    !comp ||
    comp === "Desconhecida" ||
    /^\(?\d+\)?$/.test(comp.trim()) ||
    /^\d+$/.test(comp.trim()) ||
    /^SIP\b/i.test(comp.trim())
  ) {
    const meta = extractAdSetMetadata(c.adSetName || "", c.campaignName || "", c.adName || "", c.defaultAdMessage || "");
    if (meta.company && meta.company !== "Desconhecida" && !/^\(?\d+\)?$/.test(meta.company.trim())) {
      return meta.company;
    }
    return "NÃO IDENTIFICADA";
  }
  return sanitizeAndValidateCompany(comp);
}

interface CompanyGroup {
  company: string;
  spend: number;
  conversions: number;
  reach: number;
  impressions: number;
  avgCPR: number;
  avgFrequency: number;
  count: number;
  cpm: number;
  linkClicks: number;
  // Segmentação Efetivo vs Temporário
  efSpend: number;
  efConversions: number;
  efCPR: number;
  efCount: number;
  teSpend: number;
  teConversions: number;
  teCPR: number;
  teCount: number;
  // Rateios / Praças envolvidas
  rateios: string[];
}

function buildCompanyGroup(company: string, items: CampaignData[]): CompanyGroup {
  const spend = items.reduce((s, c) => s + c.spend, 0);
  const impressions = items.reduce((s, c) => s + c.impressions, 0);
  const reach = items.reduce((s, c) => s + c.reach, 0);
  const totalConversions = items.reduce((s, c) => s + c.conversions, 0);

  const validCPR = items.filter((c) => c.conversions > 0 && c.costPerResult >= 0.5);
  const totalSpendValid = validCPR.reduce((s, c) => s + c.spend, 0);
  const convValid = validCPR.reduce((s, c) => s + c.conversions, 0);

  const efItems = items.filter((c) => c.contractType === "efetivo");
  const teItems = items.filter((c) => c.contractType === "temporario");

  const efSpend = efItems.reduce((s, c) => s + c.spend, 0);
  const efConversions = efItems.reduce((s, c) => s + c.conversions, 0);
  const efCPR = efConversions > 0 ? efSpend / efConversions : 0;

  const teSpend = teItems.reduce((s, c) => s + c.spend, 0);
  const teConversions = teItems.reduce((s, c) => s + c.conversions, 0);
  const teCPR = teConversions > 0 ? teSpend / teConversions : 0;

  const rateiosSet = new Set<string>();
  items.forEach((c) => {
    if (c.rateio && c.rateio !== "—" && c.rateio.trim() !== "") {
      rateiosSet.add(c.rateio);
    }
  });

  return {
    company,
    spend,
    conversions: totalConversions,
    reach,
    impressions,
    avgCPR: convValid > 0 ? totalSpendValid / convValid : totalConversions > 0 ? spend / totalConversions : 0,
    avgFrequency: reach > 0 ? impressions / reach : 1.0,
    count: items.length,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
    linkClicks: items.reduce((s, c) => s + (c.linkClicks > 0 ? c.linkClicks : c.clicks), 0),
    efSpend,
    efConversions,
    efCPR,
    efCount: efItems.length,
    teSpend,
    teConversions,
    teCPR,
    teCount: teItems.length,
    rateios: Array.from(rateiosSet),
  };
}

const COLORS = [
  "hsl(213, 92%, 58%)",
  "hsl(195, 92%, 50%)",
  "hsl(225, 70%, 62%)",
  "hsl(170, 75%, 45%)",
  "hsl(205, 80%, 40%)",
  "hsl(240, 60%, 62%)",
  "hsl(188, 70%, 62%)",
  "hsl(218, 45%, 45%)",
  "hsl(280, 65%, 60%)",
  "hsl(150, 60%, 45%)",
];

const tooltipStyle = {
  backgroundColor: "hsl(220, 28%, 11%)",
  border: "1px solid hsl(220, 22%, 20%)",
  borderRadius: "8px",
  color: "hsl(210, 25%, 94%)",
  fontSize: "12px",
};

const brl = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type SortType = "spend_desc" | "spend_asc" | "conv_desc" | "cpr_asc" | "name_asc";

export function ComparativeTab({ campaigns }: ComparativeTabProps) {
  const [search, setSearch] = useState("");
  const [contractFilter, setContractFilter] = useState<"all" | "efetivo" | "temporario">("all");
  const [rateioFilter, setRateioFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortType>("spend_desc");

  // Rateios disponíveis
  const availableRateios = useMemo(() => {
    const set = new Set<string>();
    campaigns.forEach((c) => {
      if (c.rateio && c.rateio !== "—" && c.rateio.trim() !== "") {
        set.add(c.rateio);
      }
    });
    return Array.from(set).sort();
  }, [campaigns]);

  // Filtragem dos dados (SEMPRE agrupa por empresa)
  const filteredCompanies = useMemo(() => {
    // 1. Filtrar campanhas
    const filtered = campaigns.filter((c) => {
      if (contractFilter !== "all" && c.contractType !== contractFilter) return false;
      if (rateioFilter !== "all" && c.rateio !== rateioFilter) return false;
      return true;
    });

    // 2. Agrupar por Empresa
    const map: Record<string, CampaignData[]> = {};
    filtered.forEach((c) => {
      const comp = resolveCompanyName(c);
      if (!map[comp]) map[comp] = [];
      map[comp].push(c);
    });

    let list = Object.entries(map)
      .map(([comp, items]) => buildCompanyGroup(comp, items))
      .filter((g) => g.spend > 0 || g.conversions > 0);

    // 3. Busca por texto
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (g) =>
          g.company.toLowerCase().includes(q) ||
          g.rateios.some((r) => r.toLowerCase().includes(q))
      );
    }

    // 4. Ordenação
    return list.sort((a, b) => {
      if (sortBy === "spend_desc") return b.spend - a.spend;
      if (sortBy === "spend_asc") return a.spend - b.spend;
      if (sortBy === "conv_desc") return b.conversions - a.conversions;
      if (sortBy === "cpr_asc") {
        if (a.avgCPR === 0) return 1;
        if (b.avgCPR === 0) return -1;
        return a.avgCPR - b.avgCPR;
      }
      if (sortBy === "name_asc") return a.company.localeCompare(b.company);
      return b.spend - a.spend;
    });
  }, [campaigns, contractFilter, rateioFilter, search, sortBy]);

  const totalSpend = useMemo(() => filteredCompanies.reduce((s, g) => s + g.spend, 0), [filteredCompanies]);
  const totalConversions = useMemo(() => filteredCompanies.reduce((s, g) => s + g.conversions, 0), [filteredCompanies]);
  const totalAvgCPR = totalConversions > 0 ? totalSpend / totalConversions : 0;

  return (
    <div className="space-y-6 animate-fade-in" id="comparative-tab">
      {/* Barra de Filtros e Busca Rápida */}
      <div className="glass-card p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-base">Comparativo por Empresa</h3>
            <p className="text-xs text-muted-foreground">
              {filteredCompanies.length} empresas com investimento ativo no período
            </p>
          </div>
        </div>

        {/* Filtros em linha limpos */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Busca */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar empresa ou praça..."
              className="pl-8 h-8 text-xs w-[180px] sm:w-[210px] bg-secondary/50"
            />
          </div>

          {/* Filtro de Modalidade (EF / TE) */}
          <div className="flex items-center gap-1 bg-secondary/50 p-1 rounded-lg border border-border/50 text-xs">
            <button
              onClick={() => setContractFilter("all")}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                contractFilter === "all"
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Todas
            </button>
            <button
              onClick={() => setContractFilter("efetivo")}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                contractFilter === "efetivo"
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Efetivo (EF)
            </button>
            <button
              onClick={() => setContractFilter("temporario")}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                contractFilter === "temporario"
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Temporário (TE)
            </button>
          </div>

          {/* Filtro de Rateio se houver */}
          {availableRateios.length > 0 && (
            <select
              value={rateioFilter}
              onChange={(e) => setRateioFilter(e.target.value)}
              className="h-8 text-xs rounded-md bg-secondary/60 border border-border/60 px-2.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">Todas as Praças/Rateios</option>
              {availableRateios.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          )}

          {/* Ordenação */}
          <div className="flex items-center gap-1">
            <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="h-8 text-xs rounded-md bg-secondary/60 border border-border/60 px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="spend_desc">Maior Gasto</option>
              <option value="spend_asc">Menor Gasto</option>
              <option value="conv_desc">Mais Conversões</option>
              <option value="cpr_asc">Melhor CPR</option>
              <option value="name_asc">Nome (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Mini KPIs de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="glass-card p-4 space-y-1">
          <p className="text-[11px] text-muted-foreground uppercase font-semibold">Investimento Total</p>
          <p className="text-xl font-bold font-display text-foreground">{brl(totalSpend)}</p>
          <p className="text-[10px] text-muted-foreground">{filteredCompanies.length} empresas exibidas</p>
        </div>
        <div className="glass-card p-4 space-y-1">
          <p className="text-[11px] text-muted-foreground uppercase font-semibold">Conversões Geradas</p>
          <p className="text-xl font-bold font-display text-emerald-400">{totalConversions.toLocaleString("pt-BR")}</p>
          <p className="text-[10px] text-muted-foreground">Resultados consolidados</p>
        </div>
        <div className="glass-card p-4 space-y-1">
          <p className="text-[11px] text-muted-foreground uppercase font-semibold">CPR Médio Geral</p>
          <p className="text-xl font-bold font-display text-foreground">
            {totalAvgCPR > 0 ? brl(totalAvgCPR) : "—"}
          </p>
          <p className="text-[10px] text-muted-foreground">Custo médio por conversão</p>
        </div>
      </div>

      {/* Grade de Cartões de Empresas com Design Limpo e Responsivo */}
      {filteredCompanies.length === 0 ? (
        <div className="glass-card p-8 text-center text-muted-foreground text-xs">
          Nenhuma empresa encontrada com os filtros aplicados.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCompanies.map((g, i) => {
            const cprColor =
              g.avgCPR === 0
                ? "text-muted-foreground"
                : g.avgCPR <= 3
                ? "text-emerald-400"
                : g.avgCPR <= 7
                ? "text-blue-400"
                : g.avgCPR <= 12
                ? "text-amber-400"
                : "text-destructive";

            return (
              <div
                key={g.company}
                className="glass-card p-4 space-y-3 border border-border/60 hover:border-primary/40 transition-all shadow-sm flex flex-col justify-between"
              >
                {/* Topo do Cartão: Nome da Empresa */}
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-2 border-b border-border/40 pb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: COLORS[i % COLORS.length] }}
                      />
                      <h4 className="font-display font-semibold text-sm text-foreground truncate" title={g.company}>
                        {g.company}
                      </h4>
                    </div>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0 font-mono">
                      {g.count} conj.
                    </Badge>
                  </div>

                  {/* Badges de Praças / Rateios se houver */}
                  {g.rateios.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap pt-0.5">
                      {g.rateios.slice(0, 2).map((r) => (
                        <span
                          key={r}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 truncate max-w-[130px]"
                          title={r}
                        >
                          {r}
                        </span>
                      ))}
                      {g.rateios.length > 2 && (
                        <span className="text-[10px] text-muted-foreground">+{g.rateios.length - 2}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Métricas Principais */}
                <div className="grid grid-cols-3 gap-2 text-center p-2.5 rounded-lg bg-secondary/30">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-medium">Gasto</p>
                    <p className="text-xs font-bold font-display text-foreground">{brl(g.spend)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-medium">Conv.</p>
                    <p className="text-xs font-bold font-display text-emerald-400">{g.conversions}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-medium">CPR</p>
                    <p className={cn("text-xs font-bold font-display", cprColor)}>
                      {g.avgCPR > 0 ? brl(g.avgCPR) : "—"}
                    </p>
                  </div>
                </div>

                {/* Segmentação Efetivo / Temporário */}
                <div className="space-y-1.5 text-[11px] pt-1">
                  {g.efSpend > 0 && (
                    <div className="flex items-center justify-between p-1.5 rounded bg-primary/5 border border-primary/20">
                      <span className="font-medium text-primary flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" /> Efetivo [EF]
                      </span>
                      <div className="flex items-center gap-2 text-right">
                        <span className="text-muted-foreground">({g.efConversions} conv)</span>
                        <span className="text-foreground font-mono font-medium">{brl(g.efSpend)}</span>
                        <strong className="text-primary font-mono">{g.efCPR > 0 ? brl(g.efCPR) : "—"}</strong>
                      </div>
                    </div>
                  )}

                  {g.teSpend > 0 && (
                    <div className="flex items-center justify-between p-1.5 rounded bg-cyan-500/5 border border-cyan-500/20">
                      <span className="font-medium text-cyan-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" /> Temporário [TE]
                      </span>
                      <div className="flex items-center gap-2 text-right">
                        <span className="text-muted-foreground">({g.teConversions} conv)</span>
                        <span className="text-foreground font-mono font-medium">{brl(g.teSpend)}</span>
                        <strong className="text-cyan-400 font-mono">{g.teCPR > 0 ? brl(g.teCPR) : "—"}</strong>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-1 border-t border-border/30">
                    <span>Alcance: {g.reach.toLocaleString("pt-BR")}</span>
                    <span>Freq: {g.avgFrequency.toFixed(2)}x</span>
                    <span>CPM: {brl(g.cpm)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Gráficos de Apoio Visual */}
      {filteredCompanies.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
          <div className="glass-card p-5 space-y-3">
            <h4 className="font-display font-semibold text-sm">Top 10 Empresas por Investimento</h4>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={filteredCompanies.slice(0, 10)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
                <XAxis
                  type="number"
                  tick={{ fill: "hsl(215, 15%, 55%)", fontSize: 10 }}
                  tickFormatter={(v) => `R$${v}`}
                />
                <YAxis
                  type="category"
                  dataKey="company"
                  tick={{ fill: "hsl(210, 20%, 85%)", fontSize: 10 }}
                  width={110}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number) => [brl(v), "Investimento"]}
                />
                <Bar dataKey="spend" radius={[0, 4, 4, 0]}>
                  {filteredCompanies.slice(0, 10).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="glass-card p-5 space-y-3">
            <h4 className="font-display font-semibold text-sm">Top 10 Empresas por Menor CPR</h4>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={filteredCompanies
                  .filter((g) => g.avgCPR > 0)
                  .sort((a, b) => a.avgCPR - b.avgCPR)
                  .slice(0, 10)}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
                <XAxis
                  type="number"
                  tick={{ fill: "hsl(215, 15%, 55%)", fontSize: 10 }}
                  tickFormatter={(v) => `R$${v.toFixed(0)}`}
                />
                <YAxis
                  type="category"
                  dataKey="company"
                  tick={{ fill: "hsl(210, 20%, 85%)", fontSize: 10 }}
                  width={110}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number) => [brl(v), "CPR Médio"]}
                />
                <Bar dataKey="avgCPR" radius={[0, 4, 4, 0]}>
                  {filteredCompanies
                    .filter((g) => g.avgCPR > 0)
                    .sort((a, b) => a.avgCPR - b.avgCPR)
                    .slice(0, 10)
                    .map((g, i) => (
                      <Cell
                        key={i}
                        fill={
                          g.avgCPR > 15
                            ? "hsl(0, 72%, 55%)"
                            : g.avgCPR > 8
                            ? "hsl(38, 92%, 55%)"
                            : "hsl(150, 60%, 45%)"
                        }
                      />
                    ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
