const OHLC_CACHE_KEY = "ohlcCache";
const OHLC_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const symbolMap = {
    "bitcoin": "BTC", "ethereum": "ETH", "dogecoin": "DOGE", "eos": "EOS", 
    "iota": "IOTA", "litecoin": "LTC", "monero": "XMR", "nem": "XEM", 
    "polkadot": "DOT", "solana": "SOL", "stellar": "XLM", "tether": "USDT", 
    "tron": "TRX", "uniswap": "UNI", "usd-coin": "USDC", "wrapped-bitcoin": "WBTC", 
    "ripple": "XRP", "crypto-com-chain": "CRO", "cosmos": "ATOM", "chainlink": "LINK", 
    "cardano": "ADA", "binancecoin": "BNB", "aave": "AAVE"
};

async function ohlcData(tokenId, days = 35) {
    const now = Date.now();
    const cache = JSON.parse(localStorage.getItem(OHLC_CACHE_KEY)) || [];
    const cachedEntry = cache.find((item) => item.token === tokenId && item.days === days);

    if (cachedEntry && now - cachedEntry.lastUpdated < OHLC_CACHE_TTL_MS) {
        console.log(`Using cached OHLC for ${tokenId} (${days} days)`, cachedEntry.ohlc);
        return cachedEntry.ohlc;
    }

    try {
        const symbol = symbolMap[tokenId.toLowerCase()] || "BTC";
        const url = `https://min-api.cryptocompare.com/data/v2/histoday?fsym=${symbol}&tsym=USD&limit=${days}`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const json = await response.json();

        const cleanData = json.Data.Data.map(candle => ({
            time: candle.time * 1000,
            dateStr: new Date(candle.time * 1000).toLocaleDateString(),
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volumeto 
        }));

        const updatedEntry = { token: tokenId, days: days, ohlc: cleanData, lastUpdated: now };
        const existingIndex = cache.findIndex((item) => item.token === tokenId && item.days === days);
        if (existingIndex >= 0) cache[existingIndex] = updatedEntry;
        else cache.push(updatedEntry);

        localStorage.setItem(OHLC_CACHE_KEY, JSON.stringify(cache));
        console.log(`Fetched and cached OHLC for ${tokenId} (${days} days): `, cleanData);
        return cleanData;

    } catch (error) {
        console.error(`Error fetching OHLC for ${tokenId}:`, error);
        throw error;
    }
}

function getSMA(arr, days) {
    if (arr.length < days) return arr[arr.length - 1];
    let sum = 0;
    const startIndex = arr.length - days;
    for (let i = startIndex; i < arr.length; i++) { sum += arr[i]; }
    return sum / days;
}

function getEMA(arr, days) {
    if (arr.length === 0) return 0;
    const k = 2 / (days + 1);
    let ema = arr[0];
    for (let i = 1; i < arr.length; i++) { ema = (arr[i] - ema) * k + ema; }
    return ema;
}

function getVol(arr) {
    if (arr.length === 0) return 0;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const ssq = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0);
    const res = Math.sqrt(ssq / arr.length);
    return isNaN(res) ? 0 : res;
}

function getRSI(arr) {
    if (arr.length < 15) return 50;
    let gains = 0, losses = 0;
    for (let i = arr.length - 14; i < arr.length; i++) {
        let diff = arr[i] - arr[i - 1];
        if (diff > 0) gains += diff; else losses += Math.abs(diff);
    }
    if (losses === 0) return 100; 
    const rs = gains / losses;
    const res = 100 - (100 / (1 + rs));
    return isNaN(res) ? 50 : res;
}

