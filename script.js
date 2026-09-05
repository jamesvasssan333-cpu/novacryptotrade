const header = document.querySelector('.site-header');
const menuToggle = document.querySelector('.menu-toggle');
const navLinks = document.querySelectorAll('.main-nav a');
const yearElement = document.getElementById('year');
const authModal = document.getElementById('authModal');
const authMessage = document.getElementById('authMessage');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const paymentForm = document.getElementById('paymentForm');
const paymentPlanName = document.getElementById('paymentPlanName');
const paymentPlanPrice = document.getElementById('paymentPlanPrice');
const payWithWalletButton = document.getElementById('payWithWallet');
const receiptStep = document.getElementById('receiptStep');
const paymentReceipt = document.getElementById('paymentReceipt');
const tabButtons = document.querySelectorAll('.tab-btn');
const TRUST_WALLET_ADDRESS = 'bc1qatftjrjuatufzakjjle666gg69ufztft4u0rxw';
const TRUST_WALLET_NETWORK = 'Bitcoin (BTC)';
const PAYMENT_BTC_AMOUNT = 0.0005;
const API_BASE_URL = 'http://localhost:3001';
const authTriggers = document.querySelectorAll('.auth-trigger');
const paymentTriggers = document.querySelectorAll('.payment-trigger');
const tradeForm = document.getElementById('tradeForm');
const tradeAssetSelect = tradeForm?.querySelector('select[name="asset"]');
const amountInput = tradeForm?.querySelector('input[name="amount"]');
const estimatedTotal = document.getElementById('estimatedTotal');
const tradeTypes = document.querySelectorAll('.trade-type');
const userNameLabel = document.getElementById('userNameLabel');
const logoutBtn = document.getElementById('logoutBtn');
const tradingDashboard = document.getElementById('trading');
const chartTimeframes = document.querySelectorAll('[data-timeframe]');
const chartChange = document.getElementById('chartChange');
const chartHigh = document.getElementById('chartHigh');
const chartLow = document.getElementById('chartLow');
const chartPrice = document.getElementById('chartPrice');
const liveStatus = document.getElementById('liveStatus');
const chartLine = document.getElementById('chartLine');
const chartArea = document.getElementById('chartArea');
const livePriceTrace = document.getElementById('livePriceTrace');
const chartDot = document.querySelector('.chart-dot');
const historicalCandles = document.getElementById('historicalCandles');
const chartWrap = document.querySelector('.chart-wrap');
const chartSvg = document.querySelector('.chart-svg');
const chartScrollButtons = document.querySelectorAll('[data-chart-scroll]');
const chartTools = document.querySelectorAll('[data-chart-tool]');
const drawingTools = document.querySelectorAll('[data-drawing-tool]');
const drawingActions = document.querySelectorAll('[data-drawing-action]');
const drawingLayer = document.getElementById('drawingLayer');
const instrumentPicker = document.getElementById('instrumentPicker');
const instrumentName = document.getElementById('instrumentName');
const instrumentDot = document.getElementById('instrumentDot');
const terminalToast = document.getElementById('terminalToast');
const fundsModal = document.getElementById('fundsModal');
const fundsForm = document.getElementById('fundsForm');
const fundsTitle = document.getElementById('fundsTitle');
const fundsSubmit = document.getElementById('fundsSubmit');
const fundsMessage = document.getElementById('fundsMessage');
const accountBalance = document.getElementById('accountBalance');
const availableBalance = document.getElementById('availableBalance');
const bookPrice = document.getElementById('bookPrice');
const fundsTabs = document.querySelectorAll('.funds-tab');
const fundsTriggers = document.querySelectorAll('[data-funds-mode]');
const fundsMethod = document.getElementById('fundsMethod');
const cardDetails = document.getElementById('cardDetails');
const cryptoDetails = document.getElementById('cryptoDetails');
const withdrawalDetails = document.getElementById('withdrawalDetails');
const BTC_DEPOSIT_ADDRESS = 'bc1qatftjrjuatufzakjjle666gg69ufztft4u0rxw';
let liveState = null;
let serverMarkets = {};
let liveTracePoints = [];
let animatedCandles = [];
let candleMotion = 0;
let authReturnFocus = null;
let approvalPollTimer = null;

const USERS_KEY = 'novacrypto_users';
const CURRENT_USER_KEY = 'novacrypto_current_user';
const PAYMENTS_KEY = 'novacrypto_payments';
const PAYMENT_REQUIRED_KEY = 'novacrypto_payment_required';
const BALANCES_KEY = 'novacrypto_balances';

if (fundsModal) {
  document.body.appendChild(fundsModal);
}
const DASHBOARD_PATH = 'trading-dashboard.htm';
const DRAWINGS_KEY = 'novacrypto_chart_drawings';
let drawingMode = 'cursor';
let drawingStart = null;
let drawingPreview = null;
let chartDrawings = [];

if (yearElement) {
  yearElement.textContent = new Date().getFullYear();
}

if (menuToggle) {
  menuToggle.addEventListener('click', () => {
    const isOpen = header.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(isOpen));
  });
}

navLinks.forEach((link) => {
  link.addEventListener('click', () => {
    header.classList.remove('open');
    menuToggle?.setAttribute('aria-expanded', 'false');
  });
});

async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function loadServerMarkets() {
  try {
    const markets = await apiRequest('/api/markets');
    serverMarkets = markets.reduce((result, market) => {
      result[market.symbol] = {
        price: Number(market.price),
        high: Number(market.price) * 1.02,
        low: Number(market.price) * 0.98,
        change: 0
      };
      return result;
    }, {});
    if (instrumentPicker?.value) renderMarketReading(serverMarkets[instrumentPicker.value] || marketDefaults[instrumentPicker.value]);
  } catch (error) {
    console.warn('Could not load server market prices:', error);
  }
}

function formatCompactMarketValue(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return '--';
  if (number >= 1e12) return `$${(number / 1e12).toFixed(2)}T`;
  if (number >= 1e9) return `$${(number / 1e9).toFixed(2)}B`;
  if (number >= 1e6) return `$${(number / 1e6).toFixed(2)}M`;
  if (number >= 1000) return `$${(number / 1000).toFixed(2)}K`;
  return formatMarketPrice(number);
}

