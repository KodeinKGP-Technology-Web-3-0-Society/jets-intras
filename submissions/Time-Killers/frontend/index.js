// API configuration
const API_BASE = "https://api.coingecko.com/api/v3";
const COINGECKO_API_KEY = "CG-v62J5R4GV5AABinMTvsLjGZA";

// DOM references
const ui = {
  coinSelect: document.getElementById("coinSelect"),
  refreshBtn: document.getElementById("refreshBtn"),
  statusText: document.getElementById("statusText"),
  priceText: document.getElementById("priceText"),
  changeText: document.getElementById("changeText"),
  volumeText: document.getElementById("volumeText"),
  trendText: document.getElementById("trendText"),
  trendIcon: document.getElementById("trendIcon"),
  trendValue: document.getElementById("trendValue"),
  predictedCloseText: document.getElementById("predictedCloseText"),
  historyChart: document.getElementById("historyChart"),
  chartTitle: document.getElementById("chartTitle"),
  range24: document.getElementById("range24"),
  range7: document.getElementById("range7"),
  range30: document.getElementById("range30"),
  watchlistBody: document.getElementById("watchlistBody"),
};

// Model feature order (must match model.json)
const FEATURE_NAMES = [
  "Volume",
  "volatility",
  "variance7",
  "variance15",
  "variance30",
  "price_change",
  "Average_price",
  "Momentum1D",
  "Momentum7D",
  "Momentum15D",
  "Momentum30D",
  "returns",
  "MovingAvg7",
  "MovingAvg15",
  "MovingAvg30",
];

// App state
const state = {
  currentRangeKey: "7d",
  currentRangeDays: 7,
  priceHistory24: [],
  priceHistory30: [],
  modelConfig: null,
};

