import modelData from "@/data/model.json";

export interface OHLCVData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface FeatureRow {
  date: string;
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  Daily_Return: number;
  High_Low_Spread: number;
  Close_Open_Spread: number;
  Volatility_7d: number;
  Volatility_14d: number;
}

function rollingStd(arr: number[], window: number): (number | null)[] {
  return arr.map((_, i) => {
    if (i < window - 1) return null;
    const slice = arr.slice(i - window + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / (slice.length - 1);
    return Math.sqrt(variance);
  });
}

export function engineerFeatures(data: OHLCVData[]): FeatureRow[] {
  const epsilon = 1e-8;
  const sorted = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculate daily returns
  const dailyReturns = sorted.map((d, i) => 
    i === 0 ? 0 : (d.close - sorted[i - 1].close) / (sorted[i - 1].close + epsilon)
  );

  const vol7 = rollingStd(dailyReturns, 7);
  const vol14 = rollingStd(dailyReturns, 14);

  const rows: FeatureRow[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (vol14[i] === null) continue;
    const d = sorted[i];
    rows.push({
      date: d.date,
      close: d.close,
      open: d.open,
      high: d.high,
      low: d.low,
      volume: d.volume,
      Daily_Return: dailyReturns[i],
      High_Low_Spread: (d.high - d.low) / (d.low + epsilon),
      Close_Open_Spread: (d.close - d.open) / (d.open + epsilon),
      Volatility_7d: vol7[i]!,
      Volatility_14d: vol14[i]!,
    });
  }
  return rows;
}

export interface Prediction {
  signal: "UP" | "DOWN";
  score: number;
  confidence: number;
  features: Record<string, number>;
}

export function predict(latestRow: FeatureRow): Prediction {
  const weights = modelData.features;
  const intercept = modelData.intercept;

  const featureValues: Record<string, number> = {
    Close_Open_Spread: latestRow.Close_Open_Spread,
    Daily_Return: latestRow.Daily_Return,
    Volatility_14d: latestRow.Volatility_14d,
    Volatility_7d: latestRow.Volatility_7d,
    High_Low_Spread: latestRow.High_Low_Spread,
  };

  let score = intercept;
  for (const [feature, weight] of Object.entries(weights)) {
    score += weight * (featureValues[feature] ?? 0);
  }

  // Ridge classifier: sign of score determines class
  const signal: "UP" | "DOWN" = score > 0 ? "UP" : "DOWN";
  // Rough confidence from magnitude (sigmoid-like mapping)
  const confidence = Math.min(Math.abs(score) * 50, 95);

  return { signal, score, confidence, features: featureValues };
}
