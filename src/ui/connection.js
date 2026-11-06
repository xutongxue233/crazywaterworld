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
  const scroller = el('div', 'income-scroll');
  scroller.appendChild(table);
  box.appendChild(scroller);
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
