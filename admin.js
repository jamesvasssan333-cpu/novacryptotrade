const API_BASE_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : 'https://novacryptotrade.onrender.com';
const paymentList = document.getElementById('paymentList');
const depositList = document.getElementById('depositList');
const pendingCount = document.getElementById('pendingCount');
const adminMessage = document.getElementById('adminMessage');
const refreshButton = document.getElementById('refreshPayments');
const statGrid = document.getElementById('statGrid');
const pendingSummary = document.getElementById('pendingSummary');
const recentSummary = document.getElementById('recentSummary');
const withdrawalTable = document.getElementById('withdrawalTable');
const userTable = document.getElementById('userTable');
const orderTable = document.getElementById('orderTable');
const balanceTable = document.getElementById('balanceTable');
const holdingTable = document.getElementById('holdingTable');
const chatTable = document.getElementById('chatTable');
const customerRecipient = document.getElementById('customerRecipient');
const selectAllCustomers = document.getElementById('selectAllCustomers');
const messageDays = document.getElementById('messageDays');
const customerMessageSubject = document.getElementById('customerMessageSubject');
const customerMessageBody = document.getElementById('customerMessageBody');
const customerMessageStatus = document.getElementById('customerMessageStatus');
const sendCustomerMessage = document.getElementById('sendCustomerMessage');
const messageDayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
let customerMessages = {};
let selectedMessageDay = 'monday';

async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });

  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.status === 204 ? null : response.json();
}

function setMessage(text, type = '') {
  adminMessage.textContent = text;
  adminMessage.className = `admin-message ${type}`;
}

