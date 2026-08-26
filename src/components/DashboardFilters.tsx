import { useMemo, useState } from "react";
import { CalendarIcon, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import type { CampaignData, DashboardFilters } from "@/types/campaign";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

interface DashboardFiltersBarProps {
  campaigns: CampaignData[];
  filters: DashboardFilters;
  onFiltersChange: (filters: DashboardFilters) => void;
}

function MultiSelect({
  label,
  options,
  selected,
  onChange,
  disabled = false,
  disabledHint,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
  disabledHint?: string;
}) {
  const [open, setOpen] = useState(false);
  if (disabled) {
    return (
      <Button variant="outline" size="sm" disabled title={disabledHint} className="h-8 text-xs gap-1.5 opacity-50 cursor-not-allowed">
        {label}
      </Button>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-8 text-xs gap-1.5", selected.length > 0 && "border-primary text-primary")}>
          {label}
          {selected.length > 0 && (
            <span className="ml-1 bg-primary/20 text-primary rounded-full px-1.5 py-0.5 text-[10px] font-bold">
              {selected.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => {
                onChange(
                  selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]
                );
              }}
              className={cn(
                "w-full text-left px-3 py-1.5 text-xs rounded-md transition-colors",
                selected.includes(opt)
                  ? "bg-primary/15 text-primary font-medium"
                  : "hover:bg-secondary text-foreground"
              )}
            >
              {opt}
            </button>
          ))}
        </div>
        {selected.length > 0 && (
          <Button variant="ghost" size="sm" className="w-full mt-2 text-xs h-7" onClick={() => onChange([])}>
            Limpar
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function DashboardFiltersBar({ campaigns, filters, onFiltersChange }: DashboardFiltersBarProps) {
  const uniqueValues = useMemo(() => {
    const analysts = new Set<string>();
    const companies = new Set<string>();
    const agencies = new Set<string>();
    const contractTypes = new Set<string>();
    const resultTypes = new Set<string>();
    const accounts = new Set<string>();
    const rateios = new Set<string>();

    campaigns.forEach((c) => {
      if (c.analyst && c.analyst !== "Desconhecido") analysts.add(c.analyst);
      if (
        c.company &&
        c.company !== "Desconhecida" &&
        !/^\(?\d+\)?$/.test(c.company.trim()) &&
        !/^\d+$/.test(c.company.trim()) &&
        !/^SIP\b/i.test(c.company.trim())
      ) {
        companies.add(c.company);
      }
      if (c.agency && c.agency !== "Desconhecida") agencies.add(c.agency);
      if (c.contractType !== "desconhecido") {
        contractTypes.add(c.contractType === "efetivo" ? "Efetivo" : "Temporário");
      }
      if (c.resultType && c.resultType !== "—") resultTypes.add(c.resultType);
      if (c.account) accounts.add(c.account);
      if (c.rateio && c.rateio !== "—") rateios.add(c.rateio);
    });

    return {
      analysts: [...analysts].sort(),
      companies: [...companies].sort(),
      agencies: [...agencies].sort(),
      contractTypes: [...contractTypes].sort(),
      resultTypes: [...resultTypes].sort(),
      accounts: [...accounts].sort(),
      rateios: [...rateios].sort(),
    };
  }, [campaigns]);

  const days = useMemo(() => {
    const set = new Set<string>();
    campaigns.forEach((c) => { if (c.day) set.add(c.day); });
    return [...set].sort();
  }, [campaigns]);

  const minDate = days.length > 0 ? new Date(days[0] + "T00:00:00") : undefined;
  const maxDate = days.length > 0 ? new Date(days[days.length - 1] + "T00:00:00") : undefined;

  const initialRange: DateRange | undefined = filters.dateRange
    ? {
        from: new Date(filters.dateRange.start + "T00:00:00"),
        to: new Date(filters.dateRange.end + "T00:00:00"),
      }
    : undefined;

  const [range, setRange] = useState<DateRange | undefined>(initialRange);

  const handleRangeChange = (r: DateRange | undefined) => {
    setRange(r);
    if (r?.from) {
      const end = r.to ?? r.from; // single day allowed
      onFiltersChange({
        ...filters,
        dateRange: {
          start: format(r.from, "yyyy-MM-dd"),
          end: format(end, "yyyy-MM-dd"),
        },
      });
    } else {
      onFiltersChange({ ...filters, dateRange: null });
    }
  };

  const hasFilters = filters.analysts.length > 0 || filters.companies.length > 0 ||
    filters.agencies.length > 0 || filters.contractTypes.length > 0 ||
    filters.resultTypes.length > 0 || filters.dateRange !== null ||
    (filters.accounts?.length ?? 0) > 0 || (filters.rateios?.length ?? 0) > 0 ||
    (filters.veiculationTypes?.length ?? 0) > 0;

  const clearAll = () => {
    setRange(undefined);
    onFiltersChange({
      dateRange: null,
      analysts: [],
      companies: [],
      agencies: [],
      contractTypes: [],
      resultTypes: [],
      statuses: [],
      accounts: [],
      rateios: [],
      veiculationTypes: [],
    });
  };

  const dateLabel = filters.dateRange
    ? filters.dateRange.start === filters.dateRange.end
      ? format(new Date(filters.dateRange.start + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })
      : `${format(new Date(filters.dateRange.start + "T00:00:00"), "dd/MM", { locale: ptBR })} – ${format(new Date(filters.dateRange.end + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}`
    : "Período";

  return (
    <div className="glass-card p-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-1">
          <Filter className="w-3.5 h-3.5" />
          <span className="font-medium">Filtros:</span>
        </div>

        {/* Single date range box */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("h-8 text-xs gap-1.5", filters.dateRange && "border-primary text-primary")}>
              <CalendarIcon className="w-3.5 h-3.5" />
              {dateLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="p-2 border-b border-border/50 flex flex-wrap gap-1.5">
              {[
                { label: "Últimos 7 dias", n: 7 },
                { label: "Últimos 14 dias", n: 14 },
                { label: "Últimos 30 dias", n: 30 },
              ].map((p) => (
                <Button
                  key={p.n}
                  variant="secondary"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    if (!maxDate) return;
                    const to = maxDate;
                    const from = new Date(to);
                    from.setDate(from.getDate() - (p.n - 1));
                    handleRangeChange({ from: minDate && from < minDate ? minDate : from, to });
                  }}
                >
                  {p.label}
                </Button>
              ))}
              <Button variant="secondary" size="sm" className="h-7 text-xs" onClick={() => handleRangeChange(minDate && maxDate ? { from: minDate, to: maxDate } : undefined)}>
                Todo o período
              </Button>
            </div>
            <Calendar
              mode="range"
              selected={range}
              onSelect={handleRangeChange}
              numberOfMonths={typeof window !== "undefined" && window.innerWidth < 640 ? 1 : 2}
              defaultMonth={range?.from ?? minDate}
              locale={ptBR}
              className="p-3 pointer-events-auto"
            />

            <div className="p-2 border-t border-border/50 flex justify-between items-center text-xs">
              <span className="text-muted-foreground">
                {range?.from ? `${format(range.from, "dd/MM/yyyy")}${range.to && range.to.getTime() !== range.from.getTime() ? ` – ${format(range.to, "dd/MM/yyyy")}` : ""}` : "Selecione o período"}
              </span>
              {range?.from && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleRangeChange(undefined)}>
                  Limpar
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <MultiSelect
          label="Analista"
          options={uniqueValues.analysts}
          selected={[]}
          onChange={() => {}}
          disabled
          disabledHint="Filtro de analista temporariamente desativado"
        />
        <MultiSelect
          label="Empresa"
          options={uniqueValues.companies}
          selected={filters.companies}
          onChange={(v) => onFiltersChange({ ...filters, companies: v })}
        />
        <MultiSelect
          label="Agência"
          options={uniqueValues.agencies}
          selected={filters.agencies}
          onChange={(v) => onFiltersChange({ ...filters, agencies: v })}
        />
        <MultiSelect
          label="Tipo Contrato"
          options={uniqueValues.contractTypes}
          selected={filters.contractTypes}
          onChange={(v) => onFiltersChange({ ...filters, contractTypes: v })}
        />
        <MultiSelect
          label="Tipo Resultado"
          options={uniqueValues.resultTypes}
          selected={filters.resultTypes}
          onChange={(v) => onFiltersChange({ ...filters, resultTypes: v })}
        />
        <MultiSelect
          label="Situação"
          options={["Em veiculação", "Pausada/Concluída"]}
          selected={filters.statuses ?? []}
          onChange={(v) => onFiltersChange({ ...filters, statuses: v })}
        />
        {uniqueValues.rateios.length > 0 && (
          <MultiSelect
            label="Praça / Unidade"
            options={uniqueValues.rateios}
            selected={filters.rateios ?? []}
            onChange={(v) => onFiltersChange({ ...filters, rateios: v })}
          />
        )}
        <MultiSelect
          label="Veiculação"
          options={["Contínua (FULL)", "Pontual / Período"]}
          selected={filters.veiculationTypes ?? []}
          onChange={(v) => onFiltersChange({ ...filters, veiculationTypes: v })}
        />
        {uniqueValues.accounts.length > 1 && (
          <MultiSelect
            label="Conta"
            options={uniqueValues.accounts}
            selected={filters.accounts ?? []}
            onChange={(v) => onFiltersChange({ ...filters, accounts: v })}
          />
        )}

        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive hover:text-destructive" onClick={clearAll}>
            <X className="w-3.5 h-3.5 mr-1" /> Limpar
          </Button>
        )}
      </div>
    </div>
  );
}

