// 支付宝网页扫码登录，二维码和待保存凭证由本机服务维护。
let alipayState = null;
let alipayBusy = false;
let alipayGeneration = 0;
let alipayTimer = null;
let alipayPollFailures = 0;
let alipayChoiceId = '';
let alipaySelectedRole = null;
const alipayLoginPath = '/api/accounts/alipay-login';

function selectedAlipayRole() {
  return alipayState?.choices?.find(choice => choice.id === alipayChoiceId);
}

function alipayRoleWorld(role) {
  return role.roleWorldName || role.worldName || '区服 ' + role.worldId;
}

function receiveAlipayState(state) {
  if (state.id !== alipayState?.id) alipaySelectedRole = null;
  alipayState = state;
  if (state.phase !== 'captured') return;
  const choices = state.choices || [];
  if (!choices.length && state.roleError) {
    alipayChoiceId = '';
    return;
  }
  const previous = alipaySelectedRole;
  const selected = choices.find(choice => choice.accountId === previous?.accountId && choice.worldId === previous?.worldId)
    || (choices.length === 1 ? choices[0] : null);
  alipaySelectedRole = selected;
  alipayChoiceId = selected?.id || '';
}

function renderAlipayRoles() {
  const box = clear($('alipay-roles'));
  const captured = alipayState?.phase === 'captured';
  box.hidden = !captured;
  if (!captured) return;
  const choices = alipayState.choices || [];
  if (!choices.length) {
    if (!alipayState.roleError) box.appendChild(el('p', 'dim', '当前支付宝账号暂无可选择的游戏角色，请核对账号和游戏渠道后重试。'));
    return;
  }
  const list = el('fieldset', 'phone-roles');
  list.appendChild(el('legend', null, '选择区服和游戏角色'));
  for (const choice of choices) {
    const row = el('label', 'phone-role');
    const input = el('input');
    input.type = 'radio';
    input.name = 'alipay-role';
    input.value = choice.id;
    input.checked = choice.id === alipayChoiceId;
    input.disabled = alipayBusy || Boolean(alipayState.roleError) || alipayState.expiresAt <= Date.now();
    input.onchange = () => {
      if (!input.checked || input.disabled || alipayBusy || alipayState?.phase !== 'captured'
        || alipayState.roleError || alipayState.expiresAt <= Date.now()) return;
      const selected = alipayState.choices.find(role => role.id === input.value);
      if (!selected) return;
      alipayChoiceId = selected.id;
      alipaySelectedRole = selected;
      $('alipay-save').disabled = false;
      $('alipay-result').textContent = '已选择 ' + (selected.nickname || '未命名角色') + ' · ' + alipayRoleWorld(selected);
    };
    const info = el('div', 'phone-role-info');
    const heading = el('div', 'phone-role-heading');
    heading.append(el('strong', null, choice.nickname || '未命名角色'), el('span', null, alipayRoleWorld(choice)));
    info.appendChild(heading);
    const stats = [];
    if (choice.level != null) stats.push('等级 ' + choice.level);
    if (choice.power != null) stats.push('战力 ' + Number(choice.power).toLocaleString('zh-CN'));
    if (stats.length) info.appendChild(el('p', 'dim', stats.join(' · ')));
    if (choice.roleWorldId && String(choice.roleWorldId) !== String(choice.worldId)) {
      info.appendChild(el('p', 'dim', '原区服 ' + (choice.worldName || choice.worldId) + '，合服后位于 ' + alipayRoleWorld(choice)));
    }
    if (choice.matched) info.appendChild(el('p', 'dim', '此账号已有保存记录，再次保存会更新所选角色和区服。'));
    row.append(input, info);
    list.appendChild(row);
  }
  box.appendChild(list);
}

