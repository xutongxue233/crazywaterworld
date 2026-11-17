import assert from 'node:assert/strict';
import fs from 'node:fs';

const script = fs.readFileSync(new URL('../src/alipay-login-ui.js', import.meta.url), 'utf8');
const prefix = '/api/accounts/alipay-login';
const fixedNow = 1_794_830_400_000;
const qrImage = 'data:image/png;base64,aGVsbG8=';
let passed = 0;

async function test(name, run) {
  await run();
  passed++;
  console.log('通过：' + name);
}

async function settle() {
  for (let index = 0; index < 20; index++) await Promise.resolve();
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function fixture({ wizard = false } = {}) {
  let now = fixedNow;
  let nextTimer = 0;
  const timers = new Map();
  const nodes = new Map();
  const state = { id: 'scan-1', phase: 'waiting', qrImage, expiresAt: fixedNow + 300_000 };
  const choices = [{ id: 'role-1', accountId: 'alipay:account', nickname: '支付宝角色', level: 35, power: 123456,
    worldId: 3000000123, worldName: '海港123服', roleWorldId: 3000000123, roleWorldName: '海港123服', matched: false }];
  const env = {
    calls: [], selections: [], accounts: [{ id: 'old-account', title: '已有账号' }],
    disconnected: new Set(), allowed: true, mayChangeCalls: [], loadCalls: [], detailsAtSelection: [], wizard, wizardEvents: [],
  };
  function makeNode() {
    const attributes = new Map();
    let text = '';
    return {
      hidden: false, disabled: false, className: '', src: '', children: [], value: '',
      get textContent() { return text + this.children.map(child => child.textContent).join(''); },
      set textContent(value) { text = String(value ?? ''); this.children = []; },
      setAttribute(key, value) { attributes.set(key, String(value)); },
      getAttribute(key) { return attributes.get(key); },
      removeAttribute(key) { attributes.delete(key); if (key === 'src') this.src = ''; },
      append(...children) { this.children.push(...children); },
      appendChild(child) { this.children.push(child); return child; },
    };
  }
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, makeNode());
    return nodes.get(id);
  }
  env.respond = async (route, payload) => {
    if (route === prefix + '/start' || route.startsWith(prefix + '/status') || route === prefix + '/roles') return { ...state };
    if (route === prefix + '/cancel') return { ok: true };
    if (route === prefix + '/save') {
      const choice = state.choices?.find(item => item.id === payload?.choiceId) || choices[0];
      return { ok: true, account: { id: choice.accountId, title: choice.nickname, status: { connected: false } }, selectedRole: choice };
    }
    assert.fail('未预期请求 ' + route);
  };
  env.call = async (route, options) => {
    const payload = options?.body ? JSON.parse(options.body) : null;
    env.calls.push({ route, payload });
    return env.respond(route, payload);
  };
  env.node = node;
  env.element = (tag, className, text) => {
    const element = makeNode();
    element.tagName = tag;
    element.className = className || '';
    element.textContent = text;
    return element;
  };
  env.clear = element => { element.textContent = ''; return element; };
  env.now = () => now;
  env.setTimer = (callback, delay) => {
    const id = ++nextTimer;
    timers.set(id, { callback, at: now + delay });
    return id;
  };
  env.clearTimer = id => timers.delete(id);
  env.mayChange = async id => {
    env.mayChangeCalls.push(id);
    return env.onMayChange ? env.onMayChange() : env.allowed;
  };
  env.load = async reload => { env.loadCalls.push(reload); await env.onLoad?.(); };
  new Function('env', `
    'use strict';
    const $ = env.node, call = env.call, el = env.element, clear = env.clear;
    const Date = { now: env.now };
    const setTimeout = env.setTimer, clearTimeout = env.clearTimer;
    const accounts = env.accounts, disconnected = env.disconnected;
    const configMayChangeAccount = env.mayChange, loadAccounts = env.load;
    const renderAccounts = () => {};
    const accountAddChanged = env.wizard ? (...args) => env.wizardEvents.push(args) : undefined;
    let accountDetailsOwner = 'old-account';
    function selectLoadedAccount(id) {
      env.detailsAtSelection.push(accountDetailsOwner);
      env.selections.push(id);
    }
    ${script}
    env.reset = resetAlipayLogin;
  `)(env);
  function descendants(element) {
    return element.children.flatMap(child => [child, ...descendants(child)]);
  }
  return {
    env, node, state, choices, timers,
    click(id) { return node(id).onclick(); },
    calls(suffix) { return env.calls.filter(entry => entry.route.startsWith(prefix + suffix)); },
    roles() { return descendants(node('alipay-roles')).filter(element => element.type === 'radio'); },
    chooseRole(index) {
      const roles = this.roles();
      assert.ok(roles[index]);
      for (const role of roles) role.checked = false;
      roles[index].checked = true;
      roles[index].onchange();
    },
    async captured(selectedChoices = choices) {
      Object.assign(state, { phase: 'captured', choices: selectedChoices, roleError: null,
        account: { id: 'alipay:account', title: '账号 abcdef0123' }, expiresAt: now + 600_000 });
      await this.tick(1500);
    },
    async tick(milliseconds) {
      const end = now + milliseconds;
      let executions = 0;
      await settle();
      while (true) {
        const next = [...timers.entries()].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        assert(++executions < 1000);
        const [id, timer] = next;
        now = timer.at;
        timers.delete(id);
        timer.callback();
        await settle();
      }
      now = end;
      await settle();
    },
  };
}

