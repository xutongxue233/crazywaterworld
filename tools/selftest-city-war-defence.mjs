// 城战攻守分工专项：虚构账号、临时账本、实际协议编解码，不连接游戏。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { warForgeFixture, warForgeSettings } from './fixtures/war-forge.mjs';
import { createUsageLedger } from '../src/automation-settings.mjs';
import { readCityWar, planCityWar, cityWarReservedFleets, runCityWar } from '../src/city-war.mjs';
import { readTreasureLoot, planTreasureLoot } from '../src/treasure-loot.mjs';
import { readWorldTarget } from '../src/world-target.mjs';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-city-war-defence-'));
process.env.CW_DATA_DIR = directory;
let sequence = 0;
const results = [];
const ledger = () => createUsageLedger('模拟防守账号', { file: path.join(directory, 'usage-' + (++sequence) + '.json') });
const check = async (name, action) => {
  try { await action(); results.push({ name, passed: true }); console.log('通过：' + name); }
  catch (error) { results.push({ name, passed: false }); console.error('失败：' + name + '\n' + error.stack); }
};
const read = (f, settings) => readCityWar(f.client, f.protocol, f.config, f.player, settings.cityWar, { mapLoader: f.mapLoader });
const plan = async (f, settings, usage = ledger()) => planCityWar(await read(f, settings), settings, {
  usage: usage.snapshot(), keys: usage.keyRecords(), pendingPetrol: usage.pendingCounters().cityWarPetrol ?? 0,
});
const run = (f, settings, usage = ledger(), options = {}) => runCityWar(f.client, f.protocol, f.config, f.player, {
  getSettings: () => settings, ledger: usage, mapLoader: f.mapLoader, ...options,
});
const fighter = (guildIdx, isNpc = false) => ({ guildIdx, isNpc, name: '虚构战斗舰队' });

function defenceFixture() {
  const f = warForgeFixture(), settings = warForgeSettings();
  settings.cityWar.defenceFleetIds = ['2远征船'];
  settings.forge.enabled = false;
  for (const city of f.state.cities) Object.assign(city, {
    attackFleetNum: 0, priorityAtkFleetNum: 0, defenceFleetNum: 0, priorityDefFleetNum: 0, battlePoints: [],
  });
  f.state.cities.find(city => city.id === 3).guildIdx = 7;
  f.state.war.declarations.push({ attackGuildIdx: 8, defenceGuildIdx: 7, cityId: 3 });
  // 共用夹具为进攻固定扣 40；本专项补全客户端的己方城市免费行军规则。
  const send = f.client.sendWatch;
  f.client.sendWatch = async (name, body) => {
    const fuel = f.state.fuel;
    await send(name, body);
    if (name === 'MoveFleetsToCityRequest' && !f.unknown &&
        f.state.cities.find(city => city.id === body.cityId)?.guildIdx === 7) f.state.fuel = fuel;
  };
  return { f, settings };
}
function onlyDefence(settings) {
  settings.cityWar.fleetIds = ['2远征船'];
  settings.cityWar.defenceFleetIds = ['2远征船'];
}

await check('旧设置未指定防守队时仍只进攻，不自动改变已有舰队任务', async () => {
  const { f, settings } = defenceFixture();
  delete settings.cityWar.defenceFleetIds;
  const result = await plan(f, settings);
  assert.equal(result.actions.length, 2);
  assert(result.actions.every(step => step.role === 'attack' && step.cityId === 2));
  assert.equal(f.client.writes.length, 0);
});

await check('一队进攻二队防守分别派往对应城市，回读确认并共用次数账本', async () => {
  const { f, settings } = defenceFixture(), usage = ledger();
  const preview = await plan(f, settings, usage);
  assert.deepEqual(preview.actions.map(step => [step.buildingId, step.role, step.cityId, step.cost]), [
    ['1远征船', 'attack', 2, 40], ['2远征船', 'defence', 3, 0],
  ]);
  assert.deepEqual(preview.fleets.map(fleet => [fleet.buildingId, fleet.role]), [['1远征船', 'attack'], ['2远征船', 'defence']]);
  const result = await run(f, settings, usage);
  assert.deepEqual(result.results.map(entry => entry.status), ['confirmed', 'confirmed']);
  assert.deepEqual(f.client.writes, [
    { name: 'MoveFleetsToCityRequest', body: { buildingId: ['1远征船'], cityId: 2 } },
    { name: 'MoveFleetsToCityRequest', body: { buildingId: ['2远征船'], cityId: 3 } },
  ]);
  assert.equal(usage.snapshot().counters.cityWarDispatches, 2);
  assert.equal(usage.snapshot().counters.cityWarPetrol, 40);
  await run(f, settings, usage);
  assert.equal(f.client.writes.length, 2, '在途舰队不可重复派遣');
});

