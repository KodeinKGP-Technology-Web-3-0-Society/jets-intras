import { predict, symbolMap, getFeatureContributions } from './predict.js';

const API_KEY = "CG-QfzzKee6U8H41yNqvhsNuwnD";

/** All the main stuff **/
//Token list
const TOKENS = [
    "dogecoin", "eos", "ethereum", "iota", "litecoin", 
    "monero", "nem", "polkadot", "solana", "stellar", 
    "tether", "tron", "uniswap", "usd-coin", "wrapped-bitcoin", 
    "ripple", "crypto-com-chain", "cosmos", "chainlink", 
    "cardano", "bitcoin", "binancecoin", "aave"
];
const ids = TOKENS.join(",");
const INITIAL_BOOT_REFRESH_KEY = "initialBootRefreshDone";

// Fetching the market data for forecast
async function getTokenData(tokenId = ids) {
    const cacheKey = `marketData_${tokenId}`; //unique cache key for ts
    const cachedData = JSON.parse(localStorage.getItem(cacheKey));
    const now = Date.now();
    const DELAY_MS = 5 *60 * 1000;
    // CACHE CHECK: If data exists and is less than 5min old, return it immediately
    if (cachedData && (now - cachedData.lastUpdated < DELAY_MS)) {
        console.log(`Using cached data for ${tokenId}`);
        console.log(cachedData.data);
        return cachedData.data; //format is objects in array, early check
    }
    try {
        console.log(`Fetching fresh data for ${tokenId}...`);
        const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${tokenId}&x_cg_demo_api_key=${API_KEY}`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        
        const data = await response.json();


        // CACHE SAVE: Store the new data with a timestamp
        localStorage.setItem(cacheKey, JSON.stringify({
            lastUpdated: now, //set timestamp to now, this is a member
            data: data //copy the data
        }));
        console.log(`Saved ${tokenId} to cache.`);
        return data;

    } catch (error) {
        console.error(`Error fetching ${tokenId}:`, error);
        // Fallback: If API fails (e.g., internet out), return stale cache if available
        return cachedData ? cachedData.data : null;
    }
}
//Cash formatter
function formatCash(n) {
    if (n < 1e3) return n.toFixed(4);
    if (n >= 1e3 && n < 1e6) return +(n / 1e3).toFixed(1) + "K";
    if (n >= 1e6 && n < 1e9) return +(n / 1e6).toFixed(1) + "M";
    if (n >= 1e9 && n < 1e12) return +(n / 1e9).toFixed(1) + "B";
    if (n >= 1e12) return +(n / 1e12).toFixed(1) + "T";
}
//Append the data to the table
function tableAppend(data, cardClick) {
    const tBody = document.querySelector("tbody");
    tBody.innerHTML = ""; // Clear existing rows
    
    data.forEach(token => { //for each token, we create a row and append to the table body
        const change24h = Number(token.price_change_percentage_24h) || 0;
        const changeColor = change24h >= 0 ? 'var(--c-color-green)' : 'var(--c-color-red)';
        
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${token.market_cap_rank || "N/A"}</td>
            <td>
                <img src="${token.image}" alt="${token.name}">
                ${token.name ? token.name: "N/A"}
                (${token.symbol ? token.symbol.toUpperCase() : "N/A"})
            </td>
            <td>$${Number(token.current_price || 0).toLocaleString("en-US", { maximumFractionDigits: 3 })}</td>
            <td style="color: ${changeColor}">
                ${change24h >= 0 ? "+" : ""}${change24h.toFixed(2)}%
            </td>
            <td>$${formatCash(Number(token.market_cap || 0))}</td>
            <td>$${formatCash(Number(token.total_volume || 0))}</td>
        `;
        tBody.appendChild(row);
        row.addEventListener("click", () => {
            cardClick(token.id);
        });
    });
}
/* chart w/ chart.js */
// Plot close price (index 4) against day label from timestamp (index 0).
let priceChartInstance = null;
function createChart(canvas, ohlcRows) {
    //data return format is an array of objects

    if (ohlcRows.length === 0) return null;

    const labels = [];
    const closeData = [];

    ohlcRows.forEach((row) => {
        const d = new Date(row.time);
        labels.push(`${d.getMonth() + 1}/${d.getDate()}`);//format as M/D
        closeData.push(row.close);
    });

    const currentClose = Number(closeData[closeData.length - 1]);
    const prevClose = Number(closeData[closeData.length - 2]);
    const last24hChange = Number.isFinite(currentClose) && Number.isFinite(prevClose) && prevClose !== 0
        ? ((currentClose - prevClose) / prevClose) * 100
        : 0;
    
    
    const isUp = last24hChange >= 0;
    const accent = document.querySelector(".chartContainer");
    if (accent) {
        accent.style.borderLeft = isUp ? "24px solid var(--c-color-green)" : "24px solid var(--c-color-red)";
    }

    if (priceChartInstance) priceChartInstance.destroy(); // Destroy previous chart instance if it exists

    priceChartInstance = new Chart(canvas, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: 'Price',
                data: closeData,
                borderWidth: 3,
                pointRadius: 0,
                pointHoverRadius: 5,
                fill: 'start',
                borderColor: isUp ? 'hsl(157, 80%, 55%)' : 'hsl(0, 80%, 55%)',
                backgroundColor: (context) => {
                    const { ctx, chartArea } = context.chart;
                    if (!chartArea) return 'hsla(157, 80%, 55%, 0.24)';
                    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                    if (isUp) {
                        gradient.addColorStop(0, 'hsla(157, 80%, 55%, 0.45)');
                        gradient.addColorStop(1, 'hsla(157, 80%, 55%, 0)');
                    } else {
                        gradient.addColorStop(0, 'hsla(0, 80%, 55%, 0.45)');
                        gradient.addColorStop(1, 'hsla(0, 80%, 55%, 0)');
                    }
                    return gradient;
                },
                tension: 0.2,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { ticks: { color: 'hsl(0, 0%, 72%)' }, grid: { color: 'hsla(0, 0%, 72%, 0.14)' } },
                x: { ticks: { color: 'hsl(0, 0%, 72%)' }, grid: { color: 'hsla(0, 0%, 72%, 0.08)' } }
            }
        }
    });
    return priceChartInstance;
}
/* UI/UX Enhancements */
// Mobile search toggle
function searchToggleMob(searchFlag, searchToggle, header, searchInput) {
    if (searchToggle.style.display !== "none") {
        searchToggle.addEventListener("click", () => {
            searchFlag = !searchFlag;
            header.classList.toggle("head", searchFlag); //basically toggles the existence of head class
            if (searchFlag) {
                searchInput.focus();
                searchInput.value = ""; // Clear input when opening search
            }
        });
    }
}
//changing the color and meter based on probability
function confidenceUpdater(probability, coin) {
    if (isNaN(probability) || probability === null || typeof probability === 'undefined') {
        console.warn(`Safety Triggered: Received NaN for ${coin}. Using 0.5 fallback.`);
        probability = 0.5;
    }
    const accent = document.querySelector(".chartContainer");
    const meterfill = document.querySelector(".chartSection .meter .fill");
    const confidenceTxt = document.querySelector(".confidenceTxt p");
    const predictTxt = document.querySelector(".confidenceTxt h2");
    const head = document.querySelector(".confidenceTxt h1");

    const formattedCoin = coin.charAt(0).toUpperCase() + coin.slice(1).replace("-", " ");
    head.textContent = `${formattedCoin} - Tomorrow's prediction`;
    
    let hue;
    if (probability >= 0.5) {
        predictTxt.innerHTML = '<img src="assets/triangle-up.svg" style = "height: 64px; transform: scaleX(0.8) scaleY(1.5); vertical-align: middle;" alt="Up Arrow">'+ "UP";
        predictTxt.style.color = "var(--c-color-green)";
        predictTxt.style.textShadow = "0 0 6px hsla(157, 80%, 43%, 0.75), 0 0 14px hsla(157, 80%, 43%, 0.55), 0 0 26px hsla(157, 80%, 43%, 0.35)";
        accent.style.borderLeft = "24px solid var(--c-color-green)";
        probability = (probability - 0.5) * 2; // Scale to 0-1
        hue = 20 + (probability * 100); // From yellow to green
    } else {
        predictTxt.innerHTML = '<img src="assets/triangle-down.svg" style = "height: 64px; transform: scaleX(0.8)scaleY(1.5);" alt="Down Arrow">' + "DOWN";
        predictTxt.style.color = "var(--c-color-red)";
        predictTxt.style.textShadow = "0 0 6px hsla(0, 81%, 57%, 0.57), 0 0 14px hsla(0, 81%, 57%, 0.3), 0 0 26px hsla(0, 81%, 57%, 0.35)";
        accent.style.borderLeft = "24px solid var(--c-color-red)";
        probability = (0.5 - probability) * 2; // Scale to 0-1
        hue = 50 - (probability * 50); // From orange to red
    }

    meterfill.style.backgroundColor = "hsl(" + hue + ", 36%, 64%)";
    meterfill.style.boxShadow = "0 0 10px hsl(" + hue + ", 80%, 55%)";
    meterfill.style.height = (probability * 100) + "%";
    confidenceTxt.textContent = `Confidence: ${(probability * 100).toFixed(1)}%`;
    confidenceTxt.style.color = "hsl(" + hue + ", 80%, 55%)";
    confidenceTxt.style.textShadow = `0 0 6px hsl(${hue}, 80%, 55%, 0.75), 0 0 14px hsl(${hue}, 80%, 55%, 0.55), 0 0 26px hsl(${hue}, 80%, 55%, 0.35)`;
}
//tags in the confidence card for 24h, 7d, 30d changes
function updateCloseChanges(ohlcRows) {
    const infoRows = document.querySelectorAll(".confidenceTxt .extraInfo p");
    if (!infoRows || infoRows.length < 3) return;

    const closes = Array.isArray(ohlcRows)
        ? ohlcRows.map(row => Number(row.close)).filter(Number.isFinite)
        : [];

    const pctFromDaysAgo = (daysAgo) => {
        if (closes.length <= daysAgo) return null;
        const current = closes[closes.length - 1];
        const past = closes[closes.length - 1 - daysAgo];
        if (!Number.isFinite(current) || !Number.isFinite(past) || past === 0) return null;
        return ((current - past) / past) * 100;
    };

    const change24h = pctFromDaysAgo(1);
    const change7d = pctFromDaysAgo(7);
    const change30d = pctFromDaysAgo(30);

    const formatPct = (value) => {
        if (!Number.isFinite(value)) return "N/A";
        return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
    };

    const applyTagColor = (el, value) => {
        if (!el) return;
        const isNegative = Number.isFinite(value) && value < 0;
        el.style.backgroundColor = isNegative ? "hsl(5, 32%, 36%)" : "hsl(157, 32%, 36%)";
    };

    infoRows[0].textContent = `last 24h: ${formatPct(change24h)}`;
    infoRows[1].textContent = `last 7d: ${formatPct(change7d)}`;
    infoRows[2].textContent = `last 30d: ${formatPct(change30d)}`;

    applyTagColor(infoRows[0], change24h);
    applyTagColor(infoRows[1], change7d);
    applyTagColor(infoRows[2], change30d);
}
// ////////
//The top 4 tokens
function topTokens(data, cardClick) {
    //data is array of obbjects
    if (!Array.isArray(data) || data.length === 0) return;

    const leaderImg = document.querySelector("img.leader");
    const leaderName = document.querySelector("span.leader");
    const gainerImg = document.querySelector("img.gainer");
    const gainerName = document.querySelector("span.gainer");
    const volumeImg = document.querySelector("img.volumeLeader");
    const volumeName = document.querySelector("span.volumeLeader");
    const undervaluedImg = document.querySelector("img.underValued");
    const undervaluedName = document.querySelector("span.underValued");
    const details = document.querySelectorAll(".details_top p");
    const cards = document.querySelectorAll(".topTokens .cards");

    const marketLeader = data.find(token => token.market_cap_rank === 1);
    if (marketLeader) {
        leaderImg.src = marketLeader.image;
        leaderName.textContent = marketLeader.name;
        details[0].textContent = `Price: $${Number(marketLeader.current_price || 0).toLocaleString("en-US", { maximumFractionDigits: 4 })}`;
        cards[0].style.cursor = "pointer";
        cards[0].onclick = () => cardClick(marketLeader.id);
    }

    const gainer = data.find(
        token => Number(token.price_change_percentage_24h) === Math.max(...data.map(t => Number(t.price_change_percentage_24h) || 0))
    );
    if (gainer) {
        gainerImg.src = gainer.image;
        gainerName.textContent = gainer.name;
        details[1].textContent = `24h Change: ${Number(gainer.price_change_percentage_24h || 0).toLocaleString("en-US", { maximumFractionDigits: 4 })}%`;
        cards[1].style.cursor = "pointer";
        cards[1].onclick = () => cardClick(gainer.id);
    }

    const volumeLeader = data.find(
        token => Number(token.total_volume) === Math.max(...data.map(t => Number(t.total_volume) || 0))
    );
    if (volumeLeader) {
        volumeImg.src = volumeLeader.image;
        volumeName.textContent = volumeLeader.name;
        const volume = Number(volumeLeader.total_volume || 0);
        details[2].textContent = `Volume: $${formatCash(volume)}`;
        cards[2].style.cursor = "pointer";
        cards[2].onclick = () => cardClick(volumeLeader.id);
    }

    const underValued = data.find(
        token => Number(token.ath_change_percentage) === Math.max(...data.map(t => Number(t.ath_change_percentage) || Number.NEGATIVE_INFINITY))
    );
    if (underValued) {
        undervaluedImg.src = underValued.image;
        undervaluedName.textContent = underValued.name;
        details[3].textContent = `ATH Change: ${Number(underValued.ath_change_percentage || 0).toFixed(2)}%`;
        cards[3].style.cursor = "pointer";
        cards[3].onclick = () => cardClick(underValued.id);
    }
}
//Search and click functionality

