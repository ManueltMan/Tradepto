/* Tradepto coin page (chart.html). Requires common.js. */
(function () {
  'use strict';

  var T = window.Tradepto;

  var params = new URLSearchParams(window.location.search);
  var requested = (params.get('coin') || 'bitcoin').trim().toLowerCase();
  var coinId = /^[a-z0-9-]+$/.test(requested) ? requested : 'bitcoin'; // CoinGecko ids are lowercase with hyphens

  var el = {
    name: document.getElementById('coin-name'),
    rank: document.getElementById('coin-rank'),
    image: document.getElementById('coin-image'),
    price: document.getElementById('coin-price'),
    change: document.getElementById('coin-change'),
    marketcap: document.getElementById('coin-marketcap'),
    volume: document.getElementById('coin-volume'),
    high: document.getElementById('coin-high'),
    low: document.getElementById('coin-low'),
    error: document.getElementById('coin-error'),
    errorText: document.getElementById('coin-error-text'),
    retry: document.getElementById('coin-retry'),
    chart: document.getElementById('tradingview-widget'),
    stopLoss: document.getElementById('stopLoss'),
    takeProfit: document.getElementById('takeProfit'),
    leverage: document.getElementById('leverage'),
    buy: document.querySelector('.buy-btn'),
    sell: document.querySelector('.sell-btn')
  };

  var currentSymbol = '';
  var currentPrice = null;
  var chartDrawn = false;

  var DETAIL_URL = 'https://api.coingecko.com/api/v3/coins/' + encodeURIComponent(coinId) +
    '?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false';

  /* ---------- Coin details ---------- */
  function usd(obj, key) {
    return obj && obj[key] && typeof obj[key].usd === 'number' ? obj[key].usd : null;
  }

  function showError(message) {
    el.errorText.textContent = message;
    el.error.hidden = false;
  }

  function showCoin(data) {
    var m = data.market_data || {};
    currentSymbol = String(data.symbol || '').toUpperCase();
    currentPrice = usd(m, 'current_price');

    el.name.textContent = data.name + ' (' + currentSymbol + ')';
    document.title = data.name + ' (' + currentSymbol + ') | Tradepto';
    el.rank.textContent = data.market_cap_rank ? 'Rank #' + data.market_cap_rank + ' by market cap' : '';

    var img = data.image && data.image.small;
    if (typeof img === 'string' && /^https:\/\//.test(img)) {
      el.image.src = img;
      el.image.hidden = false;
    }

    el.price.textContent = T.fmtUSD(currentPrice);
    T.setPill(el.change, typeof m.price_change_percentage_24h === 'number' ? m.price_change_percentage_24h : null);
    el.marketcap.textContent = T.fmtCompact(usd(m, 'market_cap'));
    el.volume.textContent = T.fmtCompact(usd(m, 'total_volume'));
    el.high.textContent = T.fmtUSD(usd(m, 'high_24h'));
    el.low.textContent = T.fmtUSD(usd(m, 'low_24h'));
    el.error.hidden = true;
  }

  function loadCoin() {
    return T.cachedFetch(DETAIL_URL, 50 * 1000)
      .then(function (data) {
        showCoin(data);
        if (!chartDrawn) { chartDrawn = true; drawChart(); }
      })
      .catch(function (err) {
        console.error('Error fetching coin data:', err);
        if (currentPrice !== null) return; // keep showing the last good data on refresh failures
        el.name.textContent = 'Error loading coin';
        if (err && err.status === 404) {
          showError('We couldn’t find that coin. Go back to the market and pick one from the list.');
        } else if (err && err.status === 429) {
          showError('The free price API is rate-limiting requests. Please wait a minute and try again.');
        } else {
          showError('We couldn’t load this coin. Check your connection and try again.');
        }
        el.chart.textContent = 'Chart cannot be loaded.';
      });
  }

  el.retry.addEventListener('click', function () {
    el.error.hidden = true;
    el.name.textContent = 'Loading...';
    loadCoin();
  });

  /* ---------- TradingView chart ---------- */
  var tvPromise = null;

  function loadTradingView() {
    if (window.TradingView) return Promise.resolve();
    if (!tvPromise) {
      tvPromise = new Promise(function (resolve, reject) {
        var script = document.createElement('script');
        script.src = 'https://s3.tradingview.com/tv.js';
        script.async = true;
        script.onload = resolve;
        script.onerror = function () { tvPromise = null; reject(new Error('TradingView failed to load')); };
        document.head.appendChild(script);
      });
    }
    return tvPromise;
  }

  function tvSymbol(symbol) {
    var clean = symbol.replace(/[^A-Z0-9]/g, '');
    if (clean === 'USDT') return 'KRAKEN:USDTUSD'; // BINANCE:USDTUSDT does not exist
    return 'BINANCE:' + clean + 'USDT';
  }

  function drawChart() {
    if (!currentSymbol) return;
    el.chart.replaceChildren();

    loadTradingView()
      .then(function () {
        new window.TradingView.widget({
          container_id: 'tradingview-widget',
          autosize: true,
          symbol: tvSymbol(currentSymbol),
          interval: '60',
          timezone: 'Etc/UTC',
          theme: T.currentTheme(),
          style: '1',
          locale: 'en',
          hide_top_toolbar: false,
          save_image: false
        });
      })
      .catch(function () {
        el.chart.textContent = 'Chart cannot be loaded.';
      });
  }

  // Redraw the chart with matching colours when the theme changes
  document.addEventListener('themechange', function () { if (chartDrawn) drawChart(); });

  /* ---------- Demo trading panel ---------- */
  function optionalNumber(raw) {
    var value = raw.trim();
    if (value === '') return null;
    var n = Number(value);
    return isFinite(n) && n > 0 ? n : false;
  }

  function placeOrder(side) {
    if (currentPrice === null) { T.toast('Price is still loading. Try again in a moment.', 'error'); return; }

    var sl = optionalNumber(el.stopLoss.value);
    var tp = optionalNumber(el.takeProfit.value);
    if (sl === false || tp === false) {
      T.toast('Stop loss and take profit must be positive numbers.', 'error');
      return;
    }

    if (side === 'buy') {
      if (sl !== null && sl >= currentPrice) { T.toast('For a buy, stop loss must be below the current price.', 'error'); return; }
      if (tp !== null && tp <= currentPrice) { T.toast('For a buy, take profit must be above the current price.', 'error'); return; }
    } else {
      if (sl !== null && sl <= currentPrice) { T.toast('For a sell, stop loss must be above the current price.', 'error'); return; }
      if (tp !== null && tp >= currentPrice) { T.toast('For a sell, take profit must be below the current price.', 'error'); return; }
    }

    var parts = [side.toUpperCase() + ' ' + currentSymbol + ' @ ' + T.fmtUSD(currentPrice), el.leverage.value];
    if (sl !== null) parts.push('SL ' + T.fmtUSD(sl));
    if (tp !== null) parts.push('TP ' + T.fmtUSD(tp));
    T.toast('Demo order: ' + parts.join(' · ') + '. No real trade was placed.');
  }

  el.buy.addEventListener('click', function () { placeOrder('buy'); });
  el.sell.addEventListener('click', function () { placeOrder('sell'); });

  /* ---------- Go ---------- */
  loadCoin();
  setInterval(function () { if (!document.hidden && currentPrice !== null) loadCoin(); }, 60 * 1000);
})();