await check('纯防守在零汽油时可派遣，仍计入每日出征上限', async () => {
  const { f, settings } = defenceFixture(), usage = ledger();
  onlyDefence(settings); f.state.fuel = 0; settings.cityWar.dailyDispatchLimit = 1;
  const result = await run(f, settings, usage);
  assert.equal(result.results[0]?.status, 'confirmed');
  assert.equal(result.results[0].step.cost, 0);
  assert.equal(f.state.fuel, 0);
  assert.equal(usage.snapshot().counters.cityWarPetrol ?? 0, 0);
  assert.equal(usage.snapshot().counters.cityWarDispatches, 1);
  f.returnFleet('2远征船');
  await run(f, settings, usage);
  assert.equal(f.client.writes.length, 1, '免费防守仍受次数上限约束');
});

await check('防守只认当前受宣战且仍属本盟的城市，不接管其他联盟防守', async () => {
  for (const change of [
    f => { f.state.cities.find(city => city.id === 3).guildIdx = 9; },
    f => { f.state.war.declarations = f.state.war.declarations.filter(row => row.cityId !== 3); },
    f => { f.state.war.declarations.find(row => row.cityId === 3).defenceGuildIdx = 9; },
    f => { f.state.war.declarations.find(row => row.cityId === 3).attackGuildIdx = 7; },
  ]) {
    const { f, settings } = defenceFixture(); onlyDefence(settings); change(f);
    assert.equal((await plan(f, settings)).actions.length, 0);
    assert.deepEqual(cityWarReservedFleets(await read(f, settings), settings), []);
    await run(f, settings); assert.equal(f.client.writes.length, 0);
  }
});

await check('只有防守目标时仅预留防守队，只有进攻目标时仅预留进攻队', async () => {
  const { f, settings } = defenceFixture();
  f.state.war.declarations = f.state.war.declarations.filter(row => row.cityId === 3);
  assert.deepEqual(cityWarReservedFleets(await read(f, settings), settings), ['2远征船']);
  assert.deepEqual((await plan(f, settings)).actions.map(step => step.buildingId), ['2远征船']);
  f.state.war.declarations = [{ attackGuildIdx: 7, defenceGuildIdx: 8, cityId: 2 }];
  assert.deepEqual(cityWarReservedFleets(await read(f, settings), settings), ['1远征船']);
  assert.deepEqual((await plan(f, settings)).actions.map(step => step.buildingId), ['1远征船']);
});

await check('多联盟围攻时防守目标去重，按守方队列和右侧非NPC战斗人数计数', async () => {
  const { f, settings } = defenceFixture();
  f.state.war.declarations.push({ attackGuildIdx: 9, defenceGuildIdx: 7, cityId: 3 });
  Object.assign(f.state.cities.find(city => city.id === 3), {
    defenceFleetNum: 6, priorityDefFleetNum: 2, attackFleetNum: 100, priorityAtkFleetNum: 40,
    battlePoints: [
      { index: 0, leftFighter: fighter(8), rightFighter: fighter(7) },
      { index: 1, leftFighter: fighter(9), rightFighter: fighter(7, true) },
    ],
  });
  const snapshot = await read(f, settings), targets = snapshot.targets.filter(target => target.id === 3);
  assert.equal(targets.length, 1);
  assert.equal(targets[0].role, 'defence');
  assert.equal(targets[0].alliedCount, 9);
  assert.equal(targets[0].countReason, '');
  assert.equal(targets[0].petrol, 0);
  assert.equal((await plan(f, settings)).actions.find(step => step.role === 'defence')?.cityId, 3);
});