function setupMarketsPage() {
  const rows = document.querySelectorAll('[data-market-symbol]');
  if (!rows.length) return;

  const updateRows = async () => {
    try {
      const markets = await apiRequest('/api/markets');
      const updatedAt = markets.find((market) => market.updatedAt)?.updatedAt;
      const updatedLabel = document.getElementById('marketUpdated');
      if (updatedLabel) {
        updatedLabel.textContent = updatedAt
          ? `Live ${new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
          : 'Live market';
      }

      markets.forEach((market) => {
        const row = document.querySelector(`[data-market-symbol="${market.symbol}"]`);
        if (!row) return;
        const price = row.querySelector('[data-market-price]');
        const change = row.querySelector('[data-market-change]');
        const volume = row.querySelector('[data-market-volume]');
        const cap = row.querySelector('[data-market-cap]');
        if (price) price.textContent = formatMarketPrice(Number(market.price));
        if (change) {
          const value = Number(market.change24h || 0);
          change.textContent = `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
          change.classList.toggle('up', value >= 0);
          change.classList.toggle('down', value < 0);
        }
        if (volume) volume.textContent = formatCompactMarketValue(market.volume24h);
        if (cap) cap.textContent = formatCompactMarketValue(market.marketCap);
      });
    } catch (error) {
      console.warn('Could not refresh spot markets:', error);
    }
  };

  const openMarket = (row) => {
    window.location.href = `trading-dashboard.htm?symbol=${encodeURIComponent(row.dataset.marketSymbol)}`;
  };

  rows.forEach((row) => {
    row.addEventListener('click', () => openMarket(row));
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openMarket(row);
      }
    });
  });

  updateRows();
  window.setInterval(updateRows, 15000);
}

function setupPortfolioPage() {
  const holdingsList = document.getElementById('holdingsList');
  if (!holdingsList) return;

  const currentUser = localStorage.getItem(CURRENT_USER_KEY);
  if (!currentUser) return;

  const coinNames = {
    BTC: 'Bitcoin', ETH: 'Ethereum', SOL: 'Solana', ADA: 'Cardano', XRP: 'XRP',
    DOGE: 'Dogecoin', BNB: 'BNB', LINK: 'Chainlink', AVAX: 'Avalanche',
    NEAR: 'NEAR Protocol', ARB: 'Arbitrum', TON: 'Toncoin'
  };
  const coinClasses = {
    BTC: 'btc', ETH: 'eth', SOL: 'sol', ADA: 'ada', XRP: 'purple', DOGE: 'gold',
    BNB: 'blue', LINK: 'purple', AVAX: 'orange', NEAR: 'teal', ARB: 'pink', TON: 'green'
  };

  const renderPortfolio = (portfolio) => {
    const total = document.getElementById('portfolioTotal');
    const cash = document.getElementById('portfolioCash');
    const invested = document.getElementById('portfolioInvested');
    const updated = document.getElementById('portfolioUpdated');
    const meters = document.getElementById('allocationMeters');
    const orders = document.getElementById('portfolioOrders');
    if (total) total.textContent = formatMarketPrice(portfolio.totalValue);
    if (cash) cash.textContent = formatMarketPrice(portfolio.cashBalance);
    if (invested) invested.textContent = formatMarketPrice(portfolio.holdingsValue);
    if (updated) updated.textContent = portfolio.updatedAt ? new Date(portfolio.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--';

    holdingsList.replaceChildren();
    if (!portfolio.assets.length) {
      holdingsList.innerHTML = '<p class="portfolio-empty">No assets held yet. Buy an asset from the trading dashboard to see it here.</p>';
    } else {
      portfolio.assets.forEach((item) => {
        const row = document.createElement('a');
        row.className = 'holding-row';
        row.href = `trading-dashboard.htm?symbol=${encodeURIComponent(item.asset)}`;
        row.innerHTML = `<div class="asset"><span class="coin-dot ${coinClasses[item.asset] || 'btc'}"></span> ${coinNames[item.asset] || item.asset}</div><div><strong>${item.quantity} ${item.asset}</strong><small>${formatMarketPrice(item.value)} <span class="trend ${item.change24h >= 0 ? 'up' : 'down'}">${item.change24h >= 0 ? '+' : ''}${item.change24h.toFixed(2)}%</span></small></div>`;
        holdingsList.append(row);
      });
    }

    meters.replaceChildren();
    portfolio.assets.forEach((item) => {
      const meter = document.createElement('div');
      meter.innerHTML = `<label>${coinNames[item.asset] || item.asset}<strong>${item.allocation.toFixed(2)}%</strong></label><div class="meter"><span style="width: ${Math.min(item.allocation, 100)}%"></span></div>`;
      meters.append(meter);
    });

    orders.replaceChildren();
    if (!portfolio.orders.length) {
      orders.innerHTML = '<p class="portfolio-empty">No trading activity yet.</p>';
      return;
    }
    portfolio.orders.forEach((order) => {
      const row = document.createElement('div');
      row.className = 'portfolio-order-row';
      row.innerHTML = `<span>${order.asset}/USD</span><span class="trend ${order.side === 'buy' ? 'up' : 'down'}">${order.side.toUpperCase()}</span><span>${order.amount} @ ${formatMarketPrice(order.price)}</span><strong>${formatMarketPrice(order.total)}</strong>`;
      orders.append(row);
    });
  };

  const refreshPortfolio = async () => {
    try {
      const email = JSON.parse(currentUser).email;
      const portfolio = await apiRequest(`/api/portfolio/${encodeURIComponent(email)}`);
      renderPortfolio(portfolio);
    } catch (error) {
      const status = document.getElementById('holdingsStatus');
      if (status) status.textContent = 'Unavailable';
      console.warn('Could not load portfolio:', error);
    }
  };

  refreshPortfolio();
  window.setInterval(refreshPortfolio, 15000);
}

function setupDashboardPositions() {
  const table = document.getElementById('positionsTable');
  const currentUser = localStorage.getItem(CURRENT_USER_KEY);
  if (!table || !currentUser) return;

  const header = table.querySelector('.positions-head');
  const positionTab = document.querySelector('.exchange-bottom-tabs button:nth-child(2)');
  const refreshPositions = async () => {
    try {
      const email = JSON.parse(currentUser).email;
      const portfolio = await apiRequest(`/api/portfolio/${encodeURIComponent(email)}`);
      table.replaceChildren(header);
      const positions = portfolio.positions || [];
      if (positionTab) positionTab.textContent = `Positions (${positions.length})`;
      if (!positions.length) {
        const empty = document.createElement('div');
        empty.className = 'positions-row positions-empty';
        empty.innerHTML = '<span>No open positions. Buy an asset to see it here.</span>';
        empty.firstElementChild.style.gridColumn = '1 / -1';
        table.append(empty);
        return;
      }
      positions.forEach((position) => {
        const row = document.createElement('div');
        const positive = position.pnl >= 0;
        const pnlText = `${positive ? '+' : '-'}${formatMarketPrice(Math.abs(position.pnl))}`;
        row.className = 'positions-row';
        row.innerHTML = `<span>${position.asset}/USD</span><span class="trend up">${position.side[0].toUpperCase()}${position.side.slice(1)}</span><span>${formatMarketPrice(position.entryPrice)}</span><span>${formatMarketPrice(position.currentPrice)}</span><span class="trend ${positive ? 'up' : 'down'}">${pnlText}</span>`;
        table.append(row);
      });
    } catch (error) {
      console.warn('Could not load dashboard positions:', error);
    }
  };

  refreshPositions();
  window.setInterval(refreshPositions, 15000);
}

function setupMarketChat() {
  const chatForm = document.getElementById('chatForm');
  const chatFeed = document.getElementById('chatFeed');
  const chatInput = document.getElementById('chatInput');
  if (!chatForm || !chatFeed || !chatInput) return;

  const currentUser = localStorage.getItem(CURRENT_USER_KEY);
  const author = currentUser ? JSON.parse(currentUser).name.split(' ')[0] || 'You' : 'You';

  const appendMessage = (item, outgoing = false) => {
    const wrapper = document.createElement('div');
    wrapper.className = `chat-message ${outgoing ? 'outgoing' : 'incoming'}`;
    const name = document.createElement('strong');
    const text = document.createElement('p');
    name.textContent = item.author || 'Trader';
    text.textContent = item.message;
    wrapper.append(name, text);
    chatFeed.append(wrapper);
  };

  const loadMessages = async () => {
    try {
      const messages = await apiRequest('/api/chat');
      messages.forEach((message) => appendMessage(message, message.author === author));
      if (messages.length) chatFeed.scrollTop = chatFeed.scrollHeight;
    } catch (error) {
      console.warn('Could not load market chat:', error);
    }
  };

  chatForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = chatInput.value.trim();
    if (!message) return;
    chatInput.disabled = true;
    try {
      const created = await apiRequest('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ author, message })
      });
      appendMessage(created, true);
      chatFeed.scrollTop = chatFeed.scrollHeight;
      chatInput.value = '';
    } catch (error) {
      showTerminalToast('Message could not be sent.');
    } finally {
      chatInput.disabled = false;
      chatInput.focus();
    }
  });

  loadMessages();
}

