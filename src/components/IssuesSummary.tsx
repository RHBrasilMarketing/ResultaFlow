import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import type { DiagnosticIssue } from "@/types/campaign";

interface IssuesSummaryProps {
  issues: DiagnosticIssue[];
}

export function IssuesSummary({ issues }: IssuesSummaryProps) {
  const critical = issues.filter((i) => i.severity === "critical").length;
  const warning = issues.filter((i) => i.severity === "warning").length;
  const info = issues.filter((i) => i.severity === "info").length;

  return (
    <div className="flex items-center gap-4">
      {critical > 0 && (
        <div className="flex items-center gap-1.5 text-destructive">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm font-semibold">{critical} crítico{critical > 1 ? "s" : ""}</span>
        </div>
      )}
      {warning > 0 && (
        <div className="flex items-center gap-1.5 text-warning">
          <AlertTriangle className="w-4 h-4" />
          <span className="text-sm font-semibold">{warning} alerta{warning > 1 ? "s" : ""}</span>
        </div>
      )}
      {info > 0 && (
        <div className="flex items-center gap-1.5 text-primary">
          <Info className="w-4 h-4" />
          <span className="text-sm font-semibold">{info} info</span>
        </div>
      )}
    </div>
  );
}
