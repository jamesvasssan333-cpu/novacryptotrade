const jsonServer = require('json-server');
const express = require('express');
const path = require('path');
const crypto = require('crypto');

function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  try {
    const contents = require('fs').readFileSync(envPath, 'utf8');
    contents.split(/\r?\n/).forEach((line) => {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!match || process.env[match[1]]) return;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    });
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn(`Could not load .env: ${error.message}`);
  }
}

loadEnvFile();

const server = jsonServer.create();
const databasePath = path.join(__dirname, 'db.json');
const router = jsonServer.router(databasePath);
const middlewares = jsonServer.defaults();
const port = Number(process.env.PORT) || 3001;
const MINIMUM_WITHDRAWAL_DEPOSIT = 500;
const MINIMUM_WITHDRAWAL_TRADES = 10;
const WELCOME_BONUS = 50000;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zewtrvkaunkkkzyfxghr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
function environmentValue(name, fallback = '') {
  return String(process.env[name] || fallback).trim().replace(/^['"]|['"]$/g, '');
}

const BREVO_API_KEY = environmentValue('BREVO_API_KEY');
const BREVO_SENDER_EMAIL = environmentValue('BREVO_SENDER_EMAIL');
const BREVO_SENDER_NAME = environmentValue('BREVO_SENDER_NAME', 'NovaCrypto');

server.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const pageRoutes = {
  '/app': 'app.html',
  '/admin': 'admin.html',
  '/market': 'market.html',
  '/order': 'order.html',
  '/trade': 'trad.html',
  '/trading-dashboard': 'trading-dashboard.htm'
};

Object.entries(pageRoutes).forEach(([route, file]) => {
  server.get(route, (req, res) => {
    res.sendFile(path.join(__dirname, file));
  });
});

const marketPrices = {
  BTC: 67420.18,
  ETH: 3480.12,
  SOL: 162.84,
  ADA: 0.62,
  XRP: 0.62,
  DOGE: 0.18,
  BNB: 603.18,
  LINK: 17.24,
  AVAX: 34.58,
  NEAR: 6.82,
  ARB: 1.07,
  TON: 7.29
};

const marketIds = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  ADA: 'cardano',
  XRP: 'ripple',
  DOGE: 'dogecoin',
  BNB: 'binancecoin',
  LINK: 'chainlink',
  AVAX: 'avalanche-2',
  NEAR: 'near',
  ARB: 'arbitrum',
  TON: 'the-open-network'
};
let marketPricesUpdatedAt = null;
const marketStats = {};

async function refreshMarketPrices() {
  try {
    const ids = Object.values(marketIds).join(',');
    const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`);
    if (!response.ok) throw new Error(`Market feed returned ${response.status}`);
    const prices = await response.json();
    Object.entries(marketIds).forEach(([symbol, id]) => {
      const price = Number(prices[id]?.usd);
      if (Number.isFinite(price) && price > 0) {
        marketPrices[symbol] = price;
        marketStats[symbol] = {
          change24h: Number(prices[id]?.usd_24h_change || 0),
          volume24h: Number(prices[id]?.usd_24h_vol || 0),
          marketCap: Number(prices[id]?.usd_market_cap || 0)
        };
      }
    });
    marketPricesUpdatedAt = new Date().toISOString();
    console.log(`Market prices refreshed at ${marketPricesUpdatedAt}`);
  } catch (error) {
    console.warn(`Using fallback market prices: ${error.message}`);
  }
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function getBalance(email) {
  return Number(router.db.get('balances').value()[email] || 0);
}

function setBalance(email, value) {
  router.db.get('balances').value()[email] = Number(value.toFixed(8));
  router.db.write();
  void supabaseRequest('balances', 'POST', { user_email: email, amount: Number(value.toFixed(8)) }, '?on_conflict=user_email');
}

function getHoldings(email) {
  const holdings = router.db.get('holdings').value() || {};
  return holdings[email] || {};
}

function setHolding(email, asset, amount) {
  const holdings = router.db.get('holdings').value() || {};
  if (!holdings[email]) holdings[email] = {};
  holdings[email][asset] = Number(Math.max(0, amount).toFixed(8));
  if (holdings[email][asset] === 0) delete holdings[email][asset];
  router.db.set('holdings', holdings).write();
  void supabaseRequest('holdings', 'POST', { user_email: email, asset, quantity: Number(Math.max(0, amount).toFixed(8)) }, '?on_conflict=user_email,asset');
}

function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

async function supabaseRequest(table, method, body, query = '') {
  if (!SUPABASE_SERVICE_ROLE_KEY) return false;
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
      method,
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!response.ok) {
      console.warn(`Supabase ${method} ${table} failed: ${response.status} ${await response.text()}`);
      return false;
    }
    return true;
  } catch (error) {
    console.warn(`Supabase ${method} ${table} failed: ${error.message}`);
    return false;
  }
}

async function supabaseRead(table, query = '?select=*') {
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('Supabase sync is not configured.');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    }
  });
  if (!response.ok) throw new Error(`Supabase GET ${table} failed: ${response.status} ${await response.text()}`);
  return response.json();
}

async function sendBrevoEmail({ to, name, subject, textContent, htmlContent }) {
  if (!BREVO_API_KEY || !BREVO_SENDER_EMAIL || BREVO_API_KEY.startsWith('replace-with-')) {
    const reason = 'Brevo email is not configured. Set BREVO_API_KEY and BREVO_SENDER_EMAIL on the server.';
    console.warn(reason);
    return { sent: false, reason, configurationError: true };
  }
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
        to: [{ email: to, name }],
        subject,
        textContent,
        htmlContent
      })
    });
    if (!response.ok) {
      const providerMessage = await response.text();
      const reason = `Brevo rejected the email (${response.status}). Check the verified sender and Brevo API key.`;
      console.warn(`${reason} ${providerMessage}`);
      return { sent: false, reason, providerStatus: response.status };
    }
    return { sent: true };
  } catch (error) {
    const reason = `Brevo could not be reached: ${error.message}`;
    console.warn(reason);
    return { sent: false, reason };
  }
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;'
  }[character]));
}

function supabaseUser(user) {
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = crypto.scryptSync(String(user.password || ''), salt, 64).toString('hex');
  return { id: user.id, name: user.name, email: user.email, password_hash: `${salt}:${passwordHash}` };
}

function supabaseOrder(order) {
  return {
    id: order.id,
    user_email: order.userEmail,
    asset: order.asset,
    side: order.side,
    order_type: order.orderType || 'Market',
    amount: order.amount,
    price: order.price,
    total: order.total,
    status: order.status || 'open',
    created_at: order.createdAt
  };
}

server.use(express.static(__dirname, { index: 'index.html' }));
server.use(middlewares);
server.use(jsonServer.bodyParser);
server.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

server.use((req, res, next) => {
  res.on('finish', () => {
    if (req.method !== 'GET' || req.path !== '/') {
      console.log(`${req.method} ${req.path} -> ${res.statusCode}`);
    }
  });
  next();
});

server.get('/api/balance/:email', (req, res) => {
  const email = normalizeEmail(req.params.email);
  if (!email) {
    return sendJson(res, 400, { error: 'A valid email is required.' });
  }
  return sendJson(res, 200, { balance: getBalance(email) });
});

server.get('/api/markets', (req, res) => {
  return sendJson(res, 200, Object.entries(marketPrices).map(([symbol, price]) => ({
    symbol,
    price,
    change24h: marketStats[symbol]?.change24h || 0,
    volume24h: marketStats[symbol]?.volume24h || 0,
    marketCap: marketStats[symbol]?.marketCap || 0,
    updatedAt: marketPricesUpdatedAt
  })));
});
    
server.get('/api/portfolio/:email', async (req, res) => {
  const email = normalizeEmail(req.params.email);
  if (!email) return sendJson(res, 400, { error: 'A valid email is required.' });

  const holdings = getHoldings(email);
  const assets = Object.entries(holdings).map(([asset, quantity]) => {
    const price = Number(marketPrices[asset] || 0);
    const amount = Number(quantity || 0);
    return {
      asset,
      quantity: amount,
      price,
      value: Number((amount * price).toFixed(8)),
      change24h: marketStats[asset]?.change24h || 0
    };
  }).filter((item) => item.quantity > 0);

  const cashBalance = getBalance(email);
  const holdingsValue = assets.reduce((total, item) => total + item.value, 0);
  const totalValue = cashBalance + holdingsValue;
  let userOrders = (router.db.get('orders').value() || [])
    .filter((order) => normalizeEmail(order.userEmail) === email);
  if (SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const remoteOrders = await supabaseRead('orders', `?user_email=eq.${encodeURIComponent(email)}&select=*`);
      const normalizedRemoteOrders = remoteOrders.map((order) => ({
        id: order.id,
        userEmail: order.user_email,
        asset: order.asset,
        side: order.side,
        orderType: order.order_type,
        amount: Number(order.amount),
        price: Number(order.price),
        total: Number(order.total),
        status: order.status,
        createdAt: order.created_at
      }));
      const ordersById = new Map(userOrders.map((order) => [String(order.id), order]));
      normalizedRemoteOrders.forEach((order) => ordersById.set(String(order.id), order));
      userOrders = [...ordersById.values()].sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt));
    } catch (error) {
      console.warn(`Supabase orders read failed: ${error.message}`);
    }
  }
  const positions = assets.map((asset) => {
    const assetOrders = userOrders.filter((order) => order.asset === asset.asset);
    const bought = assetOrders.filter((order) => order.side === 'buy');
    const boughtQuantity = bought.reduce((total, order) => total + Number(order.amount || 0), 0);
    const invested = bought.reduce((total, order) => total + Number(order.total || 0), 0);
    const entryPrice = boughtQuantity > 0 ? invested / boughtQuantity : asset.price;
    const pnl = (asset.price - entryPrice) * asset.quantity;
    return {
      asset: asset.asset,
      quantity: asset.quantity,
      entryPrice: Number(entryPrice.toFixed(8)),
      currentPrice: asset.price,
      pnl: Number(pnl.toFixed(8)),
      side: 'long'
    };
  });
  assets.forEach((item) => {
    item.allocation = totalValue > 0 ? Number(((item.value / totalValue) * 100).toFixed(2)) : 0;
  });

  return sendJson(res, 200, {
    email,
    cashBalance,
    holdingsValue,
    totalValue,
    assets,
    positions,
    orders: userOrders
      .slice(-20)
      .reverse(),
    updatedAt: marketPricesUpdatedAt
  });
});

server.get('/api/chat', (req, res) => {
  const messages = router.db.get('messages').value() || [];
  return sendJson(res, 200, messages.slice(-50));
});

server.post('/api/chat', (req, res) => {
  const author = typeof req.body.author === 'string' ? req.body.author.trim().slice(0, 40) : '';
  const message = typeof req.body.message === 'string' ? req.body.message.trim().slice(0, 500) : '';
  if (!author || !message) return sendJson(res, 400, { error: 'Author and message are required.' });

  const messages = router.db.get('messages').value() || [];
  const chatMessage = {
    id: Date.now(),
    author,
    message,
    createdAt: new Date().toISOString()
  };
  messages.push(chatMessage);
  router.db.set('messages', messages.slice(-200)).write();
  void supabaseRequest('chat_messages', 'POST', {
    id: chatMessage.id,
    author: chatMessage.author,
    message: chatMessage.message,
    created_at: chatMessage.createdAt
  }, '?on_conflict=id');
  return sendJson(res, 201, chatMessage);
});

const customerMessageDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const defaultCustomerMessages = {
  monday: { subject: 'Start your week with NovaCrypto', body: 'A new week is a fresh opportunity to review your goals and stay focused on your crypto journey. Log in to NovaCrypto and keep your plans on track.\n\nHave a productive week!' },
  tuesday: { subject: 'Your NovaCrypto market update', body: 'Take a moment today to review the latest market movement and check that your trading plans still match your goals.\n\nStay informed and trade thoughtfully.' },
  wednesday: { subject: 'Midweek portfolio check-in', body: 'This is a good time for a midweek review. Check your portfolio, review your open activity, and make sure your account is working toward your plan.\n\nKeep building with intention.' },
  thursday: { subject: 'Stay secure with NovaCrypto', body: 'Please keep your account secure by using a strong password and reviewing your account activity regularly. NovaCrypto will never ask you to share your password.\n\nThank you for helping keep your account safe.' },
  friday: { subject: 'Your NovaCrypto week in review', body: 'As the week comes to a close, take a moment to review your activity and prepare your goals for the week ahead.\n\nThank you for being part of NovaCrypto.' },
  saturday: { subject: 'Your weekend crypto reminder', body: 'Use the weekend to review your strategy, learn something new, and prepare for the next market week.\n\nEnjoy your weekend from the NovaCrypto team.' }
};

async function getCustomerMessages() {
  const messages = router.db.get('customerMessages').value() || {};
  const localMessages = customerMessageDays.reduce((result, day) => {
    result[day] = { ...defaultCustomerMessages[day], ...(messages[day] || {}), sentAt: messages[day]?.sentAt || null, sentTo: messages[day]?.sentTo || [] };
    return result;
  }, {});
  if (!SUPABASE_SERVICE_ROLE_KEY) return localMessages;

  try {
    const drafts = await supabaseRead('customer_message_drafts');
    return customerMessageDays.reduce((result, day) => {
      const draft = drafts.find((item) => item.day === day);
      result[day] = draft
        ? { ...localMessages[day], subject: draft.subject || defaultCustomerMessages[day].subject, body: draft.body || defaultCustomerMessages[day].body, updatedAt: draft.updated_at }
        : localMessages[day];
      return result;
    }, {});
  } catch (error) {
    console.warn(`Supabase customer message drafts read failed: ${error.message}`);
    return localMessages;
  }
}

server.get('/api/admin/customer-messages', async (req, res) => {
  return sendJson(res, 200, await getCustomerMessages());
});

server.put('/api/admin/customer-messages', async (req, res) => {
  const messages = req.body && typeof req.body === 'object' ? req.body : {};
  const normalized = customerMessageDays.reduce((result, day) => {
    const draft = messages[day] || {};
    result[day] = {
      subject: String(draft.subject || '').trim().slice(0, 160),
      body: String(draft.body || '').trim().slice(0, 5000),
      sentAt: draft.sentAt || null,
      sentTo: Array.isArray(draft.sentTo) ? draft.sentTo.slice(-50) : []
    };
    return result;
  }, {});
  if (SUPABASE_SERVICE_ROLE_KEY) {
    await Promise.all(Object.entries(normalized).map(([day, draft]) => supabaseRequest(
      'customer_message_drafts',
      'POST',
      { day, subject: draft.subject, body: draft.body },
      '?on_conflict=day'
    )));
  }
  router.db.set('customerMessages', normalized).write();
  return sendJson(res, 200, normalized);
});

server.post('/api/admin/customer-messages/send', async (req, res) => {
  let emails = Array.isArray(req.body.emails)
    ? [...new Set(req.body.emails.map(normalizeEmail).filter(Boolean))]
    : [normalizeEmail(req.body.email)].filter(Boolean);
  const sendToAll = req.body.sendToAll === true;
  const day = String(req.body.day || '').toLowerCase();
  const subject = String(req.body.subject || '').trim().slice(0, 160);
  const body = String(req.body.body || '').trim().slice(0, 5000);
  let users = router.db.get('users').value() || [];
  if (SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const remoteUsers = await supabaseRead('users', '?select=id,name,email');
      users = remoteUsers.map((user) => ({ id: user.id, name: user.name, email: user.email }));
    } catch (error) {
      console.warn(`Supabase customer lookup failed: ${error.message}`);
    }
  }
  if (sendToAll) {
    emails = [...new Set(users.map((user) => normalizeEmail(user.email)).filter(Boolean))];
  }
  const payments = router.db.get('payments').value() || {};

  if (!emails.length || !customerMessageDays.includes(day) || !subject || !body) {
    return sendJson(res, 400, { error: 'Day, recipient, subject, and message are required.' });
  }
  const recipients = emails.map((email) => ({
    email,
    user: users.find((item) => normalizeEmail(item.email) === email),
    payment: payments[email]
  }));
  if (recipients.some((recipient) => !recipient.user)) return sendJson(res, 404, { error: 'One or more customers were not found.' });

  const sentAt = new Date().toISOString();
  const results = await Promise.all(recipients.map(async ({ email, user, payment }) => {
    const recipientName = payment?.cardholderName || payment?.billingName || user.name || 'there';
    const safeName = escapeHtml(recipientName);
    const safeBody = escapeHtml(body).replace(/\r?\n/g, '<br>');
    const emailResult = await sendBrevoEmail({
      to: email,
      name: recipientName,
      subject,
      textContent: `Hi ${recipientName},\n\n${body}\n\nNovaCrypto`,
      htmlContent: `<!doctype html><html lang="en"><body style="margin:0;background:#f4f7fb;color:#172033;font-family:Arial,sans-serif;"><div style="padding:36px 16px;"><div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e1e7f0;border-radius:16px;overflow:hidden;"><div style="padding:28px 32px;background:#102a43;color:#fff;font-size:13px;letter-spacing:2px;font-weight:bold;">NOVACRYPTO</div><div style="padding:32px;"><p style="margin:0 0 16px;font-size:18px;font-weight:600;color:#172033;">Hello ${safeName},</p><p style="margin:0;font-size:16px;line-height:1.7;color:#526174;">${safeBody}</p></div><div style="padding:18px 32px;background:#f8fafc;color:#8793a5;font-size:12px;">A personal message from NovaCrypto</div></div></div></body></html>`
    });
    return { email, ...emailResult };
  }));

  const failed = results.filter((result) => !result.sent);
  if (failed.length) {
    const configurationError = failed.some((result) => result.configurationError);
    return sendJson(res, configurationError ? 503 : 502, {
      error: failed[0].reason,
      failedRecipients: failed.map((result) => result.email)
    });
  }

  const messages = await getCustomerMessages();
  messages[day].subject = subject;
  messages[day].body = body;
  messages[day].sentAt = sentAt;
  messages[day].sentTo = [...(messages[day].sentTo || []), ...emails.map((email) => ({ email, sentAt }))].slice(-50);
  router.db.set('customerMessages', messages).write();
  void Promise.all(emails.map((email) => supabaseRequest('customer_message_log', 'POST', {
    user_email: email,
    day,
    subject,
    body,
    sent_at: sentAt
  })));
  return sendJson(res, 200, { message: `Message sent to ${emails.length} customer${emails.length === 1 ? '' : 's'}.`, messages });
});

