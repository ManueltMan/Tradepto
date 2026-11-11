/* Tradepto dashboard (index.html). Requires common.js. */
(function () {
  'use strict';

  var T = window.Tradepto;
  var MARKETS_URL = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false';
  var CACHE_MS = 55 * 1000;
  var FAV_KEY = 'tp:favs';

  var el = {
    list: document.getElementById('market-list'),
    tabs: document.querySelectorAll('.market-tabs .tab'),
    updated: document.getElementById('last-updated'),
    search: document.getElementById('coin-search'),
    results: document.getElementById('search-results'),
    walletCoin: document.getElementById('wallet-coin'),
    walletAmount: document.getElementById('wallet-amount'),
    walletUsd: document.getElementById('wallet-usd'),
    deposit: document.getElementById('deposit-btn'),
    withdraw: document.getElementById('withdraw-btn'),
    fromAmount: document.getElementById('from-amount'),
    fromCoin: document.getElementById('from-coin'),
    toCoin: document.getElementById('to-coin'),
    swap: document.getElementById('swap-coins'),
    exResult: document.getElementById('exchange-result'),
    exSymbol: document.getElementById('to-symbol'),
    exRate: document.getElementById('exchange-rate'),
    moodLabel: document.getElementById('mood-label'),
    moodFill: document.getElementById('mood-fill'),
    moodDetail: document.getElementById('mood-detail'),
    topGainer: document.getElementById('top-gainer'),
    topLoser: document.getElementById('top-loser'),
    topVolume: document.getElementById('top-volume')
  };

  var coins = [];
  var byId = {};
  var loaded = false;
  var activeTab = 'all';
  var favourites = loadFavourites();

  /* ---------- Helpers ---------- */
  function change(coin) {
    var v = coin.price_change_percentage_24h;
    return (typeof v === 'number' && isFinite(v)) ? v : null; // the API returns null for some coins
  }

  function make(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function safeImage(url) {
    return typeof url === 'string' && /^https:\/\//.test(url) ? url : '';
  }

  function loadFavourites() {
    var raw = T.store.get(FAV_KEY);
    if (raw === null) return ['bitcoin', 'ethereum'];
    try {
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(function (x) { return typeof x === 'string'; }) : [];
    } catch (e) { return []; }
  }

  function saveFavourites() {
    T.store.set(FAV_KEY, JSON.stringify(favourites));
  }

  /* ---------- Market list ---------- */
  function filterByTab() {
    switch (activeTab) {
      case 'favourites':
        return coins.filter(function (c) { return favourites.indexOf(c.id) !== -1; });
      case 'hot':
        return coins.slice().sort(function (a, b) { return (b.total_volume || 0) - (a.total_volume || 0); }).slice(0, 8);
      case 'gainers':
        return coins.filter(function (c) { return change(c) > 0; })
          .sort(function (a, b) { return change(b) - change(a); }).slice(0, 8);
      case 'losers':
        return coins.filter(function (c) { return change(c) < 0; })
          .sort(function (a, b) { return change(a) - change(b); }).slice(0, 8);
      default:
        return coins.slice(0, 12);
    }
  }

  function buildCard(coin) {
    var card = make('article', 'coin-card');

    var src = safeImage(coin.image);
    if (src) {
      var img = new Image();
      img.className = 'coin-icon';
      img.src = src;
      img.alt = '';
      img.width = 40;
      img.height = 40;
      img.loading = 'lazy';
      card.appendChild(img);
    } else {
      card.appendChild(make('span', 'coin-icon'));
    }

    var meta = make('div', 'coin-meta');
    var heading = make('h3');
    var link = make('a', 'coin-link', coin.name);
    link.href = 'chart.html?coin=' + encodeURIComponent(coin.id);
    heading.appendChild(link);
    meta.appendChild(heading);
    meta.appendChild(make('span', 'coin-symbol', String(coin.symbol).toUpperCase()));
    card.appendChild(meta);

    var isFav = favourites.indexOf(coin.id) !== -1;
    var fav = make('button', 'fav-btn', isFav ? '★' : '☆');
    fav.type = 'button';
    fav.setAttribute('aria-pressed', String(isFav));
    fav.setAttribute('aria-label', (isFav ? 'Remove ' : 'Add ') + coin.name + (isFav ? ' from favourites' : ' to favourites'));
    fav.addEventListener('click', function () { toggleFavourite(coin); });
    card.appendChild(fav);

    var price = make('div', 'coin-price');
    price.appendChild(make('strong', '', T.fmtUSD(coin.current_price)));
    price.appendChild(T.setPill(make('span'), change(coin)));
    card.appendChild(price);

    return card;
  }

  function toggleFavourite(coin) {
    var index = favourites.indexOf(coin.id);
    if (index === -1) favourites.push(coin.id); else favourites.splice(index, 1);
    saveFavourites();
    render();
  }

  function render() {
    if (!loaded) return;
    var items = filterByTab();
    el.list.replaceChildren();

    if (!items.length) {
      el.list.appendChild(make('p', 'state-msg',
        activeTab === 'favourites'
          ? 'No favourites yet. Tap the star on any coin to add it here.'
          : 'Nothing to show right now.'));
      return;
    }

    var frag = document.createDocumentFragment();
    items.forEach(function (coin) { frag.appendChild(buildCard(coin)); });
    el.list.appendChild(frag);
  }

  function showSkeleton() {
    el.list.replaceChildren();
    for (var i = 0; i < 8; i++) el.list.appendChild(make('div', 'skeleton'));
  }

  function showError() {
    el.list.replaceChildren();
    var box = make('div', 'state-msg');
    box.appendChild(make('p', '', 'We couldn’t load market data. The free price API may be busy, so please try again in a moment.'));
    var retry = make('button', 'btn btn-primary', 'Try again');
    retry.type = 'button';
    retry.addEventListener('click', function () { showSkeleton(); load(); });
    box.appendChild(retry);
    el.list.appendChild(box);
    el.moodDetail.textContent = 'Unavailable right now.';
  }

  Array.prototype.forEach.call(el.tabs, function (tab) {
    tab.addEventListener('click', function () {
      Array.prototype.forEach.call(el.tabs, function (t) { t.setAttribute('aria-pressed', 'false'); });
      tab.setAttribute('aria-pressed', 'true');
      activeTab = tab.dataset.tab;
      render();
    });
  });

  /* ---------- Search ---------- */
  function closeResults() { el.results.hidden = true; }

  function runSearch() {
    var query = el.search.value.trim().toLowerCase();
    el.results.replaceChildren();

    if (!query) { closeResults(); return; }

    if (!loaded) {
      el.results.appendChild(make('p', 'search-empty', 'Loading coins…'));
    } else {
      var matches = coins.filter(function (c) {
        return c.name.toLowerCase().indexOf(query) !== -1 || String(c.symbol).toLowerCase().indexOf(query) !== -1;
      }).slice(0, 8);

      if (!matches.length) {
        el.results.appendChild(make('p', 'search-empty', 'No coins found.'));
      } else {
        matches.forEach(function (coin) {
          var item = make('a', 'search-item');
          item.href = 'chart.html?coin=' + encodeURIComponent(coin.id);
          var src = safeImage(coin.image);
          if (src) {
            var img = new Image();
            img.src = src;
            img.alt = '';
            img.width = 28;
            img.height = 28;
            item.appendChild(img);
          }
          item.appendChild(make('span', '', coin.name));
          item.appendChild(make('span', 'sym', String(coin.symbol).toUpperCase()));
          el.results.appendChild(item);
        });
      }
    }
    el.results.hidden = false;
  }

  el.search.addEventListener('input', runSearch);
  el.search.addEventListener('focus', function () { if (el.search.value.trim()) runSearch(); });
  el.search.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeResults();
    if (e.key === 'Enter') {
      var first = el.results.querySelector('.search-item');
      if (first) window.location.href = first.href;
    }
  });
  document.addEventListener('click', function (e) {
    if (!el.search.contains(e.target) && !el.results.contains(e.target)) closeResults();
  });

  /* ---------- Wallet (demo balances, live USD value) ---------- */
  function updateWallet() {
    var id = el.walletCoin.value;
    var holding = T.MOCK_BALANCES[id];
    if (!holding) return;
    el.walletAmount.textContent = holding.amount.toLocaleString('en-US', { maximumFractionDigits: 6 }) + ' ' + holding.symbol;
    var coin = byId[id];
    el.walletUsd.textContent = coin && typeof coin.current_price === 'number'
      ? '≈ ' + T.fmtUSD(holding.amount * coin.current_price)
      : '≈ —';
  }

  el.walletCoin.addEventListener('change', updateWallet);
  el.deposit.addEventListener('click', function () { T.toast('Demo wallet: deposits are disabled.'); });
  el.withdraw.addEventListener('click', function () { T.toast('Demo wallet: withdrawals are disabled.'); });

  /* ---------- Exchange calculator (uses the cached market prices, no extra API call) ---------- */
  function populateSelects() {
    var top = coins.slice(0, 30);
    [el.fromCoin, el.toCoin].forEach(function (select) {
      var previous = select.value;
      select.replaceChildren();
      top.forEach(function (coin) {
        var option = make('option', '', String(coin.symbol).toUpperCase());
        option.value = coin.id;
        select.appendChild(option);
      });
      var stillThere = top.some(function (c) { return c.id === previous; });
      select.value = stillThere ? previous : top[0].id;
    });
  }

  function calculate() {
    var from = byId[el.fromCoin.value];
    var to = byId[el.toCoin.value];
    if (!from || !to || !from.current_price || !to.current_price) {
      el.exResult.textContent = loaded ? '—' : '0';
      if (loaded) el.exRate.textContent = 'Rates are unavailable right now.';
      return;
    }
    var amount = parseFloat(el.fromAmount.value);
    if (!isFinite(amount) || amount < 0) amount = 0;

    var fromSym = String(from.symbol).toUpperCase();
    var toSym = String(to.symbol).toUpperCase();
    el.exResult.textContent = T.fmtAmount(amount * from.current_price / to.current_price);
    el.exSymbol.textContent = toSym;
    el.exRate.textContent = '1 ' + fromSym + ' = ' + T.fmtAmount(from.current_price / to.current_price) + ' ' + toSym + ' · indicative, before fees';
  }

  el.fromAmount.addEventListener('input', calculate);
  el.fromCoin.addEventListener('change', calculate);
  el.toCoin.addEventListener('change', calculate);
  el.swap.addEventListener('click', function () {
    var a = el.fromCoin.value;
    el.fromCoin.value = el.toCoin.value;
    el.toCoin.value = a;
    calculate();
  });

  /* ---------- Market snapshot ---------- */
  function setStat(node, coin, value, className) {
    node.textContent = String(coin.symbol).toUpperCase() + ' ' + value;
    node.className = className || '';
  }

  function updateSnapshot() {
    var withChange = coins.filter(function (c) { return change(c) !== null; });
    if (!withChange.length) return;

    var upCount = withChange.filter(function (c) { return change(c) > 0; }).length;
    var pct = Math.round(upCount / withChange.length * 100);
    el.moodLabel.textContent = pct >= 60 ? 'Bullish' : (pct <= 40 ? 'Bearish' : 'Neutral');
    el.moodLabel.className = pct >= 60 ? 'up' : (pct <= 40 ? 'down' : '');
    el.moodFill.style.width = pct + '%';
    el.moodDetail.textContent = upCount + ' of ' + withChange.length + ' coins are up over the last 24 hours.';

    var gainer = withChange.reduce(function (a, b) { return change(b) > change(a) ? b : a; });
    var loser = withChange.reduce(function (a, b) { return change(b) < change(a) ? b : a; });
    var volume = coins.reduce(function (a, b) { return (b.total_volume || 0) > (a.total_volume || 0) ? b : a; });

    setStat(el.topGainer, gainer, (change(gainer) >= 0 ? '+' : '') + change(gainer).toFixed(2) + '%', change(gainer) >= 0 ? 'up' : 'down');
    setStat(el.topLoser, loser, (change(loser) >= 0 ? '+' : '') + change(loser).toFixed(2) + '%', change(loser) >= 0 ? 'up' : 'down');
    setStat(el.topVolume, volume, T.fmtCompact(volume.total_volume));
  }

  /* ---------- Loading ---------- */
  function load() {
    return T.cachedFetch(MARKETS_URL, CACHE_MS)
      .then(function (data) {
        if (!Array.isArray(data)) throw new Error('Unexpected response');

        coins = data.filter(function (c) { return c && c.id && c.name && c.symbol; });
        byId = {};
        coins.forEach(function (c) { byId[c.id] = c; });

        var firstLoad = !loaded;
        loaded = true;
        if (firstLoad && coins.length) populateSelects();

        render();
        updateWallet();
        calculate();
        updateSnapshot();
        el.updated.textContent = 'Updated ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (el.search.value.trim()) runSearch();
      })
      .catch(function (err) {
        console.error('Error fetching prices:', err);
        if (!loaded) showError();
      });
  }

  showSkeleton();
  updateWallet();
  load();

  // Keep prices fresh while the tab is visible
  setInterval(function () { if (!document.hidden) load(); }, 60 * 1000);
})();