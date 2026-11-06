// The overview must not show the login snapshot's power once the server has a newer value.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-overview-power-'));
process.env.CW_DATA_DIR = dir;
process.env.CW_CONFIG_PACK = path.join(dir, 'config.json');
fs.writeFileSync(process.env.CW_CONFIG_PACK, '[]');

const protocol = (await import('../src/proto.mjs')).loadProtocol();
for (const name of ['OtherPlayerInfoRequest', 'OtherPlayerInfoResponse', 'SCPlayerPower', 'SCPlayerExpUpdate',
  'SCNewCampaignReport', 'CampaignReportsRequest', 'CampaignReportsResponse', 'QuickGotCampaignReportRequest', 'GotRewardResponse']) assert(protocol[name], name + ' 应存在于真实协议');

const { GameClient, toNumber } = await import('../src/client.mjs');
const { saveStore } = await import('../src/accounts.mjs');
const { createConsole } = await import('../src/server.mjs');
const { rewardSchedule } = await import('../src/reward-schedule.mjs');
const { runLoop } = await import('../src/loop.mjs');
const { createUsageLedger, defaultSettings } = await import('../src/automation-settings.mjs');

const long = (value) => ({ low: value % 2 ** 32 | 0, high: Math.floor(value / 2 ** 32), unsigned: false });
// Above Number.MAX_SAFE_INTEGER: 0x7FFFFFFF_00000001.
const playerId = { low: 1, high: 0x7fffffff, unsigned: false };
const playerIdText = ((BigInt(0x7fffffff) << 32n) + 1n).toString();
let serverPower = long(294225);
let failRead = false;
const asked = [];
let logins = 0;
let reportRecords = [];
let reportReads = 0, reportWrites = 0, onReportRead = null, reportFailure = false;
Object.defineProperty(GameClient.prototype, 'connected', { get: () => true });
GameClient.prototype.connect = async () => { logins++; return { playerInfo: { playerId, nickname: '测试', level: 20, power: long(166051) } }; };
GameClient.prototype.send = () => {};
GameClient.prototype.request = async (name, body) => {
  if (name === 'CampaignReportsRequest') {
    reportReads++;
    onReportRead?.();
    return protocol.CampaignReportsResponse.decode(protocol.CampaignReportsResponse.encode({ total: reportRecords.length, reports: reportRecords }).finish());
  }
  if (name === 'QuickGotCampaignReportRequest') {
    assert.equal(body.all, true);
    protocol.QuickGotCampaignReportRequest.decode(protocol.QuickGotCampaignReportRequest.encode(body).finish());
    reportWrites++;
    if (reportFailure) throw Error('模拟战报领奖超时');
    reportRecords.forEach(record => { record.received = true; });
    return protocol.GotRewardResponse.decode(protocol.GotRewardResponse.encode({ reward: { asset: [{ id: 'RUBY', num: 1 }] } }).finish());
  }
  if (name !== 'OtherPlayerInfoRequest') return {};
  asked.push(body.playerId);
  if (failRead) throw new Error('offline');
  return { power: serverPower };
};

