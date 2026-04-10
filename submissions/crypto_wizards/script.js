//___________________________________________Initial_________________________________________________________________

document.addEventListener("DOMContentLoaded", init);
const Models = {};
async function init() {
  try {
    const models = await loadModels();
    Object.assign(Models, models);
    await loadData();
  } catch (err) {
    console.error("Initialization failed:", err);
  }
}

//___________________________________________API_________________________________________________________________

const key = "CG-zBNS7Y2qU3cHf5twpN9CJ3pg";

// async function fetchData(id) {
//   try {
//     const res = await fetch(
//     // trending:
//     //   `https://api.coingecko.com/api/v3/search/trending`,
//     // price:
//     //   `https://api.coingecko.com/api/v3/simple/price?vs_currencies=inr&ids=${id}`,
//     // market data :
//     //   `https://api.coingecko.com/api/v3/coins/markets?vs_currency=inr&ids=${id}`,
//     // historical data on date:
//     //   `https://api.coingecko.com/api/v3/coins/${id}/history?date=01-01-2026`,
//     // detailed data :
//     //   `https://api.coingecko.com/api/v3/coins/${id}?vs_currencies=inr`,
//     // market chart data for 7 days:
//     //   `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=inr&days=7`,
//     // top 20 coins by market cap:
//     //   `https://api.coingecko.com/api/v3/coins/markets?vs_currency=inr&order=market_cap_desc&per_page=20&page=1`,
//     // global data:
//       `https://api.coingecko.com/api/v3/global`
//     );
//     const data = await res.json();
//     console.log("Crypto Market data loaded", data);
//   } catch (err) {
//     console.error("Failed to fetch CoinGecko data:", err);
//   }
// }
// fetchData("bitcoin");