function getLocalUsers() {
  const value = localStorage.getItem(USERS_KEY);
  return value ? JSON.parse(value) : [];
}

function setLocalUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getLocalPayments() {
  const value = localStorage.getItem(PAYMENTS_KEY);
  return value ? JSON.parse(value) : {};
}

function setLocalPayments(payments) {
  localStorage.setItem(PAYMENTS_KEY, JSON.stringify(payments));
}

async function getUsers() {
  try {
    const users = await apiRequest('/users');
    if (Array.isArray(users)) {
      setLocalUsers(users);
      return users;
    }
  } catch (error) {
    console.warn('Using local users fallback:', error);
  }

  return getLocalUsers();
}

async function saveUsers(users) {
  setLocalUsers(users);

  if (!users.length) return;

  try {
    const newestUser = users[users.length - 1];
    return apiRequest('/users', {
      method: 'POST',
      body: JSON.stringify(newestUser)
    });
  } catch (error) {
    console.warn('Could not sync users to server:', error);
  }
}

async function getPayments() {
  try {
    const payments = await apiRequest('/payments');
    if (payments && typeof payments === 'object') {
      setLocalPayments(payments);
      return payments;
    }
  } catch (error) {
    console.warn('Using local payments fallback:', error);
  }

  return getLocalPayments();
}

async function savePayments(payments) {
  setLocalPayments(payments);

  try {
    await apiRequest('/payments', {
      method: 'PUT',
      body: JSON.stringify(payments)
    });
  } catch (error) {
    console.warn('Could not sync payments to server:', error);
  }
}

async function hasPaid(email) {
  if (!email) return false;
  const payments = await getPayments();
  return payments[email.toLowerCase()]?.status === 'approved';
}

async function getPayment(email) {
  if (!email) return null;
  const payments = await getPayments();
  return payments[email.toLowerCase()] || null;
}

function stopApprovalPolling() {
  if (!approvalPollTimer) return;
  clearInterval(approvalPollTimer);
  approvalPollTimer = null;
}

function watchPaymentApproval(email) {
  stopApprovalPolling();
  if (!email) return;

  const checkApproval = async () => {
    const payment = await getPayment(email);
    if (payment?.status === 'approved') {
      stopApprovalPolling();
      window.location.href = DASHBOARD_PATH;
      return;
    }

    if (payment?.status === 'rejected') {
      stopApprovalPolling();
      alert('Your payment was rejected. Please contact the owner or submit a new payment.');
    }
  };

  checkApproval();
  approvalPollTimer = setInterval(checkApproval, 3000);
}

function getCurrentBalance() {
  const currentUser = localStorage.getItem(CURRENT_USER_KEY);
  if (!currentUser) return 50000;
  const email = JSON.parse(currentUser).email.toLowerCase();
  const balances = JSON.parse(localStorage.getItem(BALANCES_KEY) || '{}');
  return typeof balances[email] === 'number' ? balances[email] : 50000;
}

async function syncBalancesToServer(balances) {
  localStorage.setItem(BALANCES_KEY, JSON.stringify(balances));

  try {
    await apiRequest('/balances', {
      method: 'PUT',
      body: JSON.stringify(balances)
    });
  } catch (error) {
    console.warn('Could not sync balances to server:', error);
  }
}

function renderBalance() {
  const balance = getCurrentBalance();
  const formatted = formatMarketPrice(balance);
  if (accountBalance) accountBalance.textContent = formatted;
  if (availableBalance) availableBalance.textContent = formatted;
}

async function refreshBalanceFromServer(email) {
  try {
    const result = await apiRequest(`/api/balance/${encodeURIComponent(email)}`);
    const balances = JSON.parse(localStorage.getItem(BALANCES_KEY) || '{}');
    balances[email.toLowerCase()] = Number(result.balance);
    localStorage.setItem(BALANCES_KEY, JSON.stringify(balances));
    renderBalance();
  } catch (error) {
    console.warn('Could not refresh balance:', error);
  }
}

async function refreshDepositStatus(email, knownStatuses) {
  try {
    const deposits = await apiRequest(`/deposits?userEmail=${encodeURIComponent(email)}`);
    let statusChanged = false;

    deposits.forEach((deposit) => {
      const depositId = String(deposit.id);
      const previousStatus = knownStatuses.get(depositId);
      if (previousStatus && previousStatus !== deposit.status && ['approved', 'rejected'].includes(deposit.status)) {
        statusChanged = true;
      }
      knownStatuses.set(depositId, deposit.status);
    });

    if (statusChanged) window.location.reload();
  } catch (error) {
    console.warn('Could not refresh deposit status:', error);
  }
}

function setFundsMode(mode) {
  const isWithdraw = mode === 'withdraw';
  if (fundsModal) {
    fundsModal.classList.add('open');
    fundsModal.setAttribute('aria-hidden', 'false');
    if (!fundsModal.open) fundsModal.showModal();
  }
  fundsTabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.fundsTab === mode));
  if (fundsTitle) fundsTitle.textContent = isWithdraw ? 'Withdraw funds' : 'Deposit funds';
  if (fundsSubmit) fundsSubmit.textContent = isWithdraw ? 'Withdraw funds' : 'Deposit funds';
  if (fundsMessage) fundsMessage.textContent = '';
  updateFundsMethod();
  renderBalance();
}

