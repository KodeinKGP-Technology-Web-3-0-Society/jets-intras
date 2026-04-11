import { motion } from "framer-motion";
import type { CoinInfo } from "@/lib/api";
import { TrendingUp, TrendingDown } from "lucide-react";

interface MarketTableProps {
  coins: CoinInfo[];
  selectedCoin: string;
  onSelectCoin: (id: string) => void;
  loading: boolean;
}

const MarketTable = ({ coins, selectedCoin, onSelectCoin, loading }: MarketTableProps) => {
  if (loading) {
    return (
      <div className="glass-card p-6">
        <h3 className="font-display font-semibold text-sm mb-4">Market Overview</h3>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-secondary" />
              <div className="h-4 w-20 bg-secondary rounded" />
              <div className="ml-auto h-4 w-16 bg-secondary rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      <h3 className="font-display font-semibold text-sm mb-4">Market Overview</h3>
      <div className="space-y-1">
        {coins.map((coin, i) => {
          const isUp = coin.price_change_percentage_24h >= 0;
          const isSelected = coin.id === selectedCoin;
          return (
            <motion.button
              key={coin.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => onSelectCoin(coin.id)}
              className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-colors text-left ${
                isSelected
                  ? "bg-primary/10 border border-primary/20"
                  : "hover:bg-secondary/50"
              }`}
            >
              <img src={coin.image} alt={coin.name} className="w-7 h-7 rounded-full" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{coin.symbol.toUpperCase()}</p>
                <p className="text-xs text-muted-foreground truncate">{coin.name}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-mono">${coin.current_price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                <div className={`flex items-center justify-end gap-0.5 text-xs font-mono ${isUp ? "text-chart-up" : "text-chart-down"}`}>
                  {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {isUp ? "+" : ""}{coin.price_change_percentage_24h.toFixed(2)}%
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default MarketTable;
