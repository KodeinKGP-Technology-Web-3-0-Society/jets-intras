import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Brain, Zap } from "lucide-react";
import type { Prediction } from "@/lib/features";

interface PredictionCardProps {
  prediction: Prediction | null;
  coinSymbol: string;
  loading: boolean;
}

const PredictionCard = ({ prediction, coinSymbol, loading }: PredictionCardProps) => {
  if (loading) {
    return (
      <div className="glass-card p-6 glow-green-sm">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-5 h-5 text-primary" />
          <h3 className="font-display font-semibold text-sm">AI Prediction</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <Zap className="w-6 h-6 text-primary animate-pulse-glow" />
          <span className="ml-2 text-muted-foreground text-sm">Analyzing...</span>
        </div>
      </div>
    );
  }

  if (!prediction) return null;

  const isUp = prediction.signal === "UP";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6 glow-green-sm"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          <h3 className="font-display font-semibold text-sm">Krypton Ridge Model</h3>
        </div>
        <span className="text-xs text-muted-foreground font-mono">v1.0</span>
      </div>

      <div className="flex items-center gap-4 mb-5">
        <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
          isUp ? "bg-chart-up/15" : "bg-chart-down/15"
        }`}>
          {isUp ? (
            <TrendingUp className="w-7 h-7 text-chart-up" />
          ) : (
            <TrendingDown className="w-7 h-7 text-chart-down" />
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Tomorrow's {coinSymbol}</p>
          <p className={`text-2xl font-bold font-display ${isUp ? "text-chart-up" : "text-chart-down"}`}>
            {prediction.signal}
          </p>
        </div>
      </div>


      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground font-semibold mb-2">Feature Weights</p>
        {Object.entries(prediction.features).map(([key, value]) => (
          <div key={key} className="flex justify-between text-xs">
            <span className="text-muted-foreground">{key.replace(/_/g, " ")}</span>
            <span className={`font-mono ${value >= 0 ? "text-chart-up" : "text-chart-down"}`}>
              {value >= 0 ? "+" : ""}{value.toFixed(6)}
            </span>
          </div>
        ))}
        <div className="flex justify-between text-xs pt-1 border-t border-border/50">
          <span className="text-muted-foreground">Raw Score</span>
          <span className="font-mono text-foreground">{prediction.score.toFixed(4)}</span>
        </div>
      </div>
    </motion.div>
  );
};

export default PredictionCard;