await check('守军身份与己盟不符时跳过人数优先选点，不把未知守军当零人', async () => {
  const { f, settings } = defenceFixture(); onlyDefence(settings);
  f.state.cities.find(city => city.id === 3).battlePoints = [
    { index: 0, leftFighter: fighter(8), rightFighter: fighter(9) },
  ];
  const snapshot = await read(f, settings), target = snapshot.targets.find(row => row.id === 3);
  assert.equal(target.alliedCount, null);
  assert(target.countReason);
  assert.equal((await plan(f, settings)).actions.length, 0);
});

await check('指定城市仍按各队职责过滤，不能把防守队派向所选敌城', async () => {
  const { f, settings } = defenceFixture();
  settings.cityWar.targetMode = 'selected'; settings.cityWar.cityRefs = ['1:2'];
  assert.deepEqual((await plan(f, settings)).actions.map(step => [step.buildingId, step.cityId]), [['1远征船', 2]]);
  assert.deepEqual(cityWarReservedFleets(await read(f, settings), settings), ['1远征船']);
  settings.cityWar.cityRefs = ['1:3'];
  assert.deepEqual((await plan(f, settings)).actions.map(step => [step.buildingId, step.cityId]), [['2远征船', 3]]);
  settings.cityWar.cityRefs = ['2:3'];
  assert.equal((await plan(f, settings)).actions.length, 0);
  assert.deepEqual(cityWarReservedFleets(await read(f, settings), settings), []);
});

await check('防守选城使用守方队列，进攻人数不影响防守队选点', async () => {
  const { f, settings } = defenceFixture(); onlyDefence(settings);
  f.config.tables['1_CityCfg'].data.push({ id: 4, name: '第二守城', guildIndex: 0 });
  f.map.cityInfo[4] = { gridIdx: 40 };
  f.state.cities.push({ id: 4, guildIdx: 7, state: 2, attackFleetNum: 500, priorityAtkFleetNum: 500,
    defenceFleetNum: 0, priorityDefFleetNum: 0, battlePoints: [] });
  f.state.war.declarations.push({ attackGuildIdx: 9, defenceGuildIdx: 7, cityId: 4 });
  f.state.cities.find(city => city.id === 3).defenceFleetNum = 20;
  assert.equal((await plan(f, settings)).actions[0]?.cityId, 4);
});

await check('免费防守仍比较实际距离，攻方少队目标不干扰守方排序', async () => {
  const { f, settings } = defenceFixture();
  f.config.tables['1_CityCfg'].data.push({ id: 4, name: '更近守城', guildIndex: 0 });
  f.map.cityInfo[3] = { gridIdx: 40 }; f.map.cityInfo[4] = { gridIdx: 10 };
  f.state.cities.find(city => city.id === 3).defenceFleetNum = 20;
  f.state.cities.push({ id: 4, guildIdx: 7, state: 2, defenceFleetNum: 28, priorityDefFleetNum: 0, battlePoints: [] });
  f.state.war.declarations.push({ attackGuildIdx: 9, defenceGuildIdx: 7, cityId: 4 });
  let preview = await plan(f, settings);
  assert.equal(preview.actions.find(step => step.role === 'defence').cityId, 4, '守方相差8队就近，不能被攻方0队拉入另一排序区间');
  f.state.cities.find(city => city.id === 4).defenceFleetNum = 30;
  preview = await plan(f, settings);
  assert.equal(preview.actions.find(step => step.role === 'defence').cityId, 3, '相差10队时选守方队列较少的城');
});

await check('已在受攻主城的防守队不重复派同城，预览说明原因', async () => {
  const { f, settings } = defenceFixture(); onlyDefence(settings);
  settings.cityWar.targetMode = 'selected'; settings.cityWar.cityRefs = ['1:1'];
  f.state.war.declarations.push({ attackGuildIdx: 8, defenceGuildIdx: 7, cityId: 1 });
  const preview = await plan(f, settings);
  assert.equal(preview.actions.length, 0); assert.match(preview.fleets[0].reason, /已在/);
  await run(f, settings); assert.equal(f.client.writes.length, 0);
});

await check('降低汽油日预算或库存低于保留量不阻止零消费防守', async () => {
  const { f, settings } = defenceFixture(), usage = ledger(); onlyDefence(settings);
  const ticket = usage.reserve({ cityWarPetrol: 2000 }); usage.confirm(ticket);
  settings.cityWar.dailyPetrolLimit = 1000; settings.cityWar.petrolReserve = 5000; f.state.fuel = 0;
  assert.equal((await run(f, settings, usage)).results[0]?.status, 'confirmed');
  assert.equal(usage.snapshot().counters.cityWarPetrol, 2000);
});