function closeFunds() {
  if (fundsModal) {
    fundsModal.classList.remove('open');
    fundsModal.setAttribute('aria-hidden', 'true');
    if (fundsModal.open) fundsModal.close();
  }
  fundsForm?.reset();
}

function updateFundsMethod() {
  const isWithdraw = document.querySelector('.funds-tab.active')?.dataset.fundsTab === 'withdraw';
  cardDetails?.classList.add('hidden');
  cryptoDetails?.classList.toggle('hidden', isWithdraw);
  withdrawalDetails?.classList.toggle('hidden', !isWithdraw);
  withdrawalDetails?.querySelectorAll('input, select').forEach((field) => {
    field.required = isWithdraw;
  });
}

function showMessage(text, type = '') {
  if (!authMessage) return;
  authMessage.textContent = text;
  authMessage.classList.remove('error', 'success');

  if (type) {
    authMessage.classList.add(type);
  }
}

function openAuth(mode = 'login') {
  if (!authModal) return;

  if (!authModal.classList.contains('open')) {
    authReturnFocus = document.activeElement;
  }
  authModal.classList.add('open');
  authModal.inert = false;
  authModal.setAttribute('aria-hidden', 'false');
  paymentForm?.classList.remove('active');
  document.querySelector('.auth-tabs')?.classList.remove('hidden');

  tabButtons.forEach((button) => {
    const isActive = button.dataset.tab === mode;
    button.classList.toggle('active', isActive);
  });

  const loginTab = document.getElementById('loginForm');
  const signupTab = document.getElementById('signupForm');

  if (loginTab && signupTab) {
    loginTab.classList.toggle('active', mode === 'login');
    signupTab.classList.toggle('active', mode === 'signup');
  }

  showMessage('');
  document.querySelector('.auth-form.active input')?.focus();
}

function openPayment(plan, price) {
  if (!authModal || !paymentForm) return;

  if (!authModal.classList.contains('open')) {
    authReturnFocus = document.activeElement;
  }
  authModal.classList.add('open');
  authModal.inert = false;
  authModal.setAttribute('aria-hidden', 'false');
  document.querySelectorAll('.auth-form').forEach((form) => form.classList.remove('active'));
  document.querySelector('.auth-tabs')?.classList.add('hidden');
  paymentForm.classList.add('active');
  paymentPlanName.textContent = plan;
  paymentPlanPrice.textContent = `${PAYMENT_BTC_AMOUNT.toFixed(8)} BTC`;
  paymentForm.reset();
  receiptStep?.classList.add('hidden');
  if (payWithWalletButton) payWithWalletButton.disabled = false;
  showMessage('');
  paymentForm.querySelector('input')?.focus();
}

function closeAuth() {
  if (!authModal) return;

  const returnFocus = authReturnFocus;
  authModal.classList.remove('open');
  authModal.setAttribute('aria-hidden', 'true');
  authModal.inert = true;
  document.querySelector('.auth-tabs')?.classList.remove('hidden');
  authReturnFocus = null;

  if (returnFocus instanceof HTMLElement && document.contains(returnFocus)) {
    returnFocus.focus();
  } else {
    document.body.setAttribute('tabindex', '-1');
    document.body.focus({ preventScroll: true });
  }
}

function redirectToDashboard() {
  window.location.href = DASHBOARD_PATH;
}

function updateDashboard() {
  const currentUser = localStorage.getItem(CURRENT_USER_KEY);

  if (tradingDashboard) {
    const isLoggedIn = Boolean(currentUser);
    tradingDashboard.classList.toggle('hidden', !isLoggedIn);
  }

  if (userNameLabel) {
    const name = currentUser ? JSON.parse(currentUser).name : 'Trader';
    userNameLabel.textContent = name.split(' ')[0] || 'Trader';
  }
}

async function loginUser(email, password) {
  const users = await getUsers();
  const user = users.find(
    (item) => item.email.toLowerCase() === email.toLowerCase() && item.password === password
  );

  if (!user) {
    showMessage('Incorrect email or password. Please try again.', 'error');
    return;
  }

  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify({ name: user.name, email: user.email }));
  const payment = await getPayment(user.email);
  if (payment?.status === 'approved') {
    closeAuth();
    redirectToDashboard();
    return;
  }

  if (payment?.status === 'pending') {
    watchPaymentApproval(user.email);
    showMessage('Your payment is waiting for owner approval. You will get access after it is approved.', 'success');
    return;
  }

  openPayment('Pro', '$29');
  showMessage(payment?.status === 'rejected'
    ? 'Your previous payment was rejected. Submit your payment again for review.'
    : 'Complete payment before entering the trading dashboard.');
}

async function registerUser(name, email, password) {
  const users = await getUsers();
  const exists = users.some((item) => item.email.toLowerCase() === email.toLowerCase());

  if (exists) {
    showMessage('An account with this email already exists.', 'error');
    return;
  }

  const newUser = { name, email, password };
  users.push(newUser);
  const result = await saveUsers(users);

  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify({ name, email }));
  openPayment('Pro', '$29');
  showMessage('Account created. Complete payment and wait for admin approval before entering the trading dashboard.');
}

if (authTriggers.length) {
  authTriggers.forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const mode = trigger.dataset.auth === 'signup' ? 'signup' : 'login';
      openAuth(mode);
    });
  });
}

paymentTriggers.forEach((trigger) => {
  trigger.addEventListener('click', () => {
    openPayment(trigger.dataset.plan, trigger.dataset.price);
  });
});

fundsTriggers.forEach((trigger) => {
  trigger.addEventListener('click', () => setFundsMode(trigger.dataset.fundsMode));
});

fundsTabs.forEach((tab) => {
  tab.addEventListener('click', () => setFundsMode(tab.dataset.fundsTab));
});

document.querySelectorAll('[data-close-funds]').forEach((element) => {
  element.addEventListener('click', closeFunds);
});