function renderAlipayLogin() {
  const state = alipayState || { phase: 'idle' };
  const captured = state.phase === 'captured';
  const messages = {
    idle: '点击「生成二维码」，然后使用支付宝扫一扫。',
    starting: '正在准备浏览器并打开支付宝登录页面；首次使用可能需要自动下载 Chromium，请稍候…',
    waiting: '请使用支付宝扫码，并在手机上确认登录。',
    authorizing: '扫码已确认，正在进入游戏并读取登录信息…',
    'reading-roles': '正在读取该账号的区服和游戏角色…',
    captured: '已读取游戏角色，请确认区服和角色后保存。',
    expired: '本次登录已过期，请刷新二维码重新扫码。',
    error: '登录失败，请刷新二维码重试。',
    cancelled: '已取消本次登录。',
    saved: '账号已保存并切换，尚未开始挂机。可先在「挂机配置」设置任务，再点击账号卡片或页头的「开始挂机」。',
  };
  if (state.account?.status?.paused || state.account?.status?.loginBlocked) {
    messages.saved = '账号已保存并切换。点击页面顶部的「恢复托管」，连接后核对角色和区服。';
  } else if (state.account?.status?.looping) {
    messages.saved = '账号已保存并切换，已按保存配置启动自动挂机。可前往「挂机配置」调整任务。';
  } else if (state.account?.status?.connected) {
    messages.saved = '账号已保存并切换，游戏已连接，尚未开始挂机。可先在「挂机配置」设置任务，再点击账号卡片或页头的「开始挂机」。';
  }
  const hint = $('alipay-hint');
  hint.textContent = state.error || state.roleError || messages[state.phase] || '正在读取登录状态…';
  hint.className = 'phone-feedback ' + (state.error || state.roleError || ['expired', 'error'].includes(state.phase) ? 'bad' : 'dim');
  const image = $('alipay-qr');
  const showQr = state.phase === 'waiting' && /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(state.qrImage || '');
  image.hidden = !showQr;
  if (showQr) image.src = state.qrImage;
  else image.removeAttribute('src');
  const appLink = $('alipay-open-app');
  let launchUrl = null;
  try {
    const target = new URL(state.launchUrl);
    if (target.protocol === 'https:' && /(^|\.)alipay\.com$/i.test(target.hostname) && !target.username && !target.password) launchUrl = target.href;
  } catch {}
  appLink.hidden = !showQr || !launchUrl;
  if (!appLink.hidden) appLink.setAttribute('href', launchUrl);
  else appLink.removeAttribute('href');
  $('alipay-start').textContent = state.id || ['expired', 'error'].includes(state.phase) ? '刷新二维码' : '生成二维码';
  $('alipay-start').disabled = alipayBusy;
  $('alipay-cancel').hidden = !state.id || ['cancelled', 'saved'].includes(state.phase);
  $('alipay-cancel').disabled = alipayBusy;
  $('alipay-save').hidden = !captured;
  const selected = selectedAlipayRole();
  $('alipay-save').disabled = alipayBusy || !captured || !selected?.accountId || Boolean(state.roleError) || state.expiresAt <= Date.now();
  $('alipay-roles-retry').hidden = !captured || (!state.roleError && Boolean(state.choices?.length));
  $('alipay-roles-retry').disabled = alipayBusy || state.expiresAt <= Date.now();
  $('alipay-result').hidden = !captured && state.phase !== 'saved';
  $('alipay-result').textContent = selected
    ? '已选择 ' + (selected.nickname || '未命名角色') + ' · ' + alipayRoleWorld(selected)
    : captured && state.choices?.length ? '请选择要保存的角色。' : '';
  if (state.phase === 'saved' && state.selectedRole) {
    $('alipay-result').textContent = (state.selectedRole.nickname || '未命名角色') + ' · ' + alipayRoleWorld(state.selectedRole);
  }
  $('alipay-expiry').textContent = captured ? '请在本次登录结果过期前保存。' : '';
  $('alipay-flow').setAttribute('aria-busy', String(alipayBusy || ['starting', 'authorizing', 'reading-roles'].includes(state.phase)));
  renderAlipayRoles();
  if (typeof accountAddChanged === 'function') {
    accountAddChanged('alipay', state.phase, { busy: alipayBusy, account: state.account });
  }
}

