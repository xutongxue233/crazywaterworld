import assert from 'node:assert/strict';
import { serviceRadar, radarFuelReserve } from '../src/radar.mjs';
import { loadProtocol } from '../src/proto.mjs';
import { loadConfig } from '../src/config.mjs';
import { uidText } from '../src/hero-equipment.mjs';
import { registerFleetReservations, isFleetReserved, hasOtherFleetReservations, observeFleetReservations } from '../src/fleet-reservations.mjs';

const protocol = loadProtocol();
const guildId = { low: 7, high: 2097152, unsigned: false };
const player = { playerId: 123, guildId, worldId: 2000000, level: 18 };
const long = n => ({ low: n, high: 2097152, unsigned: false });
const tables = {
  ModuleOpenCfg: [{ moduleId: '联盟情报', playerLevel: 18 }],
  RadarFixedEventCfg: [{ eventId: 1, power: 1000, eventName: '固定事件' }],
  RadarRandEventCfg: [
    { eventId: 10001, type: '击退海盗', param1: 1, eventName: '海盗' },
    { eventId: 40001, type: '解救难民', eventName: '救助' },
  ],
  WorldParamCfg: [{ paramName: '情报事件消耗汽油', paramValue: 500 }],
  WorldPirateCfg: [{ season: '1', type: 1, level: 1, power: 100 }, { season: '2', type: 1, level: 1, power: 1000 }],
};
const config = { tables: Object.fromEntries(Object.entries(tables).map(([key, data]) => [key, { data }])) };
const event = n => ({ uid: long(n), eventId: 10001, color: 3, gridIdx: n, state: 1, startTime: 0, pirate: { type: 1, level: 1 } });
const fleet = (n, extra = {}) => ({ buildingId: n + '远征船', state: 1, power: 1200, durability: 2000, maxDura: 2000, ...extra });

function mock(options = {}) {
  const data = {
    info: { events: [event(1), event(2), event(3)], nextRefreshTime: 2000000000 },
    fleets: [fleet(1), fleet(2), fleet(3)], fuel: 20000, items: [],
    ...options,
  };
  const client = {
    data, calls: [], writes: [],
    async request(name, body = {}, response) {
      assert(protocol[name], '当前离线协议应包含 ' + name);
      assert(protocol[response], '只读接口应有实际 Response：' + response);
      this.calls.push(name);
      data.beforeRead?.(name, this);
      let result;
      if (name === 'GuildInfoRequest') result = { guild: { guildId } };
      else if (name === 'RadarInfoRequest') result = { radarInfo: data.info };
      else if (name === 'MyFleetsRequest') {
        const decoded = protocol.MyFleetsResponse.decode(protocol.MyFleetsResponse.encode({ fleets: data.fleets }).finish());
        assert(decoded.fleets.every(f => typeof f.durability === 'number' && typeof f.maxDura === 'number'));
        // Exercise a possible future int64 zero representation in addition to
        // the current protocol's actual int32 treasureLootUid response field.
        if (data.longLootUid) decoded.fleets.forEach(f => { f.treasureLootUid = { low: f.treasureLootUid, high: 0 }; });
        return decoded;
      }
      else if (name === 'AllItemRequest') result = { items: [{ itemId: '汽油', num: data.fuel }, ...data.items] };
      else if (name === 'FleetRepairParamRequest') result = data.params ?? { unitRepairCost: 6, unitRepairTime: 0.15 };
      else assert.fail('意外请求 ' + name);
      return structuredClone(result);
    },
    async sendWatch(name, body) {
      // Actual protobuf round trip validates int64 echoing and message shapes.
      const roundtrip = protocol[name].decode(protocol[name].encode(body).finish());
      this.writes.push({ name, body: structuredClone(body) });
      if (name === 'RadarSendFleetsRequest' && body.uid) assert.equal(uidText(roundtrip.uid), uidText(body.uid));
      if (data.reject) throw Object.assign(new Error('server prompt: not enough'), { prompt: {}, request: name });
      if (data.unknown) return { sent: 1 };
      if (name === 'RadarGetAllRewardsRequest') {
        data.info.events = data.info.events.filter(e => e.state !== 4);
        if (data.info.fixedEvent?.state === 4) delete data.info.fixedEvent;
      } else if (name === 'RadarSendFleetsRequest') {
        const e = body.uid ? data.info.events.find(e => uidText(e.uid) === uidText(body.uid)) : data.info.fixedEvent;
        assert(e && e.state === 1);
        e.state = 3; e.startTime = Math.floor(Date.now() / 1000);
        data.fleets.find(f => f.buildingId === body.fleetBuildingIds[0]).state = 2;
        if (!data.staleFuel) data.fuel -= 500;
        for (const need of e.refugee?.requirements ?? []) data.items.find(i => i.itemId === need.id).num -= need.num;
      } else if (name === 'RepairFleetRequest') {
        const f = data.fleets.find(f => f.buildingId === body.buildingId);
        if (!data.staleFuel) data.fuel -= Math.ceil((f.maxDura - f.durability) * 6);
        f.state = 4; f.repairing = { startTs: Math.floor(Date.now() / 1000), endDura: f.maxDura, endTs: Math.floor(Date.now() / 1000) + 1000 };
      } else assert.fail('意外写入 ' + name);
      return { sent: 1 };
    },
  };
  return client;
}

