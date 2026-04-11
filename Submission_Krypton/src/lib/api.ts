import type { OHLCVData } from "./features";

const BASE_URL = "https://api.coingecko.com/api/v3";

export interface CoinInfo {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
}

export const SUPPORTED_COINS = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum" },
  { id: "solana", symbol: "SOL", name: "Solana" },
  { id: "binancecoin", symbol: "BNB", name: "BNB" },
  { id: "cardano", symbol: "ADA", name: "Cardano" },
  { id: "dogecoin", symbol: "DOGE", name: "Dogecoin" },
  { id: "polkadot", symbol: "DOT", name: "Polkadot" },
  { id: "chainlink", symbol: "LINK", name: "Chainlink" },
  { id: "aave", symbol: "AAVE", name: "Aave" },
  { id: "cosmos", symbol: "ATOM", name: "Cosmos" },
  { id: "crypto-com-chain", symbol: "CRO", name: "Cronos" },
  { id: "eos", symbol: "EOS", name: "EOS" },
  { id: "iota", symbol: "IOTA", name: "IOTA" },
  { id: "litecoin", symbol: "LTC", name: "Litecoin" },
  { id: "monero", symbol: "XMR", name: "Monero" },
  { id: "nem", symbol: "XEM", name: "NEM" },
  { id: "stellar", symbol: "XLM", name: "Stellar" },
  { id: "tether", symbol: "USDT", name: "Tether" },
  { id: "tron", symbol: "TRX", name: "Tron" },
  { id: "uniswap", symbol: "UNI", name: "Uniswap" },
  { id: "usd-coin", symbol: "USDC", name: "USD Coin" },
];

export async function fetchCoinData(coinId: string): Promise<CoinInfo> {
  const res = await fetch(
    `${BASE_URL}/coins/markets?vs_currency=usd&ids=${coinId}&sparkline=false`
  );
  if (!res.ok) throw new Error("Failed to fetch coin data");
  const data = await res.json();
  return data[0];
}

export async function fetchOHLCV(coinId: string, days = 30): Promise<OHLCVData[]> {
  const res = await fetch(
    `${BASE_URL}/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`
  );
  if (!res.ok) throw new Error("Failed to fetch OHLCV data");
  const raw: number[][] = await res.json();

  // CoinGecko OHLC: [timestamp, open, high, low, close]
  // Group by day and aggregate
  const dayMap = new Map<string, { open: number; high: number; low: number; close: number; ts: number[] }>();

  for (const [ts, open, high, low, close] of raw) {
    const date = new Date(ts).toISOString().split("T")[0];
    const existing = dayMap.get(date);
    if (existing) {
      existing.high = Math.max(existing.high, high);
      existing.low = Math.min(existing.low, low);
      existing.close = close; // last close of the day
      existing.ts.push(ts);
    } else {
      dayMap.set(date, { open, high, low, close, ts: [ts] });
    }
  }

  return Array.from(dayMap.entries()).map(([date, d]) => ({
    date,
    open: d.open,
    high: d.high,
    low: d.low,
    close: d.close,
    volume: 0, // CoinGecko OHLC doesn't include volume
  }));
}

export async function fetchPriceHistory(coinId: string, days = 30): Promise<{ date: string; price: number }[]> {
  const res = await fetch(
    `${BASE_URL}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`
  );
  if (!res.ok) throw new Error("Failed to fetch price history");
  const data = await res.json();
  return data.prices.map(([ts, price]: [number, number]) => ({
    date: new Date(ts).toISOString(),
    price,
  }));
}

export async function fetchMultipleCoins(ids: string[]): Promise<CoinInfo[]> {
  const res = await fetch(
    `${BASE_URL}/coins/markets?vs_currency=usd&ids=${ids.join(",")}&order=market_cap_desc&sparkline=false`
  );
  if (!res.ok) throw new Error("Failed to fetch coins");
  return res.json();
}