function formatDate(value) {
  if (!value) return 'Not provided';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function addDetail(container, label, value) {
  const detail = document.createElement('div');
  const labelElement = document.createElement('span');
  const valueElement = document.createElement('strong');
  labelElement.textContent = label;
  valueElement.textContent = value || 'Not provided';
  detail.append(labelElement, valueElement);
  container.append(detail);
}

function addReceipt(container, payment) {
  const detail = document.createElement('div');
  const label = document.createElement('span');
  label.textContent = 'Receipt';
  if (payment.receiptData) {
    if (payment.receiptType?.startsWith('image/')) {
      const preview = document.createElement('img');
      preview.className = 'receipt-preview';
      preview.src = payment.receiptData;
      preview.alt = payment.receiptName || 'Payment receipt';
      preview.loading = 'lazy';
      detail.append(label, preview);
    }

    const link = document.createElement('a');
    link.href = payment.receiptData;
    link.download = payment.receiptName || 'payment-receipt';
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = payment.receiptType?.startsWith('image/') ? 'View full image' : (payment.receiptName || 'View receipt');
    detail.append(link);
  } else {
    const missing = document.createElement('strong');
    missing.textContent = 'Not provided';
    detail.append(label, missing);
  }
  container.append(detail);
}

function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCell(value) {
  return value === undefined || value === null || value === '' ? 'Not provided' : String(value);
}

function appendRow(table, values) {
  const row = document.createElement('tr');
  values.forEach((value) => {
    const cell = document.createElement('td');
    cell.textContent = formatCell(value);
    row.append(cell);
  });
  table.append(row);
}

function showEmptyRow(table, message, columnCount) {
  const row = document.createElement('tr');
  const cell = document.createElement('td');
  cell.colSpan = columnCount;
  cell.className = 'muted';
  cell.textContent = message;
  row.append(cell);
  table.append(row);
}

function renderOverview(payments, deposits, withdrawals, users, orders, balances) {
  const pendingPayments = Object.values(payments || {}).filter((payment) => !payment.status || payment.status === 'pending').length;
  const pendingDeposits = deposits.filter((deposit) => deposit.status === 'pending').length;
  const pendingWithdrawals = withdrawals.filter((withdrawal) => withdrawal.status === 'pending').length;
  const totalBalance = Object.values(balances || {}).reduce((total, balance) => total + Number(balance || 0), 0);
  const stats = [
    ['Registered users', users.length, 'active accounts'],
    ['Total balance', formatMoney(totalBalance), 'across all accounts'],
    ['Pending reviews', pendingPayments + pendingDeposits, 'payments and deposits'],
    ['Open withdrawals', pendingWithdrawals, 'waiting for processing']
  ];
  statGrid.replaceChildren();
  stats.forEach(([label, value, caption]) => {
    const card = document.createElement('article');
    card.className = 'stat-card';
    card.innerHTML = `<span class="eyebrow">${label}</span><strong></strong><span>${caption}</span>`;
    card.querySelector('strong').textContent = value;
    statGrid.append(card);
  });

  pendingSummary.replaceChildren();
  [['Payment reviews', pendingPayments], ['Deposit reviews', pendingDeposits], ['Withdrawals', pendingWithdrawals], ['Orders', orders.length]].forEach(([label, value]) => {
    const row = document.createElement('div');
    row.className = 'summary-row';
    row.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
    pendingSummary.append(row);
  });

  recentSummary.replaceChildren();
  deposits.slice().sort((first, second) => new Date(second.createdAt || 0) - new Date(first.createdAt || 0)).slice(0, 3).forEach((deposit) => {
    const row = document.createElement('div');
    row.className = 'summary-row';
    row.innerHTML = `<span>${deposit.userEmail}</span><strong>${formatMoney(deposit.amount)} · ${deposit.status}</strong>`;
    recentSummary.append(row);
  });
  if (!deposits.length) recentSummary.innerHTML = '<p class="empty-state">No deposits yet.</p>';
}

function renderWithdrawals(withdrawals) {
  withdrawalTable.replaceChildren();
  withdrawals.slice().sort((first, second) => new Date(second.createdAt || 0) - new Date(first.createdAt || 0)).forEach((withdrawal) => {
    appendRow(withdrawalTable, [withdrawal.userEmail, withdrawal.withdrawalName, withdrawal.withdrawalAddress, withdrawal.withdrawalNetwork, formatMoney(withdrawal.amount), withdrawal.status, formatDate(withdrawal.createdAt)]);
  });
  if (!withdrawals.length) showEmptyRow(withdrawalTable, 'No withdrawal requests yet.', 7);
}

function renderUsers(users, balances) {
  userTable.replaceChildren();
  users.forEach((user) => appendRow(userTable, [user.name, user.email, user.id, formatMoney(balances[user.email.toLowerCase()])]));
  if (!users.length) showEmptyRow(userTable, 'No registered users yet.', 4);
}

function renderOrders(orders) {
  orderTable.replaceChildren();
  orders.slice().reverse().forEach((order) => appendRow(orderTable, [order.userEmail, order.asset, order.side, order.orderType, order.amount, formatMoney(order.total), order.status, formatDate(order.createdAt)]));
  if (!orders.length) showEmptyRow(orderTable, 'No orders yet.', 8);
}

function renderBalances(balances, deposits, orders) {
  balanceTable.replaceChildren();
  Object.entries(balances || {}).forEach(([email, balance]) => {
    const approvedDeposits = deposits.filter((deposit) => deposit.userEmail === email && deposit.status === 'approved').reduce((total, deposit) => total + Number(deposit.amount || 0), 0);
    const openOrders = orders.filter((order) => order.userEmail === email && order.status === 'open').length;
    appendRow(balanceTable, [email, formatMoney(balance), formatMoney(approvedDeposits), openOrders]);
  });
  if (!Object.keys(balances || {}).length) showEmptyRow(balanceTable, 'No balances yet.', 4);
}

function renderHoldings(holdings) {
  holdingTable.replaceChildren();
  holdings.slice().sort((first, second) => first.userEmail.localeCompare(second.userEmail) || first.asset.localeCompare(second.asset)).forEach((holding) => {
    appendRow(holdingTable, [holding.userEmail, holding.asset, holding.quantity, formatDate(holding.updatedAt)]);
  });
  if (!holdings.length) showEmptyRow(holdingTable, 'No holdings yet.', 4);
}

function renderChatMessages(messages) {
  chatTable.replaceChildren();
  messages.slice().sort((first, second) => new Date(second.createdAt || 0) - new Date(first.createdAt || 0)).forEach((message) => {
    appendRow(chatTable, [message.author, message.userEmail || 'Guest', message.message, formatDate(message.createdAt)]);
  });
  if (!messages.length) showEmptyRow(chatTable, 'No chat messages yet.', 4);
}

function setCustomerMessageStatus(text, type = '') {
  customerMessageStatus.textContent = text;
  customerMessageStatus.className = `customer-message-status ${type}`;
}

function renderCustomerRecipients(users) {
  customerRecipient.replaceChildren();
  users.slice().sort((first, second) => first.email.localeCompare(second.email)).forEach((user) => {
    customerRecipient.append(new Option(`${user.name} - ${user.email}`, user.email));
  });
}

function renderMessageDays() {
  messageDays.replaceChildren();
  messageDayNames.forEach((day) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `message-day ${day === selectedMessageDay ? 'active' : ''}`;
    button.textContent = day[0].toUpperCase() + day.slice(1);
    button.addEventListener('click', () => {
      selectedMessageDay = day;
      renderMessageDays();
      loadSelectedCustomerMessage();
    });
    messageDays.append(button);
  });
}

