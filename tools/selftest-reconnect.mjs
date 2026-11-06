// Reconnect policy, alerts and the income report, driven through the real console routes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-reconnect-'));
process.env.CW_DATA_DIR = dir;
process.env.CW_CONFIG_PACK = path.join(dir, 'config.json');
fs.writeFileSync(process.env.CW_CONFIG_PACK, '[]');

const { normalizeReconnect, parseReconnect, reconnectDefaults, reconnectDelaySeconds, recoveryDecision } = await import('../src/reconnect.mjs');
const { createNotifier, defaultNotifySettings, normalizeNotifySettings, parseNotifySettings, webhookBody } = await import('../src/notify.mjs');
const { beijingDate, incomeView, readIncomeSnapshot, recordIncome } = await import('../src/income-report.mjs');

// ---- 重连策略 ----
assert.equal(reconnectDefaults.kicked, 'stop', '被顶号默认不能自动重连');
assert.deepEqual(normalizeReconnect(null), { ...reconnectDefaults });
assert.equal(normalizeReconnect({ baseSeconds: -1, maxSeconds: 'x', kicked: 'bad' }).baseSeconds, 5, '旧数据不合法时退回默认值');
assert.equal(normalizeReconnect({ baseSeconds: 60, maxSeconds: 10 }).maxSeconds, 60);
const valid = { enabled: true, baseSeconds: 10, maxSeconds: 120, maxAttempts: 3, kicked: 'retry', kickedMinutes: 15 };
assert.deepEqual(parseReconnect({ ...valid, extra: 1 }), valid);
for (const bad of [{ ...valid, baseSeconds: 0 }, { ...valid, maxSeconds: 5 }, { ...valid, maxAttempts: -1 }, { ...valid, kicked: 'x' },
  { ...valid, enabled: 'yes' }, { ...valid, kickedMinutes: 1.5 }]) assert.throws(() => parseReconnect(bad));

const steady = () => 0.5;
assert.deepEqual([1, 2, 3, 4, 5].map(n => reconnectDelaySeconds(valid, n, 'network', steady)), [10, 20, 40, 80, 120], '退避翻倍并受上限约束');
assert.equal(reconnectDelaySeconds(valid, 1000, 'network', () => 1), 120, '抖动不能超过上限');
assert.equal(reconnectDelaySeconds(valid, 1, 'kicked', steady), 900);

assert.deepEqual(recoveryDecision({ ...valid, kicked: 'stop' }, 'kicked', 1), { action: 'stop', reason: 'kicked' });
assert.deepEqual(recoveryDecision(valid, 'kicked', 1), { action: 'retry' });
assert.deepEqual(recoveryDecision({ ...valid, enabled: false }, 'network', 1), { action: 'stop', reason: 'disabled' });
assert.deepEqual(recoveryDecision(valid, 'network', 3), { action: 'retry' });
assert.deepEqual(recoveryDecision(valid, 'network', 4), { action: 'stop', reason: 'exhausted' });
assert.deepEqual(recoveryDecision({ ...valid, maxAttempts: 0 }, 'network', 9999), { action: 'retry' });

// ---- 通知 ----
assert.throws(() => parseNotifySettings({ ...defaultNotifySettings(), webhookUrl: 'file:///etc/passwd' }));
assert.equal(normalizeNotifySettings({ webhookUrl: 'javascript:alert(1)' }).webhookUrl, '');
assert.deepEqual(webhookBody('wecom', { title: 'T', message: 'M' }), { msgtype: 'text', text: { content: 'T\nM' } });
assert.deepEqual(webhookBody('feishu', { title: 'T', message: 'M' }), { msg_type: 'text', content: { text: 'T\nM' } });
assert.equal(webhookBody('generic', { title: 'T', message: 'M', event: 'kicked', account: 'a', time: 't' }).event, 'kicked');

