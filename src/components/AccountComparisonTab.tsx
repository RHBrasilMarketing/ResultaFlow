import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CampaignData } from "@/types/campaign";

interface AccountComparisonTabProps {
  campaigns: CampaignData[];
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(38, 92%, 55%)",
  "hsl(170, 80%, 45%)",
  "hsl(280, 60%, 55%)",
  "hsl(200, 90%, 50%)",
  "hsl(120, 50%, 45%)",
  "hsl(330, 70%, 55%)",
  "hsl(50, 90%, 50%)",
];

const tooltipStyle = {
  backgroundColor: "hsl(220, 18%, 12%)",
  border: "1px solid hsl(220, 14%, 20%)",
  borderRadius: "8px",
  color: "hsl(210, 20%, 92%)",
  fontSize: "12px",
};

export function AccountComparisonTab({ campaigns }: AccountComparisonTabProps) {
  const accounts = useMemo(() => {
    const groups: Record<string, CampaignData[]> = {};
    campaigns.forEach((c) => {
      const key = c.account || "Conta principal";
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    });

    return Object.entries(groups)
      .map(([name, items]) => {
        const spend = items.reduce((s, c) => s + c.spend, 0);
        const impressions = items.reduce((s, c) => s + c.impressions, 0);
        const reach = items.reduce((s, c) => s + c.reach, 0);
        const linkClicks = items.reduce((s, c) => s + c.linkClicks, 0);
        const conversions = items.reduce((s, c) => s + c.conversions, 0);
        const validCPR = items.filter((c) => c.conversions > 0 && c.costPerResult >= 0.5);
        const validConv = validCPR.reduce((s, c) => s + c.conversions, 0);
        const validSpend = validCPR.reduce((s, c) => s + c.spend, 0);
        const running = items.filter((c) => c.status === "active").length;
        const stopped = items.length - running;
        return {
          name,
          spend,
          impressions,
          reach,
          linkClicks,
          conversions,
          avgCPR: validConv > 0 ? validSpend / validConv : 0,
          cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
          ctr: impressions > 0 ? (linkClicks / impressions) * 100 : 0,
          count: items.length,
          running,
          stopped,
        };
      })
      .sort((a, b) => b.spend - a.spend);
  }, [campaigns]);

  if (accounts.length <= 1) {
    return (
      <div className="glass-card p-10 text-center space-y-3">
        <Building2 className="w-12 h-12 mx-auto text-muted-foreground" />
        <h3 className="font-display font-semibold text-lg">Apenas uma conta carregada</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Faça upload de mais de um CSV (clique em "Nova análise" no topo) para comparar contas de anúncio lado a lado.
        </p>
      </div>
    );
  }

  const totalSpend = accounts.reduce((s, a) => s + a.spend, 0);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display font-semibold text-lg">Comparativo de Contas</h3>
        <p className="text-sm text-muted-foreground">Performance lado a lado entre {accounts.length} contas de anúncio</p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {accounts.map((a, i) => (
          <div key={a.name} className="glass-card p-4 space-y-3 animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <h4 className="font-display font-semibold text-sm truncate" title={a.name}>{a.name}</h4>
              </div>
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                {((a.spend / totalSpend) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Gasto</p>
                <p className="font-semibold text-sm">R${a.spend.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Resultados</p>
                <p className="font-semibold text-sm">{a.conversions.toLocaleString("pt-BR")}</p>
              </div>
              <div>
                <p className="text-muted-foreground">CPR Médio</p>
                <p className={cn("font-semibold text-sm", a.avgCPR > 15 ? "text-destructive" : a.avgCPR > 8 ? "text-warning" : "text-success")}>
                  {a.avgCPR > 0 ? `R$${a.avgCPR.toFixed(2)}` : "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Conjuntos</p>
                <p className="font-semibold text-sm">{a.count}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Cliques</p>
                <p className="font-semibold text-sm">{a.linkClicks.toLocaleString("pt-BR")}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Impressões</p>
                <p className="font-semibold text-sm">{a.impressions.toLocaleString("pt-BR")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[10px] pt-2 border-t border-border/30">
              <span className="text-success">● {a.running} em veiculação</span>
              <span className="text-warning">○ {a.stopped} paradas</span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-5">
          <h4 className="font-display font-semibold text-sm mb-4">Gasto por Conta (R$)</h4>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={accounts} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
              <XAxis type="number" tick={{ fill: "hsl(215, 15%, 55%)", fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
              <YAxis type="category" dataKey="name" tick={{ fill: "hsl(210, 20%, 85%)", fontSize: 11 }} width={110} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`R$${v.toFixed(2)}`, "Gasto"]} />
              <Bar dataKey="spend" radius={[0, 4, 4, 0]}>
                {accounts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-5">
          <h4 className="font-display font-semibold text-sm mb-4">CPR Médio por Conta (R$)</h4>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={accounts.filter((a) => a.avgCPR > 0)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
              <XAxis type="number" tick={{ fill: "hsl(215, 15%, 55%)", fontSize: 11 }} tickFormatter={(v) => `R$${v.toFixed(0)}`} />
              <YAxis type="category" dataKey="name" tick={{ fill: "hsl(210, 20%, 85%)", fontSize: 11 }} width={110} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`R$${v.toFixed(2)}`, "CPR"]} />
              <Bar dataKey="avgCPR" radius={[0, 4, 4, 0]}>
                {accounts.filter((a) => a.avgCPR > 0).map((a, i) => (
                  <Cell key={i} fill={a.avgCPR > 15 ? "hsl(0, 72%, 55%)" : a.avgCPR > 8 ? "hsl(38, 92%, 55%)" : "hsl(150, 60%, 45%)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-5">
          <h4 className="font-display font-semibold text-sm mb-4">Distribuição de Gasto</h4>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={accounts} dataKey="spend" nameKey="name" cx="50%" cy="50%" outerRadius={100}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {accounts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`R$${v.toFixed(2)}`, "Gasto"]} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-5">
          <h4 className="font-display font-semibold text-sm mb-4">Cliques x Impressões</h4>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={accounts}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
              <XAxis dataKey="name" tick={{ fill: "hsl(210, 20%, 85%)", fontSize: 10 }} />
              <YAxis tick={{ fill: "hsl(215, 15%, 55%)", fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Bar dataKey="linkClicks" name="Cliques" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="impressions" name="Impressões" fill="hsl(38, 92%, 55%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detail table */}
      <div className="glass-card p-5">
        <h4 className="font-display font-semibold text-sm mb-4">Detalhe por Conta</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left p-2 text-xs font-medium text-muted-foreground">Conta</th>
                <th className="text-right p-2 text-xs font-medium text-muted-foreground">Conjuntos</th>
                <th className="text-right p-2 text-xs font-medium text-muted-foreground">Gasto</th>
                <th className="text-right p-2 text-xs font-medium text-muted-foreground">Resultados</th>
                <th className="text-right p-2 text-xs font-medium text-muted-foreground">CPR</th>
                <th className="text-right p-2 text-xs font-medium text-muted-foreground">CPM</th>
                <th className="text-right p-2 text-xs font-medium text-muted-foreground">CTR</th>
                <th className="text-right p-2 text-xs font-medium text-muted-foreground">Cliques</th>
                <th className="text-right p-2 text-xs font-medium text-muted-foreground">Impressões</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.name} className="border-b border-border/30 hover:bg-secondary/30">
                  <td className="p-2 font-medium text-xs">{a.name}</td>
                  <td className="p-2 text-right text-xs">{a.count}</td>
                  <td className="p-2 text-right text-xs font-medium">R${a.spend.toFixed(2)}</td>
                  <td className="p-2 text-right text-xs">{a.conversions}</td>
                  <td className={cn("p-2 text-right text-xs font-medium", a.avgCPR > 15 ? "text-destructive" : a.avgCPR > 8 ? "text-warning" : "text-success")}>
                    {a.avgCPR > 0 ? `R$${a.avgCPR.toFixed(2)}` : "—"}
                  </td>
                  <td className="p-2 text-right text-xs">R${a.cpm.toFixed(2)}</td>
                  <td className="p-2 text-right text-xs">{a.ctr.toFixed(2)}%</td>
                  <td className="p-2 text-right text-xs">{a.linkClicks.toLocaleString("pt-BR")}</td>
                  <td className="p-2 text-right text-xs">{a.impressions.toLocaleString("pt-BR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