function formatUSD(value) {
  return "$" + Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function formatPercent(value) {
  const num = Number(value);
  return (num > 0 ? "+" : "") + num.toFixed(2) + "%";
}

function formatAxisPrice(value) {
  const num = Number(value);
  if (num >= 1000) return "$" + Math.round(num).toLocaleString("en-US");
  if (num >= 1) return "$" + num.toFixed(2);
  if (num >= 0.01) return "$" + num.toFixed(4);
  return "$" + num.toFixed(6);
}

function setTrendDisplay(direction) {
  const isUp = direction === "UP";
  ui.trendText.className = isUp ? "trend up" : "trend down";
  ui.trendIcon.innerHTML = isUp ? "&#9650;" : "&#9660;";
  ui.trendValue.textContent = direction;
}

function setPredictionUnavailable() {
  ui.trendText.className = "trend";
  ui.trendIcon.innerHTML = "";
  ui.trendValue.textContent = "--";
  ui.predictedCloseText.textContent = "Market will close tomorrow at: --";
}

async function getJson(url) {
  const isCoinGeckoApi = typeof url === "string" && url.indexOf(API_BASE) === 0;
  const withKeyUrl =
    isCoinGeckoApi && COINGECKO_API_KEY
      ? url + (url.includes("?") ? "&" : "?") + "x_cg_demo_api_key=" + encodeURIComponent(COINGECKO_API_KEY)
      : url;

  let response = await fetch(withKeyUrl);
  if (!response.ok && isCoinGeckoApi && COINGECKO_API_KEY) response = await fetch(url);

  if (!response.ok) {
    throw new Error("Failed API call: " + response.status + " " + response.statusText);
  }
  return response.json();
}

async function ensureModelLoaded() {
  if (!state.modelConfig) {
    state.modelConfig = await getJson("./model.json");
  }
  return state.modelConfig;
}

function average(values) {
  if (!values.length) return 0;
  let sum = 0;
  for (let i = 0; i < values.length; i++) sum += values[i];
  return sum / values.length;
}

function variance(values) {
  if (!values.length) return 0;
  const avg = average(values);
  let total = 0;
  for (let i = 0; i < values.length; i++) {
    const diff = values[i] - avg;
    total += diff * diff;
  }
  return total / values.length;
}

function tail(values, count) {
  return values.slice(Math.max(0, values.length - count));
}

function safeScale(value, mean, scale) {
  const divisor = Number(scale);
  if (!Number.isFinite(divisor) || divisor === 0) return Number(value) - Number(mean || 0);
  return (Number(value) - Number(mean || 0)) / divisor;
}

function toDayKey(timestamp) {
  const date = new Date(timestamp);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return y + "-" + m + "-" + d;
}

function aggregateDailyOhlc(ohlcRows) {
  const byDay = {};

  for (let i = 0; i < ohlcRows.length; i++) {
    const row = ohlcRows[i];
    const ts = Number(row[0]);
    const key = toDayKey(ts);

    const candle = {
      key: key,
      ts: ts,
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
    };

    if (!byDay[key]) {
      byDay[key] = candle;
      continue;
    }

    byDay[key].high = Math.max(byDay[key].high, candle.high);
    byDay[key].low = Math.min(byDay[key].low, candle.low);
    byDay[key].close = candle.close;
    byDay[key].ts = candle.ts;
  }

  return Object.values(byDay).sort(function (a, b) {
    return a.ts - b.ts;
  });
}

function extractDailyVolumeMap(historyDaily) {
  const volumeByDay = {};
  const totalVolumes = (historyDaily && historyDaily.total_volumes) || [];

  for (let i = 0; i < totalVolumes.length; i++) {
    const item = totalVolumes[i];
    volumeByDay[toDayKey(item[0])] = Number(item[1]);
  }

  return volumeByDay;
}

function mergeDailyMarketData(ohlcRows, historyDaily) {
  const candles = aggregateDailyOhlc(ohlcRows || []);
  const volumeByDay = extractDailyVolumeMap(historyDaily);

  return candles.map(function (candle) {
    return {
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: Number(volumeByDay[candle.key] || 0),
    };
  });
}

function buildFallbackMarketData(historyDaily) {
  const prices = (historyDaily && historyDaily.prices) || [];
  const volumeByDay = extractDailyVolumeMap(historyDaily);
  const daily = [];

  for (let i = 1; i < prices.length; i++) {
    const ts = Number(prices[i][0]);
    const key = toDayKey(ts);
    const close = Number(prices[i][1]);
    const open = Number(prices[i - 1][1]);
    daily.push({
      open: open,
      high: Math.max(open, close),
      low: Math.min(open, close),
      close: close,
      volume: Number(volumeByDay[key] || 0),
    });
  }

  return daily;
}

function computeFeatureVector(marketDays) {
  const opens = marketDays.map(function (d) {
    return d.open;
  });
  const highs = marketDays.map(function (d) {
    return d.high;
  });
  const lows = marketDays.map(function (d) {
    return d.low;
  });
  const closes = marketDays.map(function (d) {
    return d.close;
  });
  const volumes = marketDays.map(function (d) {
    return d.volume;
  });

  const n = closes.length - 1;
  const open = opens[n];
  const high = highs[n];
  const low = lows[n];
  const close = closes[n];
  const volume = volumes[n] || 0;

  const returnsSeries = [];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1];
    returnsSeries.push(prev === 0 ? 0 : (closes[i] - prev) / prev);
  }

  const variance7 = variance(tail(returnsSeries, 7));
  const variance15 = variance(tail(returnsSeries, 15));
  const variance30 = variance(tail(returnsSeries, 30));

  const priceChange = close - open;
  const returns = open === 0 ? 0 : priceChange / open;
  const avgPrice = (open + high + low + close) / 4;
  const movingAvg7 = average(tail(closes, 7));
  const movingAvg15 = average(tail(closes, 15));
  const movingAvg30 = average(tail(closes, 30));

  const momentum1 = closes.length >= 2 ? close - closes[n - 1] : 0;
  const momentum7 = closes.length >= 8 ? close - closes[n - 7] : 0;
  const momentum15 = closes.length >= 16 ? close - closes[n - 15] : 0;
  const momentum30 = closes.length >= 31 ? close - closes[n - 30] : 0;

  return [
    volume,
    open === 0 ? 0 : (high - low) / open,
    variance7,
    variance15,
    variance30,
    priceChange,
    avgPrice,
    momentum1,
    momentum7,
    momentum15,
    momentum30,
    returns,
    movingAvg7,
    movingAvg15,
    movingAvg30,
  ];
}

