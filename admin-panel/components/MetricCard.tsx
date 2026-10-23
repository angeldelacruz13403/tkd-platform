import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: string;
  isPositive?: boolean;
  icon: LucideIcon;
  accentColor?: "chong" | "hong" | "gold" | "emerald" | "purple";
}

export function MetricCard({
  title,
  value,
  subtitle,
  change,
  isPositive = true,
  icon: Icon,
  accentColor = "chong",
}: MetricCardProps) {
  const colorStyles = {
    chong: {
      border: "hover:border-sky-500/40",
      iconBg: "bg-sky-500/10 text-sky-400 border border-sky-500/20",
      glow: "hover:shadow-chong-glow",
      valueColor: "text-white",
    },
    hong: {
      border: "hover:border-rose-500/40",
      iconBg: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
      glow: "hover:shadow-hong-glow",
      valueColor: "text-white",
    },
    gold: {
      border: "hover:border-amber-500/40",
      iconBg: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
      glow: "hover:shadow-gold",
      valueColor: "text-white",
    },
    emerald: {
      border: "hover:border-emerald-500/40",
      iconBg: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
      glow: "hover:shadow-lg",
      valueColor: "text-white",
    },
    purple: {
      border: "hover:border-purple-500/40",
      iconBg: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
      glow: "hover:shadow-lg",
      valueColor: "text-white",
    },
  }[accentColor];

  return (
    <div
      className={`glass-panel rounded-2xl p-5 border border-slate-800 transition-all duration-300 ${colorStyles.border} ${colorStyles.glow}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</span>
        <div className={`p-2 rounded-xl ${colorStyles.iconBg}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className={`text-2xl font-black tracking-tight font-display ${colorStyles.valueColor}`}>
          {value}
        </span>
        {change && (
          <span
            className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
              isPositive ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
            }`}
          >
            {change}
          </span>
        )}
      </div>

      {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
    </div>
  );
}