server.post('/api/funds', (req, res) => {
  const email = normalizeEmail(req.body.email);
  const amount = Number(req.body.amount);
  const mode = req.body.mode;
  const withdrawalName = typeof req.body.withdrawalName === 'string' ? req.body.withdrawalName.trim() : '';
  const withdrawalAddress = typeof req.body.withdrawalAddress === 'string' ? req.body.withdrawalAddress.trim() : '';
  const withdrawalNetwork = typeof req.body.withdrawalNetwork === 'string' ? req.body.withdrawalNetwork.trim() : '';

  if (!email || !Number.isFinite(amount) || amount <= 0 || !['deposit', 'withdraw'].includes(mode)) {
    return sendJson(res, 400, { error: 'A valid email, amount, and funds mode are required.' });
  }

  if (mode === 'withdraw' && (!withdrawalName || !withdrawalAddress || !withdrawalNetwork)) {
    return sendJson(res, 400, { error: 'Full name, wallet address, and network are required for withdrawals.' });
  }

  const balance = getBalance(email);
  const approvedDeposits = router.db.get('deposits').value() || [];
  const approvedDepositTotal = approvedDeposits.reduce((total, deposit) => {
    if (deposit.userEmail !== email || deposit.status !== 'approved') return total;
    return total + Number(deposit.amount || 0);
  }, 0);

  if (mode === 'withdraw' && approvedDepositTotal < MINIMUM_WITHDRAWAL_DEPOSIT) {
    return sendJson(res, 400, { error: 'You must have at least $500 in approved deposits before withdrawing funds.' });
  }

  const tradeCount = (router.db.get('orders').value() || []).filter((order) => order.userEmail === email && order.status !== 'rejected').length;
  if (mode === 'withdraw' && tradeCount < MINIMUM_WITHDRAWAL_TRADES) {
    return sendJson(res, 400, { error: `You must complete at least ${MINIMUM_WITHDRAWAL_TRADES} trades before withdrawing funds.` });
  }

  if (mode === 'withdraw' && amount > balance) {
    return sendJson(res, 400, { error: 'Withdrawal amount cannot exceed the available balance.' });
  }

  if (mode === 'withdraw') {
    if (!Array.isArray(router.db.get('withdrawals').value())) {
      router.db.set('withdrawals', []).write();
    }
    const withdrawals = router.db.get('withdrawals').value();
    const withdrawal = {
      userEmail: email,
      amount,
      withdrawalName,
      withdrawalAddress,
      withdrawalNetwork,
      status: 'pending',
      createdAt: new Date().toISOString(),
      id: Date.now()
    };
    withdrawals.push(withdrawal);
    router.db.write();
    setBalance(email, balance - amount);
    void supabaseRequest('withdrawals', 'POST', {
      id: withdrawal.id,
      user_email: withdrawal.userEmail,
      amount: withdrawal.amount,
      withdrawal_name: withdrawal.withdrawalName,
      withdrawal_address: withdrawal.withdrawalAddress,
      withdrawal_network: withdrawal.withdrawalNetwork,
      status: withdrawal.status,
      created_at: withdrawal.createdAt
    }, '?on_conflict=id');
    return sendJson(res, 202, { balance: balance - amount, withdrawal });
  }

  if (!Array.isArray(router.db.get('deposits').value())) {
    router.db.set('deposits', []).write();
  }
  const deposits = router.db.get('deposits').value();
  const deposit = {
    userEmail: email,
    amount,
    method: req.body.method || 'crypto',
    walletNetwork: req.body.walletNetwork || 'bitcoin',
    status: 'pending',
    createdAt: new Date().toISOString(),
    id: Date.now()
  };
  deposits.push(deposit);
  router.db.write();
  void supabaseRequest('deposits', 'POST', {
    id: deposit.id,
    user_email: deposit.userEmail,
    amount: deposit.amount,
    method: deposit.method,
    wallet_network: deposit.walletNetwork,
    status: deposit.status,
    created_at: deposit.createdAt
  }, '?on_conflict=id');
  return sendJson(res, 202, { balance, deposit });
});

