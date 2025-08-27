
const themeToggle = document.getElementById("theme-toggle");
const body = document.body;

themeToggle.addEventListener("click", () => {
  body.classList.toggle("dark-mode");
  body.classList.toggle("light-mode");
  themeToggle.textContent = body.classList.contains("dark-mode") ? "🌙" : "☀️";
});


const marketList = document.getElementById("market-list");
let cryptoData = [];

async function fetchPrices() {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false"
    );
    cryptoData = await res.json();
    displayMarket(cryptoData);
  } catch (error) {
    console.error("Error fetching prices:", error);
  }
}


function displayMarket(data) {
  marketList.innerHTML = "";
  
  data.slice(0, 12).forEach((coin) => {
    const div = document.createElement("div");
    div.classList.add("coin-card");
    div.innerHTML = `
      <img src="${coin.image}" alt="${coin.name}" width="40">
      <h4>${coin.name} (${coin.symbol.toUpperCase()})</h4>
      <p>$${coin.current_price.toLocaleString()}</p>
      <p class="${coin.price_change_percentage_24h >= 0 ? "green" : "red"}">
        ${coin.price_change_percentage_24h.toFixed(2)}%
      </p>
    `;
    
    div.addEventListener("click", () => {
      window.location.href = `chart.html?coin=${coin.id}`;
    });
    marketList.appendChild(div);
  });
}


const coinSearch = document.getElementById("coin-search");
const searchResults = document.getElementById("search-results");

coinSearch.addEventListener("input", () => {
  const query = coinSearch.value.toLowerCase();
  const filtered = cryptoData.filter(
    coin => coin.name.toLowerCase().includes(query) || coin.symbol.toLowerCase().includes(query)
  );

  searchResults.innerHTML = "";
  if (filtered.length > 0 && query !== "") {
    filtered.forEach(coin => {
      const div = document.createElement("div");
      div.textContent = `${coin.name} (${coin.symbol.toUpperCase()})`;
      div.addEventListener("click", () => {
        const marketCoin = Array.from(document.querySelectorAll(".coin-card"))
          .find(c => c.querySelector("h4").textContent.includes(coin.name));
        if (marketCoin) {
          marketCoin.scrollIntoView({ behavior: "smooth", block: "center" });
          marketCoin.classList.add("highlight");
          setTimeout(() => marketCoin.classList.remove("highlight"), 2000);
        }
        searchResults.style.display = "none";
        coinSearch.value = "";
      });
      searchResults.appendChild(div);
    });
    searchResults.style.display = "block";
  } else {
    searchResults.style.display = "none";
  }
});

document.addEventListener("click", (e) => {
  if (!coinSearch.contains(e.target) && !searchResults.contains(e.target)) {
    searchResults.style.display = "none";
  }
});


const fromAmount = document.getElementById("from-amount");
const fromCoin = document.getElementById("from-coin");
const toCoin = document.getElementById("to-coin");
const exchangeResult = document.getElementById("exchange-result");

async function calculateExchange() {
  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${fromCoin.value},${toCoin.value}&vs_currencies=usd`
  );
  const data = await res.json();

  const fromPrice = data[fromCoin.value].usd;
  const toPrice = data[toCoin.value].usd;
  const amount = parseFloat(fromAmount.value) || 0;

  const result = (amount * fromPrice) / toPrice;
  exchangeResult.textContent = result.toFixed(6);
}

[fromAmount, fromCoin, toCoin].forEach((el) =>
  el.addEventListener("input", calculateExchange)
);


fetchPrices();
calculateExchange();


const tabs = document.querySelectorAll(".market-tabs .tab");

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");

    const type = tab.dataset.tab;
    let filteredCoins = [];

    switch(type) {
      case "favourites":
        filteredCoins = cryptoData.slice(0, 5);
        break;
      case "hot":
        filteredCoins = [...cryptoData].sort((a,b) => b.price_change_percentage_24h - a.price_change_percentage_24h).slice(0, 5);
        break;
      case "gainers":
        filteredCoins = [...cryptoData].filter(c => c.price_change_percentage_24h > 0)
          .sort((a,b) => b.price_change_percentage_24h - a.price_change_percentage_24h)
          .slice(0, 5);
        break;
      case "losers":
        filteredCoins = [...cryptoData].filter(c => c.price_change_percentage_24h < 0)
          .sort((a,b) => a.price_change_percentage_24h - b.price_change_percentage_24h)
          .slice(0, 5);
        break;
      case "new":
        filteredCoins = cryptoData.slice(-5);
        break;
      default:
        filteredCoins = cryptoData.slice(0, 12);
    }

    displayMarket(filteredCoins);
  });
});



const menuToggle = document.getElementById("menu-toggle");
const sidebar = document.getElementById("sidebar");
const sidebarClose = document.getElementById("sidebar-close");


menuToggle.addEventListener("click", () => sidebar.classList.add("active"));
sidebarClose.addEventListener("click", () => sidebar.classList.remove("active"));
sidebar.querySelectorAll("a").forEach(link => link.addEventListener("click", () => sidebar.classList.remove("active")));


const navbarThemeToggle = document.getElementById("theme-toggle");
const sidebarThemeToggle = document.getElementById("sidebar-theme-toggle");

function toggleTheme() {
  document.body.classList.toggle("dark-mode");
  document.body.classList.toggle("light-mode");

  const isDark = document.body.classList.contains("dark-mode");
  navbarThemeToggle.textContent = isDark ? "🌙" : "☀️";
  sidebarThemeToggle.textContent = isDark ? "🌙" : "☀️";

  localStorage.setItem("mode", isDark ? "dark" : "light");
}

navbarThemeToggle.addEventListener("click", toggleTheme);
sidebarThemeToggle.addEventListener("click", toggleTheme);


if (localStorage.getItem("mode") === "dark") {
  document.body.classList.add("dark-mode");
  navbarThemeToggle.textContent = "🌙";
  sidebarThemeToggle.textContent = "🌙";
} else {
  document.body.classList.add("light-mode");
  navbarThemeToggle.textContent = "☀️";
  sidebarThemeToggle.textContent = "☀️";
}