await test('页面加载不启动浏览器，点击后显示官方二维码', async () => {
  const f = fixture();
  assert.equal(f.env.calls.length, 0);
  assert.equal(f.node('alipay-qr').hidden, true);
  await f.click('alipay-start');
  assert.deepEqual(f.calls('/start')[0].payload, { confirm: true });
  assert.equal(f.node('alipay-qr').src, qrImage);
  assert.equal(f.node('alipay-qr').hidden, false);
  assert.match(f.node('alipay-hint').textContent, /支付宝扫码/);
  assert.equal(f.node('alipay-start').textContent, '刷新二维码');
});

await test('二维码只接受 PNG 数据地址', async () => {
  for (const value of ['https://example.com/qr.png', 'data:image/svg+xml,<svg/>', 'javascript:alert(1)']) {
    const f = fixture();
    f.state.qrImage = value;
    await f.click('alipay-start');
    assert.equal(f.node('alipay-qr').hidden, true);
    assert.equal(f.node('alipay-qr').src, '');
  }
});

await test('生成响应丢失后可重新获取后台等待中的二维码', async () => {
  const f = fixture();
  const respond = f.env.respond;
  let attempts = 0;
  f.env.respond = route => {
    if (route.endsWith('/start') && ++attempts === 1) throw new Error('生成响应丢失');
    return respond(route);
  };
  await f.click('alipay-start');
  assert.match(f.node('alipay-hint').textContent, /生成响应丢失/);
  assert.equal(f.node('alipay-start').disabled, false);
  await f.click('alipay-start');
  assert.equal(f.calls('/start').length, 2);
  assert.equal(f.calls('/cancel').length, 0);
  assert.equal(f.node('alipay-qr').src, qrImage);
  await f.captured();
  await f.click('alipay-save');
  assert.deepEqual(f.calls('/save')[0].payload, { confirm: true, id: 'scan-1', choiceId: 'role-1' });
  assert.match(f.node('alipay-hint').textContent, /账号已保存并切换/);
  assert.match(f.node('alipay-hint').textContent, /尚未开始挂机.*「开始挂机」/);
});

