// 首杀结算恢复：隔离账本、虚构状态和真实协议编码，不连接游戏账号。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-pirate-settlement-'));
const priorData = process.env.CW_DATA_DIR;
process.env.CW_DATA_DIR = directory;
const { pirateAdvanceFixture } = await import('./fixtures/pirate-advance.mjs');
const { createUsageLedger } = await import('../src/automation-settings.mjs');
const { runPirateAdvance, runSinglePirateHunt } = await import('../src/pirate-advance.mjs');
const { checkFleetSettlement, settleFleetSnapshot } = await import('../src/fleet-settlement.mjs');
const { fleetRecordReason, reserveDispatch } = await import('../src/fleet-availability.mjs');
const pirates = await import('../src/pirates.mjs');
const { recoverPirateHunts } = await import('../src/pirate-recovery.mjs');
const results = [];
let sequence = 0;
const ledger = options => createUsageLedger('simulated-account', { file: path.join(directory, ++sequence + '.json'), ...options });
const test = async (name, fn) => {
  try { await fn(); results.push({ name, ok: true }); console.log('通过：' + name); }
  catch (error) { results.push({ name, ok: false }); console.error('失败：' + name + '\n' + error.stack); }
};
function fixture(mode = 'wait', options) {
  const f = pirateAdvanceFixture({ mode });
  f.player.playerId = 91001;
  f.settings.pirateHunt.maxFailures = 3;
  f.ledger = ledger(options);
  f.checkpoint = {};
  f.run = extra => runPirateAdvance({ ...f, options: structuredClone(f.settings.pirateHunt),
    getSettings: () => f.settings, enabled: () => true, oneCheck: true, ...extra });
  return f;
}
const recordOf = f => Object.entries(f.ledger.keyRecords()).find(([, r]) => r.details.kind === 'pirateFirst');
async function lostWithoutEndPush({ complete = true, ambiguous = false } = {}) {
  const f = fixture();
  await f.run();
  if (complete) f.client.emit('message', { name: 'SCPirateCampaignBegin', body: { uid: 201 } });
  Object.assign(f.fleet, { state: 3, curGridIdx: 401 });
  f.client.emit('message', { name: 'SCMyFleetUpdate', body: { fleets: [f.fleet] } });
  Object.assign(f.fleet, { state: 1, curGridIdx: 0, targetGridIdx: 0 });
  f.client.emit('message', { name: 'SCMyFleetUpdate', body: { fleets: [f.fleet] } });
  const request = f.client.request, [, record] = recordOf(f);
  f.report = { uid: 551, type: 1, scenarioId: 1, pirate: { type: 1, level: 1 },
    createTime: record.details.battleAt ?? Math.floor(Date.now() / 1000), win: false };
  f.client.request = async (name, ...args) => {
    if (name === 'CampaignReportsRequest') return { reports: ambiguous ? [f.report, { ...f.report, uid: 552 }] : [f.report], total: ambiguous ? 2 : 1 };
    return request(name, ...args);
  };
  return f;
}