async function resetAlipayLogin() {
  if (alipayBusy) return false;
  const previous = alipayState;
  ++alipayGeneration;
  clearTimeout(alipayTimer);
  alipayBusy = true;
  alipayState = { ...previous, phase: 'cancelled', qrImage: null, error: null };
  renderAlipayLogin();
  try {
    let id = previous?.id;
    // 生成响应丢失时仍可能已经打开浏览器，先找回本次临时会话再结束。
    if (!id && previous && !['idle', 'cancelled', 'saved'].includes(previous.phase)) {
      const state = await call(alipayLoginPath + '/status');
      id = state.id;
    }
    if (id) await call(alipayLoginPath + '/cancel', { method: 'POST', body: JSON.stringify({ id }) });
    alipayState = null;
    alipayChoiceId = '';
    alipaySelectedRole = null;
    alipayPollFailures = 0;
    return true;
  } catch {
    alipayState = { ...previous, phase: 'error', qrImage: null, error: '临时扫码会话尚未结束，请重试关闭或返回。' };
    throw new Error(alipayState.error);
  } finally {
    alipayBusy = false;
    renderAlipayLogin();
  }
}

function scheduleAlipayPoll(generation) {
  clearTimeout(alipayTimer);
  if (generation !== alipayGeneration || !alipayState?.id) return;
  if (alipayState.phase === 'captured') {
    alipayTimer = setTimeout(() => {
      if (generation !== alipayGeneration || alipayState?.phase !== 'captured') return;
      alipayState = { ...alipayState, phase: 'expired', qrImage: null, error: null };
      renderAlipayLogin();
    }, Math.max(0, alipayState.expiresAt - Date.now()));
  } else if (['starting', 'waiting', 'authorizing', 'reading-roles'].includes(alipayState.phase)) {
    alipayTimer = setTimeout(() => pollAlipayLogin(generation), 1500);
  }
}

async function pollAlipayLogin(generation) {
  if (generation !== alipayGeneration || !alipayState?.id) return;
  const id = alipayState.id;
  try {
    const state = await call(alipayLoginPath + '/status?id=' + encodeURIComponent(id));
    if (generation !== alipayGeneration || alipayState?.id !== id) return;
    alipayPollFailures = 0;
    receiveAlipayState(state);
  } catch (error) {
    if (generation !== alipayGeneration || alipayState?.id !== id) return;
    alipayPollFailures++;
    alipayState = { ...alipayState, error: alipayPollFailures < 3
      ? '登录状态读取失败，正在重试…'
      : '登录状态连续读取失败，请刷新二维码重试。' };
    if (alipayPollFailures >= 3) alipayState.phase = 'error';
  }
  renderAlipayLogin();
  scheduleAlipayPoll(generation);
}

$('alipay-start').onclick = async () => {
  if (alipayBusy) return;
  const previous = alipayState;
  const generation = ++alipayGeneration;
  clearTimeout(alipayTimer);
  alipayBusy = true;
  alipayPollFailures = 0;
  alipayChoiceId = '';
  alipaySelectedRole = null;
  alipayState = { phase: 'starting' };
  renderAlipayLogin();
  try {
    if (previous?.id) {
      await call(alipayLoginPath + '/cancel', { method: 'POST', body: JSON.stringify({ id: previous.id }) });
    }
    const state = await call(alipayLoginPath + '/start', { method: 'POST', body: JSON.stringify({ confirm: true }) });
    if (generation !== alipayGeneration) return;
    receiveAlipayState(state);
    scheduleAlipayPoll(generation);
  } catch (error) {
    if (generation !== alipayGeneration) return;
    alipayState = { id: previous?.id, phase: 'error', error: error.message || '二维码读取失败，请重试。' };
  } finally {
    if (generation === alipayGeneration) {
      alipayBusy = false;
      renderAlipayLogin();
    }
  }
};

