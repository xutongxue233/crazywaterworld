import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createUsageLedger } from '../src/automation-settings.mjs';
import {
  checkFleetSettlement,
  invalidateFleetReports,
  settleFleetSnapshot,
  radarEvents,
  recordsInWorld
} from '../src/fleet-settlement.mjs';
import { fleetRecordReason } from '../src/fleet-availability.mjs';
import { runAllianceRadar } from '../src/alliance-radar.mjs';
import { pirateAdvanceFixture } from './fixtures/pirate-advance.mjs';

const world = '2002001001',
  now = 1793837200,
  day = Math.floor((now + 28800) / 86400);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-fleet-settlement-'));
let n = 0,
  seq = 0;
const make = () => createUsageLedger('sample', { file: path.join(dir, ++seq + '.json') });
const home = (id) => ({
  buildingId: id,
  state: 1,
  curGridIdx: 0,
  treasureLootUid: 0,
  durability: 2060,
  maxDura: 2060
});
const radar = { eventId: 66, gridIdx: 29305, createTime: 1793836905, state: 1 };
const fk = 'fixed-66-' + radar.createTime;
const add = (ledger, key, details, confirmed = true, counters = {}) => {
  const t = ledger.reserve(counters, {}, {}, { uniqueKey: key, details });
  if (confirmed) ledger.confirm(t);
};
const settle = (l, fleets, opts = {}) => settleFleetSnapshot(l, { worldId: world, now, fleets, ...opts });
const test = async (name, fn) => {
  await fn();
  console.log('通过：' + name);
  n++;
};
await test('固定66退回待处理且同队回家，仅撤销占用，保留防重键和已确认汽油', () => {
  for (const id of ['1远征船', '2远征船', '3远征船']) {
    const l = make(),
      k = 'radar-send:' + world + ':' + fk;
    add(l, k, { kind: 'radarSend', eventKey: fk, buildingId: id, active: true }, true, { radarPetrol: 500 });
    const events = radarEvents({ events: [], fixedEvent: radar });
    settle(l, [home(id)], { events });
    assert.equal(l.keyRecords()[k].details.active, false);
    assert(l.hasKey(k));
    assert.equal(fleetRecordReason(l.keyRecords(), id, world), '');
    assert.equal(l.confirmedCounters().radarPetrol, 500);
    assert.deepEqual(settle(l, [home(id)], { events }), []);
    assert.equal(l.pendingCounters().radarPetrol ?? 0, 0);
  }
});
await test('行军、排队、战斗、驻守、维修或资料缺失均不能释放情报占用', () => {
  const l = make(),
    key = 'radar-send:' + world + ':' + fk,
    id = '2远征船';
  add(l, key, { kind: 'radarSend', eventKey: fk, buildingId: id, active: true });
  for (const fleet of [
    null,
    { ...home(id), state: 2 },
    { ...home(id), state: 3 },
    { ...home(id), state: 4 },
    { ...home(id), state: 5 },
    { ...home(id), curGridIdx: 1 },
    { ...home(id), treasureLootUid: 55 },
    { ...home(id), chipWar: { rewardTs: 123 } },
    { ...home(id), curGridIdx: undefined },
    home('1远征船')
  ])
    settle(l, fleet ? [fleet] : [], { events: radarEvents({ events: [], fixedEvent: radar }) });
  for (const events of [
    null,
    radarEvents({ events: [], fixedEvent: { ...radar, state: 2 } }),
    radarEvents({ events: [], fixedEvent: { ...radar, state: 3 } }),
    radarEvents({ events: [], fixedEvent: { ...radar, createTime: 0 } })
  ])
    settle(l, [home(id)], { events });
  assert(l.keyRecords()[key].details.active);
});
await test('普通情报可领奖、已移除、失败复位均释放；未知派遣不能用空闲核销', () => {
  for (const state of [0, 1, 4]) {
    const l = make(),
      key = 'radar-send:' + world + ':9001',
      id = '3远征船';
    add(l, key, { kind: 'radarSend', eventKey: '9001', buildingId: id, active: true }, true, {
      radarPetrol: 500
    });
    settle(l, [home(id)], { events: state ? [{ uid: '9001', state }] : [] });
    assert.equal(l.keyRecords()[key].details.active, false);
  }
  const l = make(),
    key = 'radar-send:' + world + ':' + fk;
  add(l, key, { kind: 'radarSend', buildingId: '2远征船', eventKey: fk, active: true }, false, {
    radarPetrol: 500
  });
  settle(l, [home('2远征船')], { events: radarEvents({ events: [], fixedEvent: radar }) });
  assert(l.keyRecords()[key].details.active);
  assert.equal(l.pendingCounters().radarPetrol, 500);
});
await test('关闭任务或跨重启也核对旧占用，核对只读、不派队，原键阻止重派', async () => {
  const l = make(),
    key = 'radar-send:' + world + ':' + fk;
  add(l, key, { kind: 'radarSend', eventKey: fk, buildingId: '2远征船', active: true }, true, {
    radarPetrol: 500
  });
  const calls = [];
  const c = {
    connected: true,
    request: async (name) => {
      calls.push(name);
      if (name === 'MyFleetsRequest') return { fleets: [home('2远征船')] };
      if (name === 'RadarInfoRequest') return { radarInfo: { events: [], fixedEvent: radar } };
      throw Error(name);
    }
  };
  await Promise.all([
    checkFleetSettlement(c, { worldId: world }, l),
    checkFleetSettlement(c, { worldId: world }, l)
  ]);
  assert.deepEqual(calls.sort(), ['MyFleetsRequest', 'RadarInfoRequest']);
  assert(!l.keyRecords()[key].details.active);
  await checkFleetSettlement(c, { worldId: world }, l);
  assert.equal(calls.length, 2);
  const f = pirateAdvanceFixture();
  f.player.guildId = '1001007';
  f.player.worldId = world;
  Object.assign(f.settings.radar, { enabled: true, fleetIds: ['2远征船'], types: ['fixed'] });
  f.config.tables.ModuleOpenCfg.data.push({ moduleId: '联盟情报', playerLevel: 16 });
  f.config.tables.WorldParamCfg.data.push({ paramName: '情报事件消耗汽油', paramValue: 500 });
  const old = f.client.request;
  f.client.request = async (name, ...args) =>
    name === 'RadarInfoRequest'
      ? { radarInfo: { events: [], fixedEvent: radar } }
      : name === 'MyFleetsRequest'
        ? { fleets: [home('2远征船')] }
        : name === 'OnWaterRequest'
          ? {
              building: [
                {
                  buildingId: '2远征船',
                  level: 1,
                  fleet: { formation: { heroPositions: [{ heroId: '英雄' }] } }
                }
              ]
            }
          : old(name, ...args);
  await runAllianceRadar(f.client, f.config, f.player, {
    getSettings: () => f.settings,
    enabled: () => true,
    ledger: l,
    report: () => {}
  });
  assert.equal(f.client.writes.length, 0);
  assert.equal(l.confirmedCounters().radarPetrol, 500);
});
await test('Boss漏掉行军时只用本期个人战报或跨日归队解除，保留每日防重键', async () => {
  const l = make(),
    id = '1远征船',
    key = 'world-boss:' + world + ':' + day;
  add(
    l,
    key,
    { kind: 'worldBoss', bossId: 3, grid: 800, buildingId: id, day, sentAt: now - 8, active: true },
    true,
    { worldBossPetrol: 300 }
  );
  settle(l, [home(id)], { reports: [{ type: 5, worldBoss: { bossId: 7 }, createTime: now }] });
  assert(l.keyRecords()[key].details.active);
  settle(l, [{ ...home(id), state: 2, targetGridIdx: 2 }], {
    reports: [{ type: 5, worldBoss: { bossId: 3 }, createTime: now }]
  });
  assert(l.keyRecords()[key].details.active);
  const sent = [];
  const c = {
    connected: true,
    serverClockOffsetMs: now * 1000 - Date.now(),
    request: async (name, body) => {
      sent.push(name);
      if (name === 'MyFleetsRequest') return { fleets: [home(id)] };
      if (name === 'CampaignReportsRequest')
        return {
          total: 2,
          reports: body.pageNo
            ? [{ type: 5, createTime: now, worldBoss: { bossId: 3 } }]
            : [{ type: 1, createTime: now }]
        };
      throw Error(name);
    }
  };
  await checkFleetSettlement(c, { worldId: world }, l);
  assert.equal(l.keyRecords()[key].details.active, false);
  assert.equal(sent.filter((n) => n === 'CampaignReportsRequest').length, 2);
  assert.equal(l.confirmedCounters().worldBossPetrol, 300);
  const other = make();
  add(other, key, { kind: 'worldBoss', bossId: 3, grid: 800, buildingId: id, day, active: true });
  settle(other, [home(id)], { now: now + 86400 });
  assert(!other.keyRecords()[key].details.active);
});
await test('城战及两类维修结束后释放；未确认的空闲和同城不算执行成功', () => {
  for (const [prefix, kind] of [
    ['cityWar', 'cityDispatch'],
    ['cityWar', 'cityRepair'],
    ['treasureRepair', 'treasureRepair']
  ]) {
    const l = make(),
      key = prefix + ':' + world + ':1',
      id = '1远征船';
    add(l, key, { kind, buildingId: id, cityId: 39, beforeDurability: 2060 }, false, { cityWarPetrol: 300 });
    settle(l, [{ ...home(id), cityId: 39 }]);
    assert.equal(l.keyRecords()[key].confirmed, false);
    const busy =
      kind === 'cityDispatch'
        ? { ...home(id), state: 5, cityId: 39 }
        : { ...home(id), state: 4, repairing: { endTs: now + 5 } };
    settle(l, [busy]);
    assert(l.keyRecords()[key].confirmed);
    settle(l, [home(id)]);
    assert(!l.hasKey(key));
    assert.equal(l.confirmedCounters().cityWarPetrol, 300);
  }
});
await test('货轮确认保留一次参与键，首杀不能只按返航推断输赢', () => {
  const l = make(),
    id = '3远征船',
    key = 'treasure:' + world + ':901:3';
  add(l, key, { kind: 'treasureDispatch', buildingId: id, uid: 901 }, false);
  settle(l, [home(id)]);
  assert(!l.keyRecords()[key].confirmed);
  settle(l, [{ ...home(id), state: 3, treasureLootUid: 901 }]);
  settle(l, [home(id)]);
  assert(l.keyRecords()[key].confirmed && l.hasKey(key));
  const pk = 'pirate-first:' + world + ':3:22:701';
  add(
    l,
    pk,
    { kind: 'pirateFirst', world, type: 3, level: 22, uid: 701, buildingId: id, outcome: 'started' },
    true
  );
  settle(l, [home(id)], { kills: [{ type: 3, maxKilledLevel: 21 }] });
  assert.equal(fleetRecordReason(l.keyRecords(), id, world), '');
  assert.equal(l.keyRecords()[pk].details.outcome, 'started');
  assert.equal(l.keyRecords()[pk].details.active, false);
  settle(l, [home(id)], { kills: [{ type: 3, maxKilledLevel: 22 }] });
  assert.equal(l.keyRecords()[pk].details.outcome, 'won');
});
await test('不串区服和舰队，旧快照不能释放同键的新派遣', () => {
  const l = make(),
    id = '2远征船',
    key = 'radar-send:' + world + ':' + fk;
  add(l, key, { kind: 'radarSend', buildingId: id, eventKey: fk, active: true });
  const baseline = l.keyRecords();
  l.releaseCompletedKey(key);
  add(l, key, { kind: 'radarSend', buildingId: id, eventKey: fk, active: true });
  settle(l, [home(id)], { events: [], baseline });
  assert(l.keyRecords()[key].details.active);
  assert.equal(fleetRecordReason(l.keyRecords(), id, '1001001'), '');
  assert(!Object.hasOwn(recordsInWorld(l.keyRecords(), '1001001'), key));
});
await test('首杀漏收结束广播时，个人战报必须匹配本队已确认的目标开战时刻', () => {
  const l = make(),
    id = '2远征船',
    key = 'pirate-first:' + world + ':3:22:701';
  add(
    l,
    key,
    {
      kind: 'pirateFirst',
      buildingId: id,
      world,
      uid: 701,
      type: 3,
      level: 22,
      scenarioId: 1,
      ownBattle: true,
      battleAt: now - 10,
      outcome: 'started'
    },
    true,
    { piratePetrol: 300 }
  );
  const good = {
    type: 1,
    scenarioId: 1,
    pirate: { type: 3, level: 22 },
    createTime: now - 10,
    uid: 5541,
    win: false
  };
  for (const reports of [
    [],
    [{ ...good, createTime: now - 20 }],
    [{ ...good, pirate: { type: 2, level: 22 } }],
    [good, { ...good, uid: 5542 }]
  ])
    settle(l, [home(id)], { reports });
  assert.equal(l.keyRecords()[key].details.outcome, 'started');
  settle(l, [home(id)], { reports: [good] });
  assert.equal(l.keyRecords()[key].details.outcome, 'lost');
  assert.equal(l.confirmedCounters().piratePetrol, 300);
  assert.equal(fleetRecordReason(l.keyRecords(), id, world), '');
});
await test('读取中切换世界、舰队重复或回包缺失时不释放', async () => {
  const l = make(),
    key = 'radar-send:' + world + ':' + fk,
    id = '2远征船';
  add(l, key, { kind: 'radarSend', buildingId: id, eventKey: fk, active: true });
  settle(l, [home(id), home(id)], { events: [] });
  assert(l.keyRecords()[key].details.active);
  const player = { worldId: world, playerId: 9001 },
    c = {
      connected: true,
      request: async (name) => {
        if (name === 'MyFleetsRequest') {
          player.worldId = '1001001';
          return { fleets: [home(id)] };
        }
        return { radarInfo: { events: [] } };
      }
    };
  await checkFleetSettlement(c, player, l);
  assert(l.keyRecords()[key].details.active);
});
await test('未确认的货轮请求仅在目标已消失且舰队到家时解除占用，保留未知预算', () => {
  const l = make(),
    id = '3远征船',
    key = 'treasure:' + world + ':901:3';
  add(l, key, { kind: 'treasureDispatch', buildingId: id, uid: 901 }, false, { treasurePetrol: 500 });
  settle(l, [home(id)], { cargoUids: ['901'] });
  settle(l, [{ ...home(id), state: 2 }], { cargoUids: [] });
  assert(!l.keyRecords()[key].expired);
  settle(l, [home(id)], { cargoUids: [] });
  assert(l.keyRecords()[key].expired);
  assert.equal(fleetRecordReason(l.keyRecords(), id, world), '');
  assert.equal(l.pendingCounters().treasurePetrol, 500);
  assert(l.hasKey(key));
});
await test('旧首杀缺少战报仍能释放已归队舰队，保留未知结果和汽油防重', async () => {
  for (const confirmed of [true, false]) {
    const l = make(), id = '1远征船', key = 'pirate-first:' + world + ':3:22:701';
    const details = { world, buildingId: id, outcome: confirmed ? 'started' : 'unknown', sentAt: (now - 901) * 1000 };
    add(l, key, details, confirmed, { piratePetrol: 300 });
    const events = [];
    const client = {
      connected: true,
      serverClockOffsetMs: now * 1000 - Date.now(),
      emit: (name, event) => events.push({ name, event }),
      request: async (name) => {
        if (name === 'MyFleetsRequest') return { fleets: [home(id)] };
        if (name === 'PirateKillRecordRequest') return { records: [{ type: 3, maxKilledLevel: 21 }] };
        assert.fail('不应补造战报或发出写请求 ' + name);
      }
    };
    await checkFleetSettlement(client, { worldId: world }, l);
    assert.equal(l.keyRecords()[key].details.active, false);
    assert.equal(l.keyRecords()[key].details.outcome, details.outcome);
    assert.equal(l.keyRecords()[key].confirmed, confirmed);
    assert.equal(fleetRecordReason(l.keyRecords(), id, world), '');
    assert.equal(l.snapshot().counters.piratePetrol, 300);
    assert.equal(l.pendingCounters().piratePetrol ?? 0, confirmed ? 0 : 300);
    assert.equal(l.confirmedCounters().piratePetrol ?? 0, confirmed ? 300 : 0);
    assert.throws(() => l.reserve({ piratePetrol: 300 }, {}, {}, { uniqueKey: key, details }), /重复发送/);
    const reopened = createUsageLedger('sample', { file: path.join(dir, seq + '.json') });
    assert.equal(fleetRecordReason(reopened.keyRecords(), id, world), '');
    assert(reopened.hasKey(key));
    assert.equal(events[0].name, 'diagnostic');
    assert.equal(events[0].event.event, 'fleet-settlement');
    assert.equal(events[0].event.changes.length, 1);
    // 舰队随后参与其他任务，旧首杀不能再次锁住它。
    settle(l, [{ ...home(id), state: 2, targetGridIdx: 999 }]);
    assert.equal(l.keyRecords()[key].details.active, false);
  }
});
await test('刚发送首杀、非归队状态、重复舰队和迟到快照均不能提前解除占用', () => {
  for (const confirmed of [true, false]) {
    const l = make(), id = '2远征船', key = 'pirate-first:' + world + ':3:22:701';
    const details = { kind: 'pirateFirst', world, buildingId: id, outcome: 'started', sentAt: (now - 901) * 1000 };
    add(l, key, details, confirmed, { piratePetrol: 300 });
    const baseline = l.keyRecords();
    for (const fleet of [
      { ...home(id), state: 2 }, { ...home(id), state: 3 }, { ...home(id), state: 4 },
      { ...home(id), state: 5 }, { ...home(id), curGridIdx: 4 },
      { ...home(id), curGridIdx: undefined }, { ...home(id), treasureLootUid: 1 },
      { ...home(id), chipWar: { rewardTs: 1 } }, home('3远征船')
    ]) settle(l, [fleet]);
    settle(l, [home(id), home(id)]);
    settle(l, [home(id)], { baseline: { [key]: { ...baseline[key], id: 'old-record' } } });
    assert.notEqual(l.keyRecords()[key].details.active, false);
    assert(fleetRecordReason(l.keyRecords(), id, world));
    if (!confirmed) {
      l.updateKeyDetails(key, { ...details, sentAt: now * 1000 });
      settle(l, [home(id)]);
      assert.notEqual(l.keyRecords()[key].details.active, false);
      assert.equal(l.pendingCounters().piratePetrol, 300);
    }
  }
});
function pagedPirateReports(reports) {
  const ledger = make(), id = '1远征船', key = 'pirate-first:' + world + ':3:22:701';
  add(ledger, key, { kind: 'pirateFirst', world, buildingId: id, type: 3, level: 22,
    scenarioId: 1, ownBattle: true, battleAt: now - 10, outcome: 'started' }, true, { piratePetrol: 300 });
  const state = { reports, calls: [], onPage: () => {} };
  const client = {
    connected: true,
    serverClockOffsetMs: now * 1000 - Date.now(),
    request: async (name, body, response, timeout) => {
      if (name === 'MyFleetsRequest') return { fleets: [home(id)] };
      if (name === 'PirateKillRecordRequest') return { records: [] };
      assert.equal(name, 'CampaignReportsRequest');
      assert.equal(ledger.keyRecords()[key].details.active, false, '开始读取战报前即已释放归队舰队');
      assert.equal(fleetRecordReason(ledger.keyRecords(), id, world), '');
      state.calls.push(body.pageNo);
      state.onPage(body.pageNo, timeout);
      return { total: state.reports.length, reports: [state.reports[body.pageNo]] };
    }
  };
  return { ledger, key, client, state, check: () => checkFleetSettlement(client, { worldId: world }, ledger) };
}
const pirateReport = {
  uid: 8001, type: 1, scenarioId: 1, pirate: { type: 3, level: 22 }, createTime: now - 10, win: false
};
const unrelatedReport = { uid: 8002, type: 1, scenarioId: 1, pirate: { type: 1, level: 1 }, createTime: now - 20, win: false };
await test('历史战报分多轮最多两页，末页之前释放舰队但不认定唯一战果', async () => {
  const f = pagedPirateReports([...Array.from({ length: 4 }, (_value, index) => ({ ...unrelatedReport, uid: 8100 + index })), pirateReport]);
  await f.check();
  assert.deepEqual(f.state.calls, [0, 1]);
  assert.equal(f.ledger.keyRecords()[f.key].details.outcome, 'started');
  await f.check();
  assert.deepEqual(f.state.calls, [0, 1, 2, 3]);
  assert.equal(f.ledger.keyRecords()[f.key].details.outcome, 'started');
  await f.check();
  assert.deepEqual(f.state.calls, [0, 1, 2, 3, 4]);
  assert.equal(f.ledger.keyRecords()[f.key].details.outcome, 'lost');
  assert.equal(f.ledger.confirmedCounters().piratePetrol, 300);
});
await test('分页期间总数变化会丢弃旧证据并从首页重读，新战报推送也清除扫描', async () => {
  const f = pagedPirateReports([pirateReport, ...Array.from({ length: 3 }, (_value, index) => ({ ...unrelatedReport, uid: 8100 + index }))]);
  await f.check();
  f.state.reports = Array.from({ length: 5 }, (_value, index) => ({ ...unrelatedReport, uid: 8200 + index }));
  await f.check();
  assert.deepEqual(f.state.calls, [0, 1, 2]);
  await f.check();
  assert.deepEqual(f.state.calls, [0, 1, 2, 0, 1]);
  invalidateFleetReports(f.client);
  await f.check();
  assert.deepEqual(f.state.calls, [0, 1, 2, 0, 1, 0, 1]);
  await f.check();
  await f.check();
  assert.equal(f.ledger.keyRecords()[f.key].details.outcome, 'started');
  assert.equal(f.ledger.keyRecords()[f.key].details.active, false);
  const count = f.state.calls.length;
  await f.check();
  assert.equal(f.state.calls.length, count, '读全后的结果在一分钟内复用');
});
await test('后续分页含第二份匹配战报时继续保留未知战果，不能提前按第一页确认', async () => {
  const f = pagedPirateReports([pirateReport, unrelatedReport, { ...pirateReport, uid: 8003 }]);
  await f.check();
  assert.equal(f.ledger.keyRecords()[f.key].details.outcome, 'started');
  await f.check();
  assert.equal(f.ledger.keyRecords()[f.key].details.outcome, 'started');
  assert.equal(f.ledger.keyRecords()[f.key].details.active, false);
});
await test('战报读取消耗八秒预算后让出本轮，下一轮从未读页继续', async () => {
  const f = pagedPirateReports([unrelatedReport, { ...unrelatedReport, uid: 8004 }, pirateReport]);
  const originalNow = Date.now;
  let clock = originalNow();
  Date.now = () => clock;
  try {
    f.state.onPage = (_page, timeout) => {
      assert(timeout > 0 && timeout <= 8000);
      clock += 8001;
    };
    await f.check();
    assert.deepEqual(f.state.calls, [0]);
    assert.equal(f.ledger.keyRecords()[f.key].details.active, false);
    f.state.onPage = () => {};
    await f.check();
    assert.deepEqual(f.state.calls, [0, 1, 2]);
    assert.equal(f.ledger.keyRecords()[f.key].details.outcome, 'lost');
  } finally { Date.now = originalNow; }
});
await test('两百页扫描上限保留未知结果并缓存，避免下一轮立即重复刷历史', async () => {
  const f = pagedPirateReports(Array.from({ length: 201 }, (_value, index) => index ? { ...unrelatedReport, uid: 9000 + index } : pirateReport));
  for (let round = 0; round < 100; round++) await f.check();
  assert.equal(f.state.calls.length, 200);
  assert.equal(f.ledger.keyRecords()[f.key].details.outcome, 'started');
  await f.check();
  assert.equal(f.state.calls.length, 200);
});
await test('重复分页和缺少有效战报 UID 均不能当作完整扫描确认首杀', async () => {
  for (const invalid of [{ ...unrelatedReport }, { ...unrelatedReport, uid: undefined }, { ...unrelatedReport, uid: 0 }]) {
    const f = pagedPirateReports([pirateReport, unrelatedReport, invalid]);
    await f.check();
    await f.check();
    assert.equal(f.ledger.keyRecords()[f.key].details.outcome, 'started');
    assert.equal(f.ledger.keyRecords()[f.key].details.active, false);
  }
});
console.log('舰队占用专项 ' + n + '/' + n + ' 通过');