await test('生成期间重复点击只发送一次请求，失败后可重试', async () => {
  const f = fixture();
  const start = deferred();
  const respond = f.env.respond;
  f.env.respond = route => route.endsWith('/start') ? start.promise : respond(route);
  const pending = f.click('alipay-start');
  await f.click('alipay-start');
  assert.equal(f.calls('/start').length, 1);
  assert.equal(f.node('alipay-start').disabled, true);
  start.reject(new Error('浏览器启动失败'));
  await pending;
  assert.match(f.node('alipay-hint').textContent, /浏览器启动失败/);
  assert.equal(f.node('alipay-start').disabled, false);
  f.env.respond = respond;
  await f.click('alipay-start');
  assert.equal(f.calls('/start').length, 2);
});

await test('轮询展示扫码确认和已捕获，成功后停止网络轮询', async () => {
  const f = fixture();
  await f.click('alipay-start');
  f.state.phase = 'authorizing';
  await f.tick(1500);
  assert.equal(f.node('alipay-qr').hidden, true);
  assert.match(f.node('alipay-hint').textContent, /进入游戏/);
  await f.captured();
  assert.equal(f.node('alipay-save').hidden, false);
  assert.equal(f.node('alipay-save').disabled, false);
  assert.equal(f.node('alipay-result').textContent, '已选择 支付宝角色 · 海港123服');
  const polls = f.calls('/status').length;
  await f.tick(5000);
  assert.equal(f.calls('/status').length, polls);
});

await test('取消后迟到的轮询结果不能恢复二维码', async () => {
  const f = fixture();
  await f.click('alipay-start');
  const poll = deferred();
  const respond = f.env.respond;
  f.env.respond = route => route.includes('/status') ? poll.promise : respond(route);
  await f.tick(1500);
  await f.click('alipay-cancel');
  poll.resolve({ ...f.state });
  await settle();
  assert.match(f.node('alipay-hint').textContent, /已取消/);
  assert.equal(f.node('alipay-qr').src, '');
  assert.equal(f.timers.size, 0);
  assert.deepEqual(f.calls('/cancel')[0].payload, { id: 'scan-1' });
});

await test('刷新先取消旧会话，旧响应不能覆盖新二维码', async () => {
  const f = fixture();
  await f.click('alipay-start');
  const poll = deferred();
  const respond = f.env.respond;
  f.env.respond = route => route.includes('/status') ? poll.promise : respond(route);
  await f.tick(1500);
  Object.assign(f.state, { id: 'scan-2', qrImage: 'data:image/png;base64,bmV3' });
  await f.click('alipay-start');
  assert.deepEqual(f.env.calls.slice(-2).map(call => call.route), [prefix + '/cancel', prefix + '/start']);
  poll.resolve({ id: 'scan-1', phase: 'captured', account: { id: 'wrong' }, expiresAt: fixedNow + 600_000 });
  await settle();
  assert.equal(f.node('alipay-qr').src, f.state.qrImage);
  assert.equal(f.node('alipay-save').hidden, true);
});

await test('取消失败保留重试入口，刷新不能跳过失败的取消', async () => {
  const f = fixture();
  await f.click('alipay-start');
  const respond = f.env.respond;
  f.env.respond = route => {
    if (route.endsWith('/cancel')) throw new Error('请求失败');
    return respond(route);
  };
  await f.click('alipay-cancel');
  assert.equal(f.node('alipay-cancel').hidden, false);
  assert.match(f.node('alipay-hint').textContent, /取消登录失败/);
  await f.click('alipay-start');
  assert.equal(f.calls('/start').length, 1);
  f.env.respond = respond;
  await f.click('alipay-start');
  assert.equal(f.calls('/start').length, 2);
});