if (fundsForm) {
  fundsMethod?.addEventListener('change', updateFundsMethod);
  document.getElementById('copyWallet')?.addEventListener('click', async () => {
    const address = BTC_DEPOSIT_ADDRESS;
    try {
      await navigator.clipboard.writeText(address);
      fundsMessage.textContent = 'Wallet address copied.';
      fundsMessage.className = 'funds-message success';
    } catch (error) {
      fundsMessage.textContent = address;
      fundsMessage.className = 'funds-message';
    }
  });

  fundsForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(fundsForm);
    const amount = Number(formData.get('fundsAmount'));
    const method = formData.get('fundsMethod');
    const mode = document.querySelector('.funds-tab.active')?.dataset.fundsTab || 'deposit';
    const currentUser = localStorage.getItem(CURRENT_USER_KEY);

    if (!Number.isFinite(amount) || amount <= 0) {
      fundsMessage.textContent = 'Enter an amount greater than zero.';
      fundsMessage.className = 'funds-message error';
      return;
    }

    if (mode === 'deposit' && !document.querySelector('#cryptoDetails .wallet-address')) {
      fundsMessage.textContent = 'Choose a crypto wallet address before continuing.';
      fundsMessage.className = 'funds-message error';
      return;
    }

    if (!currentUser) {
      fundsMessage.textContent = 'Sign in before managing funds.';
      fundsMessage.className = 'funds-message error';
      return;
    }

    try {
      const user = JSON.parse(currentUser);
      const withdrawalName = String(formData.get('withdrawalName') || '').trim();
      const withdrawalAddress = String(formData.get('withdrawalAddress') || '').trim();
      const withdrawalNetwork = formData.get('withdrawalNetwork');
      if (mode === 'withdraw') {
        if (!withdrawalName || !withdrawalAddress || !withdrawalNetwork) {
          fundsMessage.textContent = 'Enter your full name, wallet address, and network.';
          fundsMessage.className = 'funds-message error';
          return;
        }

        const deposits = await apiRequest(`/deposits?userEmail=${encodeURIComponent(user.email)}&status=approved`);
        const approvedDepositTotal = deposits.reduce((total, deposit) => total + Number(deposit.amount || 0), 0);
        if (approvedDepositTotal < 500) {
          fundsMessage.textContent = 'You need at least $500 in approved deposits before withdrawing funds.';
          fundsMessage.className = 'funds-message error';
          return;
        }
      }

      const result = await apiRequest('/api/funds', {
        method: 'POST',
        body: JSON.stringify({
          email: user.email,
          amount,
          mode,
          method,
          withdrawalName,
          withdrawalAddress,
          withdrawalNetwork
        })
      });
      const balances = JSON.parse(localStorage.getItem(BALANCES_KEY) || '{}');
      balances[user.email.toLowerCase()] = result.balance;
      localStorage.setItem(BALANCES_KEY, JSON.stringify(balances));
      renderBalance();
      fundsMessage.textContent = mode === 'withdraw'
        ? `Withdrawal request for ${formatMarketPrice(amount)} submitted for review.`
        : `Deposit of ${formatMarketPrice(amount)} submitted for approval. Your balance will update after review.`;
      fundsMessage.className = 'funds-message success';
      fundsForm.reset();
      updateFundsMethod();
    } catch (error) {
      fundsMessage.textContent = error.message.replace('API request failed: 400', '');
      fundsMessage.className = 'funds-message error';
    }
  });
}

document.querySelector('[data-payment-back]')?.addEventListener('click', () => {
  openAuth('signup');
});

if (tabButtons.length) {
  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      openAuth(button.dataset.tab);
    });
  });
}

if (loginForm) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(loginForm);
    const email = formData.get('email').toString().trim();
    const password = formData.get('password').toString();

    await loginUser(email, password);
  });
}

if (signupForm) {
  signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(signupForm);
    const name = formData.get('fullName').toString().trim();
    const email = formData.get('email').toString().trim();
    const password = formData.get('password').toString();
    const confirmPassword = formData.get('confirmPassword').toString();

    if (password !== confirmPassword) {
      showMessage('Passwords do not match. Please try again.', 'error');
      return;
    }

    if (password.length < 6) {
      showMessage('Password must be at least 6 characters long.', 'error');
      return;
    }

    await registerUser(name, email, password);
  });
}

if (paymentForm) {
  payWithWalletButton?.addEventListener('click', () => {
    const walletLink = `bitcoin:${TRUST_WALLET_ADDRESS}?amount=${PAYMENT_BTC_AMOUNT.toFixed(8)}`;
    receiptStep?.classList.remove('hidden');
    payWithWalletButton.disabled = true;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = walletLink;
      return;
    }

    navigator.clipboard?.writeText(TRUST_WALLET_ADDRESS).then(() => {
      showMessage('Wallet address copied. Send the fixed BTC amount, then upload your receipt below.', 'success');
    }).catch(() => {
      showMessage(`Send ${PAYMENT_BTC_AMOUNT} BTC to ${TRUST_WALLET_ADDRESS}, then upload your receipt below.`, 'success');
    });
  });

  paymentForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const currentUser = localStorage.getItem(CURRENT_USER_KEY);

    if (!currentUser) {
      showMessage('Create an account before completing payment.', 'error');
      return;
    }

    const user = JSON.parse(currentUser);
    const receipt = paymentReceipt?.files[0];
    if (!receipt) {
      showMessage('Click Pay now first, then upload your payment receipt.', 'error');
      return;
    }

    if (receipt.size > 5 * 1024 * 1024) {
      showMessage('Receipt must be smaller than 5 MB.', 'error');
      return;
    }

    const receiptData = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => resolve(reader.result));
      reader.addEventListener('error', reject);
      reader.readAsDataURL(receipt);
    });
    const payments = await getPayments();

    payments[user.email.toLowerCase()] = {
      plan: paymentPlanName.textContent,
      price: paymentPlanPrice.textContent,
      paymentMethod: 'crypto',
      walletAddress: TRUST_WALLET_ADDRESS,
      walletNetwork: TRUST_WALLET_NETWORK,
      cryptoAmount: PAYMENT_BTC_AMOUNT,
      receiptName: receipt.name,
      receiptType: receipt.type || 'application/octet-stream',
      receiptData,
      status: 'pending',
      submittedAt: new Date().toISOString(),
      paymentNote: ''
    };

    await savePayments(payments);
    paymentForm.reset();
    receiptStep?.classList.add('hidden');
    if (payWithWalletButton) payWithWalletButton.disabled = false;
    sessionStorage.removeItem(PAYMENT_REQUIRED_KEY);
    closeAuth();
    watchPaymentApproval(user.email);
    alert('Receipt sent for owner approval.');
  });
}

tradeTypes.forEach((button) => {
  button.addEventListener('click', () => {
    tradeTypes.forEach((item) => item.classList.toggle('active', item === button));
    const submitButton = tradeForm?.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.textContent = `Place ${button.textContent.toLowerCase()} order`;
    }
  });
});

chartTools.forEach((button) => {
  button.addEventListener('click', () => {
    chartTools.forEach((item) => item.classList.toggle('active', item === button));
    showTerminalToast(`${button.dataset.chartTool} view selected.`);
  });
});

function drawingStorageKey() {
  return `${DRAWINGS_KEY}_${instrumentPicker?.value || 'BTC'}`;
}

