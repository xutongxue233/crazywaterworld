// Issue #34：虚构业务数据经过真实协议编解码；不连接或消费真实游戏账号。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createUsageLedger } from '../src/automation-settings.mjs';
import { readTreasureLoot, planTreasureLoot, runTreasureLoot, treasureFollowKey } from '../src/treasure-loot.mjs';
import { recordsInWorld } from '../src/fleet-settlement.mjs';
import { treasureCycleFixture, treasureCycleSettings } from './fixtures/treasure-cycle.mjs';

const parent = path.join(os.tmpdir(), 'cw-treasure-follow-repeat-tests');
fs.mkdirSync(parent, { recursive: true });
const directory = fs.mkdtempSync(path.join(parent, 'run-'));
const results = [];
let sequence = 0;
const ledger = (options = {}) => createUsageLedger('虚构跟随反复攻占账号', {
  file: path.join(directory, `ledger-${++sequence}.json`), ...options,
});
const fixture = () => {
  const f = treasureCycleFixture(), s = treasureCycleSettings();
  Object.assign(s.treasure, { autoJoin: false, follow: true, repeatAttack: true, followNames: ['海上的风'] });
  Object.assign(f.state.targets[0], { ownerGuildIdx: 7, ownerFleetNum: 1 });
  f.state.defenders[72] = [{ name: '海上的风', guildIdx: 7, isNpc: false }];
  f.state.ranks[72] = [{ playerId: '9007199254740999', nickname: '海上的风', guildIdx: 7 }];
  return { f, s };
};
const leave = f => {
  Object.assign(f.state.targets[0], { ownerGuildIdx: 0, ownerFleetNum: 0 });
  f.state.defenders[72] = [];
  // 历史排名有跟随者，不应重新成为首次触发依据。
};
const run = (f, s, usage, options = {}) => runTreasureLoot(f.client, f.protocol, f.config, f.player,
  { getSettings: () => s, ledger: usage, ...options });
const preview = async (f, s, usage, options = {}) => planTreasureLoot(
  await readTreasureLoot(f.client, f.protocol, f.config, f.player, { preferences: s.treasure }), f.config, s,
  { usage: usage.snapshot(), keys: usage.keyRecords(), pendingFuel: usage.pendingCounters().treasurePetrol ?? 0, ...options });
const dispatches = f => f.client.writes.filter(row => row.name === 'TreasureLootSendFleetsRequest');
const first = async (f, s, usage) => {
  const result = await run(f, s, usage);
  assert.equal(result.results.length, 1, '首次跟随应有且仅有一次派遣');
  assert.equal(result.results[0].status, 'confirmed');
  assert.equal(result.results[0].step.targetUid, 72);
  assert.equal(dispatches(f).length, 1);
};
const check = async (name, work) => {
  try { await work(); results.push({ name, passed: true }); console.log('通过：' + name); }
  catch (error) { results.push({ name, passed: false, error: error.stack }); console.error('失败：' + name + '\n' + error.stack); }
};