await test('轮询临时失败会恢复，连续三次失败停止轮询', async () => {
  const f = fixture();
  await f.click('alipay-start');
  const respond = f.env.respond;
  f.env.respond = route => {
    if (route.includes('/status')) throw new Error('断网');
    return respond(route);
  };
  await f.tick(1500);
  assert.match(f.node('alipay-hint').textContent, /正在重试/);
  f.env.respond = respond;
  await f.tick(1500);
  assert.match(f.node('alipay-hint').textContent, /支付宝扫码/);
  f.env.respond = route => {
    if (route.includes('/status')) throw new Error('断网');
    return respond(route);
  };
  await f.tick(4500);
  assert.match(f.node('alipay-hint').textContent, /连续读取失败/);
  const polls = f.calls('/status').length;
  await f.tick(10_000);
  assert.equal(f.calls('/status').length, polls);
  assert.equal(f.node('alipay-qr').hidden, true);
  assert.equal(f.node('alipay-start').disabled, false);
});

await test('服务端过期和本地凭证过期均禁用保存', async () => {
  const f = fixture();
  await f.click('alipay-start');
  f.state.phase = 'expired';
  await f.tick(1500);
  assert.match(f.node('alipay-hint').textContent, /过期/);
  assert.equal(f.node('alipay-qr').hidden, true);
  f.state.phase = 'waiting';
  await f.click('alipay-start');
  await f.captured();
  await f.tick(600_000);
  assert.equal(f.node('alipay-save').disabled, true);
  await f.click('alipay-save');
  assert.equal(f.calls('/save').length, 0);
});

await test('保存前尊重未保存配置，允许后保存并切换账户', async () => {
  const f = fixture();
  await f.click('alipay-start');
  await f.captured();
  f.env.allowed = false;
  await f.click('alipay-save');
  assert.equal(f.calls('/save').length, 0);
  assert.equal(f.node('alipay-save').disabled, false);
  assert.match(f.node('alipay-hint').textContent, /配置尚未保存/);
  f.env.allowed = true;
  await f.click('alipay-save');
  assert.deepEqual(f.calls('/save')[0].payload, { confirm: true, id: 'scan-1', choiceId: 'role-1' });
  assert.deepEqual(f.env.selections, ['alipay:account']);
  assert.deepEqual(f.env.detailsAtSelection, [null]);
  assert.ok(f.env.disconnected.has('alipay:account'));
  assert.deepEqual(f.env.loadCalls, [false]);
  assert.equal(f.env.accounts.length, 2);
  assert.equal(f.node('alipay-save').hidden, true);
  assert.match(f.node('alipay-hint').textContent, /账号已保存并切换/);
  assert.equal(f.timers.size, 0);
});

await test('配置确认等待中到期，不发送保存请求', async () => {
  const f = fixture();
  await f.click('alipay-start');
  await f.captured();
  const confirm = deferred();
  f.env.onMayChange = () => confirm.promise;
  const saving = f.click('alipay-save');
  await f.tick(600_000);
  confirm.resolve(true);
  await saving;
  assert.equal(f.calls('/save').length, 0);
  assert.match(f.node('alipay-hint').textContent, /过期/);
});

await test('保存暂停或异地登录阻止的账号后提示恢复托管', async () => {
  for (const status of [
    { paused: true, connected: false },
    { loginBlocked: true, connected: false },
    { paused: true, connected: true, looping: true },
    { loginBlocked: true, connected: true, looping: true },
  ]) {
    const f = fixture();
    await f.click('alipay-start');
    await f.captured();
    const respond = f.env.respond;
    f.env.respond = async route => {
      const data = await respond(route);
      if (route.endsWith('/save')) data.account.status = status;
      return data;
    };
    await f.click('alipay-save');
    assert.match(f.node('alipay-hint').textContent, /账号已保存并切换.*恢复托管/);
    assert.deepEqual(f.env.accounts.find(account => account.id === 'alipay:account').status, status);
    assert.deepEqual(f.env.selections, ['alipay:account']);
  }
});

await test('保存已连接账号后展示连接状态', async () => {
  const f = fixture();
  await f.click('alipay-start');
  await f.captured();
  const respond = f.env.respond;
  f.env.respond = async route => {
    const data = await respond(route);
    if (route.endsWith('/save')) data.account.status = { connected: true };
    return data;
  };
  await f.click('alipay-save');
  assert.match(f.node('alipay-hint').textContent, /游戏已连接/);
  assert.equal(f.env.disconnected.has('alipay:account'), false);
});

