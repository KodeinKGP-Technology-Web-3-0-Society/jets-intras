import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Header from "@/components/Header";
import PriceChart from "@/components/PriceChart";
import PredictionCard from "@/components/PredictionCard";
import StatsBar from "@/components/StatsBar";
import MarketTable from "@/components/MarketTable";
import { fetchCoinData, fetchOHLCV, fetchPriceHistory, fetchMultipleCoins, SUPPORTED_COINS } from "@/lib/api";
import { engineerFeatures, predict, type Prediction } from "@/lib/features";
import { Clock, RefreshCw } from "lucide-react";

const Index = () => {
  const [selectedCoin, setSelectedCoin] = useState("bitcoin");
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const coinMeta = SUPPORTED_COINS.find((c) => c.id === selectedCoin)!;

  const { data: coinData, isLoading: coinLoading } = useQuery({
    queryKey: ["coin", selectedCoin],
    queryFn: () => fetchCoinData(selectedCoin),
    refetchInterval: 60000,
  });

  const { data: priceHistory, isLoading: chartLoading } = useQuery({
    queryKey: ["priceHistory", selectedCoin],
    queryFn: () => fetchPriceHistory(selectedCoin, 30),
  });

  const { data: ohlcvData, isLoading: ohlcvLoading } = useQuery({
    queryKey: ["ohlcv", selectedCoin],
    queryFn: () => fetchOHLCV(selectedCoin, 30),
  });

  const { data: allCoins, isLoading: allCoinsLoading } = useQuery({
    queryKey: ["allCoins"],
    queryFn: () => fetchMultipleCoins(SUPPORTED_COINS.map((c) => c.id)),
    refetchInterval: 60000,
  });

  const prediction: Prediction | null = ohlcvData
    ? (() => {
        const features = engineerFeatures(ohlcvData);
        if (features.length === 0) return null;
        return predict(features[features.length - 1]);
      })()
    : null;

  const isUp = coinData ? coinData.price_change_percentage_24h >= 0 : true;

  return (
    <div className="min-h-screen bg-background">
      <Header selectedCoin={selectedCoin} onSelectCoin={setSelectedCoin} />

      <main className="max-w-[1400px] mx-auto px-4 md:px-6 py-6 space-y-6">
        {/* Title Bar */}
        <div className="flex items-center justify-between">
          <motion.div
            key={selectedCoin}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-5"
          >
            {coinData && (
              <div className="w-14 h-14 rounded-2xl bg-secondary/80 border border-border/50 flex items-center justify-center glow-green-sm">
                <img src={coinData.image} alt={coinData.name} className="w-9 h-9" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold font-display">
                  {coinMeta.symbol}/USD
                </h1>
                {coinData && (
                  <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${
                    isUp ? "bg-chart-up/15 text-chart-up" : "bg-chart-down/15 text-chart-down"
                  }`}>
                    {isUp ? "+" : ""}{coinData.price_change_percentage_24h.toFixed(2)}%
                  </span>
                )}
              </div>
              {coinData && (
                <span className="text-3xl font-bold font-mono">
                  ${coinData.current_price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              )}
            </div>
          </motion.div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono">
            <Clock className="w-4 h-4" />
            {currentTime.toLocaleTimeString()}
          </div>
        </div>

        {/* Stats */}
        <StatsBar coin={coinData ?? null} loading={coinLoading} />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart */}
          <div className="lg:col-span-2 glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-sm">Price Chart — 30 Days</h2>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <RefreshCw className="w-3 h-3" />
                Auto-refresh 60s
              </div>
            </div>
            {chartLoading ? (
              <div className="h-[300px] flex items-center justify-center">
                <span className="text-muted-foreground text-sm animate-pulse-glow">Loading chart...</span>
              </div>
            ) : (
              <PriceChart data={priceHistory ?? []} isUp={isUp} />
            )}
          </div>

          {/* Prediction */}
          <div className="space-y-6">
            <PredictionCard
              prediction={prediction}
              coinSymbol={coinMeta.symbol}
              loading={ohlcvLoading}
            />

            {/* Model Info */}
            <div className="glass-card p-5">
              <h3 className="font-display font-semibold text-sm mb-3">Model Info</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Algorithm</span>
                  <span className="font-mono">Ridge Classifier</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Accuracy</span>
                  <span className="font-mono">50.96%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Precision</span>
                  <span className="font-mono text-chart-up">58.35%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Features</span>
                  <span className="font-mono">5</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">F1 Score</span>
                  <span className="font-mono">34.24%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Market Table */}
        <MarketTable
          coins={allCoins ?? []}
          selectedCoin={selectedCoin}
          onSelectCoin={setSelectedCoin}
          loading={allCoinsLoading}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-6 px-6 text-center text-sm text-muted-foreground space-y-1">
        <p>
          Made with <span className="text-chart-down">❤️</span> and <span className="font-mono text-primary">&lt;/&gt;</span> by{" "}
          <span className="text-foreground font-semibold">Shreyasi</span>,{" "}
          <span className="text-foreground font-semibold">Sahil</span>,{" "}
          <span className="text-foreground font-semibold">Aditya</span> &{" "}
          <span className="text-foreground font-semibold">Achal</span>
        </p>
        <p className="text-xs">Krypton — Ridge V1 · Not financial advice · Data via CoinGecko</p>
      </footer>
    </div>
  );
};

export default Index;
