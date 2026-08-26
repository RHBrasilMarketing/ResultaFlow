import { useMemo, useState } from "react";
import { FileDown, Search, ChevronRight, ChevronDown, Building2, FolderOpen, Layers } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CampaignData, AnalysisResult } from "@/types/campaign";

interface ReportTabProps {
  campaigns: CampaignData[];
  analysis: AnalysisResult;
}

function getDateRange(items: CampaignData[]): string {
  const days = items.map((c) => c.day).filter(Boolean).sort();
  if (days.length === 0) return "Período não informado";
  const start = days[0]; const end = days[days.length - 1];
  const fmt = (d: string) => { const [y, m, day] = d.split("-"); return `${day}/${m}/${y}`; };
  return start === end ? fmt(start) : `${fmt(start)} a ${fmt(end)}`;
}

interface Tree {
  company: string;
  spend: number; conversions: number; impressions: number; linkClicks: number;
  campaigns: {
    name: string;
    spend: number; conversions: number; impressions: number; linkClicks: number;
    adsets: CampaignData[];
  }[];
}

function buildTree(items: CampaignData[]): Tree[] {
  const byCompany = new Map<string, Map<string, CampaignData[]>>();
  for (const c of items) {
    if (!byCompany.has(c.company)) byCompany.set(c.company, new Map());
    const cm = byCompany.get(c.company)!;
    if (!cm.has(c.campaignName)) cm.set(c.campaignName, []);
    cm.get(c.campaignName)!.push(c);
  }
  const out: Tree[] = [];
  for (const [company, campMap] of byCompany.entries()) {
    const camps = Array.from(campMap.entries()).map(([name, adsets]) => ({
      name,
      spend: adsets.reduce((s, c) => s + c.spend, 0),
      conversions: adsets.reduce((s, c) => s + c.conversions, 0),
      impressions: adsets.reduce((s, c) => s + c.impressions, 0),
      linkClicks: adsets.reduce((s, c) => s + c.linkClicks, 0),
      adsets,
    })).sort((a, b) => b.spend - a.spend);
    out.push({
      company,
      spend: camps.reduce((s, c) => s + c.spend, 0),
      conversions: camps.reduce((s, c) => s + c.conversions, 0),
      impressions: camps.reduce((s, c) => s + c.impressions, 0),
      linkClicks: camps.reduce((s, c) => s + c.linkClicks, 0),
      campaigns: camps,
    });
  }
  return out.sort((a, b) => b.spend - a.spend);
}