let time = 1_000_000;
const hooks = [], errors = [];
let settings = { ...defaultNotifySettings(), webhookUrl: 'https://example.invalid/hook' };
const notifier = createNotifier({
  getSettings: () => settings, now: () => time,
  fetcher: async (url, init) => { hooks.push([url, JSON.parse(init.body)]); return { ok: true, status: 200 }; },
  onError: message => errors.push(message),
});
await notifier.send('kicked', 'a', '标题', '内容');
assert.equal(hooks.length, 1);
assert.equal(hooks[0][1].account, 'a');
assert.equal((await notifier.send('kicked', 'a', '标题', '内容')).skipped, 'cooldown', '30 分钟内不重复通知');
await notifier.send('kicked', 'b', '标题', '内容');
assert.equal(hooks.length, 2, '冷却按账号区分');
time += 31 * 60 * 1000;
await notifier.send('kicked', 'a', '标题', '内容');
assert.equal(hooks.length, 3);
settings = { ...settings, events: { ...settings.events, recovered: false } };
assert.equal((await notifier.send('recovered', 'a', '标题', '内容')).skipped, 'disabled');
const broken = createNotifier({ getSettings: () => ({ ...defaultNotifySettings(), webhookUrl: 'https://example.invalid/hook' }),
  fetcher: async () => { throw new Error('hook down'); }, onError: message => errors.push(message) });
assert.deepEqual((await broken.send('kicked', 'a', 'x', 'y')).failures, ['Webhook：hook down'], '通知失败不能抛给挂机流程');
assert.equal(errors.length, 1);
const silent = createNotifier({ getSettings: () => defaultNotifySettings() });
assert.equal((await silent.send('kicked', 'a', 'x', 'y')).skipped, 'noWebhook');
await assert.rejects(silent.test(), /请先填写 Webhook/);

// ---- 收益日报 ----
const fakeReader = {
  request: async name => (name === 'AllResourceRequest'
    ? { list: [{ res: 3, amount: { low: 500, high: 0, unsigned: false } }, { res: 4, amount: { low: 7, high: 0, unsigned: false } }] }
    : { items: [{ itemId: '汽油', num: 20 }, { itemId: '汽油', num: 5 }, { itemId: '加速器', num: 3 }] }),
};
const snapshot = await readIncomeSnapshot(fakeReader, { power: { low: 900, high: 0, unsigned: false }, level: 21, mainlineStage: 40 });
assert.deepEqual(snapshot, { gold: 500, ruby: 7, petrol: 25, speedUp: 3, power: 900, level: 21, stage: 40 });
const dayOne = Date.UTC(2026, 10, 4, 15, 59);
assert.equal(beijingDate(dayOne), '2026-11-04');
assert.equal(beijingDate(dayOne + 60_000), '2026-11-05', '按北京时间切日');
recordIncome('x', { ...snapshot, gold: 100 }, { rounds: 1 }, dayOne - 3600_000);
recordIncome('x', { ...snapshot, gold: 300 }, { rounds: 2, failures: 1 }, dayOne);
recordIncome('x', { ...snapshot, gold: 250, power: null }, { outages: 1 }, dayOne + 3600_000);
const report = incomeView('x');
assert.deepEqual(report.days.map(day => day.date), ['2026-11-05', '2026-11-04'], '新的日期排在前面');
assert.equal(report.days[1].delta.gold, 200);
assert.equal(report.days[1].rounds, 3);
assert.equal(report.days[1].failures, 1);
assert.equal(report.days[0].delta.gold, -50, '起点取前一天收盘值，净消耗显示为负');
assert.equal(report.days[0].delta.power, null, '缺值时不能算成 0');
assert.equal(report.days[0].outages, 1);
assert.deepEqual(incomeView('never').days, []);
for (let i = 0; i < 40; i++) recordIncome('old', snapshot, {}, dayOne + i * 86400_000);
assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'income-old.json'), 'utf8')).days['2026-11-04'], undefined, '只保留最近 35 天');

