import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  icon: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger";
}

const variantStyles = {
  default: "border-border/50",
  success: "border-success/30",
  warning: "border-warning/30",
  danger: "border-destructive/30",
};

const iconBgStyles = {
  default: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
};

/**
 * Escolhe um tamanho de fonte que caiba na largura do card. Valores muito longos
 * (ex: R$1.234.567,89) diminuem automaticamente em vez de quebrar linha.
 */
function sizeForLength(len: number): string {
  if (len <= 8) return "text-2xl md:text-3xl";
  if (len <= 12) return "text-xl md:text-2xl";
  if (len <= 16) return "text-lg md:text-xl";
  if (len <= 20) return "text-base md:text-lg";
  return "text-sm md:text-base";
}

export function MetricCard({ title, value, trend, trendLabel, icon, variant = "default" }: MetricCardProps) {
  const sizeClass = sizeForLength(value.length);
  return (
    <div className={cn("glass-card p-5 animate-fade-in min-w-0", variantStyles[variant])}>
      <div className="flex items-start justify-between mb-3">
        <div className={cn("p-2.5 rounded-lg", iconBgStyles[variant])}>
          {icon}
        </div>
        {trend && (
          <div className={cn("flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
            trend === "up" && "bg-success/10 text-success",
            trend === "down" && "bg-destructive/10 text-destructive",
            trend === "neutral" && "bg-muted text-muted-foreground"
          )}>
            {trend === "up" && <ArrowUp className="w-3 h-3" />}
            {trend === "down" && <ArrowDown className="w-3 h-3" />}
            {trend === "neutral" && <Minus className="w-3 h-3" />}
            {trendLabel}
          </div>
        )}
      </div>
      <p
        className={cn(
          "font-display font-bold tracking-tight leading-tight whitespace-nowrap overflow-hidden text-ellipsis tabular-nums",
          sizeClass,
        )}
        title={value}
      >
        {value}
      </p>
      <p className="text-xs md:text-sm text-muted-foreground mt-1 truncate" title={title}>{title}</p>
    </div>
  );
}