function buildFeaturesFromDailyHistory(historyDaily, ohlcRows) {
  let marketDays = mergeDailyMarketData(ohlcRows, historyDaily);
  if (marketDays.length < 31) {
    marketDays = buildFallbackMarketData(historyDaily);
  }
  if (marketDays.length < 31) return null;

  const featureSeries = [];
  for (let i = 30; i < marketDays.length; i++) {
    featureSeries.push(computeFeatureVector(marketDays.slice(0, i + 1)));
  }

  if (!featureSeries.length) return null;
  const features = featureSeries[featureSeries.length - 1];

  const localMean = [];
  const localScale = [];

  for (let j = 0; j < FEATURE_NAMES.length; j++) {
    const column = featureSeries.map(function (row) {
      return Number(row[j] || 0);
    });
    const meanVal = average(column);
    const varianceVal = variance(column);
    const stdVal = Math.sqrt(Math.max(varianceVal, 0));

    localMean.push(meanVal);
    localScale.push(stdVal > 0 ? stdVal : 1);
  }

  return {
    features: features,
    localMean: localMean,
    localScale: localScale,
  };
}

function decodePredictedClose(rawClose, currentPrice, model) {
  const raw = Number(rawClose);
  const priceNow = Number(currentPrice);
  if (!Number.isFinite(raw) || !Number.isFinite(priceNow) || priceNow <= 0) return null;

  const yMean = Number(model && (model.y_close_mean != null ? model.y_close_mean : model.close_target_mean));
  const yStd = Number(model && (model.y_close_std != null ? model.y_close_std : model.close_target_std));

  if (Number.isFinite(yStd) && yStd > 0) {
    const denormalized = raw * yStd + (Number.isFinite(yMean) ? yMean : 0);
    if (Number.isFinite(denormalized) && denormalized > 0) return denormalized;
  }

  const mode = String((model && (model.close_target || model.close_mode)) || "").toLowerCase();
  if (mode === "price") return raw > 0 ? raw : null;
  if (mode === "delta") return priceNow + raw > 0 ? priceNow + raw : null;
  if (mode === "return" || mode === "pct") return priceNow * (1 + raw) > 0 ? priceNow * (1 + raw) : null;
  if (mode === "log_return") return priceNow * Math.exp(raw);
  if (mode === "log_price") return Math.exp(raw);

  const candidates = [];
  function pushCandidate(value) {
    if (!Number.isFinite(value) || value <= 0) return;
    const rel = Math.abs(value - priceNow) / priceNow;
    candidates.push({ value: value, rel: rel });
  }

  pushCandidate(raw);
  pushCandidate(priceNow + raw);
  pushCandidate(priceNow * (1 + raw));
  if (raw > -1 && raw < 1) pushCandidate(priceNow * Math.exp(raw));

  if (!candidates.length) return null;
  candidates.sort(function (a, b) {
    return a.rel - b.rel;
  });
  if (candidates[0].rel > 0.8) return null;
  return candidates[0].value;
}

function adaptVolumeToModel(rawVolume, currentPrice, mean, scale) {
  const volume = Number(rawVolume);
  const price = Number(currentPrice);
  if (!Number.isFinite(volume) || volume <= 0) return 0;

  const candidates = [volume, volume / 1e3, volume / 1e6, volume / 1e9];
  if (Number.isFinite(price) && price > 0) {
    candidates.push(volume / price);
    candidates.push(volume / (price * 1e3));
  }

  let best = candidates[0];
  let bestScore = Infinity;
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const z = Math.abs(safeScale(candidate, mean, scale));
    if (z < bestScore) {
      bestScore = z;
      best = candidate;
    }
  }
  return best;
}