function generateGroupedPdf(items: CampaignData[], title: string) {
  const doc = new jsPDF({ orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(220, 38, 38);
  doc.rect(0, 0, pageWidth, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16); doc.setFont("helvetica", "bold");
  doc.text("RESULTA FLOW", 14, 12);
  doc.setFontSize(10); doc.setFont("helvetica", "normal");
  doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, pageWidth - 14, 12, { align: "right" });

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(13); doc.setFont("helvetica", "bold");
  doc.text(title, 14, 28);
  doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(90, 90, 90);
  doc.text(`Período: ${getDateRange(items)}`, 14, 34);

  // Resumo
  const totalSpend = items.reduce((s, c) => s + c.spend, 0);
  const totalConv = items.reduce((s, c) => s + c.conversions, 0);
  const totalImpressions = items.reduce((s, c) => s + c.impressions, 0);
  const totalLinkClicks = items.reduce((s, c) => s + c.linkClicks, 0);
  const validCPR = items.filter((c) => c.conversions > 0 && c.costPerResult >= 0.5);
  const validConv = validCPR.reduce((s, c) => s + c.conversions, 0);
  const validSpend = validCPR.reduce((s, c) => s + c.spend, 0);
  const avgCPR = validConv > 0 ? validSpend / validConv : 0;

  doc.setDrawColor(220, 38, 38); doc.setLineWidth(0.3);
  doc.roundedRect(14, 40, pageWidth - 28, 18, 2, 2, "S");
  doc.setTextColor(0, 0, 0); doc.setFontSize(9);
  doc.text(`Conjuntos: ${items.length}`, 18, 46);
  doc.text(`Gasto: R$ ${totalSpend.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 70, 46);
  doc.text(`Resultados: ${totalConv}`, 140, 46);
  doc.text(`CPR médio: R$ ${avgCPR.toFixed(2)}`, 190, 46);
  doc.text(`Cliques link: ${totalLinkClicks.toLocaleString("pt-BR")}`, 18, 53);
  doc.text(`Impressões: ${totalImpressions.toLocaleString("pt-BR")}`, 70, 53);

  // Top 5
  const top = [...items].filter((c) => c.conversions > 0 && c.costPerResult >= 0.5).sort((a, b) => a.costPerResult - b.costPerResult).slice(0, 5);
  let cursorY = 64;
  if (top.length > 0) {
    doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(34, 139, 34);
    doc.text("🏆 Conjuntos com melhor resultado", 14, cursorY);
    autoTable(doc, {
      startY: cursorY + 2,
      head: [["#", "Conjunto", "Empresa", "Analista", "Gasto", "Result.", "CPR"]],
      body: top.map((c, i) => [
        String(i + 1), c.adSetName.substring(0, 50), c.company, c.analyst,
        `R$ ${c.spend.toFixed(2)}`, c.conversions, `R$ ${c.costPerResult.toFixed(2)}`,
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [34, 139, 34], textColor: 255, fontStyle: "bold" },
      margin: { left: 14, right: 14 },
    });
    cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  // Hierarquia: Empresa → Campanha → Conjunto
  const tree = buildTree(items);
  for (const c of tree) {
    if (cursorY > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); cursorY = 20; }
    doc.setFillColor(220, 38, 38); doc.rect(14, cursorY, pageWidth - 28, 7, "F");
    doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255);
    doc.text(`📊 ${c.company}`, 16, cursorY + 5);
    doc.text(`R$ ${c.spend.toFixed(2)}  •  ${c.conversions} resultados  •  ${c.linkClicks.toLocaleString("pt-BR")} cliques`, pageWidth - 16, cursorY + 5, { align: "right" });
    cursorY += 9;

    for (const camp of c.campaigns) {
      autoTable(doc, {
        startY: cursorY,
        head: [[`📁 ${camp.name.substring(0, 70)}  —  R$ ${camp.spend.toFixed(2)}  •  ${camp.conversions} res.`, "Agência", "Mod.", "Período", "Rateio", "Status", "Gasto", "Result.", "CPR"]],
        body: camp.adsets.map((a) => [
          `↳ ${a.adSetName.substring(0, 45)}`,
          a.agency || "—",
          a.contractType === "efetivo" ? "EF" : a.contractType === "temporario" ? "TE" : "—",
          a.period || (a.isContinuous ? "FULL" : "—"),
          a.rateio || "—",
          a.status === "active" ? "Ativo" : "Pausado",
          `R$ ${a.spend.toFixed(2)}`,
          a.conversions,
          a.costPerResult >= 0.5 ? `R$ ${a.costPerResult.toFixed(2)}` : "—",
        ]),
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [248, 220, 220], textColor: [80, 0, 0], fontStyle: "bold", fontSize: 7.5 },
        alternateRowStyles: { fillColor: [252, 252, 252] },
        margin: { left: 14, right: 14 },
        didDrawPage: (data) => {
          const totalPages = doc.getNumberOfPages();
          doc.setFontSize(8); doc.setTextColor(150, 150, 150); doc.setFont("helvetica", "normal");
          doc.text(`Página ${data.pageNumber} / ${totalPages} • Resulta Flow`, pageWidth / 2, doc.internal.pageSize.getHeight() - 6, { align: "center" });
        },
      });
      cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 3;
    }
    cursorY += 4;
  }

  doc.save(`resulta-flow-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}.pdf`);
}

export function ReportTab({ campaigns, analysis }: ReportTabProps) {
  const [search, setSearch] = useState("");
  const [openCompanies, setOpenCompanies] = useState<Set<string>>(new Set());
  const [openCampaigns, setOpenCampaigns] = useState<Set<string>>(new Set());
  const [selectedAdsetId, setSelectedAdsetId] = useState<string | null>(null);
  const [selectedCampaignKey, setSelectedCampaignKey] = useState<string | null>(null);

  const tree = useMemo(() => {
    const filtered = !search ? campaigns : campaigns.filter((c) => {
      const q = search.toLowerCase();
      return c.adSetName.toLowerCase().includes(q) || c.campaignName.toLowerCase().includes(q) || c.company.toLowerCase().includes(q) || c.analyst.toLowerCase().includes(q);
    });
    return buildTree(filtered);
  }, [campaigns, search]);

  const toggleCompany = (k: string) => setOpenCompanies((s) => { const n = new Set(s); if (n.has(k)) { n.delete(k); } else { n.add(k); } return n; });
  const toggleCampaign = (k: string) => setOpenCampaigns((s) => { const n = new Set(s); if (n.has(k)) { n.delete(k); } else { n.add(k); } return n; });

  const selectedAdset = useMemo(() => campaigns.find((c) => c.id === selectedAdsetId) ?? null, [campaigns, selectedAdsetId]);
  const selectedCampaignSet = useMemo(() => {
    if (!selectedCampaignKey) return null;
    const [company, name] = selectedCampaignKey.split("|||");
    return campaigns.filter((c) => c.company === company && c.campaignName === name);
  }, [campaigns, selectedCampaignKey]);

  const running = campaigns.filter((c) => c.status === "active");

  return (
    <div className="space-y-6">
      {/* Banner de exportação — CTA principal */}
      <div className="relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="p-3 rounded-lg bg-primary/20 text-primary shrink-0 self-start">
            <FileDown className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-semibold text-lg leading-tight">Exportar relatório em PDF</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Baixe o relatório completo, ou escolha abaixo uma empresa, campanha ou conjunto específico para exportar só o que interessa.
            </p>
          </div>
          <Button
            size="lg"
            onClick={() => generateGroupedPdf(campaigns, "Relatório completo")}
            className="gap-2 shrink-0 shadow-lg shadow-primary/20"
          >
            <FileDown className="w-4 h-4" /> Exportar tudo
          </Button>
        </div>
      </div>


      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-card p-4"><p className="text-xs text-muted-foreground">Empresas</p><p className="text-2xl font-display font-bold">{tree.length}</p></div>
        <div className="glass-card p-4"><p className="text-xs text-muted-foreground">Conjuntos</p><p className="text-2xl font-display font-bold">{campaigns.length}</p></div>
        <div className="glass-card p-4"><p className="text-xs text-muted-foreground">Em veiculação</p><p className="text-2xl font-display font-bold text-success">{running.length}</p></div>
        <div className="glass-card p-4"><p className="text-xs text-muted-foreground">CPR médio</p><p className="text-2xl font-display font-bold">R${analysis.avgCPR.toFixed(2)}</p></div>
      </div>

      <div className="glass-card p-5">
        <div className="relative mb-4">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar empresa, campanha, conjunto, analista..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>

        <div className="border border-border/50 rounded-lg max-h-[500px] overflow-y-auto">
          {tree.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Nenhum resultado</p>
          ) : tree.map((c) => {
            const compOpen = openCompanies.has(c.company);
            return (
              <div key={c.company} className="border-b border-border/30 last:border-0">
                <div className="flex items-center px-3 py-2.5 hover:bg-secondary/40 cursor-pointer" onClick={() => toggleCompany(c.company)}>
                  {compOpen ? <ChevronDown className="w-4 h-4 mr-2 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 mr-2 text-muted-foreground shrink-0" />}
                  <Building2 className="w-4 h-4 mr-2 text-primary shrink-0" />
                  <div className="flex-1 min-w-0 flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-semibold truncate">{c.company}</span>
                    <span className="text-[10px] text-muted-foreground">{c.campaigns.length} camp. • {c.campaigns.reduce((s, x) => s + x.adsets.length, 0)} conj.</span>
                  </div>
                  <span className="text-xs font-medium text-foreground/70 ml-3">R${c.spend.toFixed(2)}</span>
                </div>

                {compOpen && c.campaigns.map((camp) => {
                  const ckey = `${c.company}|||${camp.name}`;
                  const campOpen = openCampaigns.has(ckey);
                  return (
                    <div key={ckey} className="ml-4 border-l border-border/30">
                      <div className={cn("flex items-center px-3 py-2 hover:bg-secondary/40 cursor-pointer", selectedCampaignKey === ckey && "bg-primary/10")}
                        onClick={() => { toggleCampaign(ckey); setSelectedCampaignKey(selectedCampaignKey === ckey ? null : ckey); setSelectedAdsetId(null); }}>
                        {campOpen ? <ChevronDown className="w-3.5 h-3.5 mr-2 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 mr-2 text-muted-foreground shrink-0" />}
                        <FolderOpen className="w-3.5 h-3.5 mr-2 text-info shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate" title={camp.name}>{camp.name}</p>
                          <p className="text-[10px] text-muted-foreground">{camp.adsets.length} conjuntos • {camp.conversions} resultados</p>
                        </div>
                        <span className="text-[11px] font-medium ml-2">R${camp.spend.toFixed(2)}</span>
                      </div>
                      {campOpen && camp.adsets.map((a) => (
                        <div key={a.id} onClick={(e) => { e.stopPropagation(); setSelectedAdsetId(selectedAdsetId === a.id ? null : a.id); setSelectedCampaignKey(null); }}
                          className={cn("ml-7 px-3 py-2 cursor-pointer border-l border-border/30 hover:bg-secondary/40 space-y-1", selectedAdsetId === a.id && "bg-primary/10")}>
                          <div className="flex items-center gap-2">
                            <Layers className="w-3 h-3 text-warning shrink-0" />
                            <p className="text-[11px] font-medium truncate flex-1" title={a.adSetName}>{a.adSetName}</p>
                            <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-medium", a.status === "active" ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>
                              {a.status === "active" ? "Ativo" : "Parado"}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-semibold">R${a.spend.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap text-[9px] pl-5">
                            {a.agency && a.agency !== "—" && (
                              <span className="px-1 py-0.2 rounded bg-primary/10 text-primary font-medium">
                                {a.agency}
                              </span>
                            )}
                            {a.contractType && a.contractType !== "desconhecido" && (
                              <span className={cn("px-1 py-0.2 rounded font-medium", a.contractType === "efetivo" ? "bg-emerald-500/10 text-emerald-400" : "bg-blue-500/10 text-blue-400")}>
                                {a.contractType === "efetivo" ? "EF" : "TE"}
                              </span>
                            )}
                            {a.period && (
                              <span className={cn("px-1 py-0.2 rounded font-medium", a.period === "FULL" ? "bg-purple-500/10 text-purple-400" : "bg-muted text-muted-foreground")}>
                                {a.period}
                              </span>
                            )}
                            {a.rateio && a.rateio !== "—" && (
                              <span className="px-1 py-0.2 rounded bg-amber-500/10 text-amber-400 font-medium">
                                {a.rateio}
                              </span>
                            )}
                            {(a.requisitionCode || a.jobTitle) && (
                              <span className="text-muted-foreground font-mono">
                                {a.requisitionCode ? `#${a.requisitionCode}` : a.jobTitle}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {(selectedAdset || selectedCampaignSet) && (
          <div className="mt-4 flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20 gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Selecionado para exportar:</p>
              <p className="text-sm font-medium truncate">
                {selectedAdset ? `Conjunto: ${selectedAdset.adSetName}` : `Campanha: ${selectedCampaignKey?.split("|||")[1]} (${selectedCampaignSet?.length} conjuntos)`}
              </p>
            </div>
            <Button size="sm" onClick={() => {
              const items = selectedAdset ? [selectedAdset] : (selectedCampaignSet ?? []);
              const title = selectedAdset ? `Conjunto — ${selectedAdset.adSetName.substring(0, 40)}` : `Campanha — ${selectedCampaignKey?.split("|||")[1].substring(0, 40)}`;
              generateGroupedPdf(items, title);
            }} className="gap-2 shrink-0">
              <FileDown className="w-4 h-4" /> Exportar PDF
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