const run = (client, options = {}) => serviceRadar(client, protocol, config, { player, enabled: key => key === 'radarAuto', ...options });
const sends = client => client.writes.filter(w => w.name === 'RadarSendFleetsRequest');

export async function testRadar() {
  assert.equal(radarFuelReserve, 10000);
  const defaults = mock();
  await serviceRadar(defaults, protocol, config);
  assert.equal(defaults.calls.length, 0, '未传开关时默认不探测也不写入');
  for (const name of ['RadarGetAllRewardsResponse', 'RadarSendFleetsResponse', 'RepairFleetResponse']) assert(!protocol[name]);
  const actual = loadConfig().tables;
  assert(actual.ModuleOpenCfg.data.some(r => r.moduleId === '联盟情报' && r.playerLevel > 0));
  assert(actual.WorldParamCfg.data.some(r => r.paramName === '情报事件消耗汽油' && r.paramValue > 0));

  for (const options of [{ player: { ...player, level: 17 } }, { player: { ...player, guildId: 0 } }, { enabled: () => false }]) {
    const c = mock(); await run(c, options); assert.equal(c.calls.length, 0); assert.equal(c.writes.length, 0);
  }

  const fuel = mock({ fuel: 11000 });
  const result = await run(fuel);
  assert.equal(sends(fuel).length, 2, '多舰队不能重复花同一份汽油');
  assert.equal(fuel.data.fuel, 10000);
  assert.equal(result.filter(e => e.ok).length, 2);
  assert.equal(new Set(sends(fuel).map(w => w.body.fleetBuildingIds[0])).size, 2);
  assert.equal(new Set(sends(fuel).map(w => uidText(w.body.uid))).size, 2);
  assert.equal(uidText(sends(fuel)[0].body.uid), '9007199254740993');

  for (const longLootUid of [false, true]) {
    const loot = mock({ longLootUid, fleets: [fleet(1, { treasureLootUid: 0 }), fleet(2, { treasureLootUid: 17 })] });
    await run(loot);
    assert.deepEqual(sends(loot).map(w => w.body.fleetBuildingIds), [['1远征船']], '真实舰队回包：零宝藏 uid 可派，非零 uid 已占用');
  }

  const fixed = mock({ info: { events: [], fixedEvent: { eventId: 1, createTime: 42, state: 1, startTime: 0 } } });
  await run(fixed);
  assert.deepEqual(sends(fixed)[0].body, { fleetBuildingIds: ['1远征船'] }, '固定事件请求不带 uid');

  const season = mock({ fleets: [fleet(1, { power: 500 })] });
  await run(season); assert.equal(sends(season).length, 0, '不能误用第一赛季的较低战力');
  const unknownSeason = mock();
  assert((await run(unknownSeason, { player: { ...player, worldId: 0 } })).some(e => /赛季/.test(e.reason)));
  assert.equal(sends(unknownSeason).length, 0);
  const unknownPower = mock({ info: { events: [{ ...event(1), pirate: { type: 1, level: 999 } }] } });
  await run(unknownPower); assert.equal(sends(unknownPower).length, 0);

  const blocked = mock({ fleets: [fleet(1, { durability: 1599 }), fleet(2, { autoFight: { isOn: true } }),
    fleet(3, { treasureLootUid: 12 }), fleet(4, { chipWar: {} }), fleet(5, { curGridIdx: 50 }), fleet(6, { state: 2 })] });
  await run(blocked); assert.equal(blocked.writes.length, 0);

  const cancelled = mock();
  await run(cancelled, { enabled: () => !cancelled.calls.includes('AllItemRequest') });
  assert.equal(cancelled.writes.length, 0, '读取后取消不应再派舰');
  const changed = mock({ beforeRead(name, c) {
    if (name === 'MyFleetsRequest' && c.calls.filter(n => n === name).length >= 2) c.data.fleets.forEach(f => { f.state = 2; });
  } });
  await run(changed); assert.equal(changed.writes.length, 0, '发送前复核舰队被别的玩法占用');

  const refused = mock({ reject: true });
  assert((await run(refused)).some(e => e.ok === false && /服务器拒绝/.test(e.error)));
  const first = refused.writes.length;
  await run(refused); // May try another target, but not the rejected one immediately.
  assert(sends(refused).slice(first).every(w => uidText(w.body.uid) !== uidText(sends(refused)[0].body.uid)));
  const uncertain = mock({ unknown: true, fleets: [fleet(1)] });
  assert((await run(uncertain)).some(e => /未确认/.test(e.error)));
  assert(isFleetReserved(uncertain, '1远征船'), '雷达未确认的派舰对其他模块可见');
  assert(hasOtherFleetReservations(uncertain, 'pirates'));
  await run(uncertain);
  assert.equal(sends(uncertain).length, 1, '静默成功不代表出征已确认，锁住该舰队及事件');
  uncertain.data.info.events = [{ ...event(1), state: 4 }];
  uncertain.data.unknown = false;
  await run(uncertain);
  assert(!isFleetReserved(uncertain, '1远征船'), '情报已完成且船空闲时释放共享预占');

  const stopped = mock({ fuel: 10500, staleFuel: true, info: { events: [event(1)] }, fleets: [fleet(1)] });
  await run(stopped);
  observeFleetReservations(stopped, { fleets: [fleet(1)], fuel: 10500 });
  assert.equal(isFleetReserved(stopped, '1远征船'), false, '自动任务关闭后，手动查看也能确认已观察到的舰队返航');
  assert.equal(hasOtherFleetReservations(stopped, 'pirate'), true, '舰队已归港但汽油尚未反映扣款时仍保留预算');
  observeFleetReservations(stopped, { fleets: [fleet(1)], fuel: 10000 });
  assert.equal(hasOtherFleetReservations(stopped, 'pirate'), false, '库存对账后手动出征可恢复');

  for (const heldShip of ['1远征船', '99远征船']) {
    const holds = new Set([heldShip]);
    const other = mock({ fuel: 10500, info: { events: [{ ...event(3), state: 4 }, event(1)] }, fleets: [fleet(1), fleet(2, { durability: 1000 })] });
    registerFleetReservations(other, 'pirates', id => holds.has(id), () => holds.size > 0);
    const report = await run(other, { enabled: () => true });
    assert.deepEqual(other.writes.map(w => w.name), ['RadarGetAllRewardsRequest'], '其他模块同船或异船未扣账时仍可领奖，但不派舰和修船');
    assert(report.some(e => /其他玩法出征尚待确认/.test(e.reason)));
    holds.clear();
    await run(other);
    assert.equal(sends(other).length, 1, '其他模块释放预占后可恢复派舰');
    assert.equal(other.data.fuel, 10000);
  }
  for (const repair of [false, true]) {
    const holds = new Set();
    const late = mock({ fleets: [fleet(1, { durability: repair ? 1000 : 2000 })], beforeRead(name, c) {
      if ((!repair && name === 'AllItemRequest' && c.calls.filter(n => n === name).length === 2)
        || (repair && name === 'FleetRepairParamRequest')) holds.add('99远征船');
    } });
    registerFleetReservations(late, 'pirates', id => holds.has(id), () => holds.size > 0);
    await run(late, { enabled: key => key === (repair ? 'radarRepair' : 'radarAuto') });
    assert.equal(late.writes.length, 0, '其他模块在读取期间新增预占，写入前仍须暂停');
  }

  const stale = mock({ fuel: 11000, staleFuel: true });
  await run(stale); await run(stale);
  assert.equal(sends(stale).length, 2, '余额尚未推送时跨轮也保留已花费用');
  stale.data.fuel = 10500;
  await run(stale);
  assert.equal(sends(stale).length, 2, '只反映一笔扣款时仍保留第二笔');

  const shared = mock({ fuel: 16500, info: { events: [event(1)] }, fleets: [fleet(1), fleet(2, { durability: 1000 }), fleet(3, { durability: 1000 })] });
  await run(shared, { enabled: () => true });
  assert.equal(sends(shared).length, 1);
  assert.equal(shared.writes.filter(w => w.name === 'RepairFleetRequest').length, 1);
  assert.equal(shared.data.fuel, 10000, '派舰和维修共用保留额');
  const repairOnly = mock({ fleets: [fleet(1, { durability: 1000 })] });
  const deferred = [];
  await run(repairOnly, { enabled: () => true, scheduler: {
    due: key => key === 'radarRepair', now: () => 100, defer: (...args) => deferred.push(args),
  } });
  assert(!repairOnly.calls.includes('RadarInfoRequest'), '维修到期不应顺带执行尚未到期的情报');
  assert.equal(repairOnly.writes.length, 1);
  assert(deferred.every(([key]) => key === 'radarRepair'));
  const unknownRepair = mock({ unknown: true, fleets: [fleet(1, { durability: 1000 })] });
  await run(unknownRepair, { enabled: key => key === 'radarRepair' });
  await run(unknownRepair, { enabled: key => key === 'radarRepair' });
  assert.equal(unknownRepair.writes.length, 1);
  const invalidParam = mock({ params: { unitRepairCost: 0 }, fleets: [fleet(1, { durability: 1000 })] });
  await run(invalidParam, { enabled: key => key === 'radarRepair' });
  assert.equal(invalidParam.writes.length, 0);

  const reward = mock({ info: { events: [{ ...event(1), state: 4 }] } });
  assert((await run(reward)).some(e => e.ok && /奖励/.test(e.label)));
  await run(reward); assert.equal(reward.writes.length, 1);
  const uncertainReward = mock({ unknown: true, info: { events: [{ ...event(1), state: 4 }] } });
  assert((await run(uncertainReward)).some(e => e.ok === false));
  await run(uncertainReward); assert.equal(uncertainReward.writes.length, 1, '领奖状态不变时不能再领同一批');

  const material = mock({ info: { events: [1, 2].map(n => ({ ...event(n), eventId: 40001, pirate: null, refugee: { requirements: [{ type: 2, id: '木板', num: 5 }] } })) },
    items: [{ itemId: '木板', num: 5 }] });
  await run(material); assert.equal(sends(material).length, 0, '首版跳过会消耗订单加工品的难民事件');

  const concurrent = mock();
  await Promise.all([run(concurrent), run(concurrent)]);
  assert.equal(sends(concurrent).length, 3, '同一账号重入只执行一次');
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  await testRadar();
  console.log('radar ok: season and int64 checks, fleet ownership, shared budgets, repair, cancellation and uncertain outcomes');
}