function setupSearch(tokensArray, onSelect, onPicked) {
    const input = document.querySelector("form input");
    const results = document.querySelector(".searchResults");
    const form = document.querySelector("form");

    // Helper to handle selection
    const handlePick = (token) => {
        input.value = token;
        results.style.display = "none";
        results.innerHTML = "";
        onSelect(token);
        onPicked();
    };

    // 1. Enter Key
    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const query = input.value.toLowerCase();
        const match = tokensArray.find(t => t.toLowerCase() === query);
        if (match) handlePick(match);
    });

    // 2. Input/Filter Logic
    input.addEventListener("input", () => {
        const query = input.value.toLowerCase().trim();
        results.innerHTML = "";
        if (!query) return results.style.display = "none";
        const filtered = tokensArray.filter(t => t.toLowerCase().includes(query));
        results.style.display = "block";
        if (filtered.length > 0) {
            filtered.forEach(token => {
                const p = document.createElement("p");
                p.textContent = token;
                p.style.cursor = "pointer";
                results.appendChild(p);
            });
        } else {
            results.innerHTML = `<p style="padding:8px 24px; pointer-events:none;">Token not found.</p>`;
        }
    });

    // 3. Click Logic
    results.addEventListener("mousedown", (e) => {
        if (e.target.tagName === "P" && e.target.style.pointerEvents !== "none") {
            handlePick(e.target.textContent);
        }
    });
}