await test('保存后自动挂机已启动或正在连接时显示任务配置入口', async () => {
  for (const connected of [false, true]) {
    const f = fixture();
    await f.click('alipay-start');
    await f.captured();
    const respond = f.env.respond;
    f.env.respond = async (route, payload) => {
      const data = await respond(route, payload);
      if (route.endsWith('/save')) data.account.status = { connected, looping: true };
      return data;
    };
    await f.click('alipay-save');
    assert.match(f.node('alipay-hint').textContent, /账号已保存并切换.*按保存配置启动自动挂机.*「挂机配置」调整任务/);
    assert.deepEqual(f.env.accounts.find(account => account.id === 'alipay:account').status, { connected, looping: true });
  }
});

await test('保存期间抑制重复请求，失败后可重试', async () => {
  const f = fixture();
  await f.click('alipay-start');
  await f.captured();
  const save = deferred();
  const respond = f.env.respond;
  f.env.respond = route => route.endsWith('/save') ? save.promise : respond(route);
  const pending = f.click('alipay-save');
  await settle();
  await f.click('alipay-save');
  await f.click('alipay-start');
  await f.click('alipay-cancel');
  assert.equal(f.calls('/save').length, 1);
  assert.equal(f.calls('/start').length, 1);
  assert.equal(f.calls('/cancel').length, 0);
  save.reject(new Error('保存失败'));
  await pending;
  assert.equal(f.node('alipay-save').disabled, false);
  f.env.respond = respond;
  await f.click('alipay-save');
  assert.equal(f.calls('/save').length, 2);
});

await test('保存成功后列表刷新失败仍展示已保存结果', async () => {
  const f = fixture();
  await f.click('alipay-start');
  await f.captured();
  f.env.onLoad = async () => { throw new Error('列表断网'); };
  await f.click('alipay-save');
  assert.match(f.node('alipay-hint').textContent, /账号已保存并切换.*列表刷新失败/);
  assert.equal(f.node('alipay-save').hidden, true);
  assert.deepEqual(f.env.selections, ['alipay:account']);
});

await test('自动读取角色时继续轮询，单个角色自动选中并展示名称区服', async () => {
  const f = fixture();
  await f.click('alipay-start');
  f.state.phase = 'reading-roles';
  await f.tick(1500);
  assert.match(f.node('alipay-hint').textContent, /读取.*区服和游戏角色/);
  assert.equal(f.node('alipay-save').disabled, true);
  assert.equal(f.node('alipay-flow').getAttribute('aria-busy'), 'true');
  await f.captured();
  assert.equal(f.roles().length, 1);
  assert.equal(f.roles()[0].checked, true);
  assert.match(f.node('alipay-roles').textContent, /支付宝角色.*海港123服.*等级 35.*战力 123,456/);
  assert.doesNotMatch(f.node('alipay-result').textContent, /abcdef/);
  assert.equal(f.node('alipay-save').disabled, false);
});

for (const selected of [1, 2]) {
  await test('展示全部角色并保存第' + (selected + 1) + '个角色', async () => {
    const f = fixture();
    await f.click('alipay-start');
    const choices = [1, 2, 3].map(index => ({ ...f.choices[0], id: 'choice-' + index, nickname: '角色' + index,
      worldId: 3000000100 + index, worldName: '海港' + index + '服', roleWorldId: 3000000100 + index, roleWorldName: '海港' + index + '服' }));
    await f.captured(choices);
    assert.equal(f.roles().length, 3);
    assert.ok(f.roles().every(role => !role.checked));
    assert.equal(f.node('alipay-save').disabled, true);
    await f.click('alipay-save');
    assert.equal(f.calls('/save').length, 0);
    f.chooseRole(selected);
    assert.equal(f.node('alipay-save').disabled, false);
    await f.click('alipay-save');
    assert.equal(f.calls('/save')[0].payload.choiceId, choices[selected].id);
    assert.deepEqual(f.env.mayChangeCalls, [choices[selected].accountId]);
    assert.equal(f.node('alipay-result').textContent, choices[selected].nickname + ' · ' + choices[selected].worldName);
  });
}

