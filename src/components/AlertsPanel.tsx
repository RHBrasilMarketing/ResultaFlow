import { useState, useMemo } from "react";
import {
  AlertTriangle,
  Flame,
  Repeat,
  Wallet,
  TrendingUp,
  Calendar,
  Save,
  Edit2,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { CampaignData } from "@/types/campaign";

export interface CompanyBudget {
  company_name: string;
  monthly_budget: number;
}

interface Props {
  campaigns: CampaignData[];
  companyBudgets: CompanyBudget[];
  totalBudget: number;
  onBudgetsUpdated?: (newTotal: number, newCompanyBudgets: CompanyBudget[]) => void;
}

const brl = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

function formatMonthLabel(ym: string) {
  const [year, month] = ym.split("-");
  const monthIdx = parseInt(month, 10) - 1;
  const name = MONTH_NAMES[monthIdx] || month;
  return `${name} de ${year}`;
}

function BudgetBar({ pct }: { pct: number }) {
  const color = pct >= 100 ? "bg-destructive" : pct >= 70 ? "bg-warning" : "bg-primary";
  return (
    <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

export function AlertsPanel({
  campaigns,
  companyBudgets,
  totalBudget,
  onBudgetsUpdated,
}: Props) {
  // Coleta todos os meses disponíveis nos dados
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    const now = new Date();
    const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    months.add(currentYM);

    for (const c of campaigns) {
      if (c.day && c.day.length >= 7) {
        months.add(c.day.slice(0, 7));
      }
      if (c.startDate && c.startDate.length >= 7) {
        months.add(c.startDate.slice(0, 7));
      }
    }
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [campaigns]);

  // Mês selecionado para cálculo do orçamento
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return availableMonths.includes(currentYM) ? currentYM : availableMonths[0] || currentYM;
  });

  // Modal de edição e salvamento de orçamento na nuvem
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editTotalBudget, setEditTotalBudget] = useState(totalBudget.toString());
  const [editCompanyBudgets, setEditCompanyBudgets] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const openBudgetDialog = () => {
    setEditTotalBudget(totalBudget.toString());
    const map: Record<string, string> = {};
    for (const cb of companyBudgets) {
      map[cb.company_name] = cb.monthly_budget.toString();
    }
    setEditCompanyBudgets(map);
    setIsDialogOpen(true);
  };

  const handleSaveBudgets = async () => {
    setSaving(true);
    try {
      const parsedTotal = parseFloat(editTotalBudget.replace(",", ".")) || 0;

      // 1. Salva no account_settings
      const { data: acctRows } = await supabase.from("account_settings").select("id").limit(1);
      if (acctRows && acctRows.length > 0) {
        const { error: errAcct } = await supabase
          .from("account_settings")
          .update({ total_budget: parsedTotal })
          .eq("id", acctRows[0].id);
        if (errAcct) throw errAcct;
      } else {
        const { error: errAcct } = await supabase
          .from("account_settings")
          .insert({ total_budget: parsedTotal });
        if (errAcct) throw errAcct;
      }

      // 2. Salva company_settings
      const updatedCompanyList: CompanyBudget[] = [];
      for (const [name, valStr] of Object.entries(editCompanyBudgets)) {
        const budgetVal = parseFloat(valStr.replace(",", ".")) || 0;
        updatedCompanyList.push({ company_name: name, monthly_budget: budgetVal });

        const { data: existing } = await supabase
          .from("company_settings")
          .select("id")
          .eq("company_name", name)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("company_settings")
            .update({ monthly_budget: budgetVal })
            .eq("id", existing.id);
        } else if (budgetVal > 0) {
          await supabase
            .from("company_settings")
            .insert({ company_name: name, monthly_budget: budgetVal });
        }
      }

      toast.success("Orçamentos salvos com sucesso na nuvem!");
      if (onBudgetsUpdated) {
        onBudgetsUpdated(parsedTotal, updatedCompanyList);
      }
      setIsDialogOpen(false);
    } catch (e: any) {
      toast.error("Erro ao salvar orçamentos", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  // Filtra dados especificamente para o mês de referência
  const monthCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      if (c.day) return c.day.startsWith(selectedMonth);
      if (c.startDate) return c.startDate.startsWith(selectedMonth);
      return true;
    });
  }, [campaigns, selectedMonth]);

  // Alertas gerais
  const highCPR = useMemo(
    () =>
      campaigns
        .filter((c) => c.conversions > 0 && c.costPerResult >= 0.5 && c.costPerResult > 5)
        .sort((a, b) => b.costPerResult - a.costPerResult)
        .slice(0, 8),
    [campaigns],
  );

  const highFreq = useMemo(
    () => campaigns.filter((c) => c.frequency > 2.5).sort((a, b) => b.frequency - a.frequency).slice(0, 8),
    [campaigns],
  );

  const noResults = useMemo(
    () => campaigns.filter((c) => c.conversions === 0 && c.spend > 5).sort((a, b) => b.spend - a.spend).slice(0, 8),
    [campaigns],
  );

  // Gasto do mês selecionado
  const monthTotalSpend = useMemo(
    () => monthCampaigns.reduce((s, c) => s + c.spend, 0),
    [monthCampaigns],
  );

  // Consumo por empresa no mês selecionado
  const budgetRows = useMemo(() => {
    const spendByCompany = new Map<string, number>();
    for (const c of monthCampaigns) {
      const key = (c.company || "—").toUpperCase();
      spendByCompany.set(key, (spendByCompany.get(key) ?? 0) + c.spend);
    }
    return companyBudgets
      .filter((b) => b.monthly_budget > 0)
      .map((b) => {
        const spend = spendByCompany.get(b.company_name.toUpperCase()) ?? 0;
        return { name: b.company_name, budget: b.monthly_budget, spend, pct: (spend / b.monthly_budget) * 100 };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [monthCampaigns, companyBudgets]);

  const totalPct = totalBudget > 0 ? (monthTotalSpend / totalBudget) * 100 : 0;
  const nearLimit = budgetRows.filter((r) => r.pct >= 70);

  // Cálculo de progresso do mês atual para ritmo de gasto
  const monthPacing = useMemo(() => {
    const [yearStr, monthStr] = selectedMonth.split("-");
    const y = parseInt(yearStr, 10);
    const m = parseInt(monthStr, 10);
    const daysInMonth = new Date(y, m, 0).getDate();
    const now = new Date();
    const isCurrent = now.getFullYear() === y && now.getMonth() + 1 === m;
    const currentDay = isCurrent ? Math.min(now.getDate(), daysInMonth) : daysInMonth;
    const timePct = (currentDay / daysInMonth) * 100;
    const dailyAvg = currentDay > 0 ? monthTotalSpend / currentDay : 0;
    const projectedSpend = dailyAvg * daysInMonth;

    return {
      daysInMonth,
      currentDay,
      timePct,
      dailyAvg,
      projectedSpend,
      isCurrent,
    };
  }, [selectedMonth, monthTotalSpend]);

  const cards = [
    { key: "cpr", title: "Custo elevado", count: highCPR.length, icon: Flame, tone: "text-destructive" },
    { key: "freq", title: "Frequência alta", count: highFreq.length, icon: Repeat, tone: "text-warning" },
    { key: "zero", title: "Gasto sem resultado", count: noResults.length, icon: AlertTriangle, tone: "text-destructive" },
    {
      key: "budget",
      title: `Orçamento ${formatMonthLabel(selectedMonth).split(" ")[0]} >70%`,
      count: nearLimit.length + (totalPct >= 70 ? 1 : 0),
      icon: Wallet,
      tone: "text-warning",
    },
  ];

  const list = (
    items: CampaignData[],
    render: (c: CampaignData) => string,
    empty: string,
  ) =>
    items.length === 0 ? (
      <p className="text-xs text-muted-foreground py-4 text-center">{empty}</p>
    ) : (
      <ul className="space-y-2">
        {items.map((c) => (
          <li key={c.id} className="flex items-start justify-between gap-3 text-xs p-2 rounded-lg bg-secondary/40">
            <span className="truncate flex-1" title={c.adSetName}>{c.adSetName}</span>
            <span className="font-semibold whitespace-nowrap">{render(c)}</span>
          </li>
        ))}
      </ul>
    );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(({ key, title, count, icon: Icon, tone }) => (
          <div key={key} className="glass-card p-4 flex items-center gap-3">
            <Icon className={`w-5 h-5 ${tone}`} />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{title}</p>
              <p className="text-xl font-display font-bold">{count}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-card p-4 space-y-3">
          <h4 className="text-sm font-display font-semibold flex items-center gap-2">
            <Flame className="w-4 h-4 text-destructive" /> Custo por resultado elevado
          </h4>
          {list(highCPR, (c) => `R$${c.costPerResult.toFixed(2)}`, "Nenhum conjunto acima de R$5,00 por resultado.")}
        </div>
        <div className="glass-card p-4 space-y-3">
          <h4 className="text-sm font-display font-semibold flex items-center gap-2">
            <Repeat className="w-4 h-4 text-warning" /> Frequência alta (&gt; 2,5)
          </h4>
          {list(highFreq, (c) => c.frequency.toFixed(2), "Nenhum conjunto com fadiga de criativo.")}
        </div>
        <div className="glass-card p-4 space-y-3">
          <h4 className="text-sm font-display font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" /> Gasto sem resultado
          </h4>
          {list(noResults, (c) => brl(c.spend), "Todos os conjuntos estão gerando resultado.")}
        </div>
      </div>

      {/* Bloco de Consumo de Orçamento Mensal com Persistência na Nuvem */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            <div>
              <h4 className="text-sm font-display font-semibold">Consumo do Orçamento Mensal</h4>
              <p className="text-xs text-muted-foreground">
                Monitoramento baseado no mês em questão cadastrado na nuvem
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Seletor do Mês de Referência */}
            <div className="flex items-center gap-1.5 bg-secondary/40 px-2 py-1 rounded-md border border-border/50">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Mês:</span>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="h-7 text-xs border-0 bg-transparent focus:ring-0 w-[140px] font-medium p-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableMonths.map((m) => (
                    <SelectItem key={m} value={m} className="text-xs">
                      {formatMonthLabel(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Botão de Edição e Salvamento na Nuvem */}
            <Button
              onClick={openBudgetDialog}
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Ajustar Orçamentos
            </Button>
          </div>
        </div>

        {/* Ritmo do Mês */}
        {monthPacing.isCurrent && (
          <div className="bg-secondary/30 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground">Progresso do Mês:</span>
              <p className="font-semibold text-foreground">
                Dia {monthPacing.currentDay} de {monthPacing.daysInMonth} ({monthPacing.timePct.toFixed(0)}% decorrido)
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Gasto Médio Diário:</span>
              <p className="font-semibold text-foreground">{brl(monthPacing.dailyAvg)}/dia</p>
            </div>
            <div>
              <span className="text-muted-foreground">Projeção até Fim do Mês:</span>
              <p className="font-semibold text-foreground">{brl(monthPacing.projectedSpend)}</p>
            </div>
          </div>
        )}

        {/* Orçamento Total da Conta */}
        {totalBudget > 0 ? (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Orçamento Total ({formatMonthLabel(selectedMonth)})</span>
              <span className={totalPct >= 100 ? "text-destructive font-semibold" : totalPct >= 70 ? "text-warning font-semibold" : "text-foreground font-medium"}>
                {brl(monthTotalSpend)} de {brl(totalBudget)} · {totalPct.toFixed(1)}%
              </span>
            </div>
            <BudgetBar pct={totalPct} />
          </div>
        ) : (
          <div className="p-3 rounded-lg bg-secondary/20 border border-dashed border-border text-xs flex items-center justify-between">
            <span className="text-muted-foreground">Orçamento mensal da conta não configurado.</span>
            <Button onClick={openBudgetDialog} variant="link" size="sm" className="text-xs h-auto p-0">
              Cadastrar Orçamento
            </Button>
          </div>
        )}

        {/* Orçamentos por Empresa */}
        <div className="space-y-3 pt-2">
          <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Orçamentos por Empresa ({formatMonthLabel(selectedMonth)})
          </h5>
          {budgetRows.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nenhuma empresa com orçamento configurado. Clique em &quot;Ajustar Orçamentos&quot; para definir e salvar na nuvem.
            </p>
          ) : (
            <div className="space-y-3">
              {budgetRows.map((r) => (
                <div key={r.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium truncate">{r.name}</span>
                    <span
                      className={
                        r.pct >= 100
                          ? "text-destructive font-semibold"
                          : r.pct >= 70
                          ? "text-warning font-semibold"
                          : "text-muted-foreground"
                      }
                    >
                      {brl(r.spend)} de {brl(r.budget)} · {r.pct.toFixed(1)}%
                    </span>
                  </div>
                  <BudgetBar pct={r.pct} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dialog para Editar e Salvar Orçamento na Nuvem */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Wallet className="w-5 h-5 text-primary" />
              Configurar e Salvar Orçamentos na Nuvem
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Orçamento Total Mensal da Conta (R$)
              </label>
              <Input
                type="number"
                step="0.01"
                placeholder="Ex: 5000.00"
                value={editTotalBudget}
                onChange={(e) => setEditTotalBudget(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground block">
                Orçamentos por Empresa (R$)
              </label>
              <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                {companyBudgets.map((cb) => (
                  <div key={cb.company_name} className="flex items-center gap-2">
                    <span className="text-xs font-medium truncate flex-1" title={cb.company_name}>
                      {cb.company_name}
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="w-32 h-8 text-xs text-right"
                      value={editCompanyBudgets[cb.company_name] ?? ""}
                      onChange={(e) =>
                        setEditCompanyBudgets({
                          ...editCompanyBudgets,
                          [cb.company_name]: e.target.value,
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSaveBudgets} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Salvando..." : "Salvar na Nuvem"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
