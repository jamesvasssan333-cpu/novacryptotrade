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
const tradeLimitPrice = document.getElementById('tradeLimitPrice');
const tradeProfit = document.getElementById('tradeProfit');
const tradeAvailable = document.getElementById('tradeAvailable');
const amountUnit = document.getElementById('amountUnit');
const mobileChart = document.getElementById('mobileChart');
const chartValue = document.getElementById('chartValue');
const chartScroll = document.getElementById('chartScroll');
const tradeMessage = document.getElementById('tradeMessage');
const authForm = document.getElementById('authForm');
const authName = document.getElementById('authName');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const authSubmit = document.getElementById('authSubmit');
const authMessage = document.getElementById('authMessage');
const paymentPanel = document.getElementById('paymentPanel');
const paymentMessage = document.getElementById('paymentMessage');
const receiptForm = document.getElementById('receiptForm');
const paymentReceipt = document.getElementById('paymentReceipt');
const appFundsForm = document.getElementById('appFundsForm');
const fundsAmount = document.getElementById('fundsAmount');
const fundsMessage = document.getElementById('fundsMessage');
const fundsSubmit = document.getElementById('fundsSubmit');
const withdrawFields = document.getElementById('withdrawFields');
const withdrawName = document.getElementById('withdrawName');
const withdrawAddress = document.getElementById('withdrawAddress');
const depositWallet = document.getElementById('depositWallet');
let markets = [];
let tradeSide = 'buy';
let authMode = 'login';
let chartRange = '1D';
let chartPrices = [];
let chartType = 'candles';
let fundsMode = 'deposit';

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
function setPaymentMessage(message, type = '') { paymentMessage.textContent = message; paymentMessage.className = `form-message ${type}`; }
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
function drawMobileChart() {
  if (!mobileChart) return;
  const context = mobileChart.getContext('2d');
  const width = mobileChart.clientWidth * window.devicePixelRatio;
  const height = mobileChart.clientHeight * window.devicePixelRatio;
  mobileChart.width = width; mobileChart.height = height; context.scale(window.devicePixelRatio, window.devicePixelRatio);
  const w = mobileChart.clientWidth; const h = mobileChart.clientHeight; const chartHeight = h * .78; const left = 8; const right = 42;
  context.clearRect(0, 0, w, h); context.fillStyle = '#050b09'; context.fillRect(0, 0, w, h);
  context.strokeStyle = 'rgba(142,230,200,.08)'; context.lineWidth = 1;
  for (let index = 1; index < 5; index += 1) { const y = chartHeight * index / 5; context.beginPath(); context.moveTo(left, y); context.lineTo(w - right, y); context.stroke(); }
  for (let index = 1; index < 7; index += 1) { const x = left + (w - left - right) * index / 7; context.beginPath(); context.moveTo(x, 0); context.lineTo(x, chartHeight); context.stroke(); }
  if (!chartPrices.length) return;
  const min = Math.min(...chartPrices) * .9995; const max = Math.max(...chartPrices) * 1.0005; const range = max - min || 1; const candleWidth = (w - left - right) / chartPrices.length;
  if (chartType === 'line') {
    context.strokeStyle = '#39d98a'; context.lineWidth = 2; context.beginPath();
    chartPrices.forEach((value, index) => { const x = left + index * candleWidth + candleWidth / 2; const y = chartHeight - ((value - min) / range) * (chartHeight - 15); if (!index) context.moveTo(x, y); else context.lineTo(x, y); });
    context.stroke();
  } else {
    chartPrices.forEach((value, index) => { const previous = chartPrices[index - 1] || value; const open = previous; const close = value; const high = Math.max(open, close) * 1.00025; const low = Math.min(open, close) * .99975; const x = left + index * candleWidth + candleWidth / 2; const y = (priceValue) => chartHeight - ((priceValue - min) / range) * (chartHeight - 15); const green = close >= open; context.strokeStyle = green ? '#39d98a' : '#ff6574'; context.fillStyle = context.strokeStyle; context.beginPath(); context.moveTo(x, y(high)); context.lineTo(x, y(low)); context.stroke(); const bodyTop = Math.min(y(open), y(close)); const bodyHeight = Math.max(2, Math.abs(y(open) - y(close))); context.fillRect(x - Math.max(1, candleWidth * .28), bodyTop, Math.max(2, candleWidth * .56), bodyHeight); });
  }
  const lastY = chartHeight - ((chartPrices.at(-1) - min) / range) * (chartHeight - 15); context.strokeStyle = '#ff9c39'; context.setLineDash([4, 3]); context.beginPath(); context.moveTo(left, lastY); context.lineTo(w - right, lastY); context.stroke(); context.setLineDash([]); context.fillStyle = '#ff9c39'; context.font = '10px sans-serif'; context.fillText(price(chartPrices.at(-1)), w - right + 3, lastY + 3);
  chartPrices.forEach((value, index) => { const x = left + index * candleWidth; const volumeHeight = 8 + (index % 5) * 3; context.fillStyle = value >= (chartPrices[index - 1] || value) ? 'rgba(57,217,138,.28)' : 'rgba(255,101,116,.28)'; context.fillRect(x, h - volumeHeight, Math.max(1, candleWidth * .5), volumeHeight); });
}

