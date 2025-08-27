
const themeToggle = document.getElementById("theme-toggle");
const body = document.body;

themeToggle.addEventListener("click", () => {
  body.classList.toggle("dark-mode");
  body.classList.toggle("light-mode");
  themeToggle.textContent = body.classList.contains("dark-mode") ? "🌙" : "☀️";

  
  if (currentCoinSymbol) loadTradingViewWidget(currentCoinSymbol);
});


const params = new URLSearchParams(window.location.search);
let currentCoin = params.get("coin") || "bitcoin"; 
let currentCoinSymbol = ""; 


const coinNameEl = document.getElementById("coin-name");
const coinPriceEl = document.getElementById("coin-price");
const coinChangeEl = document.getElementById("coin-change");
const coinMarketcapEl = document.getElementById("coin-marketcap");
const coinVolumeEl = document.getElementById("coin-volume");
const chartContainer = document.getElementById("tradingview-widget");


async function fetchCoinData(coinId) {
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}`);
    if (!res.ok) throw new Error("Coin not found");
    const data = await res.json();

    currentCoinSymbol = data.symbol.toUpperCase(); 

    
    coinNameEl.textContent = `${data.name} (${currentCoinSymbol})`;
    coinPriceEl.textContent = `$${data.market_data.current_price.usd.toLocaleString()}`;
    coinChangeEl.textContent = `${data.market_data.price_change_percentage_24h.toFixed(2)}%`;
    coinChangeEl.className = data.market_data.price_change_percentage_24h >= 0 ? "green" : "red";
    coinMarketcapEl.textContent = `$${data.market_data.market_cap.usd.toLocaleString()}`;
    coinVolumeEl.textContent = `$${data.market_data.total_volume.usd.toLocaleString()}`;

    
    loadTradingViewWidget(currentCoinSymbol);

  } catch (err) {
    console.error("Error fetching coin data:", err);
    coinNameEl.textContent = "Error loading coin";
    coinPriceEl.textContent = "-";
    coinChangeEl.textContent = "-";
    coinMarketcapEl.textContent = "-";
    coinVolumeEl.textContent = "-";
    chartContainer.innerHTML = "<p style='color:red; text-align:center;'>Chart cannot be loaded.</p>";
  }
}


function loadTradingViewWidget(symbol) {
  if (!symbol) return;

  chartContainer.innerHTML = ""; 
  const script = document.createElement("script");
  script.src = "https://s3.tradingview.com/tv.js";
  script.onload = () => {
    new TradingView.widget({
      container_id: "tradingview-widget",
      autosize: true,
      symbol: `BINANCE:${symbol}USDT`,
      interval: "60",
      timezone: "Etc/UTC",
      theme: body.classList.contains("dark-mode") ? "dark" : "light",
      style: "1",
      locale: "en",
      hide_top_toolbar: false,
      save_image: false,
    });
  };
  chartContainer.appendChild(script);
}


document.querySelector(".buy-btn").addEventListener("click", () => {
  if (currentCoinSymbol) alert(`Buy ${currentCoinSymbol} clicked!`);
});

document.querySelector(".sell-btn").addEventListener("click", () => {
  if (currentCoinSymbol) alert(`Sell ${currentCoinSymbol} clicked!`);
});


fetchCoinData(currentCoin);