async function fetchglobal() {
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/global`);
    const data = await res.json();
    console.log("Global Data loaded :", data);
    return data;
  } catch (err) {
    console.error("Failed to fetch CoinGecko data:", err);
  }
}
async function fetchTrending() {
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/search/trending`);
    const data = await res.json();
    const trending = data.coins.slice(0, 10);
    console.log("trending Data loaded :", trending);
    return trending;
  } catch (err) {
    console.error("Failed to fetch CoinGecko data:", err);
  }
}
async function fetchGainersLosers() {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=inr&order=market_cap_desc&per_page=250&page=1&price_change_percentage=24h`,
    );
    const data = await res.json();
    const valid = data.filter((c) => c.price_change_percentage_24h !== null);
    const gainers = [...valid]
      .sort(
        (a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h,
      )
      .slice(0, 10);

    const losers = [...valid]
      .sort(
        (a, b) => a.price_change_percentage_24h - b.price_change_percentage_24h,
      )
      .slice(0, 10);
    console.log("Top Gainers:", gainers);
    console.log("Top Losers:", losers);
    return { gainers, losers };
  } catch (err) {
    console.error("Failed to fetch CoinGecko data:", err);
  }
}
const coins = [
  "aave",
  "binancecoin",
  "bitcoin",
  "cardano",
  "chainlink",
  "cosmos",
  "crypto-com-chain",
  "dogecoin",
  "eos",
  "ethereum",
  "iota",
  "litecoin",
  "monero",
  "nem",
  "polkadot",
  "solana",
  "stellar",
  "tether",
  "tron",
  "uniswap",
  "usd-coin",
  "wrapped-bitcoin",
  "ripple",
];
async function fetchList(id = coins) {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=inr&ids=${id}`,
    );
    const data = await res.json();
    data.sort((a, b) => a.name.localeCompare(b.name));
    console.log("Coins data :", data);
    return data;
  } catch (err) {
    console.error("Failed to fetch CoinGecko data:", err);
  }
}
async function fetchOHLC(id) {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/ohlc?vs_currency=inr&days=30`,
    );
    const data = await res.json();
    const daily = [];
    for (let i = 0; i < data.length; i += 6) {
      const chunk = data.slice(i, i + 6);

      const open = chunk[0][1];
      const close = chunk[chunk.length - 1][4];
      const high = Math.max(...chunk.map((x) => x[2]));
      const low = Math.min(...chunk.map((x) => x[3]));

      daily.push([open, high, low, close]);
    }

    console.log("OHLC data :", daily);
    return daily;
  } catch (err) {
    console.error("Failed to fetch CoinGecko data:", err);
  }
}

async function loadData() {
  try {
    const [global, trending, gainersLosers, coins] = await Promise.all([
      fetchglobal(),
      fetchTrending(),
      fetchGainersLosers(),
      fetchList(),
    ]);
    const { gainers, losers } = gainersLosers;
    renderGlobal(global);
    renderTrending(trending);
    renderGainersLosers(gainers, losers);
    renderList(coins);
  } catch (err) {
    console.error("Failed to fetch CoinGecko data:", err);
  }
}

// //___________________________________________Render_________________________________________________________________
function setColor(el, value) {
  if (value > 0) {
    el.style.color = "var(--green)";
  } else if (value < 0) {
    el.style.color = "var(--red)";
  } else {
    el.style.color = "gray";
  }
}
function getNumericId(imageUrl) {
  // imageUrl = "https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png"
  const match = imageUrl.match(/\/images\/(\d+)\//);
  return match ? match[1] : null;
}
function renderGlobal(global) {
  document.getElementById("hero2-market").querySelector("p").textContent =
    global.data.total_market_cap.inr.toLocaleString("en-IN", {
      style: "currency",
      currency: "INR",
    });
  document.getElementById("hero2-volume").querySelector("p").textContent =
    global.data.total_volume.inr.toLocaleString("en-IN", {
      style: "currency",
      currency: "INR",
    });
  document.getElementById("hero2-dominance").querySelector("p").textContent =
    global.data.market_cap_percentage.btc.toFixed(2) + "% BTC";
  document.getElementById("hero2-active").querySelector("p").textContent =
    global.data.active_cryptocurrencies;

  const el1 = document.getElementById("hero2-market").querySelector("span");
  const el2 = document.getElementById("hero2-volume").querySelector("span");
  const value1 = global.data.market_cap_change_percentage_24h_usd;
  const value2 = global.data.volume_change_percentage_24h_usd;
  el1.textContent = (value1 > 0 ? "+" : "") + value1.toFixed(2) + "%";
  el2.textContent = (value2 > 0 ? "+" : "") + value2.toFixed(2) + "%";
  setColor(el1, value1);
  setColor(el2, value2);
}
function renderTrending(trending) {
  const listEl = document.getElementById("hero3-list1");
  listEl.innerHTML = "";
  trending.forEach((coin, i) => {
    const el = document.createElement("li");
    el.innerHTML = `${i + 1}. ${coin.item.name} <span>₹${coin.item.data.price.toFixed(2)}</span>`;
    listEl.appendChild(el);
  });
}
function renderGainersLosers(gainers, losers) {
  const listEl1 = document.getElementById("hero3-list2");
  listEl1.innerHTML = "";
  gainers.forEach((coin, i) => {
    const el = document.createElement("li");
    el.innerHTML = `${i + 1}. ${coin.name} <span>+${coin.price_change_percentage_24h.toFixed(2)}%</span>`;
    listEl1.appendChild(el);
  });
  const listEl2 = document.getElementById("hero3-list3");
  listEl2.innerHTML = "";
  losers.forEach((coin, i) => {
    const el = document.createElement("li");
    el.innerHTML = `${i + 1}. ${coin.name} <span>${coin.price_change_percentage_24h.toFixed(2)}%</span>`;
    listEl2.appendChild(el);
  });
  // listEl1.querySelectorAll("span").forEach(el => setColor(el, 1));
  // listEl2.querySelectorAll("span").forEach(el => setColor(el, -1));
}
function renderList(coins) {
  const listEl = document.getElementById("list-list");
  listEl.innerHTML = `<li id="list-el" class="list-el">
                    <h4>Coin</h4>
                    <p>Price</p>
                    <p>24h%</p>
                    <p>High 24h</p>
                    <p>Low 24h</p>
                    <p>7-day</p>
                    <p>Prediction</p>
                    <p>Confidence</p>
                </li>`;

  coins.forEach((coin, i) => {
    const el = document.createElement("li");
    el.classList.add("list-el");
    el.innerHTML = `<h4><img src="${coin.image}" alt="hell">${coin.name}</h4>
                    <p>${coin.current_price.toLocaleString("en-IN", { style: "currency", currency: "INR" })}</p>
                    <p>${(coin.price_change_percentage_24h > 0 ? "+" : "") + coin.price_change_percentage_24h.toFixed(2) + "%"}</p>
                    <p>${coin.high_24h.toLocaleString("en-IN", { style: "currency", currency: "INR" })}</p>
                    <p>${coin.low_24h.toLocaleString("en-IN", { style: "currency", currency: "INR" })}</p>
                    <p><img src="https://www.coingecko.com/coins/${getNumericId(coin.image)}/sparkline.svg" alt="${coin.coin_id}"></p>
                    <p><i class="fa-solid fa-magnifying-glass-chart"></i></p>
                    <p></p>`;
    listEl.appendChild(el);
    el.querySelectorAll("p")[5].addEventListener("click", () => {
      fetchOHLC(coin.id).then((ohlc) => {
        const model = Models[coin.id];
        if (!model || !Array.isArray(ohlc) || !ohlc.length) {
          el.querySelectorAll("p")[5].innerHTML = "-";
          el.querySelectorAll("p")[6].textContent = "N/A";
          alert("too many requests, please try again later");
          return;
        }

        const latest = ohlc[ohlc.length - 1];
        const features = [
          latest[0],
          latest[1],
          latest[2],
          latest[3],
          Number.isFinite(coin.total_volume) ? coin.total_volume : 0,
        ];
        console.log("clicked on coin , features:", ohlc);
        const [prediction, confidence] = predict(features, ohlc, model);
        el.querySelectorAll("p")[5].innerHTML = prediction;
        el.querySelectorAll("p")[6].textContent =
          confidence > 0.5 ? confidence : 1 - confidence;
      });
    });
    const listEls = document.querySelectorAll(".list-el");
    listEls.forEach((el, i) => {
      if (i > 0) {
        setColor(
          el.querySelectorAll("p")[1],
          parseFloat(el.querySelectorAll("p")[1].textContent),
        );
      }
    });
  });
}

//___________________________________________ML_________________________________________________________________
async function loadModels() {
  const modelFilesById = {
    aave: "ml_model/weights/coin_Aave.json",
    binancecoin: "ml_model/weights/coin_BinanceCoin.json",
    bitcoin: "ml_model/weights/coin_Bitcoin.json",
    cardano: "ml_model/weights/coin_Cardano.json",
    chainlink: "ml_model/weights/coin_ChainLink.json",
    cosmos: "ml_model/weights/coin_Cosmos.json",
    "crypto-com-chain": "ml_model/weights/coin_CryptocomCoin.json",
    dogecoin: "ml_model/weights/coin_Dogecoin.json",
    eos: "ml_model/weights/coin_EOS.json",
    ethereum: "ml_model/weights/coin_Ethereum.json",
    iota: "ml_model/weights/coin_Iota.json",
    litecoin: "ml_model/weights/coin_Litecoin.json",
    monero: "ml_model/weights/coin_Monero.json",
    nem: "ml_model/weights/coin_NEM.json",
    polkadot: "ml_model/weights/coin_Polkadot.json",
    solana: "ml_model/weights/coin_Solana.json",
    stellar: "ml_model/weights/coin_Stellar.json",
    tether: "ml_model/weights/coin_Tether.json",
    tron: "ml_model/weights/coin_Tron.json",
    uniswap: "ml_model/weights/coin_Uniswap.json",
    "usd-coin": "ml_model/weights/coin_USDCoin.json",
    "wrapped-bitcoin": "ml_model/weights/coin_WrappedBitcoin.json",
    ripple: "ml_model/weights/coin_XRP.json",
  };
  const models = {};

  for (const [coinId, file] of Object.entries(modelFilesById)) {
    const response = await fetch(file);
    if (!response.ok) {
      throw new Error(`Model file failed: ${file} (${response.status})`);
    }
    const model = await response.json();
    models[coinId] = model;
  }
  console.log("ML Models loaded:", models);
  return models;
}
function predict(features, data, model) {
  if (!model || !Array.isArray(model.weights) || !Array.isArray(features)) {
    alert("too many requests, please try again later");
    return ["-", "N/A"];
  }

  const engineeredFeatures = computeFeatures(data);
  const allFeatures = [...features, ...engineeredFeatures];

  // Validate all features are finite numbers
  if (!allFeatures.every((f) => Number.isFinite(f))) {
    return ["-", "N/A"];
  }

  const safeFeature = (value) => (Number.isFinite(value) ? value : 0);
  let result = Number.isFinite(model.bias) ? model.bias : 0;

  const len = Math.min(model.weights.length, allFeatures.length);
  for (let i = 0; i < len; i++) {
    const featureValue = safeFeature(allFeatures[i]);
    const weightValue = safeFeature(model.weights[i]);
    result += featureValue * weightValue;
  }

  const z = Math.max(-60, Math.min(60, result));
  const prob =
    z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z));
  const boundedProb = Math.max(0.001, Math.min(0.999, prob));

  return [
    boundedProb > 0.5
      ? '<i class="fa-solid fa-angles-up" style="color:var(--green);"></i>'
      : '<i class="fa-solid fa-angles-down" style="color:var(--red);"></i>',
    boundedProb.toFixed(3),
  ];
}

function computeFeatures(data) {
  if (!Array.isArray(data) || data.length === 0) {
    return [0, 0, 0, 0];
  }

  const safeNumber = (value) => (Number.isFinite(value) ? value : 0);
  const lastIndex = data.length - 1;
  const [, high, low, close] = data[lastIndex];
  const prevClose = lastIndex > 0 ? data[lastIndex - 1][3] : close;

  const ret = prevClose ? (close - prevClose) / prevClose : 0;

  let ma7 = close;
  if (data.length >= 7) {
    let sum = 0;
    for (let i = data.length - 7; i < data.length; i++) {
      sum += data[i][3];
    }
    ma7 = sum / 7;
  }

  let volatility7 = 0;
  if (data.length >= 7) {
    const returns = [];
    for (let i = data.length - 7; i < data.length; i++) {
      if (i > 0) {
        const prev = data[i - 1][3];
        const curr = data[i][3];
        if (prev) {
          returns.push((curr - prev) / prev);
        }
      }
    }
    if (returns.length) {
      const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
      const variance =
        returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
      volatility7 = Math.sqrt(variance);
    }
  }

  const hlRange = high - low;

  return [
    safeNumber(ret),
    safeNumber(ma7),
    safeNumber(volatility7),
    safeNumber(hlRange),
  ];
}

//___________________________________________ hamburger _________________________________________________________________
document.getElementById("hamburger").addEventListener("click", () => {
  document.getElementById("hamburger").classList.toggle("active");
  document.getElementsByClassName("nav-bar2")[0].classList.toggle("active");
});

//___________________________________________ check logged in _________________________________________________________________
document.addEventListener("DOMContentLoaded", () => {
  const userStr = localStorage.getItem("currentUser");

  if (userStr) {
    //logged in
    const user = JSON.parse(userStr);
    console.log("user data", user);
    document.getElementsByClassName("nav-el")[5].innerHTML =
      `<i class="fa-solid fa-user"></i>Logout, ${user.fname}`;
    document.getElementsByClassName("nav-el")[5].href = "login.html";
    document.getElementById("message").innerHTML =
      `Welcome back, <span>${user.fname}</span>`;
    document
      .getElementsByClassName("nav-el")[5]
      .addEventListener("click", () => {
        localStorage.removeItem("currentUser");
      });
  } else {
    //guest
    document.getElementsByClassName("nav-el")[5].innerHTML =
      '<i class="fa-solid fa-user"></i>Log in';
    document.getElementsByClassName("nav-el")[5].href = "login.html";
    // document.getElementById("message").style.display='none';
  }
});
//___________________________________________ scroll into view _________________________________________________________________
function scrollHero2(){
    document.getElementsByClassName("hero-btn")[0].scrollIntoView({
        behavior:"smooth",
        block:"start" 
    });
}
//___________________________________________ notification _________________________________________________________________
document.getElementsByClassName("nav-el")[4].addEventListener("click", (e) => {
  e.preventDefault();
  const panel = document.getElementById("notif-panel");
  panel.style.display = panel.style.display === "block" ? "none" : "block";
});

document.addEventListener("click", (e) => {
  const panel = document.getElementById("notif-panel");
  const btn = document.getElementsByClassName("nav-el")[4];
  if (!panel.contains(e.target) && !btn.contains(e.target)) {
    panel.style.display = "none";
  }
});