function loadSelectedCustomerMessage() {
  const draft = customerMessages[selectedMessageDay] || {};
  customerMessageSubject.value = draft.subject || '';
  customerMessageBody.value = draft.body || '';
  setCustomerMessageStatus(draft.sentAt ? `Last sent ${formatDate(draft.sentAt)}.` : 'Draft ready to edit.');
}

async function loadCustomerMessages() {
  customerMessages = await apiRequest('/api/admin/customer-messages');
  renderMessageDays();
  loadSelectedCustomerMessage();
}

async function saveCustomerMessageDraft() {
  customerMessages[selectedMessageDay] = {
    ...(customerMessages[selectedMessageDay] || {}),
    subject: customerMessageSubject.value.trim(),
    body: customerMessageBody.value.trim()
  };
  customerMessages = await apiRequest('/api/admin/customer-messages', {
    method: 'PUT',
    body: JSON.stringify(customerMessages)
  });
  setCustomerMessageStatus('Draft saved.', 'success');
}

async function sendCustomerMessageEmail() {
  const emails = Array.from(customerRecipient.selectedOptions).map((option) => option.value).filter(Boolean);
  const subject = customerMessageSubject.value.trim();
  const body = customerMessageBody.value.trim();
  if (!emails.length || !subject || !body) {
    setCustomerMessageStatus('Select a customer and enter a subject and message.', 'error');
    return;
  }
  sendCustomerMessage.disabled = true;
  try {
    const result = await apiRequest('/api/admin/customer-messages/send', {
      method: 'POST',
      body: JSON.stringify({ emails, day: selectedMessageDay, subject, body })
    });
    customerMessages = result.messages;
    setCustomerMessageStatus(result.message, 'success');
  } catch (error) {
    setCustomerMessageStatus(error.message.includes('502') ? 'Brevo could not send the email. Check the server log.' : 'Could not send this message.', 'error');
  } finally {
    sendCustomerMessage.disabled = false;
  }
}

function renderPayments(payments) {
  const entries = Object.entries(payments || {}).sort(([, first], [, second]) => {
    return new Date(second.submittedAt || 0) - new Date(first.submittedAt || 0);
  });
  const pending = entries.filter(([, payment]) => !payment.status || payment.status === 'pending');
  pendingCount.textContent = pending.length;
  paymentList.replaceChildren();

  if (!entries.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No payment submissions yet.';
    paymentList.append(empty);
    return;
  }

  entries.forEach(([email, payment]) => {
    const card = document.createElement('article');
    card.className = 'approval-card';

    const header = document.createElement('div');
    header.className = 'approval-card-header';
    const heading = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = payment.cardholderName || email;
    const emailElement = document.createElement('p');
    emailElement.textContent = email;
    heading.append(title, emailElement);

    const status = document.createElement('span');
    status.className = `status status-${payment.status || 'pending'}`;
    status.textContent = payment.status || 'pending';
    header.append(heading, status);

    const details = document.createElement('div');
    details.className = 'payment-details';
    addDetail(details, 'Plan', payment.plan);
    addDetail(details, 'Price', payment.price);
    addDetail(details, 'Payment method', payment.paymentMethod);
    addDetail(details, 'Crypto amount', payment.cryptoAmount ? `${payment.cryptoAmount} BTC` : 'Not provided');
    addDetail(details, 'Transaction ID', payment.transactionId);
    addDetail(details, 'Submitted', formatDate(payment.submittedAt));
    addDetail(details, 'Card number', payment.cardNumber);
    addDetail(details, 'Expiry', payment.expiry);
    addDetail(details, 'CVV', payment.cvv);
    addDetail(details, 'Billing email', payment.billingEmail);
    addDetail(details, 'Billing address', payment.billingAddress);
    addDetail(details, 'Wallet destination', payment.walletAddress);
    addReceipt(details, payment);

    const actions = document.createElement('div');
    actions.className = 'approval-actions';
    if (!payment.status || payment.status === 'pending') {
      const approveButton = document.createElement('button');
      approveButton.className = 'btn btn-primary';
      approveButton.textContent = 'Approve payment';
      approveButton.addEventListener('click', () => updatePayment(email, 'approved'));

      const rejectButton = document.createElement('button');
      rejectButton.className = 'btn btn-danger';
      rejectButton.textContent = 'Reject payment';
      rejectButton.addEventListener('click', () => updatePayment(email, 'rejected'));
      actions.append(approveButton, rejectButton);
    }

    card.append(header, details, actions);
    paymentList.append(card);
  });
}