function predictFromModel(featureBundle, currentPrice) {
  const model = state.modelConfig;
  if (!model || !model.weights || !featureBundle || !featureBundle.features) return null;

  const features = featureBundle.features.slice();
  if (features.length !== FEATURE_NAMES.length) return null;

  const trendWeights = Array.isArray(model.weights[0]) ? model.weights[0] : model.weights;
  const closeWeights = model.weights_close
    ? Array.isArray(model.weights_close[0])
      ? model.weights_close[0]
      : model.weights_close
    : trendWeights;

  const modelMean = model.mean || [];
  const modelScale = model.scale || [];

  const identityScaler = FEATURE_NAMES.every(function (_, i) {
    const meanVal = Number(modelMean[i] || 0);
    const scaleVal = Number(modelScale[i] != null ? modelScale[i] : 1);
    return Math.abs(meanVal) < 1e-8 && Math.abs(scaleVal - 1) < 1e-8;
  });

  const mean = identityScaler ? featureBundle.localMean || [] : modelMean;
  const scale = identityScaler ? featureBundle.localScale || [] : modelScale;

  if (!identityScaler) {
    features[0] = adaptVolumeToModel(features[0], currentPrice, mean[0], scale[0]);
  }

  const trendBias = Array.isArray(model.bias) ? Number((model.bias || [0])[0]) : Number(model.bias || 0);
  const closeBias = Array.isArray(model.bias_close)
    ? Number((model.bias_close || [0])[0])
    : Number(model.bias_close != null ? model.bias_close : trendBias);

  let trendScore = trendBias;
  let rawCloseScore = closeBias;

  for (let i = 0; i < features.length; i++) {
    const normalized = safeScale(features[i], mean[i], scale[i]);
    trendScore += normalized * Number(trendWeights[i] || 0);
    rawCloseScore += normalized * Number(closeWeights[i] || 0);
  }

  const probabilityUp = 1 / (1 + Math.exp(-trendScore));
  const predictedClose = decodePredictedClose(rawCloseScore, currentPrice, model);

  if (!Number.isFinite(predictedClose)) return null;

  return {
    probabilityUp: probabilityUp,
    direction: probabilityUp >= 0.5 ? "UP" : "DOWN",
    predictedClose: predictedClose,
  };
}

function setRange(key, days) {
  state.currentRangeKey = key;
  state.currentRangeDays = days;
  renderHistoryChart();
}

function setActiveRangeButton() {
  ui.range24.classList.toggle("active", state.currentRangeKey === "24h");
  ui.range7.classList.toggle("active", state.currentRangeKey === "7d");
  ui.range30.classList.toggle("active", state.currentRangeKey === "30d");
}

function getRangePrices() {
  if (state.currentRangeKey === "24h") return state.priceHistory24 || [];
  if (!state.priceHistory30 || !state.priceHistory30.length) return [];
  if (state.currentRangeKey === "30d") return state.priceHistory30;
  return state.priceHistory30.slice(Math.max(0, state.priceHistory30.length - 7));
}