server.patch('/api/deposits/:id', (req, res) => {
  const deposits = router.db.get('deposits').value() || [];
  const deposit = deposits.find((item) => String(item.id) === String(req.params.id));
  const status = req.body.status;

  if (!deposit || !['approved', 'rejected'].includes(status)) {
    return sendJson(res, 400, { error: 'A valid deposit and status are required.' });
  }
  if (deposit.status !== 'pending') {
    return sendJson(res, 409, { error: 'This deposit has already been reviewed.' });
  }

  deposit.status = status;
  deposit.reviewedAt = new Date().toISOString();
  if (status === 'approved') {
    const balance = getBalance(deposit.userEmail);
    setBalance(deposit.userEmail, balance + Number(deposit.amount));
    deposit.balanceAfterApproval = balance + Number(deposit.amount);
  }
  router.db.write();
  void supabaseRequest('deposits', 'POST', {
    id: deposit.id,
    user_email: deposit.userEmail,
    amount: deposit.amount,
    method: deposit.method,
    wallet_network: deposit.walletNetwork,
    status: deposit.status,
    balance_after_approval: deposit.balanceAfterApproval,
    created_at: deposit.createdAt,
    reviewed_at: deposit.reviewedAt
  }, '?on_conflict=id');
  return sendJson(res, 200, { deposit });
});