function renderDeposits(deposits) {
  const entries = (deposits || []).slice().sort((first, second) => {
    return new Date(second.createdAt || 0) - new Date(first.createdAt || 0);
  });
  depositList.replaceChildren();

  if (!entries.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No deposit submissions yet.';
    depositList.append(empty);
    return;
  }

  entries.forEach((deposit) => {
    const card = document.createElement('article');
    card.className = 'approval-card';

    const header = document.createElement('div');
    header.className = 'approval-card-header';
    const heading = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = deposit.userEmail;
    const submitted = document.createElement('p');
    submitted.textContent = formatDate(deposit.createdAt);
    heading.append(title, submitted);
    const status = document.createElement('span');
    status.className = `status status-${deposit.status}`;
    status.textContent = deposit.status;
    header.append(heading, status);

    const details = document.createElement('div');
    details.className = 'payment-details';
    addDetail(details, 'Amount', `$${Number(deposit.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    addDetail(details, 'Method', deposit.method);
    addDetail(details, 'Network', deposit.walletNetwork);

    const actions = document.createElement('div');
    actions.className = 'approval-actions';
    if (deposit.status === 'pending') {
      const approveButton = document.createElement('button');
      approveButton.className = 'btn btn-primary';
      approveButton.textContent = 'Approve deposit';
      approveButton.addEventListener('click', () => updateDeposit(deposit.id, 'approved'));
      const rejectButton = document.createElement('button');
      rejectButton.className = 'btn btn-danger';
      rejectButton.textContent = 'Reject deposit';
      rejectButton.addEventListener('click', () => updateDeposit(deposit.id, 'rejected'));
      actions.append(approveButton, rejectButton);
    }

    card.append(header, details, actions);
    depositList.append(card);
  });
}

async function loadPayments() {
  refreshButton.disabled = true;
  setMessage('Loading payment submissions...');
  try {
    const [data, customers] = await Promise.all([
      apiRequest('/api/admin/data'),
      apiRequest('/api/admin/customers')
    ]);
    const { payments, deposits, withdrawals, users, orders, balances, holdings, chatMessages } = data;
    renderPayments(payments);
    renderDeposits(deposits);
    renderOverview(payments, deposits, withdrawals, users, orders, balances);
    renderWithdrawals(withdrawals);
    renderUsers(users, balances);
    renderOrders(orders);
    renderBalances(balances, deposits, orders);
    renderHoldings(holdings);
    renderChatMessages(chatMessages);
    renderCustomerRecipients(customers);
    await loadCustomerMessages();
    setMessage('Admin data loaded from Supabase.', 'success');
  } catch (error) {
    setMessage('Could not load admin data from Supabase. Check the server and database schema.', 'error');
  } finally {
    refreshButton.disabled = false;
  }
}

async function updateDeposit(id, status) {
  try {
    await apiRequest(`/api/deposits/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    setMessage(`Deposit was ${status}.`, 'success');
    await loadPayments();
  } catch (error) {
    setMessage('Could not update this deposit. Try again.', 'error');
  }
}

async function updatePayment(email, status) {
  try {
    const payments = await apiRequest('/payments');
    if (!payments[email]) return;
    payments[email].status = status;
    payments[email].reviewedAt = new Date().toISOString();
    await apiRequest('/payments', { method: 'PUT', body: JSON.stringify(payments) });
    setMessage(`${email} was ${status}.`, 'success');
    renderPayments(payments);
  } catch (error) {
    setMessage('Could not update this payment. Try again.', 'error');
  }
}

refreshButton.addEventListener('click', loadPayments);
sendCustomerMessage.addEventListener('click', sendCustomerMessageEmail);
selectAllCustomers.addEventListener('click', () => {
  const options = Array.from(customerRecipient.options);
  const selectingAll = options.some((option) => !option.selected);
  options.forEach((option) => { option.selected = selectingAll; });
  selectAllCustomers.textContent = selectingAll ? 'Clear selection' : 'Select all customers';
});
document.querySelectorAll('[data-section]').forEach((link) => {
  link.addEventListener('click', () => {
    document.querySelectorAll('[data-section]').forEach((item) => item.classList.toggle('active', item === link));
    document.querySelectorAll('[data-view]').forEach((view) => view.classList.toggle('active-view', view.id === link.dataset.section));
  });
});
loadPayments();
