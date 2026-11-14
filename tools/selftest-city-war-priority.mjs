// 城战优先级回归：隔离账号、假客户端、真实协议，不连接游戏。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-city-priority-'));
const previousDataDir = process.env.CW_DATA_DIR;
process.env.CW_DATA_DIR = path.join(directory, 'data');
fs.mkdirSync(process.env.CW_DATA_DIR);
const { warForgeFixture, warForgeSettings } = await import('./fixtures/war-forge.mjs');
const { createUsageLedger } = await import('../src/automation-settings.mjs');
const { readCityWar, planCityWar, cityWarReservedFleets, refreshCityWarReservations } = await import('../src/city-war.mjs');
const { reserveDispatch, dispatchReservationReason } = await import('../src/fleet-availability.mjs');
const { runLoop } = await import('../src/loop.mjs');
const { createChallengeRun } = await import('../src/challenge-automation.mjs');

const realNow = Date.now;
let sequence = 0;
const results = [];
const check = async (name, action) => {
  try { await action(); results.push({ name, passed: true }); console.log('通过：' + name); }
  catch (error) { results.push({ name, passed: false }); console.error('失败：' + name + '\n' + error.stack); }
};
const ledger = () => createUsageLedger('模拟城战优先级账号', { file: path.join(directory, 'usage-' + (++sequence) + '.json') });
const read = (f, settings) => readCityWar(f.client, f.protocol, f.config, f.player, settings.cityWar, { mapLoader: f.mapLoader });
const preview = async (f, settings) => planCityWar(await read(f, settings), settings);
const multilateral = f => f.state.war.declarations.push({ attackGuildIdx: 9, defenceGuildIdx: 8, cityId: 2 });
const mapFile = path.join(directory, 'map.json');
fs.writeFileSync(mapFile, JSON.stringify([null, null, null, null, null, [[null, null, {
  mapInfo: { width: 10, height: 10, tileWidth: 100, tileHeight: 75 },
  cityInfo: { 1: { gridIdx: 0 }, 2: { gridIdx: 1 }, 3: { gridIdx: 10 } },
  mapData: Array(100).fill(0),
}]]]));

// 首杀与城战在同一假连接、同一完整 runLoop 中竞争一队。所有新增
// 请求/响应也经过实际 protobuf 编解码，不能用未声明写操作掩盖失败。
async function dispatchRound({ beforeWar = false, unknownCounts = false, openingRead = 0, reserve = true } = {}) {
  let clock = realNow();
  Date.now = () => clock;
  try {
    const f = warForgeFixture(), settings = warForgeSettings(), usage = ledger(), challengeRun = createChallengeRun();
    const start = Math.floor(clock / 1000) + (beforeWar || openingRead ? 5 : -60);
    f.state.war.startTime = start;
    f.state.war.endTime = start + 3600;
    if (unknownCounts) multilateral(f);
    settings.forge.enabled = false;
    Object.assign(settings.cityWar, { fleetIds: ['1远征船'], autoRepair: false, reserveDuringWar: reserve });
    Object.assign(settings.pirateHunt, {
      enabled: true, fleetIds: ['1远征船'], types: ['1'], maxLevel: 3,
      minDurabilityPercent: 80, petrolReserve: 0, fuelBudget: 3000,
    });
    f.config.resources = { mapFiles: { 1: mapFile } };
    f.config.tables.WorldPirateCfg = { data: [1, 2, 3].map(level => ({ season: 1, type: 1, level, showName: '模拟海盗', power: 1 })) };
    f.config.tables['1_SeasonTaskCfg'] = { data: [{ season: 1, stage: 1, maxPirateLevel: 3 }] };
    f.config.tables.WorldParamCfg.data.push({ paramName: '打野怪消耗汽油', paramValue: 300 });
    const request = f.client.request, send = f.client.sendWatch;
    let pirateReads = 0;
    const trace = [];
    const wire = (name, body) => f.protocol[name].decode(f.protocol[name].encode(body).finish());
    f.client.request = async (name, body = {}, response = name.replace(/Request$/, 'Response')) => {
      wire(name, body);
      if (name === 'PirateKillRecordRequest' && ++pirateReads === openingRead) clock = (start + 1) * 1000;
      trace.push({ name, time: Math.floor(clock / 1000) });
      if (name === 'SeasonTaskStageRequest') return wire(response, { stage: 1 });
      if (name === 'PirateKillRecordRequest') return wire(response, { records: [{ type: 1, maxKilledLevel: 0 }] });
      if (name === 'AllPirateRequest') return wire(response, { pirates: [{ uid: 201, type: 1, level: 1, cityId: 2, gridIdx: 22 }] });
      return request(name, body, response);
    };
    f.client.sendWatch = async (name, body) => {
      wire(name, body);
      trace.push({ name, time: Math.floor(clock / 1000), write: true });
      if (name === 'ChallengePirateRequest') {
        f.client.writes.push({ name, body });
        f.state.fuel -= 300;
        Object.assign(f.state.fleets[0], { state: 2, targetGridIdx: 22, targetCityId: 2 });
        f.client.emit('message', { name: 'SCMyFleetUpdate', body: wire('SCMyFleetUpdate', { fleets: [f.state.fleets[0]] }) });
        return;
      }
      return send(name, body);
    };
    await runLoop(f.client, f.protocol, {
      config: f.config, player: f.player, rounds: 1, allowMutate: true,
      getSettings: () => settings, usageLedger: usage, isEnabled: () => false, challengeRun,
    });
    return { writes: f.client.writes, trace, pirateReads, start, settings, usage: usage.snapshot(), pirate: challengeRun.pirate.state };
  } finally { Date.now = realNow; }
}