server.post('/users', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const users = router.db.get('users').value() || [];

  if (!email || !req.body.name || !req.body.password) {
    return sendJson(res, 400, { error: 'Name, email, and password are required.' });
  }

  if (users.some((user) => normalizeEmail(user.email) === email)) {
    return sendJson(res, 409, { error: 'An account with this email already exists.' });
  }

  const user = {
    ...req.body,
    email,
    id: req.body.id || Date.now()
  };
  users.push(user);
  router.db.set('users', users).write();
  void supabaseRequest('users', 'POST', supabaseUser(user), '?on_conflict=email');

  const balances = router.db.get('balances').value() || {};
  if (typeof balances[email] !== 'number') {
    balances[email] = WELCOME_BONUS;
    router.db.set('balances', balances).write();
  }

  const welcomeEmailResult = await sendBrevoEmail({
    to: email,
    name: user.name,
    subject: 'Welcome to NovaCrypto',
    textContent: `Hi ${user.name},\n\nYour NovaCrypto account is ready. Complete your payment and wait for owner approval before trading.\n\nNovaCrypto`,
    htmlContent: `<p>Hi ${escapeHtml(user.name)},</p><p>Your NovaCrypto account is ready. Complete your payment and wait for owner approval before trading.</p><p>NovaCrypto</p>`
  });
  return sendJson(res, 201, { ...user, welcomeEmailSent: welcomeEmailResult.sent });
});

