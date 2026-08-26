import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Search, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CampaignData } from "@/types/campaign";

interface CampaignTableProps {
  campaigns: CampaignData[];
}

const statusStyles: Record<string, string> = {
  active: "bg-success/15 text-success border border-success/30",
  paused: "bg-warning/15 text-warning border border-warning/30",
  inactive: "bg-muted text-muted-foreground border border-border/50",
  not_delivering: "bg-destructive/15 text-destructive border border-destructive/30",
  recently_completed: "bg-info/15 text-info border border-info/30",
  error: "bg-destructive/15 text-destructive border border-destructive/30",
};

const statusLabels: Record<string, string> = {
  active: "Ativo",
  paused: "Pausado",
  inactive: "Inativo",
  not_delivering: "Sem veiculação",
  recently_completed: "Concluído",
  error: "Erro",
};

const contractLabels: Record<string, string> = { efetivo: "EF", temporario: "TE", desconhecido: "—" };
const contractStyles: Record<string, string> = {
  efetivo: "bg-primary/15 text-primary border border-primary/30",
  temporario: "bg-accent/15 text-accent border border-accent/30",
  desconhecido: "bg-muted text-muted-foreground border border-border/40",
};

type SortKey = keyof CampaignData;
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string; align?: "left" | "right" | "center"; sortable?: boolean }[] = [
  { key: "adSetName", label: "Conjunto", sortable: true },
  { key: "analyst", label: "Analista", sortable: true },
  { key: "company", label: "Empresa", sortable: true },
  { key: "contractType", label: "Tipo", align: "center", sortable: true },
  { key: "status", label: "Status", sortable: true },
  { key: "day", label: "Dia", sortable: true },
  { key: "spend", label: "Gasto", align: "right", sortable: true },
  { key: "reach", label: "Alcance", align: "right", sortable: true },
  { key: "impressions", label: "Impressões", align: "right", sortable: true },
  { key: "frequency", label: "Freq.", align: "right", sortable: true },
  { key: "conversions", label: "Resultados", align: "right", sortable: true },
  { key: "resultType", label: "Tipo Res." },
  { key: "costPerResult", label: "CPR", align: "right", sortable: true },
  { key: "linkClicks", label: "Cliques Link", align: "right", sortable: true },
];

