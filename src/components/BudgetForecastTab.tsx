import { useMemo, useState } from "react";
import { format, differenceInCalendarDays, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarIcon,
  Wallet,
  TrendingUp,
  Search,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  DollarSign,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CampaignData } from "@/types/campaign";

interface Props {
  /** Linhas diárias (não agregadas) — usadas para média de gasto por dia. */
  dailyRows: CampaignData[];
  /** Conjuntos consolidados. */
  campaigns: CampaignData[];
}

const brl = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type SortField = "projected" | "daily" | "days" | "name" | "company";
type SortOrder = "asc" | "desc";

export function BudgetForecastTab({ dailyRows, campaigns }: Props) {
  const [target, setTarget] = useState<Date | undefined>(addDays(new Date(), 30));
  const [search, setSearch] = useState("");
  const [agencyFilter, setAgencyFilter] = useState<string>("all");
  const [expandRows, setExpandRows] = useState(false);
  const [sortField, setSortField] = useState<SortField>("projected");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // média de gasto diário real por conjunto
  const avgDaily = useMemo(() => {
    const m = new Map<string, { spend: number; days: Set<string> }>();
    for (const r of dailyRows) {
      const key = `${r.account}||${r.campaignName}||${r.adSetName}`;
      const cur = m.get(key) ?? { spend: 0, days: new Set<string>() };
      cur.spend += r.spend;
      if (r.day) cur.days.add(r.day);
      m.set(key, cur);
    }
    const out = new Map<string, number>();
    m.forEach((v, k) => out.set(k, v.days.size > 0 ? v.spend / v.days.size : 0));
    return out;
  }, [dailyRows]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const availableAgencies = useMemo(() => {
    const set = new Set<string>();
    campaigns.forEach((c) => {
      if (c.agency && c.agency !== "—") set.add(c.agency);
    });
    return Array.from(set).sort();
  }, [campaigns]);

  const rows = useMemo(() => {
    if (!target) return [];
    const actives = campaigns.filter((c) => c.status === "active");
    const list = actives
      .filter((c) => {
        if (agencyFilter !== "all" && c.agency !== agencyFilter) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          const matches =
            c.adSetName.toLowerCase().includes(q) ||
            c.company.toLowerCase().includes(q) ||
            (c.agency && c.agency.toLowerCase().includes(q)) ||
            (c.rateio && c.rateio.toLowerCase().includes(q)) ||
            (c.requisitionCode && c.requisitionCode.toLowerCase().includes(q)) ||
            (c.jobTitle && c.jobTitle.toLowerCase().includes(q));
          if (!matches) return false;
        }
        return true;
      })
      .map((c) => {
        const key = `${c.account}||${c.campaignName}||${c.adSetName}`;
        const historic = avgDaily.get(key) ?? 0;
        const daily = c.dailyBudget && c.dailyBudget > 0 ? c.dailyBudget : historic;

        const end = c.scheduleEnd ? new Date(c.scheduleEnd) : null;
        const hasEnd = !!end && !isNaN(end.getTime());
        const effectiveEnd = hasEnd && end! < target ? end! : target;
        const days = Math.max(0, differenceInCalendarDays(effectiveEnd, today) + 1);

        let projected = daily * days;
        // Orçamento total (lifetime) limita o gasto restante
        const cap =
          c.budgetRemaining && c.budgetRemaining > 0
            ? c.budgetRemaining
            : c.lifetimeBudget && c.lifetimeBudget > 0
            ? Math.max(0, c.lifetimeBudget - c.spend)
            : null;
        let capped = false;
        if (cap !== null && projected > cap) {
          projected = cap;
          capped = true;
        }

        return {
          c,
          daily,
          usedBudget: !!(c.dailyBudget && c.dailyBudget > 0),
          days,
          projected,
          capped,
          endLabel: hasEnd ? format(end!, "dd/MM/yyyy") : null,
          endsBefore: hasEnd && end! < target,
        };
      });

    return list.sort((a, b) => {
      let diff = 0;
      if (sortField === "projected") diff = b.projected - a.projected;
      else if (sortField === "daily") diff = b.daily - a.daily;
      else if (sortField === "days") diff = b.days - a.days;
      else if (sortField === "name") diff = a.c.adSetName.localeCompare(b.c.adSetName);
      else if (sortField === "company") diff = a.c.company.localeCompare(b.c.company);

      return sortOrder === "asc" ? -diff : diff;
    });
  }, [campaigns, avgDaily, target, today, agencyFilter, search, sortField, sortOrder]);

  const totalProjected = rows.reduce((s, r) => s + r.projected, 0);
  const totalDaily = rows.reduce((s, r) => s + r.daily, 0);
  const daysAhead = target ? Math.max(0, differenceInCalendarDays(target, today) + 1) : 0;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" id="budget-forecast-tab">
      <div className="glass-card p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="font-display font-semibold text-lg flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" /> Calculadora de Orçamento
          </h3>
          <p className="text-sm text-muted-foreground">
            Projeção de gasto das campanhas ativas até a data escolhida.
          </p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <CalendarIcon className="w-4 h-4" />
              {target ? `Até ${format(target, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}` : "Escolher data final"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <div className="p-2 border-b border-border/50 flex flex-wrap gap-1.5">
              {[7, 15, 30, 60, 90].map((n) => (
                <Button
                  key={n}
                  variant="secondary"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setTarget(addDays(today, n))}
                >
                  +{n} dias
                </Button>
              ))}
            </div>
            <Calendar
              mode="single"
              selected={target}
              onSelect={setTarget}
              defaultMonth={target}
              disabled={(d) => d < today}
              locale={ptBR}
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* KPI Cards Simplificados */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Gasto projetado</p>
          <p className="text-2xl font-display font-bold text-primary mt-1 break-words leading-tight">
            {brl(totalProjected)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {daysAhead} dias à frente · {rows.length} conjuntos ativos
          </p>
        </div>
        <div className="glass-card p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Custo médio por dia</p>
          <p className="text-2xl font-display font-bold mt-1 break-words leading-tight text-foreground">
            {brl(totalDaily)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">Soma das médias diárias ativas</p>
        </div>
      </div>

      <div className="glass-card overflow-hidden space-y-3 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h4 className="font-display font-semibold text-sm">Detalhamento por Conjunto Ativo ({rows.length})</h4>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar vaga, req, agência..."
                className="pl-8 h-8 text-xs w-[180px] bg-secondary/50"
              />
            </div>
            {availableAgencies.length > 0 && (
              <div className="flex items-center gap-1 bg-secondary/40 p-0.5 rounded-md text-xs">
                <button
                  onClick={() => setAgencyFilter("all")}
                  className={cn(
                    "px-2 py-1 rounded text-xs",
                    agencyFilter === "all" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground"
                  )}
                >
                  Todas Agências
                </button>
                {availableAgencies.map((ag) => (
                  <button
                    key={ag}
                    onClick={() => setAgencyFilter(ag)}
                    className={cn(
                      "px-2 py-1 rounded text-xs",
                      agencyFilter === ag ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground"
                    )}
                  >
                    {ag}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-secondary/50">
              <tr className="text-left text-muted-foreground uppercase text-[11px] font-semibold border-b border-border/60">
                <th
                  className="px-4 py-2.5 cursor-pointer hover:text-foreground select-none"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center gap-1">
                    Conjunto de Anúncio
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-4 py-2.5 font-medium">Estrutura (Agência / Mod / Rateio)</th>
                <th
                  className="px-4 py-2.5 cursor-pointer hover:text-foreground select-none"
                  onClick={() => handleSort("company")}
                >
                  <div className="flex items-center gap-1">
                    Empresa
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  className="px-4 py-2.5 text-right cursor-pointer hover:text-foreground select-none"
                  onClick={() => handleSort("daily")}
                >
                  <div className="flex items-center justify-end gap-1">
                    Custo/dia
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  className="px-4 py-2.5 text-right cursor-pointer hover:text-foreground select-none"
                  onClick={() => handleSort("days")}
                >
                  <div className="flex items-center justify-end gap-1">
                    Dias
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  className="px-4 py-2.5 text-right cursor-pointer hover:text-foreground select-none"
                  onClick={() => handleSort("projected")}
                >
                  <div className="flex items-center justify-end gap-1">
                    Projeção
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {(expandRows ? rows : rows.slice(0, 3)).map((r) => (
                <tr key={r.c.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 max-w-[280px]">
                    <p className="truncate font-medium text-foreground" title={r.c.adSetName}>
                      {r.c.adSetName}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {r.usedBudget ? "Orçamento diário do Meta" : "Média histórica de gasto"}
                      {r.capped && " · Limitado pelo orçamento total"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {r.c.agency && r.c.agency !== "—" && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">
                          {r.c.agency}
                        </Badge>
                      )}
                      {r.c.contractType && r.c.contractType !== "desconhecido" && (
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] px-1.5 py-0",
                            r.c.contractType === "efetivo"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                          )}
                        >
                          {r.c.contractType === "efetivo" ? "EF" : "TE"}
                        </Badge>
                      )}
                      {r.c.rateio && r.c.rateio !== "—" && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-400 border-amber-500/20">
                          {r.c.rateio}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-medium">{r.c.company}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap font-mono">
                    {r.daily > 0 ? brl(r.daily) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{r.days}</td>
                  <td className="px-4 py-3 text-right font-bold text-foreground font-mono whitespace-nowrap">
                    {brl(r.projected)}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum conjunto ativo no período selecionado.
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="bg-secondary/40">
                <tr>
                  <td className="px-4 py-2.5 font-semibold" colSpan={5}>
                    Total projetado até {target ? format(target, "dd/MM/yyyy") : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-display font-bold text-primary whitespace-nowrap">
                    {brl(totalProjected)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {rows.length > 3 && (
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpandRows(!expandRows)}
              className="text-xs gap-1.5"
            >
              {expandRows ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" /> Mostrar menos (Top 3)
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" /> Ver todos os {rows.length} conjuntos ativos
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