server.get('/api/admin/customers', (req, res) => {
  const users = router.db.get('users').value() || [];
  return sendJson(res, 200, users.map(({ password, ...user }) => user));
});

server.post('/api/orders', async (req, res) => {
  const email = normalizeEmail(req.body.userEmail);
  const asset = String(req.body.asset || '').toUpperCase();
  const side = String(req.body.side || '').toLowerCase();
  const amount = Number(req.body.amount);
  const price = marketPrices[asset];

  if (!email || !marketPrices[asset] || !['buy', 'sell'].includes(side) || !Number.isFinite(amount) || amount <= 0) {
    return sendJson(res, 400, { error: 'Invalid order details.' });
  }

  const total = Number((price * amount).toFixed(8));
  const balance = getBalance(email);
  const currentHolding = Number(getHoldings(email)[asset] || 0);
  if (side === 'buy' && total > balance) {
    return sendJson(res, 400, { error: 'Insufficient available balance for this order.' });
  }
  if (side === 'sell' && amount > currentHolding) {
    return sendJson(res, 400, { error: `Insufficient ${asset} holdings for this order.` });
  }

  const nextBalance = side === 'buy' ? balance - total : balance + total;
  setBalance(email, nextBalance);
  setHolding(email, asset, side === 'buy' ? currentHolding + amount : currentHolding - amount);
  const order = {
    userEmail: email,
    asset,
    side,
    orderType: req.body.orderType || 'Market',
    amount,
    price,
    total,
    status: 'open',
    createdAt: new Date().toISOString(),
    id: Date.now()
  };
  router.db.get('orders').push(order).write();
  const supabaseSynced = await supabaseRequest('orders', 'POST', supabaseOrder(order), '?on_conflict=id');
  return sendJson(res, 201, { order, balance: nextBalance, holdings: getHoldings(email), supabaseSynced });
});