export function CampaignTable({ campaigns }: CampaignTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState<SortKey | null>("spend");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return campaigns;
    const term = searchTerm.toLowerCase();
    return campaigns.filter((c) =>
      c.adSetName.toLowerCase().includes(term) ||
      c.campaignName.toLowerCase().includes(term) ||
      c.company.toLowerCase().includes(term) ||
      c.analyst.toLowerCase().includes(term) ||
      (c.agency && c.agency.toLowerCase().includes(term)) ||
      (c.requisitionCode && c.requisitionCode.toLowerCase().includes(term)) ||
      (c.jobTitle && c.jobTitle.toLowerCase().includes(term)) ||
      (c.period && c.period.toLowerCase().includes(term)) ||
      (c.sip && c.sip.toLowerCase().includes(term)) ||
      (c.rateio && c.rateio.toLowerCase().includes(term))
    );
  }, [campaigns, searchTerm]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      const va = a[sortKey]; const vb = b[sortKey];
      if (typeof va === "number" && typeof vb === "number") return sortDir === "asc" ? va - vb : vb - va;
      const sa = String(va ?? ""); const sb = String(vb ?? "");
      return sortDir === "asc" ? sa.localeCompare(sb, "pt-BR") : sb.localeCompare(sa, "pt-BR");
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
    setPage(1);
  }

  const exportTableCsv = () => {
    const headers = ["Conjunto", "Campanha", "Empresa", "Analista", "Tipo", "Status", "Dia", "Gasto (R$)", "Alcance", "Impressoes", "Frequencia", "Resultados", "CPR (R$)", "Cliques"];
    const rows = sorted.map((c) => [
      `"${c.adSetName.replace(/"/g, '""')}"`,
      `"${c.campaignName.replace(/"/g, '""')}"`,
      `"${c.company.replace(/"/g, '""')}"`,
      `"${c.analyst.replace(/"/g, '""')}"`,
      c.contractType,
      c.status,
      c.day || "",
      c.spend.toFixed(2).replace(".", ","),
      c.reach,
      c.impressions,
      c.frequency.toFixed(2).replace(".", ","),
      c.conversions,
      c.costPerResult.toFixed(2).replace(".", ","),
      c.linkClicks,
    ]);
    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `campanhas_resultaflow_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="glass-card overflow-hidden space-y-3 p-4">
      {/* Search & Export Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            placeholder="Buscar conjunto, campanha, empresa..."
            className="pl-9 h-8 text-xs bg-secondary/50"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <span className="text-xs text-muted-foreground">
            Exibindo <strong className="text-foreground">{sorted.length}</strong> itens
          </span>
          <Button variant="outline" size="sm" onClick={exportTableCsv} className="h-8 text-xs gap-1">
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Exportar CSV</span>
          </Button>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto rounded-lg border border-border/50">
        <table className="w-full text-xs">
          <thead className="bg-secondary/60 sticky top-0 z-10 backdrop-blur-md">
            <tr className="border-b border-border/60">
              {COLUMNS.map((col) => (
                <th
                  key={col.key as string}
                  onClick={() => col.sortable && toggleSort(col.key)}
                  className={cn(
                    "p-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap",
                    col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left",
                    col.sortable && "cursor-pointer hover:text-foreground select-none"
                  )}
                >
                  <span className={cn("inline-flex items-center gap-1", col.align === "right" && "flex-row-reverse")}>
                    {col.label}
                    {col.sortable && (sortKey === col.key
                      ? (sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />)
                      : <ArrowUpDown className="w-3 h-3 opacity-25" />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="text-center py-8 text-muted-foreground text-xs">
                  Nenhuma campanha encontrada para a busca atual.
                </td>
              </tr>
            ) : (
              paginated.map((c) => (
                <tr key={c.id} className="hover:bg-secondary/40 transition-colors">
                  <td className="p-2.5">
                    <p className="font-medium text-foreground truncate max-w-[240px]" title={c.adSetName}>{c.adSetName}</p>
                    <div className="flex flex-wrap items-center gap-1 mt-0.5 max-w-[240px]">
                      {c.agency && c.agency !== "Desconhecida" && (
                        <span className="text-[9px] bg-primary/10 text-primary px-1 py-0.2 rounded font-semibold">{c.agency}</span>
                      )}
                      {c.period && (
                        <span className="text-[9px] bg-secondary text-muted-foreground px-1 py-0.2 rounded font-medium">{c.period}</span>
                      )}
                      {c.requisitionCode && (
                        <span className="text-[9px] bg-accent/15 text-accent-foreground px-1 py-0.2 rounded font-mono font-medium">Req {c.requisitionCode}</span>
                      )}
                      {c.jobTitle && !c.requisitionCode && (
                        <span className="text-[9px] bg-secondary/80 text-foreground px-1 py-0.2 rounded truncate max-w-[120px]" title={c.jobTitle}>{c.jobTitle}</span>
                      )}
                    </div>
                  </td>
                  <td className="p-2.5 text-muted-foreground truncate max-w-[110px]" title={c.analyst}>{c.analyst}</td>
                  <td className="p-2.5">
                    <p className="font-medium text-foreground truncate max-w-[130px]" title={c.company}>{c.company}</p>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      {c.rateio && c.rateio !== "—" && <span className="truncate">{c.rateio}</span>}
                      {c.sip && <span className="font-mono text-[9px] text-muted-foreground/80">({c.sip})</span>}
                    </div>
                  </td>
                  <td className="p-2.5 text-center">
                    <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", contractStyles[c.contractType])}>
                      {contractLabels[c.contractType]}
                    </span>
                  </td>
                  <td className="p-2.5">
                    <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap", statusStyles[c.status] || statusStyles.active)}>
                      {statusLabels[c.status] || c.status}
                    </span>
                  </td>
                  <td className="p-2.5 text-muted-foreground whitespace-nowrap">{c.day || "—"}</td>
                  <td className="p-2.5 text-right font-medium tabular-nums whitespace-nowrap">
                    R$ {c.spend.toFixed(2)}
                  </td>
                  <td className="p-2.5 text-right tabular-nums whitespace-nowrap text-muted-foreground">{c.reach.toLocaleString("pt-BR")}</td>
                  <td className="p-2.5 text-right tabular-nums whitespace-nowrap text-muted-foreground">{c.impressions.toLocaleString("pt-BR")}</td>
                  <td className={cn("p-2.5 text-right tabular-nums whitespace-nowrap font-medium", c.frequency > 2.5 ? "text-warning" : "text-muted-foreground")}>
                    {c.frequency.toFixed(2)}
                  </td>
                  <td className={cn("p-2.5 text-right tabular-nums whitespace-nowrap font-bold", c.conversions === 0 && c.spend > 5 ? "text-destructive" : "text-foreground")}>
                    {c.conversions || "0"}
                  </td>
                  <td className="p-2.5 text-muted-foreground truncate max-w-[110px]" title={c.resultType}>
                    {c.resultCategory === "mensagens" || /mensag|message/i.test(c.resultType) ? "💬 Mensagens" :
                     c.resultCategory === "cliques" || /clique|click|link/i.test(c.resultType) ? "🔗 Cliques" : c.resultType === "—" ? "—" : c.resultType}
                  </td>
                  <td className={cn("p-2.5 text-right tabular-nums whitespace-nowrap font-medium",
                    c.costPerResult > 0 && c.costPerResult < 0.5 ? "text-muted-foreground line-through" :
                    c.costPerResult > 15 ? "text-destructive font-bold" : c.costPerResult > 0 ? "text-emerald-400" : "text-muted-foreground"
                  )}>
                    {c.costPerResult > 0 ? `R$${c.costPerResult.toFixed(2)}` : "—"}
                  </td>
                  <td className="p-2.5 text-right tabular-nums whitespace-nowrap text-muted-foreground">{c.linkClicks || "0"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 text-xs">
          <span className="text-muted-foreground">
            Página <strong className="text-foreground">{page}</strong> de {totalPages}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
