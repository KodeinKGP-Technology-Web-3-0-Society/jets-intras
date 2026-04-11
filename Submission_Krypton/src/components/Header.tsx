import { TrendingUp, Activity } from "lucide-react";
import { SUPPORTED_COINS } from "@/lib/api";

interface HeaderProps {
  selectedCoin: string;
  onSelectCoin: (id: string) => void;
}

const Header = ({ selectedCoin, onSelectCoin }: HeaderProps) => {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-border/50 glass-card rounded-none border-x-0 border-t-0">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center glow-green-sm">
          <TrendingUp className="w-5 h-5 text-primary" />
        </div>
        <span className="text-xl font-bold font-display text-gradient">Krypton</span>
      </div>


      <div className="flex items-center gap-3">
        <select
          value={selectedCoin}
          onChange={(e) => onSelectCoin(e.target.value)}
          className="bg-secondary text-secondary-foreground border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {SUPPORTED_COINS.map((coin) => (
            <option key={coin.id} value={coin.id}>
              {coin.symbol} — {coin.name}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Activity className="w-3 h-3 text-primary animate-pulse-glow" />
          <span>Live</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