try {
  await check('多联盟进攻人数未知仍预留城战舰队，不能借给首杀', async () => {
    const f = warForgeFixture(), settings = warForgeSettings();
    multilateral(f);
    const snapshot = await read(f, settings), plan = planCityWar(snapshot, settings);
    assert.equal(snapshot.targets[0].alliedCount, null);
    assert.equal(plan.actions.length, 0);
    assert.deepEqual(plan.reservedFleetIds, ['1远征船', '2远征船']);
    assert.deepEqual(plan.reservedFleetIds, cityWarReservedFleets(snapshot, settings));
  });

  await check('在途舰队未同步时继续保留城战预留', async () => {
    const f = warForgeFixture(), settings = warForgeSettings(), request = f.client.request;
    f.client.request = async (...args) => {
      const value = await request(...args);
      if (args[0] === 'WorldInfoRequest') value.fleets = undefined;
      return value;
    };
    const snapshot = await read(f, settings), plan = planCityWar(snapshot, settings);
    assert.equal(snapshot.targets[0].transitCount, null);
    assert.equal(plan.actions.length, 0);
    assert.deepEqual(plan.reservedFleetIds, ['1远征船', '2远征船']);
  });

  await check('进攻与防守目标人数均未知时按分工保留两队', async () => {
    const f = warForgeFixture(), settings = warForgeSettings();
    settings.cityWar.defenceFleetIds = ['2远征船'];
    multilateral(f);
    Object.assign(f.state.cities.find(city => city.id === 3), {
      guildIdx: 7, battlePoints: [{ index: 0, rightFighter: { guildIdx: 9, isNpc: false } }],
    });
    f.state.war.declarations.push({ attackGuildIdx: 8, defenceGuildIdx: 7, cityId: 3 });
    const snapshot = await read(f, settings), plan = planCityWar(snapshot, settings);
    assert(snapshot.targets.every(target => target.alliedCount === null));
    assert.equal(plan.actions.length, 0);
    assert.deepEqual(plan.reservedFleetIds, ['1远征船', '2远征船']);
  });

  await check('人数未知时只预留有对应职责目标的舰队', async () => {
    const f = warForgeFixture(), settings = warForgeSettings();
    settings.cityWar.defenceFleetIds = ['2远征船'];
    multilateral(f);
    assert.deepEqual((await preview(f, settings)).reservedFleetIds, ['1远征船']);
  });

  await check('没有对应宣战或指定城市不匹配时不预留闲置舰队', async () => {
    for (const change of [
      (f) => { f.state.war.declarations = []; },
      (_f, settings) => { settings.cityWar.defenceFleetIds = ['1远征船', '2远征船']; },
      (_f, settings) => { settings.cityWar.targetMode = 'selected'; settings.cityWar.cityRefs = ['1:3']; },
    ]) {
      const f = warForgeFixture(), settings = warForgeSettings();
      change(f, settings);
      assert.deepEqual((await preview(f, settings)).reservedFleetIds, []);
    }
  });

  await check('城战未开始或已经结束时不预留空闲舰队', async () => {
    for (const state of ['before', 'after']) {
      const f = warForgeFixture(), settings = warForgeSettings(), now = Math.floor(Date.now() / 1000);
      Object.assign(f.state.war, state === 'before' ? { startTime: now + 3600, endTime: now + 7200 } : { startTime: now - 7200, endTime: now - 3600 });
      assert.deepEqual((await preview(f, settings)).reservedFleetIds, []);
    }
  });

  await check('关闭城战或关闭时段预留时不强占其它玩法舰队', async () => {
    for (const field of ['enabled', 'reserveDuringWar']) {
      const f = warForgeFixture(), settings = warForgeSettings();
      settings.cityWar[field] = false;
      multilateral(f);
      assert.deepEqual((await preview(f, settings)).reservedFleetIds, []);
    }
  });

  await check('原生委任额度为零只阻止接续，不解除城战预留', async () => {
    const f = warForgeFixture(), settings = warForgeSettings();
    f.config.tables.VipLevelCfg.data.find(row => row.level === 3).effects = [];
    const plan = await preview(f, settings);
    assert.equal(plan.actions.length, 0);
    assert(plan.fleets.every(fleet => /原生舰队委任尚未解锁/.test(fleet.reason)));
    assert.deepEqual(plan.reservedFleetIds, ['1远征船', '2远征船']);
  });

  await check('共享预留读取横跨开战时刻时按完成时间保留舰队且不派城战', async () => {
    let clock = realNow(); Date.now = () => clock;
    try {
      const f = warForgeFixture(), settings = warForgeSettings(), offset = 120000;
      f.client.serverClockOffsetMs = offset;
      const start = Math.floor((clock + offset) / 1000) + 5;
      f.config.resources = { mapFiles: { 1: mapFile } };
      f.state.war.startTime = start; f.state.war.endTime = start + 3600;
      f.beforeRead = async name => { if (name === 'WorldInfoRequest') clock = (start + 1) * 1000 - offset; };
      await refreshCityWarReservations(f.client, f.protocol, f.config, f.player, () => settings);
      assert.match(dispatchReservationReason(f.client, settings, 'pirateHunt', '1远征船'), /城战/);
      assert.deepEqual(f.client.writes, []);
    } finally { Date.now = realNow; }
  });

  await check('共享预留读取横跨结束时刻时释放旧城战意向', async () => {
    let clock = realNow(); Date.now = () => clock;
    try {
      const f = warForgeFixture(), settings = warForgeSettings(), end = Math.floor(clock / 1000) + 5;
      f.config.resources = { mapFiles: { 1: mapFile } };
      f.state.war.endTime = end;
      reserveDispatch(f.client, 'cityWar', ['1远征船']);
      f.beforeRead = async name => { if (name === 'WorldInfoRequest') clock = (end + 1) * 1000; };
      await refreshCityWarReservations(f.client, f.protocol, f.config, f.player, () => settings);
      assert.equal(dispatchReservationReason(f.client, settings, 'pirateHunt', '1远征船'), '');
      assert.deepEqual(f.client.writes, []);
    } finally { Date.now = realNow; }
  });

  await check('共享预留检查中设置被替换时标记未发送且不派遣', async () => {
    const f = warForgeFixture(); let settings = warForgeSettings();
    f.config.resources = { mapFiles: { 1: mapFile } };
    f.beforeRead = async name => { if (name === 'WarDeclarationRequest') settings = structuredClone(settings); };
    await assert.rejects(refreshCityWarReservations(f.client, f.protocol, f.config, f.player, () => settings), error => {
      assert.equal(error.notSent, true); return /设置或连接已变化/.test(error.message);
    });
    assert.deepEqual(f.client.writes, []);
  });

  await check('共享预留检查中连接断开时标记未发送且不派遣', async () => {
    const f = warForgeFixture(), settings = warForgeSettings();
    f.config.resources = { mapFiles: { 1: mapFile } };
    f.beforeRead = async name => { if (name === 'WarDeclarationRequest') f.client.connected = false; };
    await assert.rejects(refreshCityWarReservations(f.client, f.protocol, f.config, f.player, () => settings), error => {
      assert.equal(error.notSent, true); return /设置或连接已变化/.test(error.message);
    });
    assert.deepEqual(f.client.writes, []);
  });

  await check('关闭城战时段预留会真正清除旧意向，重新打开前不残留', async () => {
    const f = warForgeFixture(), settings = warForgeSettings();
    f.config.resources = { mapFiles: { 1: mapFile } };
    reserveDispatch(f.client, 'cityWar', ['1远征船']);
    settings.cityWar.reserveDuringWar = false;
    await refreshCityWarReservations(f.client, f.protocol, f.config, f.player, () => settings);
    // 临时恢复开关仅用于检测缓存是否已清除，不能只依赖关闭开关时的读取门控。
    settings.cityWar.reserveDuringWar = true;
    assert.equal(dispatchReservationReason(f.client, settings, 'pirateHunt', '1远征船'), '');
    assert.deepEqual(f.calls, []);
    assert.deepEqual(f.client.writes, []);
  });

  await check('完整挂机在正常城战窗口只派城战，不派首杀', async () => {
    const result = await dispatchRound();
    assert.equal(result.settings.fleetDispatch.priority[0], 'cityWar');
    assert(result.writes.some(row => row.name === 'MoveFleetsToCityRequest'));
    assert(!result.writes.some(row => row.name === 'ChallengePirateRequest'));
    assert.equal(result.usage.counters.piratePetrol ?? 0, 0);
  });

  await check('完整挂机遇多联盟人数未知时等待，不派首杀且不扣汽油', async () => {
    const result = await dispatchRound({ unknownCounts: true });
    assert.deepEqual(result.writes, []);
    assert.equal(result.usage.counters.piratePetrol ?? 0, 0);
    assert.equal(result.usage.uncertain, 0);
  });

  await check('首次首杀读取期间进入城战时段时重新预留并取消派遣', async () => {
    const result = await dispatchRound({ openingRead: 1 });
    assert(result.trace.some(row => row.name === 'PirateKillRecordRequest' && row.time >= result.start));
    assert(!result.writes.some(row => row.name === 'ChallengePirateRequest'));
    assert.match(result.pirate.reason, /城战/);
    assert.equal(result.usage.counters.piratePetrol ?? 0, 0);
    assert.equal(result.usage.uncertain, 0);
  });

  await check('最终复核读取期间进入城战时段时发送前再次预留', async () => {
    const result = await dispatchRound({ openingRead: 2 });
    assert(result.pirateReads >= 2, '必须到达 startPirateHunt 的第二次实际目标读取');
    assert(!result.writes.some(row => row.name === 'ChallengePirateRequest'));
    assert.match(result.pirate.reason, /城战/);
    assert.equal(result.usage.counters.piratePetrol ?? 0, 0);
    assert.equal(result.usage.uncertain, 0);
  });

  await check('城战开始前仍允许空闲舰队首杀', async () => {
    const result = await dispatchRound({ beforeWar: true });
    assert.equal(result.writes.filter(row => row.name === 'ChallengePirateRequest').length, 1);
    assert.equal(result.usage.counters.piratePetrol, 300);
  });

  await check('用户关闭时段预留后，未知城战目标不拦其它合法派遣', async () => {
    const result = await dispatchRound({ unknownCounts: true, reserve: false });
    assert.equal(result.writes.filter(row => row.name === 'ChallengePirateRequest').length, 1);
    assert.equal(result.usage.counters.piratePetrol, 300);
  });
} finally {
  Date.now = realNow;
  if (previousDataDir === undefined) delete process.env.CW_DATA_DIR;
  else process.env.CW_DATA_DIR = previousDataDir;
  const resolved = path.resolve(directory), tempRoot = path.resolve(os.tmpdir());
  if (path.dirname(resolved) !== tempRoot || !path.basename(resolved).startsWith('cw-city-priority-')) throw new Error('拒绝清理意外测试目录');
  fs.rmSync(resolved, { recursive: true, force: true });
}
const passed = results.filter(result => result.passed).length;
console.log('城战预留与优先级专项 ' + passed + '/' + results.length + ' 通过');
if (passed !== results.length) process.exitCode = 1;