await check('仍处于原生委任阶段的防守队等待接管，不伪称已固定原生职责', async () => {
  const { f, settings } = defenceFixture(); onlyDefence(settings);
  f.state.fleets[1].autoFight.todayTimes = 0;
  assert.match((await plan(f, settings)).fleets[0].reason, /原生委任尚余/);
  await run(f, settings); assert.equal(f.client.writes.length, 0);
});

await check('指定城市详情读取失败时返回未确认，不访问不存在的目标', async () => {
  const { f, settings } = defenceFixture(); onlyDefence(settings);
  settings.cityWar.targetMode = 'selected'; settings.cityWar.cityRefs = ['1:3'];
  f.beforeRead = name => { if (name === 'WarDeclarationRequest') throw Error('离线模拟读取失败'); };
  const result = await readWorldTarget(f.client, f.protocol, f.config, f.player, settings, ledger(), { layer: 'cities', key: 'city-3' });
  assert(result.notes.some(note => /未确认/.test(note)));
  assert.equal(f.client.writes.length, 0);
});

await check('防守仍要求已有英雄编队和空闲舰队，不抢占行军或其他玩法', async () => {
  for (const change of [
    f => { f.state.buildings[1].fleet.formation.heroPositions = []; },
    f => { f.state.fleets[1].state = 2; },
    f => { f.state.fleets[1].state = 3; },
    f => { f.state.fleets[1].state = 5; },
    f => { f.state.fleets[1].treasureLootUid = 71; },
    f => { f.state.fleets[1].curGridIdx = 11; },
  ]) {
    const { f, settings } = defenceFixture(); onlyDefence(settings); change(f);
    await run(f, settings); assert.equal(f.client.writes.length, 0);
  }
});

await check('防守零行军费用不绕过维修报价、汽油保留和每日维修预算', async () => {
  const { f, settings } = defenceFixture(), usage = ledger(); onlyDefence(settings);
  f.state.fleets[1].durability = 1000;
  let preview = await plan(f, settings, usage);
  assert.equal(preview.actions[0]?.kind, 'cityRepair');
  assert.equal(preview.actions[0].role, 'defence');
  assert.equal(preview.actions[0].cost, 2000);
  settings.cityWar.maxRepairCost = 1999;
  assert.equal((await plan(f, settings, usage)).actions.length, 0);
  settings.cityWar.maxRepairCost = 3000; settings.cityWar.dailyPetrolLimit = 1999;
  assert.equal((await plan(f, settings, usage)).actions.length, 0);
  settings.cityWar.dailyPetrolLimit = 2000; settings.cityWar.petrolReserve = 49000;
  assert.equal((await plan(f, settings, usage)).actions.length, 0);
  settings.cityWar.petrolReserve = 0;
  assert.equal((await run(f, settings, usage)).results[0]?.status, 'confirmed');
  f.finishRepair('2远征船');
  assert.equal((await run(f, settings, usage)).results[0]?.step.kind, 'cityDispatch');
  assert.deepEqual(f.client.writes.map(row => row.name), ['RepairFleetRequest', 'MoveFleetsToCityRequest']);
  assert.equal(usage.snapshot().counters.cityWarPetrol, 2000);
  assert.equal(usage.snapshot().counters.cityWarDispatches, 1);
});

await check('防守原生委任设为零时先关闭并回读确认，再发指定防守队', async () => {
  const { f, settings } = defenceFixture(); onlyDefence(settings);
  settings.cityWar.nativeCommissionLimit = 0;
  f.state.fleets[1].autoFight.todayTimes = 0;
  const result = await run(f, settings);
  assert.equal(result.results[0]?.status, 'confirmed');
  assert.deepEqual(f.client.writes, [
    { name: 'SetFleetAutoFightRequest', body: { buildingIds: ['2远征船'], isOn: false } },
    { name: 'MoveFleetsToCityRequest', body: { buildingId: ['2远征船'], cityId: 3 } },
  ]);
  const other = defenceFixture(); onlyDefence(other.settings);
  other.settings.cityWar.nativeCommissionLimit = 0; other.f.ignoreNativeOff = true;
  await run(other.f, other.settings);
  assert.deepEqual(other.f.client.writes.map(row => row.name), ['SetFleetAutoFightRequest']);
});

