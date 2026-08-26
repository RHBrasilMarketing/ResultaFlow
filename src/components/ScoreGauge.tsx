import { cn } from "@/lib/utils";

interface ScoreGaugeProps {
  score: number;
  label: string;
}

export function ScoreGauge({ score, label }: ScoreGaugeProps) {
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;

  const color = score >= 80 ? "text-success" : score >= 50 ? "text-warning" : "text-destructive";
  const strokeColor = score >= 80 ? "hsl(150, 60%, 45%)" : score >= 50 ? "hsl(38, 92%, 55%)" : "hsl(0, 72%, 55%)";
  const glowColor = score >= 80 ? "hsl(150 60% 45% / 0.3)" : score >= 50 ? "hsl(38 92% 55% / 0.3)" : "hsl(0 72% 55% / 0.3)";

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-36 h-36">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" fill="none" stroke="hsl(220, 14%, 18%)" strokeWidth="8" />
          <circle
            cx="60" cy="60" r="54" fill="none"
            stroke={strokeColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{
              filter: `drop-shadow(0 0 6px ${glowColor})`,
              transition: "stroke-dashoffset 1s ease-out",
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("text-3xl font-display font-bold", color)}>{score}</span>
          <span className="text-xs text-muted-foreground">/100</span>
        </div>
      </div>
      <p className="text-sm font-medium text-muted-foreground mt-3">{label}</p>
    </div>
  );
}