function chartPoint(event) {
  if (!chartSvg) return null;
  const bounds = chartSvg.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(3200, ((event.clientX - bounds.left) / bounds.width) * 3200)),
    y: Math.max(0, Math.min(300, ((event.clientY - bounds.top) / bounds.height) * 300))
  };
}

function drawingElement(drawing, preview = false) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', drawing.type === 'rectangle' ? 'rect' : 'line');
  element.classList.add('user-drawing');
  if (preview) element.classList.add('preview');

  if (drawing.type === 'rectangle') {
    element.setAttribute('x', Math.min(drawing.start.x, drawing.end.x));
    element.setAttribute('y', Math.min(drawing.start.y, drawing.end.y));
    element.setAttribute('width', Math.abs(drawing.end.x - drawing.start.x));
    element.setAttribute('height', Math.abs(drawing.end.y - drawing.start.y));
  } else {
    element.setAttribute('x1', drawing.type === 'horizontal' ? 0 : drawing.start.x);
    element.setAttribute('y1', drawing.type === 'horizontal' ? drawing.start.y : drawing.start.y);
    element.setAttribute('x2', drawing.type === 'horizontal' ? 3200 : drawing.end.x);
    element.setAttribute('y2', drawing.type === 'horizontal' ? drawing.start.y : drawing.end.y);
  }
  return element;
}

function renderDrawings() {
  if (!drawingLayer) return;
  drawingLayer.replaceChildren(...chartDrawings.map((drawing) => drawingElement(drawing)));
}

function loadDrawings() {
  try {
    chartDrawings = JSON.parse(localStorage.getItem(drawingStorageKey()) || '[]');
  } catch (error) {
    chartDrawings = [];
  }
  renderDrawings();
}

function saveDrawings() {
  localStorage.setItem(drawingStorageKey(), JSON.stringify(chartDrawings));
}

function setDrawingMode(mode) {
  drawingMode = mode;
  drawingTools.forEach((tool) => tool.classList.toggle('active', tool.dataset.drawingTool === mode));
  chartWrap?.classList.toggle('drawing-mode', mode !== 'cursor');
  chartWrap?.setAttribute('data-drawing-tool', mode);
  showTerminalToast(mode === 'cursor' ? 'Chart cursor selected.' : `${mode[0].toUpperCase()}${mode.slice(1)} tool selected. Drag on the chart to draw.`);
}

drawingTools.forEach((tool) => tool.addEventListener('click', () => setDrawingMode(tool.dataset.drawingTool)));
drawingActions.forEach((action) => action.addEventListener('click', () => {
  if (action.dataset.drawingAction === 'undo') chartDrawings.pop();
  if (action.dataset.drawingAction === 'clear') chartDrawings = [];
  saveDrawings();
  renderDrawings();
}));

chartSvg?.addEventListener('pointerdown', (event) => {
  if (drawingMode === 'cursor') return;
  drawingStart = chartPoint(event);
  chartSvg.setPointerCapture(event.pointerId);
});

chartSvg?.addEventListener('pointermove', (event) => {
  if (!drawingStart || drawingMode === 'cursor') return;
  const currentPoint = chartPoint(event);
  drawingPreview?.remove();
  drawingPreview = drawingElement({ type: drawingMode, start: drawingStart, end: currentPoint }, true);
  drawingLayer?.append(drawingPreview);
});

chartSvg?.addEventListener('pointerup', (event) => {
  if (!drawingStart || drawingMode === 'cursor') return;
  const endPoint = chartPoint(event);
  if (Math.abs(endPoint.x - drawingStart.x) > 4 || Math.abs(endPoint.y - drawingStart.y) > 4) {
    chartDrawings.push({ type: drawingMode, start: drawingStart, end: endPoint });
    saveDrawings();
  }
  drawingPreview?.remove();
  drawingPreview = null;
  drawingStart = null;
  renderDrawings();
});

function updateInstrument() {
  const selectedOption = instrumentPicker?.selectedOptions[0];
  if (!selectedOption) return;

  const instrument = selectedOption.textContent;
  instrumentName.textContent = selectedOption.dataset.name;
  document.querySelectorAll('.pair-label, .ticket-header h3').forEach((element) => {
    element.textContent = instrument;
  });
  instrumentDot.className = `coin-dot ${selectedOption.dataset.dot}`;
  if (tradeAssetSelect) tradeAssetSelect.value = selectedOption.value;
  liveTracePoints = [];
  livePriceTrace?.setAttribute('d', 'M0,205');
  renderMarketReading(serverMarkets[selectedOption.value] || marketDefaults[selectedOption.value]);
}

instrumentPicker?.addEventListener('change', updateInstrument);

function formatMarketPrice(value) {
  if (value >= 1000) return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`;
}

const marketDefaults = {
  BTC: { price: 67420.18, high: 68120, low: 64240, change: 4.2 },
  ETH: { price: 3480.12, high: 3542.76, low: 3417.48, change: 3.8 },
  SOL: { price: 162.84, high: 168.2, low: 154.7, change: -1.1 },
  ADA: { price: 0.62, high: 0.65, low: 0.58, change: 2.7 },
  XRP: { price: 0.62, high: 0.65, low: 0.58, change: 2.7 },
  DOGE: { price: 0.18, high: 0.19, low: 0.16, change: 6.4 },
  BNB: { price: 603.18, high: 612.4, low: 584.2, change: 1.7 },
  LINK: { price: 17.24, high: 17.8, low: 16.4, change: 2.3 },
  AVAX: { price: 34.58, high: 35.9, low: 33.2, change: -0.9 },
  NEAR: { price: 6.82, high: 7.1, low: 6.4, change: 3.6 },
  ARB: { price: 1.07, high: 1.13, low: 0.98, change: 4.8 },
  TON: { price: 7.29, high: 7.6, low: 6.9, change: 1.9 }
};

function renderMarketReading(market) {
  if (!market) return;
  liveState = { ...market, symbol: instrumentPicker?.value };
  chartPrice.textContent = formatMarketPrice(market.price);
  if (bookPrice) bookPrice.textContent = formatMarketPrice(market.price);
  chartHigh.textContent = `High ${formatMarketPrice(market.high)}`;
  chartLow.textContent = `Low ${formatMarketPrice(market.low)}`;
  chartChange.textContent = `${market.change >= 0 ? '+' : ''}${market.change.toFixed(2)}%`;
  chartChange.classList.toggle('up', market.change >= 0);
  chartChange.classList.toggle('down', market.change < 0);

  const range = Math.max(market.high - market.low, market.price * 0.01);
  const chartY = 42 + ((market.high - market.price) / range) * 218;
  chartDot?.setAttribute('cy', chartY.toFixed(1));
  document.querySelector('.chart-crosshair')?.setAttribute('x1', '3160');
  document.querySelector('.chart-crosshair')?.setAttribute('x2', '3160');
  document.querySelector('.chart-crosshair')?.setAttribute('y1', chartY.toFixed(1));
  document.querySelector('.current-price-line')?.setAttribute('y1', chartY.toFixed(1));
  document.querySelector('.current-price-line')?.setAttribute('y2', chartY.toFixed(1));
  updateEstimatedTotal();
}

function updateLiveTrace(price, market) {
  if (!livePriceTrace) return;
  const range = Math.max(market.high - market.low, market.price * 0.01);
  const y = Math.max(34, Math.min(268, 42 + ((market.high - price) / range) * 218));
  liveTracePoints.push({ x: liveTracePoints.length ? liveTracePoints[liveTracePoints.length - 1].x + 55 : 0, y });
  if (liveTracePoints.length > 36) liveTracePoints.shift();
  const points = liveTracePoints.map((point, index) => ({ x: index * 55, y: point.y }));
  livePriceTrace.setAttribute('d', points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y.toFixed(1)}`).join(' '));
}