// ---- 控制台路由与恢复流程 ----
const protocol = (await import('../src/proto.mjs')).loadProtocol();
const { GameClient } = await import('../src/client.mjs');
const { loadStore, saveStore } = await import('../src/accounts.mjs');
const { createConsole } = await import('../src/server.mjs');

let logins = 0;
let loginError = null;
const live = new Set();
Object.defineProperty(GameClient.prototype, 'connected', { get() { return live.has(this); } });
GameClient.prototype.connect = async function () {
  logins++;
  if (loginError) throw loginError;
  live.add(this);
  return { playerInfo: { nickname: '测试', level: 5 } };
};
GameClient.prototype.send = () => {};
GameClient.prototype.request = async () => ({});
GameClient.prototype.sendWatch = async () => ({});
GameClient.prototype.stop = function () { this.stopping = true; live.delete(this); };
const dropConnection = client => { live.delete(client); client.emit('close', {}); };
const kick = client => { live.delete(client); client.emit('fatal', { reason: 'SCChannelExpired' }); client.emit('close', {}); };

const fast = { enabled: true, baseSeconds: 1, maxSeconds: 1, maxAttempts: 0, kicked: 'stop', kickedMinutes: 1 };
saveStore({ activeId: 'a', accounts: [{ id: 'a', url: 'ws://invalid.invalid', login: {}, automation: {
  enabled: false, everySeconds: 3600, reconnect: fast, tasks: Object.fromEntries((await import('../src/automation.mjs')).automationTasks.map(t => [t.key, t.key === 'mail'])) } }] });