try {
  await test('关闭首杀后仍凭个人胜利记录结算未知派遣并释放舰队', async () => {
    const f = fixture('unknown'); await f.run();
    const [key] = recordOf(f);
    f.settings.pirateHunt.enabled = false; f.state.level = 1;
    await checkFleetSettlement(f.client, f.player, f.ledger);
    assert.equal(f.ledger.keyRecords()[key].details.outcome, 'won');
    assert.equal(f.ledger.keyRecords()[key].confirmed, true);
    assert.equal(f.ledger.pendingCounters().piratePetrol ?? 0, 0);
    assert.equal(f.ledger.confirmedCounters().piratePetrol, 300);
    assert.equal(fleetRecordReason(f.ledger.keyRecords(), f.fleet.buildingId, String(f.player.worldId)), '');
    assert.equal(pirates.pirateHuntFlights(f.client).length, 0);
    assert.equal(f.client.writes.length, 1);
  });
  await test('未知结果导致停止后继续核对，迟到胜利只结算一次且不自动重启派遣', async () => {
    const f = fixture('unknown'); await f.run(); await f.run();
    assert.equal(f.checkpoint.state.halted, true);
    f.state.level = 1;
    for (let i = 0; i < 3; i++) await f.run();
    assert.equal(recordOf(f)[1].details.outcome, 'won');
    assert.equal(f.checkpoint.state.wins, 1);
    assert.equal(f.checkpoint.state.halted, true);
    assert.match(f.checkpoint.state.reason, /已确认/);
    assert.equal(pirates.pirateHuntFlights(f.client).length, 0);
    assert.equal(f.client.writes.length, 1);
  });
  await test('空闲、时间流逝及全服广播不能解除无个人证据的未知派遣', async () => {
    const f = fixture('unknown'); await f.run(); await f.run();
    f.client.emit('message', { name: 'SCPirateCampaignEnd', body: { uid: 201, isWin: false } });
    for (let i = 0; i < 3; i++) { await checkFleetSettlement(f.client, f.player, f.ledger); await f.run(); }
    assert.equal(recordOf(f)[1].confirmed, false);
    assert.equal(f.ledger.pendingCounters().piratePetrol, 300);
    assert.equal(pirates.pirateHuntFlights(f.client).length, 1);
    assert.equal(f.client.writes.length, 1);
  });
  await test('唯一个人战败记录同时结算账本并清理内存，下一轮可正常重试', async () => {
    const f = await lostWithoutEndPush();
    await checkFleetSettlement(f.client, f.player, f.ledger);
    assert.equal(recordOf(f)[1].details.outcome, 'lost');
    assert.equal(pirates.pirateHuntFlights(f.client).length, 0);
    await f.run();
    assert.equal(f.checkpoint.state.failures, 1);
    assert.equal(f.client.writes.length, 2);
    assert.equal(f.ledger.confirmedCounters().piratePetrol, 600);
  });
  await test('纯账本结算后重新检查首杀也能清理内存，不依赖公共结算产生新变化', async () => {
    const f = await lostWithoutEndPush();
    settleFleetSnapshot(f.ledger, { worldId: String(f.player.worldId), fleets: [f.fleet], reports: [f.report], now: Math.floor(Date.now() / 1000) });
    assert.equal(recordOf(f)[1].details.outcome, 'lost');
    await f.run();
    assert.equal(f.checkpoint.state.failures, 1);
    assert.equal(f.client.writes.length, 2);
  });
  await test('单次手动入口在既有战报结算后可重新派遣，不被旧内存任务卡住', async () => {
    const f = await lostWithoutEndPush();
    const view = await pirates.pirateHuntOptions(f.client, f.config, f.player);
    const result = await runSinglePirateHunt(f.client, f.config, f.player, {
      targetKey: view.targets[0].targetKey, fleetKey: view.fleets[0].key,
      enabled: () => true, getSettings: () => f.settings, ledger: f.ledger,
    });
    assert.equal(result.status, 'started');
    assert.equal(f.client.writes.length, 2);
  });
  await test('重连恢复的内存任务保留账本编号，迟到个人胜利同时清除占用', async () => {
    const f = fixture('unknown'); await f.run();
    const reconnect = pirateAdvanceFixture({ mode: 'wait' });
    reconnect.player.playerId = f.player.playerId; reconnect.state.level = 1;
    recoverPirateHunts(reconnect.client, reconnect.player, f.ledger, 'simulated-account', null);
    assert.equal(pirates.pirateHuntFlights(reconnect.client).length, 1);
    await checkFleetSettlement(reconnect.client, reconnect.player, f.ledger);
    assert.equal(recordOf(f)[1].details.outcome, 'won');
    assert.equal(pirates.pirateHuntFlights(reconnect.client).length, 0);
    assert.equal(reconnect.client.writes.length, 0);
  });
  await test('旧任务的终态快照不能清除同目标同舰队的新派遣', async () => {
    const f = await lostWithoutEndPush();
    await checkFleetSettlement(f.client, f.player, f.ledger);
    const old = f.ledger.keyRecords(), [key, before] = recordOf(f);
    await f.run();
    assert.notEqual(f.ledger.keyRecords()[key].id, before.id);
    assert.equal(pirates.pirateHuntFlights(f.client).length, 1);
    assert.equal(typeof pirates.reconcilePirateFlights, 'function');
    pirates.reconcilePirateFlights(f.client, old, String(f.player.worldId));
    assert.equal(pirates.pirateHuntFlights(f.client).length, 1);
    assert.equal(recordOf(f)[1].details.outcome, 'started');
  });
  await test('内存恢复严格匹配世界、舰队、目标和账本编号', async () => {
    const f = fixture(); await f.run();
    const [key, original] = recordOf(f), world = String(f.player.worldId);
    assert.equal(typeof pirates.reconcilePirateFlights, 'function');
    for (const change of [
      r => { r.details.world = '2002002'; },
      r => { r.details.buildingId = '2远征船'; },
      r => { r.details.uid = 202; },
      r => { r.details.level = 2; },
      r => { r.details.type = 2; },
      r => { r.id = 'different-reservation'; },
      r => { r.expired = true; },
      r => { r.confirmed = false; },
    ]) {
      const r = structuredClone(original); r.confirmed = true; r.details.outcome = 'lost'; change(r);
      pirates.reconcilePirateFlights(f.client, { [key]: r }, world);
      assert.equal(pirates.pirateHuntFlights(f.client).length, 1);
    }
    const r = structuredClone(original); r.confirmed = true; r.details.outcome = 'lost';
    pirates.reconcilePirateFlights(f.client, { [key]: r }, '2002002');
    assert.equal(pirates.pirateHuntFlights(f.client).length, 1);
  });
  await test('缺本队开战证据或存在两份匹配战报时仍保留占用', async () => {
    for (const options of [{ complete: false }, { ambiguous: true }]) {
      const f = await lostWithoutEndPush(options);
      await checkFleetSettlement(f.client, f.player, f.ledger);
      assert.equal(recordOf(f)[1].details.outcome, 'started');
      assert.equal(pirates.pirateHuntFlights(f.client).length, 1);
      assert.equal(f.client.writes.length, 1);
    }
  });
  await test('读取期间切换世界、角色或替换同键派遣时不结算新任务', async () => {
    for (const mode of ['world', 'player', 'replacement']) {
      const f = fixture('unknown'); await f.run(); f.state.level = 1;
      const [key, before] = recordOf(f), request = f.client.request;
      f.client.request = async (name, ...args) => {
        const result = await request(name, ...args);
        if (name === 'PirateKillRecordRequest') {
          if (mode === 'world') f.player.worldId = 2002002;
          if (mode === 'player') f.player.playerId = 92002;
          if (mode === 'replacement') {
            f.ledger.cancel({ id: before.id });
            f.ledger.reserve({ piratePetrol: 300 }, {}, {}, { uniqueKey: key, details: { ...before.details } });
          }
        }
        return result;
      };
      await checkFleetSettlement(f.client, f.player, f.ledger);
      assert.equal(f.ledger.keyRecords()[key].confirmed, false);
      assert.equal(f.ledger.pendingCounters().piratePetrol, 300);
    }
  });
  await test('跨日迟到胜利不重复计入当天汽油额度', async () => {
    let time = Date.now(); const f = fixture('unknown', { now: () => time }); await f.run();
    time += 86400000; f.state.level = 1;
    await checkFleetSettlement(f.client, f.player, f.ledger);
    assert.equal(recordOf(f)[1].details.outcome, 'won');
    assert.equal(f.ledger.pendingCounters().piratePetrol ?? 0, 0);
    assert.equal(f.ledger.confirmedCounters().piratePetrol ?? 0, 0);
  });
  await test('自动首杀发送前重新核对城战预留，取消时不占用汽油', async () => {
    const f = fixture(); let checks = 0;
    f.settings.cityWar.enabled = true; f.settings.cityWar.reserveDuringWar = true; f.settings.cityWar.fleetIds = ['1远征船'];
    await f.run({ prepareDispatch: async () => { if (++checks === 2) reserveDispatch(f.client, 'cityWar', ['1远征船']); } });
    assert.equal(checks, 2); assert.equal(f.client.writes.length, 0);
    assert.equal(f.ledger.snapshot().uncertain, 0);
    assert.equal(f.ledger.snapshot().counters.piratePetrol ?? 0, 0);
  });
  await test('手动首杀发送前同样核对城战预留', async () => {
    const f = fixture(), view = await pirates.pirateHuntOptions(f.client, f.config, f.player);
    f.settings.cityWar.enabled = true; f.settings.cityWar.reserveDuringWar = true; f.settings.cityWar.fleetIds = ['1远征船'];
    await assert.rejects(runSinglePirateHunt(f.client, f.config, f.player, {
      targetKey: view.targets[0].targetKey, fleetKey: view.fleets[0].key,
      enabled: () => true, getSettings: () => f.settings, ledger: f.ledger,
      prepareDispatch: async () => reserveDispatch(f.client, 'cityWar', ['1远征船']),
    }), /城战/);
    assert.equal(f.client.writes.length, 0); assert.equal(f.ledger.snapshot().uncertain, 0);
  });
  await test('发送前异步核对期间暂停不会派遣或留下预算占用', async () => {
    const f = fixture(); let checks = 0, enabled = true;
    await f.run({ enabled: () => enabled, prepareDispatch: async () => { if (++checks === 2) enabled = false; } });
    assert.equal(f.client.writes.length, 0); assert.equal(f.ledger.snapshot().uncertain, 0);
  });
} finally {
  if (priorData === undefined) delete process.env.CW_DATA_DIR; else process.env.CW_DATA_DIR = priorData;
  for (const file of fs.readdirSync(directory)) fs.unlinkSync(path.join(directory, file));
  fs.rmdirSync(directory);
}
const passed = results.filter(r => r.ok).length;
console.log(`首杀结算恢复：${passed}/${results.length} 通过`);
if (passed !== results.length) process.exitCode = 1;