server.use((req, res, next) => {
  if ((req.method === 'PUT' && req.path === '/balances') || (req.method === 'POST' && req.path === '/orders')) {
    return sendJson(res, 405, { error: 'Use the server-owned trading or funds endpoint.' });
  }
  next();
});

server.put('/payments', async (req, res) => {
  const payments = req.body && typeof req.body === 'object' ? req.body : {};
  const previousPayments = router.db.get('payments').value() || {};
  router.db.set('payments', payments).write();
  const users = router.db.get('users').value() || [];
  const userSyncResults = await Promise.all(users.map((user) => supabaseRequest('users', 'POST', supabaseUser(user), '?on_conflict=email')));
  const paymentSyncResults = await Promise.all(Object.entries(payments).flatMap(([email, payment]) => {
    const paymentSync = supabaseRequest('payments', 'POST', {
        id: payment.id || undefined,
        user_email: normalizeEmail(email),
        plan: payment.plan || 'Pro',
        price: payment.price || '',
        payment_method: payment.paymentMethod || 'crypto',
        wallet_address: payment.walletAddress,
        wallet_network: payment.walletNetwork,
        crypto_amount: payment.cryptoAmount,
        receipt_name: payment.receiptName,
        receipt_type: payment.receiptType,
        receipt_data: payment.receiptData,
        status: payment.status || 'pending',
        payment_note: payment.paymentNote || '',
        submitted_at: payment.submittedAt || new Date().toISOString(),
        reviewed_at: payment.reviewedAt
      }, '?on_conflict=user_email');
    const emailAddress = normalizeEmail(email);
    const user = users.find((item) => normalizeEmail(item.email) === emailAddress);
    const recipientName = user?.name || 'there';
    const safeRecipientName = escapeHtml(recipientName);
    const safePlan = escapeHtml(payment.plan || 'Pro');
    const safePrice = escapeHtml(payment.price || 'Paid');
    const approvalEmail = payment.status === 'approved' && previousPayments[email]?.status !== 'approved'
      ? sendBrevoEmail({
        to: emailAddress,
            name: recipientName,
            subject: 'Payment approved - welcome to NovaCrypto',
            textContent: `Hi ${recipientName}, your ${payment.plan || 'Pro'} payment (${payment.price || 'Paid'}) has been approved. You can now sign in and access your NovaCrypto trading dashboard.`,
            htmlContent: `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f4f7fb;color:#172033;font-family:Arial,sans-serif;">
    <div style="padding:36px 16px;">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e1e7f0;border-radius:16px;overflow:hidden;">
        <div style="padding:28px 32px;background:#102a43;color:#ffffff;">
          <div style="font-size:13px;letter-spacing:2px;font-weight:bold;color:#8ee6c8;">NOVACRYPTO</div>
          <h1 style="margin:18px 0 0;font-size:28px;line-height:1.2;">Payment approved</h1>
        </div>
        <div style="padding:32px;">
          <p style="margin:0 0 18px;font-size:17px;">Hi ${safeRecipientName},</p>
          <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#526174;">Your payment has been reviewed and approved. Your NovaCrypto trading access is now active.</p>
          <div style="margin:0 0 26px;padding:18px 20px;background:#f0fbf7;border-left:4px solid #27ae88;border-radius:8px;">
            <div style="margin-bottom:8px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#52706a;">Subscription</div>
            <strong style="font-size:18px;color:#102a43;">${safePlan}</strong>
            <div style="margin-top:6px;color:#526174;">${safePrice}</div>
          </div>
          <p style="margin:26px 0 0;font-size:14px;line-height:1.6;color:#718096;">Sign in with the email address you used during registration. Thank you for choosing NovaCrypto.</p>
        </div>
        <div style="padding:18px 32px;background:#f8fafc;color:#8793a5;font-size:12px;">This is an automated account approval message from NovaCrypto.</div>
      </div>
    </div>
  </body>
</html>`
      })
      : Promise.resolve(false);
    return [paymentSync.then((success) => ({ type: 'payment', success })), approvalEmail.then((success) => ({ type: 'email', success }))];
  }));
  const syncFailed = userSyncResults.some((result) => !result) || paymentSyncResults.some((result) => result.type === 'payment' && !result.success);
  if (syncFailed) {
    console.warn('Payment saved locally, but Supabase synchronization failed.');
    return sendJson(res, 200, { ...payments, syncWarning: 'Payment saved locally; cloud synchronization is pending.' });
  }
  return sendJson(res, 200, payments);
});