await test('伪造单选值不能启用保存或提交角色', async () => {
  const f = fixture();
  await f.click('alipay-start');
  await f.captured([f.choices[0], { ...f.choices[0], id: 'role-2', worldId: 3000000124 }]);
  const input = f.roles()[0];
  input.value = 'forged-role';
  input.checked = true;
  input.onchange();
  assert.equal(f.node('alipay-save').disabled, true);
  await f.click('alipay-save');
  assert.equal(f.calls('/save').length, 0);
});

await test('无角色显示说明和重读入口，读取失败时禁止保存', async () => {
  const f = fixture();
  await f.click('alipay-start');
  await f.captured([]);
  assert.match(f.node('alipay-roles').textContent, /暂无可选择的游戏角色/);
  assert.equal(f.node('alipay-roles-retry').hidden, false);
  assert.equal(f.node('alipay-save').disabled, true);
  Object.assign(f.state, { choices: f.choices, roleError: '角色查询失败' });
  await f.click('alipay-roles-retry');
  assert.deepEqual(f.calls('/roles')[0].payload, { confirm: true, id: 'scan-1' });
  assert.match(f.node('alipay-hint').textContent, /角色查询失败/);
  assert.equal(f.node('alipay-save').disabled, true);
  assert.ok(f.roles().every(role => role.disabled));
  await f.click('alipay-save');
  assert.equal(f.calls('/save').length, 0);
  f.state.roleError = null;
  await f.click('alipay-roles-retry');
  assert.equal(f.node('alipay-save').disabled, false);
  assert.equal(f.node('alipay-roles-retry').hidden, true);
});

await test('角色重读失败后可重试并按原区服保留选择', async () => {
  const f = fixture();
  await f.click('alipay-start');
  const choices = [f.choices[0], { ...f.choices[0], id: 'role-2', worldId: 3000000124, nickname: '第二角色' }];
  await f.captured(choices);
  f.chooseRole(1);
  const respond = f.env.respond;
  f.env.respond = route => {
    if (route.endsWith('/roles')) throw new Error('查询暂时失败');
    return respond(route);
  };
  await f.click('alipay-roles-retry');
  assert.match(f.node('alipay-hint').textContent, /查询暂时失败/);
  assert.equal(f.node('alipay-save').disabled, true);
  assert.equal(f.node('alipay-roles-retry').hidden, false);
  f.env.respond = respond;
  f.state.choices = choices.map(choice => ({ ...choice, id: choice.id + '-new' }));
  await f.click('alipay-roles-retry');
  assert.equal(f.roles()[1].checked, true);
  assert.equal(f.roles()[1].value, 'role-2-new');
  await f.click('alipay-save');
  assert.equal(f.calls('/save')[0].payload.choiceId, 'role-2-new');
});

await test('合服角色展示原区服和现区服，保存结果使用实际角色信息', async () => {
  const f = fixture();
  await f.click('alipay-start');
  const role = { ...f.choices[0], roleWorldId: 3000000200, roleWorldName: '海港200服', matched: true, existingTitle: '账号 abcdef0123' };
  await f.captured([role]);
  assert.match(f.node('alipay-roles').textContent, /原区服 海港123服，合服后位于 海港200服/);
  assert.doesNotMatch(f.node('alipay-roles').textContent, /abcdef/);
  await f.click('alipay-save');
  assert.equal(f.node('alipay-result').textContent, '支付宝角色 · 海港200服');
});