await check('防守发送前失城、停战、职责修改或关闭功能时均不沿用旧计划', async () => {
  for (const change of [
    (f) => { f.state.cities.find(city => city.id === 3).guildIdx = 8; },
    (f) => { f.state.war.declarations = []; },
    (f, settings) => { settings.cityWar.defenceFleetIds = []; },
    (f, settings) => { settings.cityWar.enabled = false; },
  ]) {
    const { f, settings } = defenceFixture(); onlyDefence(settings);
    let reads = 0;
    f.beforeRead = name => { if (name === 'WarDeclarationRequest' && ++reads === 2) change(f, settings); };
    await run(f, settings); assert.equal(f.client.writes.length, 0);
  }
});

await check('免费防守结果未知仍保留舰队与次数占用，重建账本和换日不能重发', async () => {
  const { f, settings } = defenceFixture(); onlyDefence(settings); f.unknown = true;
  const file = path.join(directory, 'defence-midnight.json');
  let now = Date.UTC(2026, 10, 14, 15, 59, 59);
  let usage = createUsageLedger('未知防守账号', { file, now: () => now });
  const first = await run(f, settings, usage);
  assert.equal(first.results[0]?.status, 'unknown');
  assert.equal(usage.snapshot().uncertain, 1);
  assert.equal(usage.pendingCounters().cityWarDispatches, 1);
  assert.equal(usage.pendingCounters().cityWarPetrol ?? 0, 0);
  now += 3000;
  usage = createUsageLedger('未知防守账号', { file, now: () => now });
  await run(f, settings, usage);
  assert.equal(f.client.writes.length, 1);
  assert.equal(usage.snapshot().uncertain, 1);
  Object.assign(f.state.fleets[1], { state: 2, targetCityId: 3 });
  await run(f, settings, usage);
  assert.equal(usage.snapshot().uncertain, 0);
  assert.equal(f.client.writes.length, 1);
});

await check('未知防守占用会阻止同队巨轮出征，其他舰队仍可用', async () => {
  const { f, settings } = defenceFixture(), usage = ledger(); onlyDefence(settings); f.unknown = true;
  await run(f, settings, usage);
  Object.assign(settings.treasure, { enabled: true, autoJoin: true, fleetIds: ['1远征船', '2远征船'], petrolReserve: 0 });
  const snapshot = await readTreasureLoot(f.client, f.protocol, f.config, f.player);
  const preview = planTreasureLoot(snapshot, f.config, settings, { keys: usage.keyRecords(), pendingFuel: 0 });
  assert.equal(preview.actions.length, 1);
  assert.deepEqual(preview.actions[0].body.fleetBuildingIds, ['1远征船']);
});

await check('防守被明确拒绝时释放次数预约，同一目标不会立即重复提交', async () => {
  const { f, settings } = defenceFixture(), usage = ledger(); onlyDefence(settings); f.reject = true;
  assert.equal((await run(f, settings, usage)).results[0]?.status, 'rejected');
  assert.equal(usage.pendingCounters().cityWarDispatches ?? 0, 0);
  assert.equal(usage.snapshot().counters.cityWarDispatches ?? 0, 0);
  await run(f, settings, usage);
  assert.equal(f.client.writes.length, 1);
});

await check('并发防守检查只派一次，服务器战斗和排队状态都可确认已派遣', async () => {
  const { f, settings } = defenceFixture(), usage = ledger(); onlyDefence(settings);
  await Promise.all([run(f, settings, usage), run(f, settings, usage)]);
  assert.equal(f.client.writes.length, 1);
  for (const state of [3, 5]) {
    const other = defenceFixture(), otherUsage = ledger(); onlyDefence(other.settings); other.f.unknown = true;
    await run(other.f, other.settings, otherUsage);
    Object.assign(other.f.state.fleets[1], { state, cityId: 3, targetCityId: 0 });
    await run(other.f, other.settings, otherUsage);
    assert.equal(otherUsage.snapshot().uncertain, 0);
    assert.equal(other.f.client.writes.length, 1);
  }
});

console.log('城战防守专项 ' + results.filter(row => row.passed).length + '/' + results.length + ' 通过');
if (results.some(row => !row.passed)) process.exitCode = 1;