server.get('/api/admin/data', async (req, res) => {
  try {
    const [users, balances, holdings, orders, deposits, withdrawals, payments, chatMessages] = await Promise.all([
      supabaseRead('users'),
      supabaseRead('balances'),
      supabaseRead('holdings'),
      supabaseRead('orders'),
      supabaseRead('deposits'),
      supabaseRead('withdrawals'),
      supabaseRead('payments'),
      supabaseRead('chat_messages')
    ]);

    return sendJson(res, 200, {
      source: 'supabase',
      users: users.map(({ password_hash, ...user }) => user),
      balances: Object.fromEntries(balances.map((item) => [item.user_email, Number(item.amount)])),
      holdings: holdings.map((item) => ({
        userEmail: item.user_email,
        asset: item.asset,
        quantity: Number(item.quantity),
        updatedAt: item.updated_at
      })),
      orders: orders.map((item) => ({
        id: item.id,
        userEmail: item.user_email,
        asset: item.asset,
        side: item.side,
        orderType: item.order_type,
        amount: Number(item.amount),
        price: Number(item.price),
        total: Number(item.total),
        status: item.status,
        createdAt: item.created_at
      })),
      deposits: deposits.map((item) => ({
        id: item.id,
        userEmail: item.user_email,
        amount: Number(item.amount),
        method: item.method,
        walletNetwork: item.wallet_network,
        status: item.status,
        balanceAfterApproval: item.balance_after_approval,
        createdAt: item.created_at,
        reviewedAt: item.reviewed_at
      })),
      withdrawals: withdrawals.map((item) => ({
        id: item.id,
        userEmail: item.user_email,
        amount: Number(item.amount),
        withdrawalName: item.withdrawal_name,
        withdrawalAddress: item.withdrawal_address,
        withdrawalNetwork: item.withdrawal_network,
        status: item.status,
        createdAt: item.created_at,
        reviewedAt: item.reviewed_at
      })),
      payments: Object.fromEntries(payments.map((item) => [item.user_email, {
        plan: item.plan,
        price: item.price,
        paymentMethod: item.payment_method,
        walletAddress: item.wallet_address,
        walletNetwork: item.wallet_network,
        cryptoAmount: item.crypto_amount,
        receiptName: item.receipt_name,
        receiptType: item.receipt_type,
        receiptData: item.receipt_data,
        status: item.status,
        paymentNote: item.payment_note,
        submittedAt: item.submitted_at,
        reviewedAt: item.reviewed_at
      }])),
      chatMessages: chatMessages.map((item) => ({
        id: item.id,
        userEmail: item.user_email,
        author: item.author,
        message: item.message,
        createdAt: item.created_at
      }))
    });
  } catch (error) {
    console.warn(`Supabase admin read failed: ${error.message}`);
    const localData = router.db.value();
    const localUsers = (localData.users || []).map(({ password, password_hash, ...user }) => user);
    const localHoldings = Object.entries(localData.holdings || {}).flatMap(([userEmail, assets]) =>
      Object.entries(assets || {}).map(([asset, quantity]) => ({ userEmail, asset, quantity: Number(quantity) }))
    );

    return sendJson(res, 200, {
      source: 'local',
      users: localUsers,
      balances: localData.balances || {},
      holdings: localHoldings,
      orders: localData.orders || [],
      deposits: localData.deposits || [],
      withdrawals: localData.withdrawals || [],
      payments: localData.payments || {},
      chatMessages: localData.messages || []
    });
  }
});

server.use(router);
server.listen(port, () => {
  console.log(`JSON Server is running on http://localhost:${port}`);
  console.log(`Saving data to ${databasePath}`);
  if (!SUPABASE_SERVICE_ROLE_KEY) console.warn('Supabase sync disabled: set SUPABASE_SERVICE_ROLE_KEY in the server environment.');
  refreshMarketPrices();
  setInterval(refreshMarketPrices, 60000);
});