await test('角色重读立即返回进度时持续轮询，失败后再次重读保留原选择', async () => {
  const f = fixture();
  await f.click('alipay-start');
  const choices = [f.choices[0], { ...f.choices[0], id: 'role-2', worldId: 3000000124, nickname: '第二角色' }];
  await f.captured(choices);
  f.chooseRole(1);
  Object.assign(f.state, { phase: 'reading-roles', choices: [], roleError: null });
  await f.click('alipay-roles-retry');
  assert.match(f.node('alipay-hint').textContent, /正在读取/);
  assert.equal(f.node('alipay-save').disabled, true);
  Object.assign(f.state, { phase: 'captured', roleError: '读取角色失败' });
  await f.tick(1500);
  assert.match(f.node('alipay-hint').textContent, /读取角色失败/);
  assert.equal(f.node('alipay-roles-retry').hidden, false);
  Object.assign(f.state, { phase: 'reading-roles', choices: [], roleError: null });
  await f.click('alipay-roles-retry');
  Object.assign(f.state, { phase: 'captured', choices });
  await f.tick(1500);
  assert.equal(f.roles()[1].checked, true);
  assert.equal(f.node('alipay-save').disabled, false);
  await f.click('alipay-save');
  assert.equal(f.calls('/save')[0].payload.choiceId, 'role-2');
});

for (const action of ['alipay-cancel', 'alipay-start']) {
  await test('重新读取角色时' + (action === 'alipay-cancel' ? '取消' : '刷新') + '使迟到结果失效', async () => {
    const f = fixture();
    await f.click('alipay-start');
    await f.captured([]);
    const roles = deferred();
    const respond = f.env.respond;
    f.env.respond = route => route.endsWith('/roles') ? roles.promise : respond(route);
    const reading = f.click('alipay-roles-retry');
    assert.match(f.node('alipay-hint').textContent, /正在读取/);
    assert.equal(f.node('alipay-cancel').disabled, false);
    assert.equal(f.node('alipay-start').disabled, false);
    Object.assign(f.state, { id: 'scan-2', phase: 'waiting', choices: [] });
    await f.click(action);
    roles.resolve({ ...f.state, id: 'scan-1', phase: 'captured', choices: f.choices });
    await reading;
    assert.equal(f.node('alipay-save').hidden, true);
    assert.equal(f.roles().length, 0);
    assert.match(f.node('alipay-hint').textContent, action === 'alipay-cancel' ? /已取消/ : /支付宝扫码/);
  });
}

await test('保存期间修改单选不能替换正在保存的角色', async () => {
  const f = fixture();
  await f.click('alipay-start');
  await f.captured([f.choices[0], { ...f.choices[0], id: 'role-2', worldId: 3000000124 }]);
  f.chooseRole(1);
  const save = deferred();
  const respond = f.env.respond;
  f.env.respond = (route, payload) => route.endsWith('/save') ? save.promise : respond(route, payload);
  const saving = f.click('alipay-save');
  await settle();
  f.chooseRole(0);
  assert.ok(f.roles().every(role => role.disabled));
  assert.equal(f.calls('/save')[0].payload.choiceId, 'role-2');
  save.resolve(await respond(prefix + '/save', { choiceId: 'role-2' }));
  await saving;
});

await test('页面模板与独立脚本接线完整', async () => {
  const page = fs.readFileSync(new URL('../src/page.mjs', import.meta.url), 'utf8');
  const template = fs.readFileSync(new URL('../src/ui/pages.tsx', import.meta.url), 'utf8');
  assert.ok(page.includes('${alipayLoginScript}'));
  assert.ok(page.includes("new URL('./alipay-login-ui.js', import.meta.url)"));
  for (const id of ['flow', 'start', 'cancel', 'save', 'hint', 'qr', 'result', 'expiry', 'roles', 'roles-retry']) {
    assert.ok(template.includes('id="alipay-' + id + '"'), id);
  }
});

