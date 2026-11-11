/* Tradepto shared helpers: theme, navigation drawer, toasts, formatting, cached fetch.
   Loaded in <head> on every page so the saved theme is applied before first paint. */
(function () {
  'use strict';

  var THEME_KEY = 'mode';
  var root = document.documentElement;

  /* ---------- Safe storage (never throws in private mode / when full) ---------- */
  var store = {
    get: function (key) {
      try { return window.localStorage.getItem(key); } catch (e) { return null; }
    },
    set: function (key, value) {
      try { window.localStorage.setItem(key, value); return true; } catch (e) { return false; }
    },
    remove: function (key) {
      try { window.localStorage.removeItem(key); } catch (e) { /* ignore */ }
    }
  };

  /* ---------- Theme: one source of truth (data-theme on <html>) ---------- */
  function currentTheme() {
    return root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
  }

  applyTheme(store.get(THEME_KEY) === 'light' ? 'light' : 'dark');

  function syncToggles() {
    var isDark = currentTheme() === 'dark';
    var icon = isDark ? '🌙' : '☀️';
    var buttons = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      if (btn.hasAttribute('data-theme-label')) {
        btn.textContent = icon + ' ' + (isDark ? 'Dark mode' : 'Light mode');
      } else {
        btn.textContent = icon;
        btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
        btn.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
      }
    }
  }

  function setTheme(theme) {
    applyTheme(theme);
    store.set(THEME_KEY, theme);
    syncToggles();
    document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: theme } }));
  }

  /* ---------- Formatting ---------- */
  function fmtUSD(n) {
    if (typeof n !== 'number' || !isFinite(n)) return '—';
    var abs = Math.abs(n);
    var digits = abs >= 1 ? 2 : (abs >= 0.01 ? 4 : 8);
    return n.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: digits
    });
  }

  function fmtCompact(n) {
    if (typeof n !== 'number' || !isFinite(n)) return '—';
    return n.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 2
    });
  }

  function fmtAmount(n) {
    if (typeof n !== 'number' || !isFinite(n)) return '—';
    var abs = Math.abs(n);
    var digits = abs >= 1000 ? 2 : (abs >= 1 ? 4 : 8);
    return n.toLocaleString('en-US', { maximumFractionDigits: digits });
  }

  /* Sets text + colour class on a .pill element from a 24h % change */
  function setPill(el, pct) {
    if (!el) return el;
    el.className = 'pill';
    if (typeof pct !== 'number' || !isFinite(pct)) {
      el.classList.add('flat');
      el.textContent = '—';
      return el;
    }
    var up = pct >= 0;
    el.classList.add(up ? 'up' : 'down');
    el.textContent = (up ? '▲ ' : '▼ ') + Math.abs(pct).toFixed(2) + '%';
    el.title = '24h change';
    return el;
  }

  /* ---------- Cached fetch: protects the free CoinGecko API from rate limits ---------- */
  function cachedFetch(url, ttl) {
    var key = 'tp:cache:' + url;
    var stale = null;

    try {
      var raw = window.sessionStorage.getItem(key);
      if (raw) {
        stale = JSON.parse(raw);
        if (Date.now() - stale.t < ttl) return Promise.resolve(stale.d);
      }
    } catch (e) { stale = null; }

    return fetch(url)
      .then(function (res) {
        if (!res.ok) {
          var err = new Error('HTTP ' + res.status);
          err.status = res.status;
          throw err;
        }
        return res.json();
      })
      .then(function (data) {
        try {
          window.sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), d: data }));
        } catch (e) { /* storage full: skip caching */ }
        return data;
      })
      .catch(function (err) {
        if (stale) return stale.d; // fall back to older data rather than show nothing
        throw err;
      });
  }

  /* ---------- Toasts ---------- */
  function toast(message, type) {
    var region = document.getElementById('toast-region');
    if (!region) return;
    var item = document.createElement('div');
    item.className = 'toast' + (type === 'error' ? ' error' : '');
    item.textContent = message;
    region.appendChild(item);
    setTimeout(function () {
      item.classList.add('leaving');
      setTimeout(function () { item.remove(); }, 300);
    }, 3800);
  }

  /* ---------- Demo wallet holdings (shared by dashboard and profile) ---------- */
  var MOCK_BALANCES = {
    bitcoin: { symbol: 'BTC', amount: 1.234 },
    ethereum: { symbol: 'ETH', amount: 12.5 },
    tether: { symbol: 'USDT', amount: 2500 }
  };

  /* ---------- Navigation drawer ---------- */
  function initNav() {
    var toggle = document.getElementById('menu-toggle');
    var sidebar = document.getElementById('sidebar');
    var closeBtn = document.getElementById('sidebar-close');
    var backdrop = document.getElementById('backdrop');
    if (!toggle || !sidebar || !backdrop) return;

    function open() {
      sidebar.classList.add('open');
      backdrop.classList.add('show');
      toggle.setAttribute('aria-expanded', 'true');
      document.body.classList.add('no-scroll');
      if (closeBtn) closeBtn.focus();
    }

    function close(returnFocus) {
      if (!sidebar.classList.contains('open')) return;
      sidebar.classList.remove('open');
      backdrop.classList.remove('show');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('no-scroll');
      if (returnFocus) toggle.focus();
    }

    toggle.addEventListener('click', function () {
      if (sidebar.classList.contains('open')) close(true); else open();
    });
    if (closeBtn) closeBtn.addEventListener('click', function () { close(true); });
    backdrop.addEventListener('click', function () { close(false); });

    sidebar.addEventListener('click', function (e) {
      if (e.target.closest('a')) close(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close(true);
    });

    var desktop = window.matchMedia('(min-width: 769px)');
    var onChange = function (e) { if (e.matches) close(false); };
    if (desktop.addEventListener) desktop.addEventListener('change', onChange);
    else if (desktop.addListener) desktop.addListener(onChange);
  }

  /* ---------- Boot ---------- */
  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    // Theme buttons: one delegated listener, so no button can ever be wired twice
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-theme-toggle]')) {
        setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
      }
    });
    syncToggles();

    var region = document.createElement('div');
    region.id = 'toast-region';
    region.className = 'toast-region';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    document.body.appendChild(region);

    var years = document.querySelectorAll('[data-year]');
    for (var i = 0; i < years.length; i++) years[i].textContent = new Date().getFullYear();

    initNav();
  });

  window.Tradepto = {
    store: store,
    currentTheme: currentTheme,
    fmtUSD: fmtUSD,
    fmtCompact: fmtCompact,
    fmtAmount: fmtAmount,
    setPill: setPill,
    cachedFetch: cachedFetch,
    toast: toast,
    MOCK_BALANCES: MOCK_BALANCES
  };
})();