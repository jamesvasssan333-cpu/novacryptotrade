const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:3001' : 'https://novacryptotrade.onrender.com';
const currentUserKey = 'novacrypto_current_user';
const appContent = document.getElementById('appContent');
const guestCard = document.getElementById('guestCard');
const logoutButton = document.getElementById('logoutButton');
const userName = document.getElementById('userName');
const balanceValue = document.getElementById('balanceValue');
const availableValue = document.getElementById('availableValue');
const portfolioValue = document.getElementById('portfolioValue');
const portfolioUpdated = document.getElementById('portfolioUpdated');
const homeMarkets = document.getElementById('homeMarkets');
const marketList = document.getElementById('marketList');
const marketSearch = document.getElementById('marketSearch');
const assetSelect = document.getElementById('assetSelect');
const tradePrice = document.getElementById('tradePrice');
const tradeAmount = document.getElementById('tradeAmount');
const tradeTotal = document.getElementById('tradeTotal');
const tradeMessage = document.getElementById('tradeMessage');
const authForm = document.getElementById('authForm');
const authName = document.getElementById('authName');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const authSubmit = document.getElementById('authSubmit');
const authMessage = document.getElementById('authMessage');
let markets = [];
let tradeSide = 'buy';
let authMode = 'login';

function currentUser() {
  try { return JSON.parse(localStorage.getItem(currentUserKey) || 'null'); } catch { return null; }
}

async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.status === 204 ? null : response.json();
}