await test('弹窗关闭清理扫码和定时器，迟到的角色回复不能恢复内容', async () => {
  const f = fixture({ wizard: true });
  await f.click('alipay-start');
  const pending = deferred();
  const respond = f.env.respond;
  f.env.respond = (route, payload) => route.includes('/status?id=') ? pending.promise : respond(route, payload);
  await f.tick(1500);
  assert.equal(await f.env.reset(), true);
  assert.equal(f.calls('/cancel').length, 1);
  assert.equal(f.node('alipay-qr').src, '');
  assert.equal(f.timers.size, 0);
  pending.resolve({ phase: 'captured', id: 'scan-1', choices: f.choices, expiresAt: fixedNow + 600_000 });
  await settle();
  assert.equal(f.roles().length, 0);
  assert.equal(f.node('alipay-save').hidden, true);
  assert.equal(f.env.wizardEvents.at(-1)[1], 'idle');
  assert.equal(f.env.wizardEvents.at(-1)[2].busy, false);
});

await test('弹窗清理可找回丢失的生成响应，失败后保留重试', async () => {
  const f = fixture();
  const respond = f.env.respond;
  let failCancel = true;
  f.env.respond = (route, payload) => {
    if (route.endsWith('/start')) throw new Error('模拟响应丢失');
    if (route.endsWith('/cancel') && failCancel) throw new Error('模拟清理失败');
    return respond(route, payload);
  };
  await f.click('alipay-start');
  await assert.rejects(f.env.reset(), /临时扫码会话尚未结束/);
  assert.equal(f.calls('/status').length, 1);
  assert.equal(f.node('alipay-start').disabled, false);
  failCancel = false;
  assert.equal(await f.env.reset(), true);
  assert.deepEqual(f.calls('/cancel').at(-1).payload, { id: 'scan-1' });
  assert.equal(f.node('alipay-qr').hidden, true);
});

await test('生成和保存短请求在途时阻止弹窗清理，完成后发出成功状态', async () => {
  const f = fixture({ wizard: true });
  const respond = f.env.respond;
  const starting = deferred();
  f.env.respond = (route, payload) => route.endsWith('/start') ? starting.promise : respond(route, payload);
  const start = f.click('alipay-start');
  assert.equal(await f.env.reset(), false);
  assert.equal(f.env.wizardEvents.at(-1)[2].busy, true);
  starting.resolve(await respond(prefix + '/start'));
  await start;
  await f.captured();
  const saving = deferred();
  f.env.respond = (route, payload) => route.endsWith('/save') ? saving.promise : respond(route, payload);
  const save = f.click('alipay-save');
  await settle();
  assert.equal(await f.env.reset(), false);
  saving.resolve(await respond(prefix + '/save'));
  await save;
  assert.equal(f.env.wizardEvents.at(-1)[1], 'saved');
  assert.equal(f.env.wizardEvents.at(-1)[2].busy, false);
  assert.equal(await f.env.reset(), true);
  assert.equal(f.calls('/cancel').length, 0, '已保存结果已由服务端消费');
});

await test('手机跳转仅使用当前二维码的支付宝官方地址，失效后移除', async () => {
  const f = fixture();
  f.state.launchUrl = 'https://render.alipay.com/p/s/ulink?auth=test';
  await f.click('alipay-start');
  assert.equal(f.node('alipay-open-app').hidden, false);
  assert.equal(f.node('alipay-open-app').getAttribute('href'), f.state.launchUrl);
  f.state.launchUrl = 'https://alipay.com.evil.invalid/login';
  await f.tick(1500);
  assert.equal(f.node('alipay-open-app').hidden, true);
  assert.equal(f.node('alipay-open-app').getAttribute('href'), undefined);
  f.state.phase = 'expired';
  await f.tick(1500);
  assert.equal(f.node('alipay-open-app').hidden, true);
});

console.log(`selftest-alipay-login-ui: ${passed} cases ok`);