saveStore({ activeId: 'a', accounts: [{ id: 'a', url: 'ws://invalid.invalid', login: {}, automation: { enabled: false } }] });
const app = createConsole({ port: 0 });
async function runReportLoop(client, ledger, flags, settings = null) {
  const entries = [];
  await runLoop(client, protocol, {
    config: { tables: {} }, player: { level: 21, worldId: 1001001 }, allowMutate: true, rounds: 1,
    isEnabled: key => flags.has(key), getSettings: () => settings, usageLedger: ledger, onStep: entry => entries.push(entry),
  });
  return entries;
}
try {
  await app.listen();
  const overview = async () => {
    const res = await fetch('http://127.0.0.1:' + app.server.address().port + '/api/overview?account=a', { signal: AbortSignal.timeout(10000) });
    assert.equal(res.status, 200);
    return res.json();
  };

  assert.equal(toNumber((await overview()).player.power), 294225, '总览应显示服务端战力，而不是登录快照');
  assert.equal(asked.at(-1), playerIdText, 'playerId 不能经过不安全的数字转换');

  failRead = true;
  assert.equal(toNumber((await overview()).player.power), 294225, '读取失败时保留已知战力，总览不能因此失败');

  const session = app.sessions.get('a');
  session.client.emit('message', { name: 'SCPlayerPower', body: { power: long(300000) } });
  assert.equal(toNumber((await overview()).player.power), 300000, '战力推送应立即生效');

  session.client.emit('message', { name: 'SCPlayerPower', body: { power: long(0) } });
  assert.equal(toNumber((await overview()).player.power), 300000, '空的战力推送不能清零');

  assert.equal(logins, 1, '刷新总览不能重新登录');

  failRead = false;
  serverPower = long(0);
  assert.equal(toNumber((await overview()).player.power), 300000, '回包没有战力时保留已知值');

  const schedule = rewardSchedule(session.client);
  const unlockTasks = ['adShop', 'weekPass', 'trialSweep', 'dailyRewards', 'chests', 'museumCollect', 'museumExplore',
    'petCollect', 'petBreed', 'worldOnline', 'tradeTasks', 'seasonTasks', 'museumRevenue', 'museumAchievements',
    'heroGrowth', 'stageAuto', 'treasureLoot'];
  for (const key of [...unlockTasks, 'mail']) schedule.defer(key, schedule.now() + 3600);
  schedule.defer('museumExplore:1', schedule.now() + 3600);
  session.client.emit('message', { name: 'SCPlayerExpUpdate', body: { level: 20, exp: 10 } });
  assert(schedule.nextCheck('museumExplore') > schedule.now(), '同等级经验推送应保留任务截止时间');
  session.client.emit('message', { name: 'SCPlayerExpUpdate', body: { level: 21, exp: 0 } });
  for (const key of unlockTasks) assert.equal(schedule.nextCheck(key), null, key + ' 升级解锁后应立即重新检查');
  assert.equal(schedule.nextCheck('museumExplore:1'), null, '升级时同时清理玩法细项的截止时间');
  assert(schedule.nextCheck('mail') > schedule.now(), '升级不影响无关任务');
  assert.equal(session.player.level, 21);

  const pushReport = () => session.client.emit('message', { name: 'SCNewCampaignReport', body: {} });
  const unclaimed = uid => ({ uid, received: false, rewards: { assetPackage: { asset: [{ id: 'RUBY', num: 1 }] } } });
  assert.equal(session.loop.running, false, '验证未启动挂机时的推送领奖');
  reportRecords = [unclaimed(1)];
  pushReport();
  assert(session.reportClaim, '新战报应进入账号的串行领奖队列');
  await session.reportClaim;
  assert.equal(reportWrites, 1, '未启动挂机也应按原开关领取新战报');
  pushReport();
  await session.reportClaim;
  assert.equal(reportWrites, 1, '已领取战报不应重复提交');

  session.loop.tasks.campaignReports = false;
  reportRecords = [unclaimed(2)];
  const readsBeforeDisabled = reportReads;
  pushReport();
  assert.equal(session.reportClaim, null, '关闭原战报开关后不启动推送领奖');
  assert.equal(reportReads, readsBeforeDisabled);

  session.loop.tasks.campaignReports = true;
  onReportRead = () => { session.loop.tasks.campaignReports = false; };
  pushReport();
  await session.reportClaim;
  assert.equal(reportWrites, 1, '列表读取期间关闭开关，发送前必须停止');
  onReportRead = null;
  session.loop.tasks.campaignReports = true;
  session.paused = true;
  pushReport();
  assert.equal(session.reportClaim, null, '暂停账号时不得因推送发起领奖');
  session.paused = false;
  onReportRead = () => { session.generation++; };
  pushReport();
  await session.reportClaim;
  assert.equal(reportWrites, 1, '账号队列代次改变后不得继续提交原领奖操作');
  onReportRead = null;

  reportFailure = true;
  pushReport();
  await session.reportClaim;
  assert.equal(reportWrites, 2, '模拟一次已发送但结果未知的推送领奖');
  for (const keys of [['campaignReports'], ['battleReportRewards'], ['campaignReports', 'battleReportRewards']]) {
    // 重新读取同账号的持久账本，验证跨入口和跨次运行的未知记录都能阻止重发。
    const entries = await runReportLoop(session.client, createUsageLedger('a'), new Set(keys));
    assert.equal(reportWrites, 2, keys.join('+') + ' 不得绕过推送领奖留下的未知记录');
    assert(entries.some(entry => entry.taskKey === 'battleReportRewards' && entry.skipped && /前次战报领取结果未确认/.test(entry.reason)), '实际挂机应报告战报结果待确认');
    assert(!entries.some(entry => entry.ok), '未知结果不能报告成功');
  }

  for (const detailed of [false, true]) {
    const client = new EventEmitter();
    client.connected = true;
    const records = [], requests = [];
    let writes = 0, beforeRead = null;
    client.request = async (name, body) => {
      requests.push(name);
      assert(protocol[name], name + ' 应存在于真实协议');
      protocol[name].decode(protocol[name].encode(body).finish());
      if (name === 'CampaignReportsRequest') {
        beforeRead?.();
        return protocol.CampaignReportsResponse.decode(protocol.CampaignReportsResponse.encode({ total: records.length, reports: records }).finish());
      }
      assert.equal(name, 'QuickGotCampaignReportRequest', '新旧开关应统一使用一键领取协议');
      assert.equal(body.all, true);
      writes++;
      records.forEach(record => { record.received = true; });
      return protocol.GotRewardResponse.decode(protocol.GotRewardResponse.encode({ reward: { asset: [{ id: 'RUBY', num: 1 }] } }).finish());
    };
    const settings = detailed ? defaultSettings() : null;
    const ledger = createUsageLedger('loop-reports-' + detailed, { file: path.join(dir, 'loop-reports-' + detailed + '.json') });
    for (const keys of [['campaignReports'], ['battleReportRewards'], ['campaignReports', 'battleReportRewards']]) {
      records.push(unclaimed(records.length + 1));
      const before = writes;
      const entries = await runReportLoop(client, ledger, new Set(keys), settings);
      assert.equal(writes, before + 1, '新旧开关分别或同时开启，每轮只提交一次：' + detailed + '/' + keys.join('+'));
      assert(entries.some(entry => entry.taskKey === 'battleReportRewards' && entry.ok && entry.status === 'confirmed'), '实际挂机应报告已确认领取');
    }
    records.push(unclaimed(records.length + 1));
    const beforeDisabled = requests.length;
    await runReportLoop(client, ledger, new Set(), settings);
    assert.equal(requests.length, beforeDisabled, '两个战报开关都关闭时不应读取或领取');
    const flags = new Set(['campaignReports']);
    beforeRead = () => flags.clear();
    await runReportLoop(client, ledger, flags, settings);
    assert.equal(writes, 3, '旧开关在列表读取期间关闭，实际挂机不得继续发送');
  }
} finally {
  await app.close();
  assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir()));
  assert(path.basename(dir).startsWith('cw-overview-power-'));
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log('overview power ok: power and unlock pushes, queued report rewards, loop aliases, persistent unknown protection and send-time controls');
process.exit(0);