function refreshChart() { const market = selectedMarket(); if (!market.price) return; const points = chartRange === '1M' ? 40 : chartRange === '1W' ? 30 : 24; const last = Number(market.price); if (!chartPrices.length || chartPrices.length !== points) chartPrices = Array.from({ length: points }, (_, index) => last * (1 + Math.sin(index * 1.7) * .006 - (points - index) * .00025)); chartPrices = [...chartPrices.slice(1), last * (1 + (Math.random() - .48) * .002)]; chartValue.textContent = price(last); drawMobileChart(); }
function updateTrade() {
  const market = selectedMarket();
  const quantity = Number(tradeAmount.value || 0);
  const total = quantity * Number(market.price || 0);
  document.getElementById('tradePair').textContent = `${market.symbol} / USD`;
  tradePrice.textContent = `${price(market.price)} current market price`;
  tradeLimitPrice.value = Number(market.price || 0).toFixed(2);
  amountUnit.textContent = market.symbol;
  tradeTotal.textContent = money(total);
  tradeProfit.textContent = `+${money(total * 0.02)}`;
  tradeAvailable.textContent = availableValue.textContent;
  refreshChart();
}

async function loadMarkets() { try { markets = await apiRequest('/api/markets'); renderMarkets(markets); updateTrade(); } catch { tradePrice.textContent = 'Market unavailable'; } }
async function loadAccount() {
  const user = currentUser();
  if (!user) { appContent.hidden = true; guestCard.hidden = false; paymentPanel.hidden = true; return; }
  userName.textContent = user.name?.split(' ')[0] || 'Trader'; logoutButton.hidden = false;
  try {
    const payments = await apiRequest('/payments');
    const payment = payments[user.email.toLowerCase()];
    if (payment?.status !== 'approved') {
      appContent.hidden = true; guestCard.hidden = false; authForm.hidden = true; document.getElementById('guestLogin').hidden = true; paymentPanel.hidden = false;
      setPaymentMessage(payment?.status === 'pending' ? 'Receipt received. Your account is waiting for owner approval.' : 'Complete payment and upload your receipt to unlock trading.', payment?.status === 'pending' ? 'success' : '');
      return;
    }
    guestCard.hidden = true; paymentPanel.hidden = true; appContent.hidden = false;
    const [balance, portfolio] = await Promise.all([apiRequest(`/api/balance/${userEmail()}`), apiRequest(`/api/portfolio/${userEmail()}`)]);
    balanceValue.textContent = money(balance.balance); availableValue.textContent = money(balance.balance); portfolioValue.textContent = money(portfolio.totalValue); portfolioUpdated.textContent = portfolio.updatedAt ? `Updated ${new Date(portfolio.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'No holdings yet';
    const assets = portfolio.assets || [];
    document.getElementById('holdingList').innerHTML = assets.length ? assets.map((item) => `<button class="holding-row" data-symbol="${item.asset}" type="button"><span class="coin-dot ${item.asset.toLowerCase()}">${item.asset[0]}</span><div><strong>${item.asset}</strong><small>${item.quantity} units</small></div><div class="row-price"><strong>${money(item.value)}</strong><small>${Number(item.change24h || 0).toFixed(2)}%</small></div></button>`).join('') : '<p class="form-message">No holdings yet. Place your first trade.</p>';
  } catch { tradeMessage.textContent = 'Account data is temporarily unavailable.'; }
}

document.querySelectorAll('[data-go]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.go)));
document.addEventListener('click', (event) => { const target = event.target.closest('[data-symbol]'); if (target && assetSelect) { assetSelect.value = target.dataset.symbol; updateTrade(); showView('trade'); } });
marketSearch?.addEventListener('input', () => renderMarkets(markets));
assetSelect?.addEventListener('change', updateTrade);
tradeAmount?.addEventListener('input', updateTrade);
document.querySelectorAll('[data-step]').forEach((button) => button.addEventListener('click', () => {
  if (button.dataset.step === 'price') return;
  const current = Number(tradeAmount.value || 0);
  const increment = current < 0.01 ? 0.001 : current < 1 ? 0.01 : 0.1;
  tradeAmount.value = Math.max(0, current + (button.dataset.direction === 'up' ? increment : -increment)).toFixed(8);
  updateTrade();
}));
document.querySelectorAll('[data-quick-amount]').forEach((button) => button.addEventListener('click', () => {
  tradeAmount.value = button.dataset.quickAmount;
  updateTrade();
}));
document.querySelectorAll('[data-chart-range]').forEach((button) => button.addEventListener('click', () => { chartRange = button.dataset.chartRange; document.querySelectorAll('[data-chart-range]').forEach((item) => item.classList.toggle('active', item === button)); chartPrices = []; refreshChart(); }));
document.querySelectorAll('[data-chart-type]').forEach((button) => button.addEventListener('click', () => { chartType = button.dataset.chartType; document.querySelectorAll('[data-chart-type]').forEach((item) => item.classList.toggle('active', item === button)); drawMobileChart(); }));
let chartDragging = false;
let chartDragStart = 0;
let chartScrollStart = 0;
chartScroll?.addEventListener('pointerdown', (event) => { chartDragging = true; chartDragStart = event.clientX; chartScrollStart = chartScroll.scrollLeft; chartScroll.setPointerCapture(event.pointerId); });
chartScroll?.addEventListener('pointermove', (event) => { if (chartDragging) chartScroll.scrollLeft = chartScrollStart - (event.clientX - chartDragStart); });
chartScroll?.addEventListener('pointerup', () => { chartDragging = false; });
chartScroll?.addEventListener('pointercancel', () => { chartDragging = false; });
window.addEventListener('resize', drawMobileChart);
document.querySelectorAll('[data-side]').forEach((button) => button.addEventListener('click', () => { tradeSide = button.dataset.side; document.querySelectorAll('[data-side]').forEach((item) => item.classList.toggle('active', item === button)); updateTrade(); }));
document.querySelectorAll('[data-funds-mode]').forEach((button) => button.addEventListener('click', () => { fundsMode = button.dataset.fundsMode; document.querySelectorAll('[data-funds-mode]').forEach((item) => item.classList.toggle('active', item === button)); withdrawFields.hidden = fundsMode !== 'withdraw'; depositWallet.hidden = fundsMode !== 'deposit'; fundsSubmit.textContent = fundsMode === 'withdraw' ? 'Request withdrawal' : 'I have sent my deposit'; fundsMessage.textContent = ''; }));
document.getElementById('depositWalletCopy')?.addEventListener('click', async () => { await navigator.clipboard.writeText('bc1qatftjrjuatufzakjjle666gg69ufztft4u0rxw'); fundsMessage.textContent = 'Deposit wallet address copied.'; });
logoutButton?.addEventListener('click', () => { localStorage.removeItem(currentUserKey); window.location.reload(); });
document.getElementById('guestLogin')?.addEventListener('click', () => { authForm.hidden = false; document.getElementById('guestLogin').hidden = true; authEmail.focus(); });
document.getElementById('copyWallet')?.addEventListener('click', async () => { await navigator.clipboard.writeText('bc1qatftjrjuatufzakjjle666gg69ufztft4u0rxw'); setPaymentMessage('Wallet address copied.', 'success'); });
document.getElementById('showReceipt')?.addEventListener('click', () => { receiptForm.hidden = false; paymentReceipt.focus(); });
document.getElementById('switchAccount')?.addEventListener('click', () => { localStorage.removeItem(currentUserKey); window.location.reload(); });
receiptForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const user = currentUser(); const receipt = paymentReceipt.files[0];
  if (!user || !receipt) return;
  if (receipt.size > 5 * 1024 * 1024) { setPaymentMessage('Receipt must be smaller than 5 MB.', 'error'); return; }
  const receiptData = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.addEventListener('load', () => resolve(reader.result)); reader.addEventListener('error', reject); reader.readAsDataURL(receipt); });
  try {
    const payments = await apiRequest('/payments');
    payments[user.email.toLowerCase()] = { plan: 'Pro', price: '0.00050000 BTC', paymentMethod: 'crypto', walletAddress: 'bc1qatftjrjuatufzakjjle666gg69ufztft4u0rxw', walletNetwork: 'Bitcoin (BTC)', cryptoAmount: 0.0005, receiptName: receipt.name, receiptType: receipt.type || 'application/octet-stream', receiptData, status: 'pending', submittedAt: new Date().toISOString(), paymentNote: '' };
    await apiRequest('/payments', { method: 'PUT', body: JSON.stringify(payments) });
    receiptForm.reset(); setPaymentMessage('Receipt sent. Trading will unlock after owner approval.', 'success');
  } catch { setPaymentMessage('Could not send receipt. Check your connection and try again.', 'error'); }
});
appFundsForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const user = currentUser();
  const amount = Number(fundsAmount.value);
  if (!user || !amount || amount <= 0) { fundsMessage.textContent = 'Enter a valid amount.'; return; }
  if (fundsMode === 'withdraw' && (!withdrawName.value.trim() || !withdrawAddress.value.trim())) { fundsMessage.textContent = 'Enter your name and wallet address.'; return; }
  fundsMessage.textContent = 'Sending request...';
  try {
    await apiRequest('/api/funds', { method: 'POST', body: JSON.stringify({ email: user.email, amount, mode: fundsMode, method: 'crypto', walletNetwork: 'bitcoin', withdrawalName: withdrawName.value.trim(), withdrawalAddress: withdrawAddress.value.trim(), withdrawalNetwork: 'bitcoin' }) });
    fundsMessage.textContent = fundsMode === 'withdraw' ? 'Withdrawal request sent for owner review.' : 'Deposit request sent. It will be added after approval.';
    appFundsForm.reset();
  } catch (error) {
    fundsMessage.textContent = error.message.includes('400') ? (fundsMode === 'withdraw' ? 'Withdrawal locked: you need $500 approved deposits and 10 trades.' : 'Deposit request could not be sent.') : 'Could not connect to the funds service.';
  }
});
document.querySelectorAll('[data-auth-mode]').forEach((button) => button.addEventListener('click', () => setAuthMode(button.dataset.authMode)));
authForm?.addEventListener('submit', authenticate);
document.getElementById('refreshButton')?.addEventListener('click', () => Promise.all([loadMarkets(), loadAccount()]));
document.getElementById('tradeForm')?.addEventListener('submit', async (event) => { event.preventDefault(); const user = currentUser(); if (!user) { tradeMessage.textContent = 'Open an account before trading.'; return; } const market = selectedMarket(); const amount = Number(tradeAmount.value); if (!amount || amount <= 0 || !market.price) { tradeMessage.textContent = 'Enter a valid amount.'; return; } const quantity = amount / market.price; const total = amount; tradeMessage.textContent = 'Submitting order...'; try { await apiRequest('/api/orders', { method: 'POST', body: JSON.stringify({ userEmail: user.email, asset: market.symbol, side: tradeSide, orderType: 'Market', amount: quantity, price: market.price, total }) }); tradeMessage.textContent = `${tradeSide === 'buy' ? 'Buy' : 'Sell'} order placed for ${quantity.toFixed(8)} ${market.symbol}.`; tradeAmount.value = ''; updateTrade(); loadAccount(); } catch (error) { tradeMessage.textContent = error.message.includes('400') ? 'Order rejected. Check your balance or holdings.' : 'Order could not be placed. Try again.'; } });

loadAccount();
loadMarkets();
window.setInterval(refreshChart, 2500);