async function getOhlcForChart(tokenId) {
    const cache = JSON.parse(localStorage.getItem('ohlcCache')) || [];
    const cachedEntry = cache.find((item) => item.token === tokenId);
    
    if (cachedEntry && cachedEntry.ohlc && cachedEntry.ohlc.length > 0) {
        return cachedEntry.ohlc.map(c => ({ time: c.time, close: c.close }));
    }

    try {
        const symbol = symbolMap[tokenId.toLowerCase()] || "BTC";
        const response = await fetch(`https://min-api.cryptocompare.com/data/v2/histoday?fsym=${symbol}&tsym=USD&limit=30`);
        const json = await response.json();
        return json.Data.Data.map(candle => ({
            time: candle.time * 1000,
            close: candle.close
        }));
    } catch (error) {
        console.error("Chart fetch failed:", error);
        return [];
    }
}

async function updateFeatureImpact(tokenId) {
    const container = document.getElementById("featureContainer");
    if (!container) return;

    try {
        const { z, features } = await getFeatureContributions(tokenId);
        const topFeatures = features
            .slice()
            .sort((a, b) => Math.abs(b.wixi) - Math.abs(a.wixi))
            .slice(0, 6);

        container.innerHTML = "";
        topFeatures.forEach((feature) => {
            const width = Math.min(100, Math.max(0, Math.abs(feature.contributionPct)));
            const card = document.createElement("div");
            let color;
            if (feature.contributionPct>0) color = "hsl(126, 20%, 46%)";
            else color = "hsl(0, 28%, 49%)";
            card.className = "cards";
            card.innerHTML = `
                <h3>${feature.label}</h3>
                <div class="meter">
                    <span class="fill" style="width: ${width}%;background-color: ${color}"></span>
                </div>
                <p>Contribution: ${feature.contributionPct.toFixed(1)}%</p>
            `;
            container.appendChild(card);
        });
    } catch (error) {
        console.error("Feature impact update failed:", error);
        container.innerHTML = "<p>Could not load feature contributions.</p>";
    }
}

