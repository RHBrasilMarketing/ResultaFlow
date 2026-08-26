import { useMemo } from "react";
import { AlertTriangle, AlertCircle, Info, ChevronRight } from "lucide-react";
import type { DiagnosticIssue } from "@/types/campaign";
import { cn } from "@/lib/utils";

interface DiagnosticTabProps {
  issues: DiagnosticIssue[];
}

const severityConfig = {
  critical: { icon: AlertTriangle, label: "Crítico", bg: "bg-destructive/10", text: "text-destructive", border: "border-destructive/30" },
  warning: { icon: AlertCircle, label: "Atenção", bg: "bg-warning/10", text: "text-warning", border: "border-warning/30" },
  info: { icon: Info, label: "Info", bg: "bg-primary/10", text: "text-primary", border: "border-primary/30" },
};

const categoryLabels: Record<string, string> = {
  performance: "Performance",
  segmentation: "Segmentação",
  creative: "Criativo",
  budget: "Orçamento",
};

export function DiagnosticTab({ issues }: DiagnosticTabProps) {
  const grouped = useMemo(() => {
    const groups: Record<string, DiagnosticIssue[]> = {};
    issues.forEach((issue) => {
      const key = issue.severity;
      if (!groups[key]) groups[key] = [];
      groups[key].push(issue);
    });
    return groups;
  }, [issues]);

  const counts = useMemo(() => ({
    critical: issues.filter((i) => i.severity === "critical").length,
    warning: issues.filter((i) => i.severity === "warning").length,
    info: issues.filter((i) => i.severity === "info").length,
  }), [issues]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display font-semibold text-lg">Diagnóstico Detalhado</h3>
        <p className="text-sm text-muted-foreground">Problemas identificados e recomendações de otimização</p>
      </div>

      {/* Summary badges */}
      <div className="flex items-center gap-3 flex-wrap">
        {counts.critical > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-destructive/10 text-destructive text-xs font-medium">
            <AlertTriangle className="w-3.5 h-3.5" /> {counts.critical} Críticos
          </div>
        )}
        {counts.warning > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-warning/10 text-warning text-xs font-medium">
            <AlertCircle className="w-3.5 h-3.5" /> {counts.warning} Atenção
          </div>
        )}
        {counts.info > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
            <Info className="w-3.5 h-3.5" /> {counts.info} Informativos
          </div>
        )}
        {issues.length === 0 && (
          <p className="text-sm text-success font-medium">✓ Nenhum problema encontrado!</p>
        )}
      </div>

      {/* Issues list */}
      {(["critical", "warning", "info"] as const).map((severity) => {
        const group = grouped[severity];
        if (!group || group.length === 0) return null;
        const config = severityConfig[severity];
        const Icon = config.icon;

        return (
          <div key={severity} className="space-y-3">
            <h4 className={cn("font-display font-semibold text-sm flex items-center gap-2", config.text)}>
              <Icon className="w-4 h-4" /> {config.label} ({group.length})
            </h4>
            {group.map((issue) => (
              <div key={issue.id} className={cn("glass-card p-4 border-l-4 animate-fade-in", config.border)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{issue.title}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                        {categoryLabels[issue.category] || issue.category}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{issue.description}</p>
                    <div className="flex items-start gap-2 pt-1">
                      <ChevronRight className="w-3.5 h-3.5 text-success mt-0.5 shrink-0" />
                      <p className="text-xs text-success/90">{issue.suggestion}</p>
                    </div>
                    {issue.metric && issue.currentValue !== undefined && issue.idealValue !== undefined && (
                      <div className="flex items-center gap-4 pt-1 text-xs text-muted-foreground">
                        <span>{issue.metric}: <strong className="text-foreground">{typeof issue.currentValue === "number" ? issue.currentValue.toFixed(2) : issue.currentValue}</strong></span>
                        <span>Meta: <strong className="text-success">{typeof issue.idealValue === "number" ? issue.idealValue.toFixed(2) : issue.idealValue}</strong></span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
