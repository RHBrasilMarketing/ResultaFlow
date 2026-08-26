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
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Building2,
  Search,
  Filter,
  DollarSign,
  Zap,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CampaignData } from "@/types/campaign";
import { cn } from "@/lib/utils";

interface EfficiencyTabProps {
  campaigns: CampaignData[];
}

// Cores semânticas para faixas de CPR: Verde (Bom) / Azul (Aceitável) / Amarelo (Atenção) / Vermelho (Crítico)
const COLORS_EFFICIENCY = [
  "#10b981", // Bom / Ótimo (R$ 0 - 2)
  "#3b82f6", // Aceitável / OK (R$ 2,01 - 5)
  "#f59e0b", // Atenção (R$ 5,01 - 10)
  "#ef4444", // Inaceitável / Crítico (> R$ 10)
];

export function EfficiencyTab({ campaigns }: EfficiencyTabProps) {
  const [dimension, setDimension] = useState<"company" | "agency" | "contractType" | "rateio" | "veiculation">("company");
  const [searchTerm, setSearchTerm] = useState("");
  const [cprTierFilter, setCprTierFilter] = useState<string>("all");

  const totalSpend = useMemo(() => campaigns.reduce((s, c) => s + c.spend, 0), [campaigns]);
  const totalConversions = useMemo(() => campaigns.reduce((s, c) => s + c.conversions, 0), [campaigns]);

  const wastedSpend = useMemo(() => {
    return campaigns.filter((c) => c.conversions === 0 && c.spend > 0).reduce((s, c) => s + c.spend, 0);
  }, [campaigns]);

  const topWasters = useMemo(() => {
    return [...campaigns]
      .filter((c) => c.conversions === 0 && c.spend > 0)
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 8)
      .map((c) => ({
        name: c.adSetName.length > 35 ? c.adSetName.substring(0, 35) + "…" : c.adSetName,
        fullName: c.adSetName,
        company: c.company,
        agency: c.agency,
        rateio: c.rateio,
        contractType: c.contractType,
        period: c.period,
        jobTitle: c.jobTitle,
        requisitionCode: c.requisitionCode,
        spend: c.spend,
        impressions: c.impressions,
        reach: c.reach,
      }));
  }, [campaigns]);

  // Faixas globais de CPR
  const efficiencyBuckets = useMemo(() => {
    const buckets = [
      { label: "Bom / Ótimo (R$0–2)", min: 0, max: 2, count: 0, spend: 0, conversions: 0 },
      { label: "Aceitável / OK (R$2,01–5)", min: 2, max: 5, count: 0, spend: 0, conversions: 0 },
      { label: "Atenção (R$5,01–10)", min: 5, max: 10, count: 0, spend: 0, conversions: 0 },
      { label: "Inaceitável (>R$10)", min: 10, max: Infinity, count: 0, spend: 0, conversions: 0 },
    ];
    campaigns.filter((c) => c.conversions > 0 && c.costPerResult >= 0.1).forEach((c) => {
      const bucket = buckets.find((b) => c.costPerResult > b.min && c.costPerResult <= b.max) || buckets[buckets.length - 1];
      bucket.count++;
      bucket.spend += c.spend;
      bucket.conversions += c.conversions;
    });
    return buckets;
  }, [campaigns]);

  // Recomendações de orçamento
  const budgetRecommendations = useMemo(() => {
    const withResults = campaigns.filter((c) => c.conversions > 0).sort((a, b) => a.costPerResult - b.costPerResult);
    const top3 = withResults.slice(0, 4);
    const bottom3 = withResults.slice(-4).reverse();
    return { increase: top3, decrease: bottom3 };
  }, [campaigns]);

  // ==========================================
  // EFICIÊNCIA DE CPR DINÂMICA (POR DIMENSÃO)
  // ==========================================
  const dimensionEfficiency = useMemo(() => {
    const map = new Map<string, {
      name: string;
      spend: number;
      conversions: number;
      adSetCount: number;
      goodCount: number;
      acceptableCount: number;
      attentionCount: number;
      criticalCount: number;
    }>();

    campaigns.forEach((c) => {
      let key = "";
      if (dimension === "company") {
        key = c.company || "Desconhecida";
        if (/^\d+$/.test(key.trim()) || /^SIP\b/i.test(key.trim())) return;
      } else if (dimension === "agency") {
        key = c.agency && c.agency !== "—" ? c.agency : "SEM AGÊNCIA";
      } else if (dimension === "contractType") {
        key = c.contractType === "efetivo" ? "Efetivo [EF]" : c.contractType === "temporario" ? "Temporário [TE]" : "Outros";
      } else if (dimension === "rateio") {
        key = c.rateio && c.rateio !== "—" ? c.rateio : "SEM RATEIO";
      } else if (dimension === "veiculation") {
        key = (c.isContinuous || c.period === "FULL") ? "Contínua (FULL)" : "Pontual (Período)";
      }

      const existing = map.get(key) ?? {
        name: key,
        spend: 0,
        conversions: 0,
        adSetCount: 0,
        goodCount: 0,
        acceptableCount: 0,
        attentionCount: 0,
        criticalCount: 0,
      };

      existing.spend += c.spend;
      existing.conversions += c.conversions;
      existing.adSetCount += 1;

      if (c.conversions === 0 && c.spend > 0) {
        existing.criticalCount += 1;
      } else if (c.costPerResult <= 2) {
        existing.goodCount += 1;
      } else if (c.costPerResult <= 5) {
        existing.acceptableCount += 1;
      } else if (c.costPerResult <= 10) {
        existing.attentionCount += 1;
      } else {
        existing.criticalCount += 1;
      }

      map.set(key, existing);
    });

    return Array.from(map.values()).map((item) => {
      const avgCPR = item.conversions > 0 ? item.spend / item.conversions : (item.spend > 0 ? item.spend : 0);

      let tier: "good" | "acceptable" | "attention" | "critical" = "good";
      let tierLabel = "Bom";
      let tierColor = "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
      let tierIcon = CheckCircle2;

      if (item.conversions === 0) {
        tier = "critical";
        tierLabel = "Sem Conversão";
        tierColor = "bg-destructive/15 text-destructive border-destructive/30";
        tierIcon = AlertTriangle;
      } else if (avgCPR <= 2.0) {
        tier = "good";
        tierLabel = "Bom (R$ 0 - 2)";
        tierColor = "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
        tierIcon = CheckCircle2;
      } else if (avgCPR <= 5.0) {
        tier = "acceptable";
        tierLabel = "Aceitável (R$ 2 - 5)";
        tierColor = "bg-blue-500/15 text-blue-400 border-blue-500/30";
        tierIcon = CheckCircle2;
      } else if (avgCPR <= 10.0) {
        tier = "attention";
        tierLabel = "Atenção (R$ 5 - 10)";
        tierColor = "bg-amber-500/15 text-amber-400 border-amber-500/30";
        tierIcon = AlertCircle;
      } else {
        tier = "critical";
        tierLabel = "Crítico (> R$ 10)";
        tierColor = "bg-rose-500/15 text-rose-400 border-rose-500/30";
        tierIcon = AlertTriangle;
      }

      return {
        ...item,
        avgCPR,
        tier,
        tierLabel,
        tierColor,
        tierIcon,
      };
    }).sort((a, b) => b.spend - a.spend);
  }, [campaigns, dimension]);

  const filteredItems = useMemo(() => {
    return dimensionEfficiency.filter((c) => {
      if (cprTierFilter !== "all" && c.tier !== cprTierFilter) return false;
      if (searchTerm.trim() && !c.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [dimensionEfficiency, cprTierFilter, searchTerm]);

  const stats = useMemo(() => {
    const good = dimensionEfficiency.filter((c) => c.tier === "good").length;
    const acceptable = dimensionEfficiency.filter((c) => c.tier === "acceptable").length;
    const attention = dimensionEfficiency.filter((c) => c.tier === "attention").length;
    const critical = dimensionEfficiency.filter((c) => c.tier === "critical").length;
    return { good, acceptable, attention, critical, total: dimensionEfficiency.length };
  }, [dimensionEfficiency]);

  const tooltipStyle = {
    backgroundColor: "hsl(220, 18%, 12%)",
    border: "1px solid hsl(220, 14%, 20%)",
    borderRadius: "8px",
    color: "hsl(210, 20%, 92%)",
    fontSize: "12px",
  };

  return (
    <div className="space-y-6 animate-fade-in" id="efficiency-tab">
      <div>
        <h3 className="font-display font-semibold text-lg flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Eficiência de CPR & Alocação Orçamentária
        </h3>
        <p className="text-sm text-muted-foreground">
          Análise de retorno por resultado, categorização de CPR por empresa cadastrada e redução de desperdícios.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Gasto Efetivo</p>
          <p className="text-xl font-display font-bold">R$ {(totalSpend - wastedSpend).toFixed(2)}</p>
          <p className="text-[10px] text-emerald-400">
            {totalSpend > 0 ? ((1 - wastedSpend / totalSpend) * 100).toFixed(0) : 100}% do total investido
          </p>
        </div>

        <div className="glass-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Gasto Sem Resultado</p>
          <p className="text-xl font-display font-bold text-destructive">R$ {wastedSpend.toFixed(2)}</p>
          <p className="text-[10px] text-destructive">
            {totalSpend > 0 ? ((wastedSpend / totalSpend) * 100).toFixed(0) : 0}% desperdiçado
          </p>
        </div>

        <div className="glass-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Conjuntos Sem Retorno</p>
          <p className="text-xl font-display font-bold text-amber-400">
            {campaigns.filter((c) => c.conversions === 0 && c.spend > 0).length}
          </p>
          <p className="text-[10px] text-muted-foreground">de {campaigns.length} conjuntos analisados</p>
        </div>

        <div className="glass-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Custo Médio por Resultado</p>
          <p className="text-xl font-display font-bold text-primary">
            {totalConversions > 0 ? `R$ ${(totalSpend / totalConversions).toFixed(2)}` : "—"}
          </p>
          <p className="text-[10px] text-muted-foreground">{totalConversions} conversas/resultados</p>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SEÇÃO PRINCIPAL: EFICIÊNCIA DE CPR POR DIMENSÃO (EMPRESA, AGÊNCIA, MODALIDADE, RATEIO) */}
      {/* ======================================================== */}
      <div className="glass-card p-5 space-y-4 border border-primary/30">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h4 className="font-display font-bold text-base text-foreground flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              Eficiência de CPR por Dimensão
            </h4>
            <p className="text-xs text-muted-foreground">
              Classificação semântica de CPR: <strong>Bom</strong> (R$ 0 - 2), <strong>Aceitável</strong> (R$ 2 - 5), <strong>Atenção</strong> (R$ 5 - 10) e <strong>Crítico</strong>.
            </p>
          </div>

          {/* Seletor de Dimensão */}
          <div className="flex items-center gap-1 p-1 bg-secondary/50 rounded-lg flex-wrap">
            {([
              { key: "company" as const, label: "Empresa" },
              { key: "agency" as const, label: "Agência" },
              { key: "contractType" as const, label: "Modalidade (EF/TE)" },
              { key: "rateio" as const, label: "Praça / Rateio" },
              { key: "veiculation" as const, label: "Veiculação" },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setDimension(key)}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-all",
                  dimension === key
                    ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Chips de Resumo de Status e Busca */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
          <div className="relative flex-1 max-w-sm w-full">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Filtrar por nome (${dimension === "company" ? "empresa" : dimension === "agency" ? "agência" : dimension === "rateio" ? "rateio" : "item"})...`}
              className="pl-9 h-8 text-xs bg-secondary/40 border-border/70 w-full"
            />
          </div>

          {/* Chips de Resumo de Status */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setCprTierFilter("good")}
              className={cn("px-2.5 py-1 rounded-full text-xs font-semibold border transition-all",
                cprTierFilter === "good" ? "bg-emerald-500 text-white" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
              )}
            >
              🟢 Bom: {stats.good}
            </button>
            <button
              onClick={() => setCprTierFilter("acceptable")}
              className={cn("px-2.5 py-1 rounded-full text-xs font-semibold border transition-all",
                cprTierFilter === "acceptable" ? "bg-blue-500 text-white" : "bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20"
              )}
            >
              🔵 Aceitável: {stats.acceptable}
            </button>
            <button
              onClick={() => setCprTierFilter("attention")}
              className={cn("px-2.5 py-1 rounded-full text-xs font-semibold border transition-all",
                cprTierFilter === "attention" ? "bg-amber-500 text-white" : "bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
              )}
            >
              🟡 Atenção: {stats.attention}
            </button>
            <button
              onClick={() => setCprTierFilter("critical")}
              className={cn("px-2.5 py-1 rounded-full text-xs font-semibold border transition-all",
                cprTierFilter === "critical" ? "bg-destructive text-white" : "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20"
              )}
            >
              🔴 Crítico: {stats.critical}
            </button>
            {cprTierFilter !== "all" && (
              <Button variant="ghost" size="sm" onClick={() => setCprTierFilter("all")} className="h-7 text-xs px-2">
                Limpar
              </Button>
            )}
          </div>
        </div>

        {/* Grade Visual de Destaque */}
        {filteredItems.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredItems.slice(0, 6).map((c, i) => {
              const Icon = c.tierIcon;
              return (
                <div
                  key={i}
                  className={cn(
                    "p-3.5 rounded-xl border transition-all bg-card/60 hover:bg-card/90 space-y-2.5",
                    c.tierColor
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 truncate">
                      <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="font-bold text-xs sm:text-sm text-foreground truncate" title={c.name}>
                        {c.name}
                      </span>
                    </div>
                    <Badge variant="outline" className={cn("text-[10px] px-2 py-0.5 gap-1 shrink-0 font-semibold", c.tierColor)}>
                      <Icon className="w-2.5 h-2.5" />
                      {c.tier === "good" ? "Bom" : c.tier === "acceptable" ? "Aceitável" : c.tier === "attention" ? "Atenção" : "Crítico"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/40 text-center">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">CPR Médio</p>
                      <p className="text-xs sm:text-sm font-bold font-display">
                        {c.conversions > 0 ? `R$ ${c.avgCPR.toFixed(2)}` : "Sem Conv."}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Conversas</p>
                      <p className="text-xs sm:text-sm font-bold text-emerald-400">
                        {c.conversions}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Investido</p>
                      <p className="text-xs sm:text-sm font-bold text-foreground">
                        R$ {c.spend.toFixed(0)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tabela de Eficiência de CPR */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm text-left">
            <thead className="bg-secondary/60 text-muted-foreground uppercase text-[11px] font-semibold border-b border-border/60">
              <tr>
                <th className="p-3">{dimension === "company" ? "Empresa" : dimension === "agency" ? "Agência" : dimension === "contractType" ? "Modalidade" : dimension === "rateio" ? "Praça / Rateio" : "Tipo de Veiculação"}</th>
                <th className="p-3 text-right">Investimento Total</th>
                <th className="p-3 text-right">Conversas Geradas</th>
                <th className="p-3 text-right">CPR Médio</th>
                <th className="p-3 text-center">Classificação</th>
                <th className="p-3">Distribuição de Conjuntos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    Nenhum item encontrado para este filtro.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => {
                  const Icon = item.tierIcon;
                  const totalSets = item.adSetCount || 1;

                  return (
                    <tr key={idx} className="hover:bg-secondary/30 transition-colors">
                      {/* Item */}
                      <td className="p-3 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="text-foreground font-semibold">{item.name}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{item.adSetCount} conjuntos de anúncios</span>
                      </td>

                      {/* Investimento */}
                      <td className="p-3 text-right font-medium tabular-nums text-foreground">
                        R$ {item.spend.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Conversas */}
                      <td className="p-3 text-right tabular-nums">
                        <span className={cn("font-bold text-sm", item.conversions > 0 ? "text-emerald-400" : "text-muted-foreground")}>
                          {item.conversions}
                        </span>
                      </td>

                      {/* CPR Médio */}
                      <td className="p-3 text-right tabular-nums">
                        <span className={cn("font-bold text-sm",
                          item.avgCPR <= 2 ? "text-emerald-400" :
                          item.avgCPR <= 5 ? "text-blue-400" :
                          item.avgCPR <= 10 ? "text-amber-400" : "text-rose-400"
                        )}>
                          {item.conversions > 0 ? `R$ ${item.avgCPR.toFixed(2)}` : "Sem Conv."}
                        </span>
                      </td>

                      {/* Classificação CPR */}
                      <td className="p-3 text-center">
                        <Badge variant="outline" className={cn("text-xs px-2.5 py-0.5 gap-1 inline-flex items-center font-semibold", item.tierColor)}>
                          <Icon className="w-3 h-3" />
                          {item.tierLabel}
                        </Badge>
                      </td>

                      {/* Barra de Distribuição de Conjuntos */}
                      <td className="p-3">
                        <div className="space-y-1 min-w-[140px] max-w-[200px]">
                          <div className="w-full h-2 rounded-full bg-secondary/80 overflow-hidden flex">
                            {item.goodCount > 0 && (
                              <div
                                style={{ width: `${(item.goodCount / totalSets) * 100}%` }}
                                className="bg-emerald-500 h-full"
                                title={`${item.goodCount} conjuntos em Bom`}
                              />
                            )}
                            {item.acceptableCount > 0 && (
                              <div
                                style={{ width: `${(item.acceptableCount / totalSets) * 100}%` }}
                                className="bg-blue-500 h-full"
                                title={`${item.acceptableCount} conjuntos em Aceitável`}
                              />
                            )}
                            {item.attentionCount > 0 && (
                              <div
                                style={{ width: `${(item.attentionCount / totalSets) * 100}%` }}
                                className="bg-amber-500 h-full"
                                title={`${item.attentionCount} conjuntos em Atenção`}
                              />
                            )}
                            {item.criticalCount > 0 && (
                              <div
                                style={{ width: `${(item.criticalCount / totalSets) * 100}%` }}
                                className="bg-rose-500 h-full"
                                title={`${item.criticalCount} conjuntos em Crítico`}
                              />
                            )}
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span>🟢 {item.goodCount}</span>
                            <span>🔵 {item.acceptableCount}</span>
                            <span>🟡 {item.attentionCount}</span>
                            <span>🔴 {item.criticalCount}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gráficos e Recomendações */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribuição por Faixa de CPR */}
        <div className="glass-card p-5">
          <h4 className="font-display font-semibold text-sm mb-4">Distribuição de Conjuntos por Faixa de CPR</h4>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={efficiencyBuckets} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
              <XAxis dataKey="label" tick={{ fill: "hsl(215, 15%, 55%)", fontSize: 9 }} interval={0} angle={-10} textAnchor="end" height={50} />
              <YAxis tick={{ fill: "hsl(215, 15%, 55%)", fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => [v, name === "count" ? "Conjuntos" : name]} />
              <Bar dataKey="count" name="Conjuntos" radius={[4, 4, 0, 0]}>
                {efficiencyBuckets.map((_, i) => <Cell key={i} fill={COLORS_EFFICIENCY[i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Maiores Desperdiçadores */}
        {topWasters.length > 0 && (
          <div className="glass-card p-5">
            <h4 className="font-display font-semibold text-sm mb-4">Maiores Desperdiçadores (Gasto Sem Conversão)</h4>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={topWasters} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
                <XAxis type="number" tick={{ fill: "hsl(215, 15%, 55%)", fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
                <YAxis type="category" dataKey="name" tick={{ fill: "hsl(210, 20%, 85%)", fontSize: 10 }} width={170} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`R$ ${v.toFixed(2)}`, "Gasto"]} />
                <Bar dataKey="spend" fill="hsl(0, 72%, 55%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Recomendações de Aumento/Redução */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {budgetRecommendations.increase.length > 0 && (
          <div className="glass-card p-4 space-y-3 border-l-4 border-l-emerald-500">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <h5 className="font-semibold text-xs text-foreground uppercase tracking-wider">
                Oportunidades de Escala (Menor CPR)
              </h5>
            </div>
            <div className="space-y-2">
              {budgetRecommendations.increase.map((c, i) => (
                <div key={i} className="p-2.5 rounded-lg bg-secondary/40 text-xs space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground truncate max-w-[280px]" title={c.adSetName}>{c.adSetName}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-emerald-400 font-bold">R$ {c.costPerResult.toFixed(2)}</span>
                      <span className="text-muted-foreground text-[10px]">({c.conversions} conv)</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                    {c.agency && c.agency !== "—" && (
                      <span className="px-1.5 py-0.2 rounded bg-primary/10 text-primary font-medium">
                        {c.agency}
                      </span>
                    )}
                    {c.contractType && c.contractType !== "desconhecido" && (
                      <span className={cn("px-1.5 py-0.2 rounded font-medium", c.contractType === "efetivo" ? "bg-emerald-500/10 text-emerald-400" : "bg-blue-500/10 text-blue-400")}>
                        {c.contractType === "efetivo" ? "EF" : "TE"}
                      </span>
                    )}
                    {c.period && (
                      <span className={cn("px-1.5 py-0.2 rounded font-medium", c.period === "FULL" ? "bg-purple-500/10 text-purple-400" : "bg-muted text-muted-foreground")}>
                        {c.period}
                      </span>
                    )}
                    {c.rateio && c.rateio !== "—" && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 font-medium">
                        {c.rateio}
                      </span>
                    )}
                    {(c.requisitionCode || c.jobTitle) && (
                      <span className="text-muted-foreground font-mono">
                        {c.requisitionCode ? `#${c.requisitionCode}` : c.jobTitle}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {budgetRecommendations.decrease.length > 0 && (
          <div className="glass-card p-4 space-y-3 border-l-4 border-l-destructive">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <h5 className="font-semibold text-xs text-foreground uppercase tracking-wider">
                Revisão Urgente (Maior CPR)
              </h5>
            </div>
            <div className="space-y-2">
              {budgetRecommendations.decrease.map((c, i) => (
                <div key={i} className="p-2.5 rounded-lg bg-secondary/40 text-xs space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground truncate max-w-[280px]" title={c.adSetName}>{c.adSetName}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-rose-400 font-bold">R$ {c.costPerResult.toFixed(2)}</span>
                      <span className="text-muted-foreground text-[10px]">({c.conversions} conv)</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                    {c.agency && c.agency !== "—" && (
                      <span className="px-1.5 py-0.2 rounded bg-primary/10 text-primary font-medium">
                        {c.agency}
                      </span>
                    )}
                    {c.contractType && c.contractType !== "desconhecido" && (
                      <span className={cn("px-1.5 py-0.2 rounded font-medium", c.contractType === "efetivo" ? "bg-emerald-500/10 text-emerald-400" : "bg-blue-500/10 text-blue-400")}>
                        {c.contractType === "efetivo" ? "EF" : "TE"}
                      </span>
                    )}
                    {c.period && (
                      <span className={cn("px-1.5 py-0.2 rounded font-medium", c.period === "FULL" ? "bg-purple-500/10 text-purple-400" : "bg-muted text-muted-foreground")}>
                        {c.period}
                      </span>
                    )}
                    {c.rateio && c.rateio !== "—" && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 font-medium">
                        {c.rateio}
                      </span>
                    )}
                    {(c.requisitionCode || c.jobTitle) && (
                      <span className="text-muted-foreground font-mono">
                        {c.requisitionCode ? `#${c.requisitionCode}` : c.jobTitle}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