async function main() {
    if (!sessionStorage.getItem(INITIAL_BOOT_REFRESH_KEY)) {
        sessionStorage.setItem(INITIAL_BOOT_REFRESH_KEY, "1");
        window.location.reload();
        return;
    }

    const searchToggle = document.getElementById("searchToggle");
    const randomBtn = document.getElementById("random");
    const form = document.querySelector("form");
    const searchInput = form.querySelector("input");
    const header = document.querySelector("header");
    const canvas = document.getElementById('priceChart');
    const chartLoading = document.querySelector(".chartLoading");
    const confidenceLoading = document.querySelector(".confidenceLoading");
    let searchFlag = false;

    const setPredictionLoading = (isLoading) => {
        chartLoading?.classList.toggle("hidden", !isLoading);
        confidenceLoading?.classList.toggle("hidden", !isLoading);
    };

    searchToggleMob(searchFlag, searchToggle, header, searchInput);
    const data = await getTokenData(ids);
    
    
    const searchResults = form.querySelector(".searchResults");
    const closeMobileSearch = () => {
        if (window.matchMedia("(max-width: 640px)").matches) {
            header.classList.remove("head");
            searchFlag = false;
            searchResults.style.display = "none";
            searchInput.blur();
        }
    };

    searchInput.addEventListener("focus", () => {
        searchResults.style.display = "block";
    });
    searchInput.addEventListener("blur", () => {
        searchInput.value = ""; // Clear input on blur
        // Delay hide so pointerdown on a result can run before the dropdown disappears.
        setTimeout(() => {
            if (!form.contains(document.activeElement)) {
                searchResults.style.display = "none";
            }
        }, 120);
    });
    
    async function triggerPrediction(coinId) {
        setPredictionLoading(true);
        try {
            const liveProb = await predict(coinId);
            console.log(`Predicted probability for ${coinId}:`, liveProb);
            confidenceUpdater(liveProb, coinId);
            const selectedOhlc = await getOhlcForChart(coinId);
            createChart(canvas, selectedOhlc);
            await updateFeatureImpact(coinId);
            updateCloseChanges(selectedOhlc);
            scrollTo({ top: document.querySelector(".chartSection").offsetTop - 100, behavior: "smooth" });
        } catch (error) {
            console.error("Prediction flow failed:", error);
        } finally {
            setPredictionLoading(false);
        }
    }
    if (data && Array.isArray(data)) {
        tableAppend(data, triggerPrediction);
    }

    if (canvas.innerHTML === "") await triggerPrediction("bitcoin"); // Default prediction on load (can be any token from the list)
    randomBtn.addEventListener("click", async () => {
        const tokenPool = ids.split(",").map(token => token.trim());
        tokenPool.splice(tokenPool.indexOf("iota"), 1);
        if (tokenPool.length === 0) return;

        const randomToken = tokenPool[Math.floor(Math.random() * tokenPool.length)];
        searchInput.value = randomToken;
        await triggerPrediction(randomToken);
    });



    topTokens(data, triggerPrediction);
    setupSearch(TOKENS, triggerPrediction, closeMobileSearch);
}

main();