async function features(tokenId) {
    const data = await ohlcData(tokenId);
    if (!data || data.length < 30) throw new Error(`Not enough data for ${tokenId}`);

    const close = data.map(d => d.close);
    const today = data[data.length - 1];
    const yday = data[data.length - 2];

    const returns = [];
    for(let i = 1; i < close.length; i++) {
        returns.push((close[i] - close[i-1]) / close[i-1]);
    }

    const dailyReturn = returns[returns.length - 1];
    const volChange = yday.volume ? (today.volume - yday.volume) / yday.volume : 0;

    return {
        Daily_Return: dailyReturn,
        Moving_Avg_7: getSMA(close, 7),
        Moving_Avg_30: getSMA(close, 30),
        Volatility: getVol(returns.slice(-7)),
        Momentum: today.close - data[data.length - 6].close,
        Price_MAvg_7_ratio: today.close / getSMA(close, 7),
        Price_Change: today.close - today.open,
        RSI_14: getRSI(close),
        EMA_7: getEMA(close, 7),
        EMA_30: getEMA(close, 30),
        MA_ratio: getSMA(close, 7) / getSMA(close, 30),
        VPC: dailyReturn * volChange,
        Return_lag1: returns[returns.length - 2] || 0,
        Return_lag2: returns[returns.length - 3] || 0,
        Return_lag3: returns[returns.length - 4] || 0,
        Return_mean_7: getSMA(returns, 7),
        Return_std_7: getVol(returns.slice(-7))
    };
}

const FEATURE_LABELS = [
    "Daily Return", "Moving Avg (7)", "Moving Avg (30)", "Volatility",
    "Momentum", "Price / MA(7)", "Price Change", "RSI (14)",
    "EMA (7)", "EMA (30)", "MA Ratio", "VPC",
    "Return Lag 1", "Return Lag 2", "Return Lag 3",
    "Return Mean (7)", "Return Std (7)",
    "BTC Daily Return", "BTC EMA (7)", "BTC RSI (14)", "BTC Return Lag 1"
];
//converting the feature object to a vector basica
function buildRawFeatureVector(c, b) {
    return [
        c.Daily_Return, c.Moving_Avg_7, c.Moving_Avg_30, c.Volatility,
        c.Momentum, c.Price_MAvg_7_ratio, c.Price_Change, c.RSI_14,
        c.EMA_7, c.EMA_30, c.MA_ratio, c.VPC,
        c.Return_lag1, c.Return_lag2, c.Return_lag3,
        c.Return_mean_7, c.Return_std_7,
        b.Daily_Return, b.EMA_7, b.RSI_14, b.Return_lag1
    ];
}

function computeLinearTerms(model, rawFeatures) {
    let z = model.intercept;
    const terms = [];

    for (let i = 0; i < rawFeatures.length; i++) {
        let val = rawFeatures[i];
        const m = model.scaling.mean[i];
        let s = model.scaling.std[i];

        if (isNaN(val) || val === null) val = m;
        if (s === 0) s = 1;

        const scaledVal = (val - m) / s;
        const wixi = scaledVal * model.weights[i];
        z += wixi;

        terms.push({
            index: i,
            label: FEATURE_LABELS[i] || `Feature ${i + 1}`,
            wixi
        });
    }

    return { z, terms };
}

export async function getFeatureContributions(tokenId) {
    const res = await fetch('./data.json');
    const model = await res.json();

    const c = await features(tokenId);
    const b = await features('bitcoin');
    const rawFeatures = buildRawFeatureVector(c, b);

    const { z, terms } = computeLinearTerms(model, rawFeatures);

    return {
        z,
        features: terms.map((term) => ({
            ...term,
            contributionPct: (term.wixi / z) * 100
        }))
    };
}

export async function predict(tokenId) {
    try {
        const res = await fetch('./data.json');
        if (!res.ok) throw new Error(`Could not find data.json!`);
        const model = await res.json();

        const c = await features(tokenId);
        const b = await features('bitcoin');
        const rawFeatures = buildRawFeatureVector(c, b);
        const { z } = computeLinearTerms(model, rawFeatures);

        if (isNaN(z)) throw new Error("Math resulted in NaN");

        const prob = 1 / (1 + Math.exp(-z));
        const finalProb = prob >= model.optimal_threshold ? 
               0.5 + ((prob - model.optimal_threshold) / (1 - model.optimal_threshold)) * 0.5 : 
               (prob / model.optimal_threshold) * 0.5;

        return isNaN(finalProb) ? 0.5 : finalProb;

    } catch (error) {
        console.error(`ML Error for ${tokenId}:`, error.message);
        return 0.5; 
    }
}