function updateEstimatedTotal() {
  if (!estimatedTotal || !amountInput || !instrumentPicker) return;
  const amount = Number(amountInput.value);
  const symbol = instrumentPicker.value;
  const market = liveState?.symbol === symbol ? liveState : marketDefaults[symbol];
  if (!market || !Number.isFinite(amount) || amount < 0) {
    estimatedTotal.textContent = '$0.00';
    return;
  }
  estimatedTotal.textContent = formatMarketPrice(market.price * amount);
}

function tickMarketReading() {
  const symbol = instrumentPicker?.value;
  const defaults = serverMarkets[symbol] || marketDefaults[symbol];
  if (!symbol || !defaults) return;
  if (!liveState || liveState.symbol !== symbol) {
    renderMarketReading(defaults);
  }

  const anchorPrice = defaults.price;
  const currentPrice = liveState.price;
  const pullToAnchor = (anchorPrice - currentPrice) * 0.12;
  const step = anchorPrice * (0.00035 + Math.random() * 0.0008) * (Math.random() > 0.48 ? 1 : -1);
  const price = Math.max(anchorPrice * 0.985, Math.min(anchorPrice * 1.015, currentPrice + pullToAnchor + step));
  const market = {
    price,
    high: Math.max(defaults.high, price),
    low: Math.min(defaults.low, price),
    change: defaults.change + ((price - anchorPrice) / anchorPrice) * 100
  };
  renderMarketReading(market);
  updateLiveTrace(price, market);
  updateAnimatedCandles(price >= currentPrice);
  if (liveStatus) liveStatus.textContent = `Live movement ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function updateAnimatedCandles(marketMovingUp) {
  candleMotion += marketMovingUp ? 0.34 : -0.34;
  animatedCandles.forEach((candle, index) => {
    const wave = Math.sin(candleMotion + index * 0.52);
    const translation = wave * (index > 42 ? 5 : 3);
    candle.wick.setAttribute('transform', `translate(0 ${translation.toFixed(1)})`);
    candle.body.setAttribute('transform', `translate(0 ${translation.toFixed(1)})`);
    candle.body.classList.toggle('down', wave < -0.08);
  });
}

function renderOfflineMarketReading(symbol) {
  const defaults = marketDefaults[symbol];
  if (!defaults) return;
  const price = defaults.price * (1 + (Math.random() - 0.5) * 0.002);
  renderMarketReading({
    price,
    high: defaults.price * 1.018,
    low: defaults.price * 0.982,
    change: (Math.random() - 0.45) * 6
  });
  if (liveStatus) {
    liveStatus.textContent = `Live demo ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
}

function refreshLivePrice() {
  const symbol = instrumentPicker?.value;
  if (!symbol || !chartPrice) return;
  renderMarketReading(serverMarkets[symbol] || marketDefaults[symbol]);
}

if (instrumentPicker) {
  const requestedSymbol = new URLSearchParams(window.location.search).get('symbol')?.toUpperCase();
  if (requestedSymbol && instrumentPicker.querySelector(`option[value="${requestedSymbol}"]`)) {
    instrumentPicker.value = requestedSymbol;
    updateInstrument();
  }
  loadServerMarkets();
  refreshLivePrice();
  window.setInterval(tickMarketReading, 2200);
}

tradeAssetSelect?.addEventListener('change', (event) => {
  if (!instrumentPicker) return;
  instrumentPicker.value = event.target.value;
  updateInstrument();
});

amountInput?.addEventListener('input', updateEstimatedTotal);

document.querySelectorAll('.utility-link').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    document.querySelectorAll('.utility-link').forEach((item) => item.classList.toggle('active', item === link));

    const actions = {
      trades: ['#tradeForm', 'Order ticket ready.'],
      signals: ['.chart-panel', 'Signals are being monitored for the selected pair.'],
      social: ['.chat-panel', 'Market chat opened.'],
      express: ['#tradeForm', 'Express trade ready. Market order selected.'],
      tournaments: [null, 'Trading tournaments are coming soon.'],
      pending: ['#portfolio', 'Open positions and pending activity opened.'],
      hotkeys: [null, 'Shortcuts: T trades, S sell, B buy, F fullscreen.']
    };
    const [target, message] = actions[link.dataset.tool] || [];
    if (target) {
      document.querySelector(target)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (link.dataset.tool === 'express') {
      const orderType = tradeForm?.querySelector('select[name="type"]');
      if (orderType) orderType.value = 'Market';
    }
    showTerminalToast(message);
  });
});

function showTerminalToast(message) {
  if (!terminalToast) return;
  terminalToast.textContent = message;
  terminalToast.classList.add('visible');
  window.clearTimeout(showTerminalToast.timeout);
  showTerminalToast.timeout = window.setTimeout(() => {
    terminalToast.classList.remove('visible');
  }, 3200);
}

const fullscreenButton = document.querySelector('.utility-fullscreen');
const chartFocusExit = document.getElementById('chartFocusExit');

function toggleChartFocus() {
  const focusMode = document.body.classList.toggle('chart-focus-mode');
  if (fullscreenButton) {
    fullscreenButton.textContent = focusMode ? '×' : '⛶';
    fullscreenButton.setAttribute('aria-label', focusMode ? 'Exit chart focus' : 'Full screen');
  }
}

fullscreenButton?.addEventListener('click', toggleChartFocus);
chartFocusExit?.addEventListener('click', toggleChartFocus);

