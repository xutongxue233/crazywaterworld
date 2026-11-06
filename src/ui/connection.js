const reconnectFields = {
  base: $('reconnect-base'), max: $('reconnect-max'), attempts: $('reconnect-attempts'),
  kicked: $('reconnect-kicked'), kickedMinutes: $('reconnect-kicked-minutes'),
};
const reconnectToggle = $('reconnect-enabled'), reconnectSave = $('reconnect-save');
let reconnectAccount = null, reconnectEdited = false, reconnectSaving = false;

function setSettingSwitch(input, enabled) {
  input.disabled = false;
  input.setAttribute('aria-checked', String(enabled));
  input.dataset.state = enabled ? 'checked' : 'unchecked';
  input.querySelector('[data-slot=switch-thumb]').dataset.state = input.dataset.state;
}
const settingSwitchOn = input => input.getAttribute('aria-checked') === 'true';

function renderReconnect(data) {
  refreshNotify();
  if (reconnectAccount !== current) reconnectEdited = false;
  reconnectAccount = current;
  if (reconnectEdited || reconnectSaving) return;
  const saved = data.reconnect;
  setSettingSwitch(reconnectToggle, saved.enabled);
  reconnectFields.base.value = saved.baseSeconds;
  reconnectFields.max.value = saved.maxSeconds;
  reconnectFields.attempts.value = saved.maxAttempts;
  reconnectFields.kicked.value = saved.kicked;
  reconnectFields.kickedMinutes.value = saved.kickedMinutes;
  for (const input of Object.values(reconnectFields)) input.disabled = false;
  reconnectFields.kickedMinutes.disabled = saved.kicked !== 'retry';
  reconnectSave.disabled = true;
}

function reconnectChanged() {
  reconnectEdited = true;
  reconnectFields.kickedMinutes.disabled = reconnectFields.kicked.value !== 'retry';
  reconnectSave.disabled = false;
  $('reconnect-hint').textContent = '';
}
for (const input of Object.values(reconnectFields)) input.addEventListener('input', reconnectChanged);
reconnectToggle.onclick = () => {
  setSettingSwitch(reconnectToggle, !settingSwitchOn(reconnectToggle));
  reconnectChanged();
};

$('reconnect-form').onsubmit = async event => {
  event.preventDefault();
  const account = current;
  if (!account || reconnectSaving || account !== reconnectAccount) return;
  reconnectSaving = true;
  reconnectSave.disabled = true;
  try {
    await call('/api/loop/reconnect', { method: 'POST', body: JSON.stringify({
      enabled: settingSwitchOn(reconnectToggle),
      baseSeconds: reconnectFields.base.valueAsNumber,
      maxSeconds: reconnectFields.max.valueAsNumber,
      maxAttempts: reconnectFields.attempts.valueAsNumber,
      kicked: reconnectFields.kicked.value,
      kickedMinutes: reconnectFields.kickedMinutes.valueAsNumber,
    }) });
    if (account === current) {
      reconnectEdited = false;
      $('reconnect-hint').textContent = '已保存';
    }
  } catch (error) {
    if (account === current) {
      reconnectSave.disabled = false;
      reportError(error);
    }
  } finally {
    reconnectSaving = false;
    if (account === current) refreshLoop();
  }
};

const notifySave = $('notify-save'), notifyTest = $('notify-test');
const notifyWebhook = $('notify-webhook'), notifyFormat = $('notify-format');
let notifyLoaded = false, notifyEdited = false;

function notifyChanged() {
  notifyEdited = true;
  notifySave.disabled = false;
  notifyTest.disabled = true;
  $('notify-hint').textContent = '保存后才能发送测试通知';
}

function renderNotify({ settings, events }) {
  notifyWebhook.value = settings.webhookUrl;
  notifyFormat.value = settings.webhookFormat;
  notifyWebhook.disabled = notifyFormat.disabled = false;
  const box = clear($('notify-events'));
  for (const { key, label } of events) {
    const row = el('label', 'notify-event');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.dataset.notifyEvent = key;
    input.checked = settings.events[key] === true;
    input.onchange = notifyChanged;
    row.append(input, el('span', '', label));
    box.appendChild(row);
  }
  notifySave.disabled = true;
  notifyTest.disabled = false;
}

async function refreshNotify() {
  if (notifyLoaded || notifyEdited) return;
  try {
    renderNotify(await call('/api/notify'));
    notifyLoaded = true;
  } catch (error) {
    reportError(error);
  }
}

notifyWebhook.addEventListener('input', notifyChanged);
notifyFormat.addEventListener('input', notifyChanged);

$('notify-form').onsubmit = async event => {
  event.preventDefault();
  notifySave.disabled = true;
  const events = {};
  for (const input of document.querySelectorAll('[data-notify-event]')) events[input.dataset.notifyEvent] = input.checked;
  try {
    await call('/api/notify/save', { method: 'POST', body: JSON.stringify({
      webhookUrl: notifyWebhook.value, webhookFormat: notifyFormat.value, events,
    }) });
    notifyEdited = false;
    notifyTest.disabled = false;
    $('notify-hint').textContent = '已保存';
  } catch (error) {
    notifySave.disabled = false;
    reportError(error);
  }
};

notifyTest.onclick = async () => {
  notifyTest.disabled = true;
  $('notify-hint').textContent = '正在发送';
  try {
    await call('/api/notify/test', { method: 'POST', body: '{}' });
    $('notify-hint').textContent = '测试通知已发送';
  } catch (error) {
    $('notify-hint').textContent = '';
    reportError(error);
  } finally {
    notifyTest.disabled = false;
  }
};

let incomeAccount = null, incomeAt = 0, incomePending = false;
const signed = value => (value === null ? '-' : (value > 0 ? '+' : '') + value.toLocaleString('zh-CN'));

function renderIncome({ fields, days }) {
  const box = clear($('income-view'));
  if (!days.length) {
    box.appendChild(el('span', 'dim', '挂机运行后开始记录'));
    return;
  }
  const table = document.createElement('table');
  const head = table.createTHead().insertRow();
  for (const title of ['日期', ...fields.map(field => field.label), '轮数', '失败', '掉线']) {
    const cell = document.createElement('th');
    cell.textContent = title;
    head.appendChild(cell);
  }
  const body = table.createTBody();
  for (const day of days) {
    const row = body.insertRow();
    row.insertCell().textContent = day.date;
    for (const field of fields) row.insertCell().textContent = signed(day.delta[field.key]);
    for (const value of [day.rounds, day.failures, day.outages]) row.insertCell().textContent = value;
  }
  box.appendChild(table);
  box.appendChild(el('p', 'dim', '按北京时间统计账号余额的净变化，消耗也会计入，因此可能为负。'));
}

async function refreshIncome() {
  const account = current;
  if (!account || incomePending || (incomeAccount === account && Date.now() - incomeAt < 60_000)) return;
  incomePending = true;
  try {
    const data = await call('/api/income');
    incomeAccount = account;
    incomeAt = Date.now();
    if (account === current) renderIncome(data);
  } catch (error) {
    reportError(error);
  } finally {
    incomePending = false;
  }
}