function renderHistoryChart() {
  const points = getRangePrices();
  ui.chartTitle.textContent =
    state.currentRangeKey === "24h"
      ? "Price Trend (Last 24 Hours)"
      : "Price Trend (Last " + state.currentRangeDays + " Days)";

  setActiveRangeButton();

  const ctx = ui.historyChart.getContext("2d");
  const w = ui.historyChart.width;
  const h = ui.historyChart.height;
  ctx.clearRect(0, 0, w, h);

  if (points.length < 2) {
    ctx.fillStyle = "#5a6a84";
    ctx.font = "16px Arial";
    ctx.fillText("Not enough data to draw chart.", 20, 40);
    return;
  }

  const padding = { top: 24, right: 22, bottom: 46, left: 84 };
  const plotW = w - padding.left - padding.right;
  const plotH = h - padding.top - padding.bottom;

  const prices = points.map(function (item) {
    return Number(item[1]);
  });

  const minPrice = Math.min.apply(null, prices);
  const maxPrice = Math.max.apply(null, prices);
  const range = maxPrice - minPrice || 1;
  const yPad = range * 0.1;
  const yMin = minPrice - yPad;
  const yMax = maxPrice + yPad;

  ctx.strokeStyle = "#d7e4f5";
  ctx.lineWidth = 1;

  for (let i = 0; i < 5; i++) {
    const y = padding.top + (plotH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(w - padding.right, y);
    ctx.stroke();

    const value = yMax - ((yMax - yMin) * i) / 4;
    ctx.fillStyle = "#5a6a84";
    ctx.font = "12px Arial";
    ctx.fillText(formatAxisPrice(value), 10, y + 4);
  }

  const linePoints = [];
  for (let i = 0; i < points.length; i++) {
    const x = padding.left + (plotW * i) / (points.length - 1);
    const yVal = Number(points[i][1]);
    const y = padding.top + ((yMax - yVal) / (yMax - yMin)) * plotH;
    linePoints.push({ x: x, y: y });
  }

  ctx.beginPath();
  ctx.moveTo(linePoints[0].x, linePoints[0].y);
  for (let i = 1; i < linePoints.length; i++) {
    ctx.lineTo(linePoints[i].x, linePoints[i].y);
  }
  ctx.lineTo(linePoints[linePoints.length - 1].x, padding.top + plotH);
  ctx.lineTo(linePoints[0].x, padding.top + plotH);
  ctx.closePath();
  ctx.fillStyle = "rgba(14, 165, 164, 0.10)";
  ctx.fill();

  ctx.beginPath();
  for (let i = 0; i < linePoints.length; i++) {
    const x = linePoints[i].x;
    const y = linePoints[i].y;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = "#0ea5a4";
  ctx.lineWidth = 3.5;
  ctx.stroke();

  for (let i = 0; i < linePoints.length; i++) {
    const x = linePoints[i].x;
    const y = linePoints[i].y;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#1c3357";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  const first = new Date(points[0][0]);
  const middle = new Date(points[Math.floor(points.length / 2)][0]);
  const last = new Date(points[points.length - 1][0]);

  const firstLabel =
    state.currentRangeKey === "24h"
      ? first.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : first.toLocaleDateString();
  const middleLabel =
    state.currentRangeKey === "24h"
      ? middle.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : middle.toLocaleDateString();
  const lastLabel =
    state.currentRangeKey === "24h"
      ? last.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : last.toLocaleDateString();

  ctx.fillStyle = "#5a6a84";
  ctx.font = "12px Arial";
  ctx.fillText(firstLabel, padding.left, h - 14);
  const midWidth = ctx.measureText(middleLabel).width;
  ctx.fillText(middleLabel, padding.left + plotW / 2 - midWidth / 2, h - 14);
  const lastWidth = ctx.measureText(lastLabel).width;
  ctx.fillText(lastLabel, w - padding.right - lastWidth, h - 14);
}

async function loadSelectedCoin() {
  const coinId = ui.coinSelect.value;
  ui.statusText.textContent = "Loading selected coin...";

  const coinUrl = API_BASE + "/coins/markets?vs_currency=usd&ids=" + coinId + "&price_change_percentage=24h";
  const history30Url = API_BASE + "/coins/" + coinId + "/market_chart?vs_currency=usd&days=30&interval=daily";
  const history24Url = API_BASE + "/coins/" + coinId + "/market_chart?vs_currency=usd&days=1&interval=hourly";
  const history90Url = API_BASE + "/coins/" + coinId + "/market_chart?vs_currency=usd&days=90&interval=daily";
  const ohlc90Url = API_BASE + "/coins/" + coinId + "/ohlc?vs_currency=usd&days=90";

  const [coinData, history30Data, history24Data, history90Data] = await Promise.all([
    getJson(coinUrl),
    getJson(history30Url),
    getJson(history24Url),
    getJson(history90Url),
  ]);

  let ohlc90Data = [];
  try {
    ohlc90Data = await getJson(ohlc90Url);
  } catch (error) {
    ohlc90Data = [];
  }

  try {
    await ensureModelLoaded();
  } catch (error) {
    state.modelConfig = null;
    setPredictionUnavailable();
  }

  if (!coinData || !coinData.length) return;
  const coin = coinData[0];

  ui.priceText.textContent = formatUSD(coin.current_price);
  ui.changeText.textContent = formatPercent(coin.price_change_percentage_24h || 0);
  ui.volumeText.textContent = formatUSD(coin.total_volume);
  ui.changeText.className = (coin.price_change_percentage_24h || 0) >= 0 ? "value up" : "value down";

  const featureBundle = buildFeaturesFromDailyHistory(history90Data, ohlc90Data);
  const prediction = predictFromModel(featureBundle, coin.current_price);

  if (prediction) {
    setTrendDisplay(prediction.direction);
    const predictedCloseValue = Number(prediction.predictedClose);
    if (Number.isFinite(predictedCloseValue)) {
      ui.predictedCloseText.textContent = "Market will close tomorrow at: " + formatUSD(predictedCloseValue);
    } else {
      setPredictionUnavailable();
    }
  } else {
    setPredictionUnavailable();
  }

  state.priceHistory30 = history30Data.prices || [];
  state.priceHistory24 = history24Data.prices || [];
  renderHistoryChart();

  ui.statusText.textContent = "Updated: " + new Date().toLocaleString();
}

async function loadWatchlist() {
  const url =
    API_BASE +
    "/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=8&page=1&price_change_percentage=24h";

  const coins = await getJson(url);
  ui.watchlistBody.innerHTML = "";

  for (let i = 0; i < coins.length; i++) {
    const coin = coins[i];
    const tr = document.createElement("tr");
    tr.className = "watchlist-row";
    if (coin.id === ui.coinSelect.value) tr.classList.add("active");

    const tdName = document.createElement("td");
    tdName.textContent = coin.name;

    const tdPrice = document.createElement("td");
    tdPrice.textContent = formatUSD(coin.current_price);

    const tdChange = document.createElement("td");
    tdChange.textContent = formatPercent(coin.price_change_percentage_24h || 0);
    tdChange.className = (coin.price_change_percentage_24h || 0) >= 0 ? "up" : "down";

    tr.appendChild(tdName);
    tr.appendChild(tdPrice);
    tr.appendChild(tdChange);

    tr.addEventListener("click", function () {
      let option = ui.coinSelect.querySelector("option[value=\"" + coin.id + "\"]");
      if (!option) {
        option = document.createElement("option");
        option.value = coin.id;
        option.textContent = coin.name;
        ui.coinSelect.appendChild(option);
      }
      ui.coinSelect.value = coin.id;
      loadAllData();
    });

    ui.watchlistBody.appendChild(tr);
  }
}

async function loadAllData() {
  try {
    await Promise.all([loadSelectedCoin(), loadWatchlist()]);
  } catch (error) {
    ui.statusText.textContent = "Could not load API data. Try again.";
  }
}

// App bootstrap and event wiring
ui.refreshBtn.addEventListener("click", loadAllData);
ui.coinSelect.addEventListener("change", loadAllData);
ui.range24.addEventListener("click", function () {
  setRange("24h", 1);
});
ui.range7.addEventListener("click", function () {
  setRange("7d", 7);
});
ui.range30.addEventListener("click", function () {
  setRange("30d", 30);
});

loadAllData();
