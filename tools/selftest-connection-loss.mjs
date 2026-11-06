// 掉线、被顶号和登录失败时停止挂机且不重连。经真实控制台路由驱动，全程离线。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-connection-loss-'));
process.env.CW_DATA_DIR = dir;
process.env.CW_CONFIG_PACK = path.join(dir, 'config.json');
fs.writeFileSync(process.env.CW_CONFIG_PACK, '[]');

// ---- 控制台路由 ----
const { GameClient } = await import('../src/client.mjs');
const { loadStore, saveStore } = await import('../src/accounts.mjs');
const { createConsole } = await import('../src/server.mjs');
const { PAGE } = await import('../src/page.mjs');
const { operationLabels } = await import('../src/operation-labels.mjs');

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

// 旧账号文件里已保存的重连设置不再生效，也不能被改写。
const legacyReconnect = { enabled: true, baseSeconds: 1, maxSeconds: 1, maxAttempts: 0, kicked: 'retry', kickedMinutes: 1 };
saveStore({ activeId: 'a', accounts: [{ id: 'a', url: 'ws://invalid.invalid', login: {}, automation: {
  enabled: false, everySeconds: 3600, reconnect: legacyReconnect, tasks: Object.fromEntries((await import('../src/automation.mjs')).automationTasks.map(t => [t.key, t.key === 'mail'])) } }] });
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
  const startAndConnect = async label => {
    assert.equal((await startLoop()).status, 200);
    await waitFor(() => session().client?.connected && session().loop.running, label);
    assert.equal(automation().enabled, true, '持续挂机要记住开关，控制台重启后才能恢复');
  };
  const assertStayedStopped = async (loginsBefore, label) => {
    await session().loop.job;
    assert.equal(session().loop.running, false, label);
    assert.equal(automation().enabled, false, label + '：不能在控制台重启时恢复');
    await sleep(1300);
    assert.equal(logins, loginsBefore, label + '：不能自动重新登录');
  };

  // 网络掉线
  await startAndConnect('首次连接');
  assert.equal(logins, 1);
  let before = logins;
  dropConnection(session().client);
  await assertStayedStopped(before, '掉线后停止挂机');

  // 被顶号，旧账号设置为“等待后重连”也不再生效
  await startAndConnect('重新开始');
  before = logins;
  kick(session().client);
  await assertStayedStopped(before, '被顶号后停止挂机');

  // 持续挂机的登录网络错误不再重试
  session().client?.stop();
  session().client = null;
  loginError = new Error('socket error during login');
  before = logins;
  assert.equal((await startLoop()).status, 200);
  await waitFor(() => !session().loop.running, '登录失败后结束');
  assert.equal(logins, before + 1);
  await assertStayedStopped(before + 1, '登录失败后停止挂机');

  // 服务器拒绝登录
  loginError = Object.assign(new Error('login rejected'), { loginResponse: { result: 1 } });
  before = logins;
  assert.equal((await startLoop()).status, 200);
  await waitFor(() => !session().loop.running, '登录被拒后结束');
  await assertStayedStopped(before + 1, '登录被拒后停止挂机');
  loginError = null;

  // 用户主动停止不受影响
  await startAndConnect('恢复后再次开始');
  assert.equal((await post('/api/loop/stop?account=a', { confirm: true })).status, 200);
  await session().loop.job;
  assert.equal(automation().enabled, false);

  // 模块接口与界面已移除，账号里的旧设置原样保留
  for (const pathname of ['/api/loop/reconnect?account=a', '/api/notify/save', '/api/notify/test']) {
    assert.equal((await post(pathname, {})).status, 404, pathname);
  }
  assert.equal((await fetch(url('/api/notify'))).status, 404);
  assert.equal((await fetch(url('/api/income?account=a'))).status, 404);
  const view = await (await fetch(url('/api/loop?account=a'))).json();
  assert.equal('reconnect' in view, false);
  assert.equal('recovery' in view, false);
  assert.deepEqual(automation().reconnect, legacyReconnect, '恢复功能时旧设置还能用');
  for (const id of ['reconnect-form', 'notify-form', 'reconnect-enabled', 'notify-webhook']) assert.ok(!PAGE.includes('id="' + id + '"'), id);
  assert.ok(!PAGE.includes('连接与通知'));
  assert.ok(!PAGE.includes('收益日报'));
  assert.ok(!PAGE.includes('id="income-view"'));
  for (const route of ['/api/loop/reconnect', '/api/notify', '/api/notify/save', '/api/notify/test', '/api/income']) assert.equal(operationLabels[route], undefined, route);

} finally {
  await app.close();
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log('connection loss ok: stops without reconnect on drop, kick and login failure');