if (tradeForm) {
  tradeForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(tradeForm);
    const asset = formData.get('asset');
    const type = formData.get('type');
    const amount = Number(formData.get('amount'));
    const side = document.querySelector('.trade-type.active')?.textContent.trim().toLowerCase() || 'buy';
    const currentUser = localStorage.getItem(CURRENT_USER_KEY);
    const market = liveState?.symbol === asset ? liveState : marketDefaults[asset];

    if (!currentUser || !market || !Number.isFinite(amount) || amount <= 0) {
      showTerminalToast('Enter a valid order amount and sign in first.');
      return;
    }

    const email = JSON.parse(currentUser).email.toLowerCase();
    const total = market.price * amount;
    const order = {
      userEmail: email,
      asset,
      side,
      orderType: type,
      amount,
      price: market.price,
      total,
      status: 'open',
      createdAt: new Date().toISOString()
    };

    try {
      const result = await apiRequest('/api/orders', { method: 'POST', body: JSON.stringify(order) });
      const balances = JSON.parse(localStorage.getItem(BALANCES_KEY) || '{}');
      balances[email] = result.balance;
      localStorage.setItem(BALANCES_KEY, JSON.stringify(balances));
      renderBalance();
      showTerminalToast(`${side === 'buy' ? 'Buy' : 'Sell'} order placed for ${amount} ${asset}.`);
    } catch (error) {
      showTerminalToast(error.message.includes('400') ? 'Order rejected by the server.' : 'Could not place the order. Please try again.');
      return;
    }

    tradeForm.reset();
  });
}

const chartData = {
  '1D': { change: '+4.2%', high: 'High $68,120', low: 'Low $64,240', line: 'M0,205 C80,190, 115,150, 190,170 S300,90 370,125 S470,55 540,105 S660,45 760,80', dot: '80' },
  '1W': { change: '+8.7%', high: 'High $69,480', low: 'Low $61,920', line: 'M0,220 C80,215, 120,180, 190,195 S290,130 360,155 S460,95 540,130 S660,65 760,70', dot: '70' },
  '1M': { change: '+16.3%', high: 'High $71,240', low: 'Low $56,880', line: 'M0,235 C80,220, 120,240, 190,185 S290,205 360,145 S470,170 540,105 S660,115 760,55', dot: '55' }
};

function buildHistoricalCandles() {
  if (!historicalCandles) return;
  animatedCandles = [];
  historicalCandles.replaceChildren();
  const candleCount = 100;
  let close = 195;

  for (let index = 0; index < candleCount; index += 1) {
    const x = 24 + index * 31;
    const direction = Math.sin(index * 1.7) > 0 ? 1 : -1;
    const move = 8 + Math.abs(Math.sin(index * 2.1)) * 18;
    const open = close;
    close = Math.max(38, Math.min(245, close - direction * move));
    const high = Math.min(open, close) - 8 - (index % 4) * 2;
    const low = Math.max(open, close) + 8 + (index % 3) * 3;
    const bodyY = Math.min(open, close);
    const bodyHeight = Math.max(7, Math.abs(open - close));
    const colorClass = close > open ? '' : 'down';

    const wick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    wick.setAttribute('x1', x);
    wick.setAttribute('x2', x);
    wick.setAttribute('y1', high);
    wick.setAttribute('y2', low);

    const body = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    body.setAttribute('x', x - 7);
    body.setAttribute('y', bodyY);
    body.setAttribute('width', '14');
    body.setAttribute('height', bodyHeight);
    if (colorClass) body.classList.add(colorClass);

    historicalCandles.append(wick, body);
    animatedCandles.push({ wick, body });
  }

  if (chartWrap) chartWrap.scrollLeft = chartWrap.scrollWidth;
}

buildHistoricalCandles();

setupMarketsPage();
setupPortfolioPage();
setupDashboardPositions();
setupMarketChat();

chartScrollButtons.forEach((button) => {
  button.addEventListener('click', () => {
    if (!chartWrap) return;
    const distance = Math.max(chartWrap.clientWidth * 0.72, 320);
    chartWrap.scrollBy({ left: button.dataset.chartScroll === 'left' ? -distance : distance, behavior: 'smooth' });
  });
});

chartWrap?.addEventListener('wheel', (event) => {
  if (Math.abs(event.deltaY) <= Math.abs(event.deltaX) || chartWrap.scrollWidth <= chartWrap.clientWidth) return;
  event.preventDefault();
  chartWrap.scrollLeft += event.deltaY;
}, { passive: false });

chartTimeframes.forEach((button) => {
  button.addEventListener('click', () => {
    const data = chartData[button.dataset.timeframe];
    if (!data) return;

    chartTimeframes.forEach((item) => item.classList.toggle('active', item === button));
    chartChange.textContent = data.change;
    chartHigh.textContent = data.high;
    chartLow.textContent = data.low;
    chartLine.setAttribute('d', data.line);
    chartArea.setAttribute('d', `${data.line} L760,300 L0,300 Z`);
    chartDot.setAttribute('cy', data.dot);
  });
});

document.querySelectorAll('[data-close-auth]').forEach((element) => {
  element.addEventListener('click', closeAuth);
});

document.querySelectorAll('[data-switch-tab]').forEach((button) => {
  button.addEventListener('click', () => {
    openAuth(button.dataset.switchTab);
  });
});

if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem(CURRENT_USER_KEY);
    window.location.href = 'index.html';
  });
}

if (document.body.dataset.page === 'dashboard') {
  const currentUser = localStorage.getItem(CURRENT_USER_KEY);

  if (!currentUser) {
    window.location.href = 'index.html';
  } else {
    const parsedUser = JSON.parse(currentUser);
    const knownDepositStatuses = new Map();
    getPayment(parsedUser.email).then((payment) => {
      const paid = payment?.status === 'approved';
      if (!paid) {
        sessionStorage.setItem(PAYMENT_REQUIRED_KEY, 'true');
        window.location.href = 'index.html';
      } else if (userNameLabel) {
        userNameLabel.textContent = parsedUser.name.split(' ')[0] || 'Trader';
      }
      renderBalance();
      refreshBalanceFromServer(parsedUser.email);
      refreshDepositStatus(parsedUser.email, knownDepositStatuses);
      window.setInterval(() => {
        refreshBalanceFromServer(parsedUser.email);
        refreshDepositStatus(parsedUser.email, knownDepositStatuses);
      }, 3000);
    });
  }
} else {
  updateDashboard();

  if (sessionStorage.getItem(PAYMENT_REQUIRED_KEY) === 'true') {
    sessionStorage.removeItem(PAYMENT_REQUIRED_KEY);
    const currentUser = localStorage.getItem(CURRENT_USER_KEY);
    getPayment(currentUser ? JSON.parse(currentUser).email : '').then((payment) => {
      if (payment?.status === 'pending') {
        openAuth('login');
        watchPaymentApproval(currentUser ? JSON.parse(currentUser).email : '');
        showMessage('Your payment is waiting for owner approval. You will get access after it is approved.', 'success');
      } else {
        openPayment('Pro', '$29');
        showMessage(payment?.status === 'rejected'
          ? 'Your previous payment was rejected. Submit your payment again for review.'
          : 'Complete payment before entering the trading dashboard.');
      }
    });
  }
}