const app = createConsole({ port: 0 });
const waitFor = async (check, label) => {
  for (let i = 0; i < 100; i++) {
    if (check()) return;
    await sleep(50);
  }
  assert.fail('超时：' + label);
};
const automation = () => loadStore().accounts[0].automation;
try {
  await app.listen();
  const url = pathname => 'http://127.0.0.1:' + app.server.address().port + pathname;
  const post = (pathname, body) => fetch(url(pathname), { method: 'POST', body: JSON.stringify(body), signal: AbortSignal.timeout(5000) });
  const session = () => app.sessions.get('a') ?? null;
  const startLoop = () => post('/api/loop/start?account=a', { confirm: true, rounds: 0, everySeconds: 3600 });

  assert.equal((await startLoop()).status, 200);
  await waitFor(() => session().client?.connected, '首次连接');
  assert.equal(logins, 1);

  const first = session().client;
  dropConnection(first);
  assert.equal(automation().enabled, true, '掉线不能清除挂机开关，否则重启后不会恢复');
  assert(session().recovery?.timer, '掉线后要安排重连');
  assert.equal((await (await fetch(url('/api/loop?account=a'))).json()).recovery.kind, 'network');
  await waitFor(() => session().client?.connected && session().client !== first, '自动重连');
  assert.equal(logins, 2);
  await waitFor(() => session().loop.running, '恢复挂机');

  // 用户主动暂停要取消等待中的重连，并且记为不再挂机。
  dropConnection(session().client);
  assert(session().recovery?.timer);
  assert.equal((await post('/api/loop/stop?account=a', { confirm: true })).status, 200);
  assert.equal(session().recovery, null);
  assert.equal(automation().enabled, false);
  const afterStop = logins;
  await sleep(1300);
  assert.equal(logins, afterStop, '用户停止后不能再重连');

  // 定时器已经触发、仍等待上一轮结束时，停止也必须清除持久化开关。
  assert.equal((await startLoop()).status, 200);
  await waitFor(() => session().client?.connected, '重连等待窗口前连接');
  dropConnection(session().client);
  clearTimeout(session().recovery.timer);
  session().recovery.timer = null;
  assert.equal((await post('/api/loop/stop?account=a', { confirm: true })).status, 200);
  assert.equal(session().recovery, null);
  assert.equal(automation().enabled, false, '停止已触发的重连也不能在下次启动时恢复');
  await session().loop.job;

  // 默认策略：被顶号后不重连，也不在重启时恢复。
  assert.equal((await startLoop()).status, 200);
  await waitFor(() => session().client?.connected, '重新开始');
  const beforeKick = logins;
  kick(session().client);
  await session().loop.job;
  assert.equal(session().recovery, null);
  assert.equal(automation().enabled, false, '被顶号默认要停止挂机');
  await sleep(1300);
  assert.equal(logins, beforeKick, '默认不能把正在玩的游戏顶下线');

  // 配置为等待后重连时安排定时器，等待时长来自设置。
  assert.equal((await post('/api/loop/reconnect?account=a', { ...fast, kicked: 'retry', kickedMinutes: 20 })).status, 200);
  assert.equal(automation().reconnect.kicked, 'retry');
  assert.equal((await post('/api/loop/reconnect?account=a', { ...fast, kicked: 'retry', kickedMinutes: 0 })).status, 400);
  assert.equal(automation().reconnect.kickedMinutes, 20, '非法设置不能写入');
  await session().loop.job;
  assert.equal((await startLoop()).status, 200);
  await waitFor(() => session().client?.connected, '再次开始');
  const kickedAt = Date.now();
  kick(session().client);
  const nextAt = session().recovery.nextAt;
  assert(nextAt - kickedAt >= 19 * 60_000, '被顶号后按设置的分钟数等待');
  assert.equal(automation().enabled, true);
  assert.equal((await post('/api/loop/reconnect?account=a', { ...fast, enabled: false })).status, 200);
  assert.equal(session().recovery, null, '关闭自动重连要取消等待中的重连');
  assert.equal(automation().enabled, false);
  await session().loop.job;

  // 凭证失效不重试。
  assert.equal((await post('/api/loop/reconnect?account=a', fast)).status, 200);
  session().client?.stop();
  session().client = null;
  loginError = Object.assign(new Error('login rejected'), { loginResponse: { result: 1 } });
  assert.equal((await startLoop()).status, 200);
  await waitFor(() => !session().loop.running, '登录被拒后结束');
  assert.equal(session().recovery, null, '登录被拒不能重试');
  assert.equal(automation().enabled, false);

  // 网络错误导致登录失败时继续重试，恢复后归零。
  loginError = new Error('socket error during login');
  assert.equal((await startLoop()).status, 200);
  await waitFor(() => session().recovery?.timer, '登录失败后安排重试');
  assert.equal(automation().enabled, true);
  const attempts = session().recovery.attempts;
  await waitFor(() => session().recovery?.attempts > attempts, '重试次数累加');
  loginError = null;
  await waitFor(() => session().client?.connected && session().loop.running, '网络恢复后继续挂机');
  await waitFor(() => session().recovery === null, '完成一轮后清除重连状态');
  assert.equal((await post('/api/loop/stop?account=a', { confirm: true })).status, 200);
  await session().loop.job;

  // 通知设置与收益日报路由。
  assert.equal((await post('/api/notify/save', { ...defaultNotifySettings(), webhookUrl: 'ftp://x' })).status, 400);
  const saved = { ...defaultNotifySettings(), events: { ...defaultNotifySettings().events, recovered: false } };
  assert.equal((await post('/api/notify/save', saved)).status, 200);
  const read = await (await fetch(url('/api/notify'))).json();
  assert.equal(read.settings.events.recovered, false);
  assert(read.events.some(event => event.key === 'credential'));
  assert.equal((await post('/api/notify/test', {})).status, 400, '未填写 Webhook 时要提示');
  const income = await (await fetch(url('/api/income?account=a'))).json();
  assert(Array.isArray(income.days));
  assert(income.fields.some(field => field.key === 'gold'));
  for (const name of ['AllResourceRequest', 'AllResourceResponse', 'AllItemRequest', 'AllItemResponse']) assert(protocol[name], name);
} finally {
  await app.close();
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log('reconnect ok: backoff, configurable kicked policy, user stop, rejected credentials, alert cooldown, income report');