try {
  await check('首次必须命中跟随对象，常规参加和历史排名都不能兜底', async () => {
    const { f, s } = fixture(), usage = ledger(); leave(f); s.treasure.autoJoin = true;
    assert.equal((await preview(f, s, usage)).actions.length, 0);
    await run(f, s, usage); assert.equal(f.client.writes.length, 0);
  });

  await check('首次确认后双方被打回，同舰队可连续再派且预览不修改账本', async () => {
    const { f, s } = fixture(), usage = ledger(); await first(f, s, usage); leave(f);
    for (let expected = 2; expected <= 3; expected++) {
      f.returnFromTreasure('1远征船');
      const before = usage.keyRecords();
      const plan = await preview(f, s, usage);
      assert.equal(plan.actions[0]?.kind, 'treasureDispatch');
      assert.equal(plan.actions[0].targetUid, 72);
      assert.deepEqual(usage.keyRecords(), before, '只读预览不得删改首次确认记录');
      const result = await run(f, s, usage);
      assert.equal(result.results[0]?.status, 'confirmed');
      assert.equal(dispatches(f).length, expected);
    }
    assert.equal(usage.snapshot().counters.treasureDispatches, 3);
    assert.equal(usage.snapshot().uncertain, 0);
  });

  await check('首次由真实出发行军触发，行军已结束后仍可反复攻占', async () => {
    const { f, s } = fixture(), usage = ledger(), request = f.client.request;
    leave(f); const now = Math.floor(Date.now() / 1000);
    let traveler = { buildingId: '9远征船', state: 2, treasureLootUid: 72, targetGridIdx: 500,
      moveStartTs: now - 1, moveEndTs: now + 60,
      owner: { playerId: '9007199254740999', nickname: '海上的风', guildId: f.player.guildId } };
    f.client.request = async (...args) => {
      const reply = await request(...args);
      if (args[0] !== 'WorldInfoRequest') return reply;
      return f.protocol.WorldInfoResponse.decode(f.protocol.WorldInfoResponse.encode({
        ...reply, fleets: [...reply.fleets, traveler],
      }).finish());
    };
    const result = await run(f, s, usage);
    assert.equal(result.results[0]?.status, 'confirmed'); assert.equal(result.results[0].step.followPhase, 'departing');
    traveler = { ...traveler, state: 1, treasureLootUid: 0, targetGridIdx: 0 };
    f.returnFromTreasure('1远征船'); await run(f, s, usage);
    assert.equal(dispatches(f).length, 2);
  });

  await check('确认后的普通维修和重启不丢失首次触发，换日按新日期计次', async () => {
    const { f, s } = fixture(), file = path.join(directory, 'repair-restart.json');
    let now = Date.parse('2026-11-03T15:59:00Z'), usage = ledger({ file, now: () => now });
    await first(f, s, usage); leave(f); f.returnFromTreasure('1远征船', 1500);
    let result = await run(f, s, usage);
    assert.equal(result.results[0]?.step.kind, 'treasureRepair');
    assert.equal(result.results[0].status, 'confirmed');
    now += 120000; usage = ledger({ file, now: () => now });
    f.finishRepair('1远征船'); result = await run(f, s, usage);
    assert.equal(result.results[0]?.status, 'confirmed');
    assert.deepEqual(f.client.writes.map(row => row.name), ['TreasureLootSendFleetsRequest', 'RepairFleetRequest', 'TreasureLootSendFleetsRequest']);
    assert.equal(usage.snapshot().counters.treasureDispatches, 1);
    assert.equal(usage.snapshot().uncertain, 0);
  });

  await check('首次跟随标记写入中断后可从已确认派遣恢复，不重复占用预算', async () => {
    const { f, s } = fixture(), file = path.join(directory, 'marker-interruption.json');
    let usage = ledger({ file }); await first(f, s, usage); leave(f); f.returnFromTreasure('1远征船');
    const key = treasureFollowKey(1001001, 72, '1远征船'), confirm = usage.confirm;
    usage.confirm = ticket => {
      if (usage.keyRecords()[key]?.id === ticket.id) throw new Error('模拟标记已写入但确认前进程中断');
      return confirm(ticket);
    };
    await assert.rejects(run(f, s, usage), /确认前进程中断/);
    assert.equal(usage.keyRecords()[key].confirmed, false); assert.equal(dispatches(f).length, 1);
    assert.equal(usage.snapshot().counters.treasureDispatches, 1);
    usage = ledger({ file });
    const result = await run(f, s, usage);
    assert.equal(result.results[0]?.status, 'confirmed'); assert.equal(dispatches(f).length, 2);
    assert.equal(usage.keyRecords()[key].confirmed, true); assert.equal(usage.snapshot().uncertain, 0);
    assert.equal(usage.snapshot().counters.treasureDispatches, 2);
    assert.equal(recordsInWorld(usage.keyRecords(), 1001002)[key], undefined, '共享舰队记录筛选不可带入其他区服标记');
  });

  await check('其他舰队、新货轮及其他区服不能借用已确认首次触发', async () => {
    for (const kind of ['fleet', 'target', 'world']) {
      const { f, s } = fixture(), usage = ledger(); await first(f, s, usage); leave(f); f.returnFromTreasure('1远征船');
      if (kind === 'fleet') s.treasure.fleetIds = ['2远征船'];
      if (kind === 'target') { f.state.targets[0].uid = 73; f.state.defenders[73] = []; f.state.ranks[73] = f.state.ranks[72]; }
      if (kind === 'world') f.player.worldId = 1001002;
      await run(f, s, usage); assert.equal(dispatches(f).length, 1, kind);
    }
  });

  await check('未知首次出征持续锁定，直到服务器实际确认才能解锁再派', async () => {
    const { f, s } = fixture(), usage = ledger(); f.unknown = true;
    let result = await run(f, s, usage); assert.equal(result.results[0].status, 'unknown');
    leave(f); f.returnFromTreasure('1远征船', 1500);
    await run(f, s, usage); assert.equal(f.client.writes.length, 1); assert.equal(usage.snapshot().uncertain, 1);
    Object.assign(f.state.fleets[0], { state: 2, treasureLootUid: 72, durability: 2000 });
    await run(f, s, usage); assert.equal(usage.snapshot().uncertain, 0);
    f.returnFromTreasure('1远征船'); f.unknown = false;
    result = await run(f, s, usage); assert.equal(result.results[0]?.status, 'confirmed');
    assert.equal(dispatches(f).length, 2);
  });

  await check('首次明确拒绝、仅维修确认和发送前取消均不能解锁', async () => {
    for (const kind of ['rejected', 'repair', 'cancelled']) {
      const { f, s } = fixture(), usage = ledger(); let enabled = true;
      if (kind === 'rejected') f.reject = true;
      if (kind === 'repair') f.state.fleets[0].durability = 1500;
      if (kind === 'cancelled') {
        const reserve = usage.reserve;
        usage.reserve = (...args) => { const ticket = reserve(...args); enabled = false; return ticket; };
      }
      const result = await run(f, s, usage, { enabled: () => enabled });
      if (kind === 'rejected') assert.equal(result.results[0].status, 'rejected');
      if (kind === 'repair') assert.equal(result.results[0].step.kind, 'treasureRepair');
      const sent = f.client.writes.length; leave(f); f.returnFromTreasure('1远征船'); f.reject = false; enabled = true;
      await run(f, s, usage); assert.equal(f.client.writes.length, sent, kind);
      assert.equal(usage.snapshot().uncertain, 0, kind);
    }
  });

  await check('关闭反复攻占后仍禁止第二次出征，再开启才恢复', async () => {
    const { f, s } = fixture(), usage = ledger(); await first(f, s, usage); leave(f); f.returnFromTreasure('1远征船');
    s.treasure.repeatAttack = false; await run(f, s, usage); assert.equal(dispatches(f).length, 1);
    s.treasure.repeatAttack = true; await run(f, s, usage); assert.equal(dispatches(f).length, 2);
  });

  await check('开始维修后关闭反复攻占，即使跟随者仍在也不再次出征', async () => {
    const { f, s } = fixture(), usage = ledger(); await first(f, s, usage); f.returnFromTreasure('1远征船', 1500);
    const result = await run(f, s, usage);
    assert.equal(result.results[0]?.step.kind, 'treasureRepair'); assert.equal(result.results[0].status, 'confirmed');
    s.treasure.repeatAttack = false; f.finishRepair('1远征船');
    await run(f, s, usage); assert.equal(dispatches(f).length, 1);
    s.treasure.repeatAttack = true; await run(f, s, usage); assert.equal(dispatches(f).length, 2);
  });

  await check('首次触发离开仍阻止发送，已确认后的再派不因复核时离开取消', async () => {
    for (const repeat of [false, true]) {
      const { f, s } = fixture(), usage = ledger();
      if (repeat) { await first(f, s, usage); f.returnFromTreasure('1远征船'); }
      let worldReads = 0;
      f.beforeRead = name => { if (name === 'WorldInfoRequest' && ++worldReads === 2) leave(f); };
      const result = await run(f, s, usage);
      assert.equal(dispatches(f).length, repeat ? 2 : 0);
      if (repeat) assert.equal(result.results[0]?.status, 'confirmed');
    }
  });

  await check('首次解锁后仍遵守奖励、进度、避战、敌盟、预算和舰队条件', async () => {
    const blocks = {
      reward: (f, s) => { s.treasure.rewardItems = ['不存在的奖励']; },
      personalProgress: (f, s) => { f.state.ranks[72].push({ playerId: f.player.playerId, nickname: f.player.nickname, guildIdx: 7, progress: 10 }); s.treasure.personalProgressLimit = 10; },
      totalProgress: (f, s) => { f.state.targets[0].progress = s.treasure.maxProgress; },
      avoid: (f, s) => { Object.assign(f.state.targets[0], { ownerGuildIdx: 7, ownerFleetNum: 1 }); f.state.defenders[72] = [{ name: '需要避战', guildIdx: 7, isNpc: false }]; s.treasure.avoidNames = ['需要避战']; },
      hostile: f => { Object.assign(f.state.targets[0], { ownerGuildIdx: 8, ownerFleetNum: 1 }); f.state.defenders[72] = [{ name: '敌方守军', guildIdx: 8, isNpc: false }]; },
      fuel: (f, s) => { s.treasure.petrolReserve = f.state.fuel; },
      dailyDispatch: (f, s) => { s.treasure.dailyDispatchLimit = 1; },
      rewardQuota: f => { f.state.stats.todayRewardTimes = 3; },
      durability: (f, s) => { f.state.fleets[0].durability = 1000; s.treasure.autoRepair = false; },
      busy: f => { f.state.fleets[0].state = 2; },
      outsideHome: f => { f.state.fleets[0].curGridIdx = 10; },
      targetGone: f => { f.state.targets = []; },
      smallBoat: f => { f.state.targets[0].color = 3; },
      disabled: (f, s) => { s.treasure.enabled = false; },
    };
    for (const [name, block] of Object.entries(blocks)) {
      const { f, s } = fixture(), usage = ledger(); await first(f, s, usage); leave(f); f.returnFromTreasure('1远征船');
      assert.equal((await preview(f, s, usage)).actions[0]?.kind, 'treasureDispatch', name + '：施加限制前可再次出征');
      block(f, s); await run(f, s, usage); assert.equal(f.client.writes.length, 1, name);
    }
  });

  await check('再次出征仍在发送前复查目标和用量，不绕过舰队调度预约', async () => {
    for (const kind of ['targetGone', 'rewardQuota', 'reserved', 'disabled']) {
      const { f, s } = fixture(), usage = ledger(); await first(f, s, usage); leave(f); f.returnFromTreasure('1远征船');
      let worldReads = 0;
      f.beforeRead = name => {
        if (name !== 'WorldInfoRequest' || ++worldReads !== 2) return;
        if (kind === 'targetGone') f.state.targets = [];
        if (kind === 'rewardQuota') f.state.stats.todayRewardTimes = 3;
        if (kind === 'disabled') s.treasure.enabled = false;
      };
      await run(f, s, usage, { canUseFleet: () => kind !== 'reserved' });
      assert.equal(f.client.writes.length, 1, kind);
      assert.equal(usage.snapshot().uncertain, 0, kind);
    }
  });

  await check('再次出征结果未知时，首次确认记录不能使未知写请求重发', async () => {
    const { f, s } = fixture(), usage = ledger(); await first(f, s, usage); leave(f); f.returnFromTreasure('1远征船');
    f.unknown = true; const result = await run(f, s, usage);
    assert.equal(result.results[0]?.status, 'unknown'); assert.equal(dispatches(f).length, 2);
    await run(f, s, usage); assert.equal(dispatches(f).length, 2);
    assert.equal(usage.snapshot().uncertain, 1); assert.equal(usage.pendingCounters().treasurePetrol, 500);
  });

  await check('再次出征明确拒绝仍保留首次触发，下一轮可重新核验后尝试', async () => {
    const { f, s } = fixture(), usage = ledger(); await first(f, s, usage); leave(f); f.returnFromTreasure('1远征船');
    f.reject = true; let result = await run(f, s, usage);
    assert.equal(result.results[0]?.status, 'rejected'); assert.equal(dispatches(f).length, 2);
    assert.equal(usage.snapshot().uncertain, 0); assert.equal(usage.snapshot().counters.treasureDispatches, 1);
    f.reject = false; result = await run(f, s, usage);
    assert.equal(result.results[0]?.status, 'confirmed'); assert.equal(dispatches(f).length, 3);
    assert.equal(usage.snapshot().counters.treasureDispatches, 2);
  });

  await check('普通参加的确认记录不能充当指定跟随的首次触发', async () => {
    const { f, s } = fixture(), usage = ledger(); s.treasure.follow = false; s.treasure.autoJoin = true;
    await first(f, s, usage); leave(f); f.returnFromTreasure('1远征船');
    s.treasure.follow = true; s.treasure.autoJoin = false;
    await run(f, s, usage); assert.equal(dispatches(f).length, 1);
  });
} finally {
  const report = { kind: 'Issue #34 跟随首次触发离线回归，未连接真实游戏', total: results.length,
    passed: results.filter(row => row.passed).length, results };
  console.log(`跟随反复攻占专项：${report.passed}/${report.total} 组通过`);
  const resolved = fs.realpathSync(directory);
  if (path.dirname(resolved) !== fs.realpathSync(parent) || !path.basename(resolved).startsWith('run-')) throw new Error('临时目录边界校验失败');
  fs.rmSync(resolved, { recursive: true });
  if (report.passed !== report.total) process.exitCode = 1;
}
