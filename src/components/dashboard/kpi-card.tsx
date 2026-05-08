import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
    isPositive: boolean;
  };
  className?: string;
}

export function KPICard({ title, value, subtitle, icon: Icon, trend, className }: KPICardProps) {
  const isDarkBg = className?.includes('bg-primary') || className?.includes('bg-slate-900');

  return (
    <Card className={cn("overflow-hidden border-none shadow-sm", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className={cn(
          "text-sm font-medium", 
          isDarkBg ? "text-white/80" : "text-muted-foreground"
        )}>
          {title}
        </CardTitle>
        <div className={cn("p-2 rounded-full", isDarkBg ? "bg-white/20" : "bg-primary/10")}>
          <Icon className={cn("h-4 w-4", isDarkBg ? "text-white" : "text-primary")} />
        </div>
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-bold font-headline", isDarkBg ? "text-white" : "text-foreground")}>{value}</div>
        {(subtitle || trend) && (
          <div className="flex items-center gap-2 mt-1">
            {trend && (
              <span className={cn(
                "text-xs font-medium",
                trend.isPositive ? "text-green-600" : "text-red-600"
              )}>
                {trend.isPositive ? "+" : "-"}{trend.value}%
              </span>
            )}
            {subtitle && (
              <p className={cn("text-xs", isDarkBg ? "text-white/60" : "text-muted-foreground")}>
                {subtitle}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
