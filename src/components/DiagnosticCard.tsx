import { cn } from "@/lib/utils";
import { AlertTriangle, AlertCircle, Info, Lightbulb, TrendingDown, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import type { DiagnosticIssue } from "@/types/campaign";

const severityConfig = {
  critical: {
    icon: AlertCircle,
    dotClass: "status-dot-error",
    bg: "bg-destructive/5 border-destructive/20",
    badge: "bg-destructive/15 text-destructive",
    label: "Crítico",
  },
  warning: {
    icon: AlertTriangle,
    dotClass: "status-dot-warning",
    bg: "bg-warning/5 border-warning/20",
    badge: "bg-warning/15 text-warning",
    label: "Atenção",
  },
  info: {
    icon: Info,
    dotClass: "status-dot-success",
    bg: "bg-primary/5 border-primary/20",
    badge: "bg-primary/15 text-primary",
    label: "Info",
  },
};

const categoryLabels = {
  performance: "Performance",
  segmentation: "Segmentação",
  creative: "Criativo",
  budget: "Orçamento",
};

interface DiagnosticCardProps {
  issue: DiagnosticIssue;
  index: number;
}

export function DiagnosticCard({ issue, index }: DiagnosticCardProps) {
  const [expanded, setExpanded] = useState(false);
  const config = severityConfig[issue.severity];
  const Icon = config.icon;

  return (
    <div
      className={cn("border rounded-xl p-4 transition-all cursor-pointer animate-fade-in", config.bg)}
      style={{ animationDelay: `${index * 100}ms` }}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start gap-3">
        <div className={config.dotClass} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", config.badge)}>
              {config.label}
            </span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
              {categoryLabels[issue.category]}
            </span>
          </div>
          <h4 className="font-medium text-sm leading-snug">{issue.title}</h4>

          {expanded && (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">{issue.description}</p>

              {issue.metric && (
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <TrendingDown className="w-3.5 h-3.5 text-destructive" />
                    <span className="text-muted-foreground">Atual:</span>
                    <span className="font-semibold">{issue.currentValue?.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Ideal:</span>
                    <span className="font-semibold text-success">{issue.idealValue?.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2 p-3 rounded-lg bg-accent/10 border border-accent/20">
                <Lightbulb className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                <p className="text-sm text-accent">{issue.suggestion}</p>
              </div>
            </div>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </div>
    </div>
  );
}