function money(value) { return `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function price(value) { return `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`; }
function userEmail() { return encodeURIComponent(currentUser()?.email || ''); }

function setAuthMessage(message, type = '') { authMessage.textContent = message; authMessage.className = `form-message ${type}`; }
function setAuthMode(mode) {
  authMode = mode;
  document.querySelectorAll('[data-auth-mode]').forEach((button) => button.classList.toggle('active', button.dataset.authMode === mode));
  document.querySelector('.auth-name-field').hidden = mode !== 'signup';
  authName.required = mode === 'signup';
  authPassword.autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
  authSubmit.textContent = mode === 'signup' ? 'Create account' : 'Sign in';
  setAuthMessage('');
}

async function authenticate(event) {
  event.preventDefault();
  const email = authEmail.value.trim().toLowerCase();
  const password = authPassword.value;
  try {
    const users = await apiRequest('/users');
    if (authMode === 'login') {
      const user = users.find((item) => item.email.toLowerCase() === email && item.password === password);
      if (!user) { setAuthMessage('Incorrect email or password.', 'error'); return; }
      localStorage.setItem(currentUserKey, JSON.stringify({ name: user.name, email: user.email }));
    } else {
      if (!authName.value.trim()) { setAuthMessage('Enter your full name.', 'error'); return; }
      if (users.some((item) => item.email.toLowerCase() === email)) { setAuthMessage('An account with this email already exists.', 'error'); return; }
      const user = { name: authName.value.trim(), email, password };
      const response = await apiRequest('/users', { method: 'POST', body: JSON.stringify(user) });
      localStorage.setItem(currentUserKey, JSON.stringify({ name: response.name || user.name, email }));
    }
    authForm.reset();
    authForm.hidden = true;
    guestCard.hidden = true;
    appContent.hidden = false;
    await loadAccount();
  } catch (error) {
    setAuthMessage(error.message.includes('409') ? 'An account with this email already exists.' : 'Could not connect to the account service.', 'error');
  }
}

function showView(name) {
  document.querySelectorAll('[data-view]').forEach((view) => view.classList.toggle('active', view.dataset.view === name));
  document.querySelectorAll('[data-go]').forEach((button) => button.classList.toggle('active', button.dataset.go === name));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderMarkets(items) {
  const filtered = items.filter((item) => `${item.symbol} ${item.name}`.toLowerCase().includes((marketSearch?.value || '').toLowerCase()));
  const row = (item) => `<div class="market-row" data-symbol="${item.symbol}"><span class="coin-dot ${item.symbol.toLowerCase()}">${item.symbol[0]}</span><div><strong>${item.symbol} / USD</strong><small>${item.name}</small></div><div class="row-price"><strong>${price(item.price)}</strong><small class="${Number(item.change24h) >= 0 ? 'up' : 'down'}">${Number(item.change24h || 0) >= 0 ? '+' : ''}${Number(item.change24h || 0).toFixed(2)}%</small></div></div>`;
  if (marketList) marketList.innerHTML = filtered.map(row).join('') || '<p class="form-message">No assets found.</p>';
  if (homeMarkets) homeMarkets.innerHTML = items.slice(0, 3).map((item) => `<button class="market-chip" data-symbol="${item.symbol}" type="button"><strong>${item.symbol}</strong><small>${price(item.price)}</small><small class="${Number(item.change24h) >= 0 ? 'up' : 'down'}">${Number(item.change24h || 0) >= 0 ? '+' : ''}${Number(item.change24h || 0).toFixed(2)}%</small></button>`).join('');
}

function selectedMarket() { return markets.find((item) => item.symbol === assetSelect?.value) || markets[0] || { symbol: 'BTC', price: 0 }; }
function updateTrade() { const market = selectedMarket(); document.getElementById('tradePair').textContent = `${market.symbol} / USD`; tradePrice.textContent = price(market.price); tradeTotal.textContent = money(tradeAmount.value || 0); }

async function loadMarkets() { try { markets = await apiRequest('/api/markets'); renderMarkets(markets); updateTrade(); } catch { tradePrice.textContent = 'Market unavailable'; } }
async function loadAccount() {
  const user = currentUser();
  if (!user) { appContent.hidden = true; guestCard.hidden = false; return; }
  userName.textContent = user.name?.split(' ')[0] || 'Trader'; logoutButton.hidden = false;
  try {
    const [balance, portfolio] = await Promise.all([apiRequest(`/api/balance/${userEmail()}`), apiRequest(`/api/portfolio/${userEmail()}`)]);
    balanceValue.textContent = money(balance.balance); availableValue.textContent = money(balance.balance); portfolioValue.textContent = money(portfolio.totalValue); portfolioUpdated.textContent = portfolio.updatedAt ? `Updated ${new Date(portfolio.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'No holdings yet';
    const assets = portfolio.assets || [];
    document.getElementById('holdingList').innerHTML = assets.length ? assets.map((item) => `<a class="holding-row" href="trading-dashboard.htm?symbol=${item.asset}"><span class="coin-dot ${item.asset.toLowerCase()}">${item.asset[0]}</span><div><strong>${item.asset}</strong><small>${item.quantity} units</small></div><div class="row-price"><strong>${money(item.value)}</strong><small>${Number(item.change24h || 0).toFixed(2)}%</small></div></a>`).join('') : '<p class="form-message">No holdings yet. Place your first trade.</p>';
  } catch { tradeMessage.textContent = 'Account data is temporarily unavailable.'; }
}

document.querySelectorAll('[data-go]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.go)));
document.addEventListener('click', (event) => { const target = event.target.closest('[data-symbol]'); if (target && assetSelect) { assetSelect.value = target.dataset.symbol; updateTrade(); showView('trade'); } });
marketSearch?.addEventListener('input', () => renderMarkets(markets));
assetSelect?.addEventListener('change', updateTrade);
tradeAmount?.addEventListener('input', updateTrade);
document.querySelectorAll('[data-side]').forEach((button) => button.addEventListener('click', () => { tradeSide = button.dataset.side; document.querySelectorAll('[data-side]').forEach((item) => item.classList.toggle('active', item === button)); }));
logoutButton?.addEventListener('click', () => { localStorage.removeItem(currentUserKey); window.location.reload(); });
document.getElementById('guestLogin')?.addEventListener('click', () => { authForm.hidden = false; document.getElementById('guestLogin').hidden = true; authEmail.focus(); });
document.querySelectorAll('[data-auth-mode]').forEach((button) => button.addEventListener('click', () => setAuthMode(button.dataset.authMode)));
authForm?.addEventListener('submit', authenticate);
document.getElementById('refreshButton')?.addEventListener('click', () => Promise.all([loadMarkets(), loadAccount()]));
document.getElementById('tradeForm')?.addEventListener('submit', async (event) => { event.preventDefault(); const user = currentUser(); if (!user) { tradeMessage.textContent = 'Open an account before trading.'; return; } const market = selectedMarket(); const amount = Number(tradeAmount.value); if (!amount || amount <= 0) { tradeMessage.textContent = 'Enter a valid amount.'; return; } try { await apiRequest('/api/orders', { method: 'POST', body: JSON.stringify({ userEmail: user.email, asset: market.symbol, side: tradeSide, orderType: 'Market', amount: amount / market.price, price: market.price, total: amount }) }); tradeMessage.textContent = `${tradeSide === 'buy' ? 'Buy' : 'Sell'} order placed.`; tradeAmount.value = ''; updateTrade(); loadAccount(); } catch { tradeMessage.textContent = 'Order could not be placed. Check your balance.'; } });

loadAccount();
loadMarkets();