$('alipay-cancel').onclick = async () => {
  if (alipayBusy || !alipayState?.id) return;
  const previous = alipayState;
  const generation = ++alipayGeneration;
  clearTimeout(alipayTimer);
  alipayBusy = true;
  alipayState = { ...previous, phase: 'cancelled', qrImage: null, error: null };
  renderAlipayLogin();
  try {
    await call(alipayLoginPath + '/cancel', { method: 'POST', body: JSON.stringify({ id: previous.id }) });
    if (generation === alipayGeneration) alipayState = { phase: 'cancelled' };
  } catch (error) {
    if (generation === alipayGeneration) {
      alipayState = { id: previous.id, phase: 'error', error: '取消登录失败，请重试取消。' };
    }
  } finally {
    if (generation === alipayGeneration) {
      alipayBusy = false;
      renderAlipayLogin();
    }
  }
};

$('alipay-roles-retry').onclick = async () => {
  if (alipayBusy || alipayState?.phase !== 'captured' || alipayState.expiresAt <= Date.now()) return;
  const pending = alipayState;
  const generation = ++alipayGeneration;
  clearTimeout(alipayTimer);
  alipayState = { ...pending, phase: 'reading-roles', error: null, roleError: null };
  renderAlipayLogin();
  try {
    const state = await call(alipayLoginPath + '/roles', { method: 'POST', body: JSON.stringify({ confirm: true, id: pending.id }) });
    if (generation !== alipayGeneration || alipayState?.id !== pending.id) return;
    receiveAlipayState(state);
  } catch (error) {
    if (generation !== alipayGeneration || alipayState?.id !== pending.id) return;
    alipayState = { ...pending, roleError: error.message || '角色读取失败，请重试。', error: null };
    if (pending.expiresAt <= Date.now()) alipayState.phase = 'expired';
  }
  renderAlipayLogin();
  scheduleAlipayPoll(generation);
};

$('alipay-save').onclick = async () => {
  if (alipayBusy || alipayState?.phase !== 'captured' || alipayState.roleError) return;
  const choice = selectedAlipayRole();
  if (!choice?.accountId) return;
  if (alipayState.expiresAt <= Date.now()) {
    alipayState = { ...alipayState, phase: 'expired', error: null };
    renderAlipayLogin();
    return;
  }
  const pending = alipayState;
  alipayBusy = true;
  renderAlipayLogin();
  $('alipay-save').textContent = '正在保存…';
  try {
    if (!await configMayChangeAccount(choice.accountId)) {
      alipayState = { ...pending, error: '当前账号的配置尚未保存，请处理配置后再次保存此账号。' };
      return;
    }
    if (pending.expiresAt <= Date.now()) {
      alipayState = { ...pending, phase: 'expired', error: null };
      return;
    }
    const data = await call(alipayLoginPath + '/save', { method: 'POST', body: JSON.stringify({ confirm: true, id: pending.id, choiceId: choice.id }) });
    ++alipayGeneration;
    clearTimeout(alipayTimer);
    alipayState = { phase: 'saved', account: data.account, selectedRole: data.selectedRole || choice };
    const index = accounts.findIndex(account => account.id === data.account.id);
    if (index < 0) accounts.push(data.account);
    else accounts[index] = { ...accounts[index], ...data.account };
    if (!data.account.status?.connected) disconnected.add(data.account.id);
    accountDetailsOwner = null;
    selectLoadedAccount(data.account.id);
    renderAccounts();
    try {
      await loadAccounts(false);
    } catch {
      alipayState.error = '账号已保存并切换，账号列表刷新失败，请刷新页面查看。';
    }
  } catch (error) {
    alipayState = { ...pending, error: error.message || '保存失败，请重试。' };
  } finally {
    alipayBusy = false;
    $('alipay-save').textContent = '保存所选角色';
    renderAlipayLogin();
  }
};

renderAlipayLogin();
