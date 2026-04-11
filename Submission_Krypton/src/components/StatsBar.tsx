import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, DollarSign, BarChart3, Clock } from "lucide-react";
import type { CoinInfo } from "@/lib/api";

interface StatsBarProps {
  coin: CoinInfo | null;
  loading: boolean;
}

const StatsBar = ({ coin, loading }: StatsBarProps) => {
  if (loading || !coin) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass-card p-4 animate-pulse">
            <div className="h-3 w-16 bg-secondary rounded mb-2" />
            <div className="h-6 w-24 bg-secondary rounded" />
          </div>
        ))}
      </div>
    );
  }

  const isUp = coin.price_change_percentage_24h >= 0;

  const stats = [
    {
      label: "Current Price",
      value: `$${coin.current_price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      icon: DollarSign,
      change: coin.price_change_percentage_24h,
    },
    {
      label: "24h High",
      value: `$${coin.high_24h.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      icon: ArrowUpRight,
    },
    {
      label: "24h Low",
      value: `$${coin.low_24h.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      icon: ArrowDownRight,
    },
    {
      label: "Market Cap",
      value: `$${(coin.market_cap / 1e9).toFixed(2)}B`,
      icon: BarChart3,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="glass-card p-4"
        >
          <div className="flex items-center gap-2 mb-1">
            <stat.icon className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{stat.label}</span>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-lg font-bold font-mono">{stat.value}</span>
            {stat.change !== undefined && (
              <span className={`text-xs font-mono mb-0.5 ${isUp ? "text-chart-up" : "text-chart-down"}`}>
                {isUp ? "+" : ""}{stat.change.toFixed(2)}%
              </span>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default StatsBar;
