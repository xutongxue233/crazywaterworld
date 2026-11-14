// 独立生产调度集成测试：真实 runLoop、真实协议、虚构客户端与虚拟时钟。
// 必须在任何业务模块加载前隔离数据目录，不连接游戏或现有控制台。
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-factory-loop-'));
const originalDataDir = process.env.CW_DATA_DIR, originalNow = Date.now;
process.env.CW_DATA_DIR = folder;
const base = Date.UTC(2026, 10, 14, 4);
let wall = base, serial = 0;
Date.now = () => wall;
const results = [];

try {
  const { runLoop } = await import('../src/loop.mjs');
  const { loadProtocol } = await import('../src/proto.mjs');
  const { defaultSettings, createUsageLedger } = await import('../src/automation-settings.mjs');
  const protocol = loadProtocol();

  function integration({ rounds = 2, mainEveryMs = 3600000, cli = false, offset = 0, finishAfterMs = 5000, fallbackSeconds = 30 } = {}) {
    const settings = defaultSettings();
    const disable = value => {
      for (const [key, item] of Object.entries(value)) {
        if (typeof item === 'boolean') value[key] = false;
        else if (item && typeof item === 'object') disable(item);
      }
    };
    disable(settings);
    Object.assign(settings.loop, { world: true, everySeconds: mainEveryMs / 1000 });
    Object.assign(settings.factory, { enabled: true, gain: true, produce: true, demandFirst: false, keepStock: 10, checkEverySeconds: fallbackSeconds });
    const player = { playerId: 32300000 + (++serial), worldId: 1, guildId: 1, level: 40, vip: { vipLevel: 0 } };
    const config = { tables: {
      BuildingCfg: { data: [{ buildingType: '材料厂' }] },
      BuildingProduceCfg: { data: [{ buildType: '材料厂', itemId: '产品甲', unlockLevel: 1, produceTime: 120, costItem: [['木材', 1]] }] },
      BuildingProduceParamCfg: { data: [{ paramName: '制造位上限', paramValue: 1 }] },
      GameParamCfg: { data: [{ paramName: '产品存量初始上限', paramValue: 50 }] },
      ModuleOpenCfg: { data: [{ moduleId: '联盟', playerLevel: 1 }] },
    } };
    const ledger = createUsageLedger('虚构生产调度账号-' + serial, { file: path.join(folder, serial + '.json') });
    const controller = new AbortController(), stop = controller.signal;
    const flags = new Set(['collect', 'startProduce']);
    const sleeps = [], reports = [], roundsDone = [], protocolCalls = [], protocolErrors = [], violations = [];
    const state = { stock: new Map([['木材', 100]]),
      building: { buildingId: '1材料厂', level: 10, factory: { factoryQ: [{ idx: 0, productId: '产品甲',
        ...(finishAfterMs == null ? {} : { finishTime: Math.floor((base + offset + finishAfterMs) / 1000) }) }], finishedProducts: [] } } };
    // 完整循环会安装各业务的连接级推送观察器；与 GameClient 一样允许多个模块订阅。
    const client = new EventEmitter(); client.setMaxListeners(50);
    Object.assign(client, { connected: true, festivals: [], serverClockOffsetMs: offset });
    let currentSettings = settings, active = false, scheduled = 0, readsInFlight = 0, writesInFlight = 0;
    let queue = Promise.resolve(), sleepHook, beforeRead, afterWrite, reportHook, roundHook;
    const codec = (name, value) => {
      const type = protocol[name]; assert(type, '真实协议必须存在：' + name);
      return type.decode(type.encode(value).finish());
    };
    const finish = () => {
      const q = state.building.factory.factoryQ;
      if (!q.length) return;
      let product = state.building.factory.finishedProducts.find(row => row.id === '产品甲');
      if (!product) { product = { type: 0, id: '产品甲', num: 0 }; state.building.factory.finishedProducts.push(product); }
      product.num += q.length; q.length = 0;
    };
    const mature = () => {
      const q = state.building.factory.factoryQ;
      if (q.length && q.every(row => row.finishTime > 0 && row.finishTime * 1000 <= wall + offset)) finish();
    };
    const schedule = work => {
      const job = queue.then(async () => {
        if (active) violations.push('同账号队列任务重入');
        assert.equal(active, false, '同账号不能同时执行两个队列任务');
        active = true; scheduled++;
        try { return await work(); } finally { active = false; }
      });
      queue = job.catch(() => {}); return job;
    };
    const enter = (method, name, body, write) => {
      if (!active) violations.push(name + '绕过账号队列');
      if (writesInFlight || write && readsInFlight) violations.push(name + '与其他协议重叠');
      assert.equal(active, true, '所有生产读写必须经同账号队列');
      assert.equal(writesInFlight, 0, '生产写协议期间不能重入协议');
      if (write) { assert.equal(readsInFlight, 0, '生产写入不能与读取交叉'); writesInFlight++; }
      else readsInFlight++;
      protocolCalls.push({ method, name, body, at: wall, job: scheduled });
    };
    const leave = write => { if (write) writesInFlight--; else readsInFlight--; };
    client.request = async (name, body = {}, response = name.replace(/Request$/, 'Response')) => {
      const write = name === 'GainFactoryProduceRequest'; enter('request', name, body, write);
      try {
        codec(name, body); await beforeRead?.(name); mature();
        let result;
        if (name === 'OnWaterRequest') result = { building: [state.building], workerOrder: [] };
        else if (name === 'AllItemRequest') result = { items: [...state.stock].map(([itemId, num]) => ({ itemId, num })) };
        else if (name === 'AllResourceRequest') result = { list: [] };
        else if (name === 'MyResFieldsRequest') result = { fields: [] };
        else if (name === 'MyFleetsRequest') result = { fleets: [] };
        else if (name === 'WeekInfoRequest') result = { activityTime: [] };
        else if (name === 'GuildInfoRequest') result = { guild: { guildId: 1, welfarePack: [], gotWelfareTime: 0 }, gotTitle: 0, gotTitleTime: 0 };
        else if (name === 'GainFactoryProduceRequest') {
          const assets = state.building.factory.finishedProducts;
          result = { products: { asset: structuredClone(assets) } };
          for (const row of assets) state.stock.set(row.id, (state.stock.get(row.id) ?? 0) + row.num);
          state.building.factory.finishedProducts = [];
          await afterWrite?.(name);
        } else throw new Error('禁止未声明协议：' + name);
        return codec(response, result);
      } catch (error) { protocolErrors.push({ name, message: error.message }); throw error; }
      finally { leave(write); }
    };
    client.sendWatch = async (name, body) => {
      enter('sendWatch', name, body, true);
      try {
        const request = codec(name, body); assert.equal(name, 'StartFactoryProduceRequest');
        assert.deepEqual(Object.keys(request).sort(), ['buildingId', 'productId']);
        assert.equal(state.building.factory.factoryQ.length, 0, '不能重复占用生产槽位');
        state.stock.set('木材', state.stock.get('木材') - 1);
        state.building.factory.factoryQ.push({ idx: 0, productId: request.productId, finishTime: Math.floor((wall + offset) / 1000) + 120 });
        await afterWrite?.(name); return { seq: protocolCalls.length };
      } catch (error) { protocolErrors.push({ name, message: error.message }); throw error; }
      finally { leave(true); }
    };
    const run = async () => {
      const result = await runLoop(client, protocol, {
        config, player, rounds, everyMs: mainEveryMs, getEveryMs: () => mainEveryMs,
        allowMutate: true, ...(cli ? {} : { isEnabled: key => flags.has(key) }),
        getSettings: () => currentSettings, usageLedger: ledger, stop, schedule,
        sleep: async ms => {
          assert(ms > 0, '生产调度不能零毫秒忙轮询');
          sleeps.push(ms); assert(sleeps.length < 100, '调度等待应有界');
          if (sleepHook) await sleepHook(ms, sleeps.length); else wall += ms;
        },
        onStep: row => { reports.push(row); reportHook?.(row); },
        onRound: row => { roundsDone.push(row); roundHook?.(row); },
      });
      await queue; return result;
    };
    const clean = async () => {
      assert.deepEqual(violations, [], '协议不得并行或绕过账号队列');
      assert.deepEqual(protocolErrors, [], '不得将未声明协议错误吞进循环备注');
      assert.deepEqual(reports.filter(row => row.error && !row.skipped), [], '不得吞掉执行错误');
      assert.equal(client.listenerCount('automationSettingsChanged'), 0, '循环结束应移除配置监听');
      const count = protocolCalls.length;
      client.emit('automationSettingsChanged');
      for (let n = 0; n < 10; n++) client.emit('message', { name: 'SCUpdateWaterBuilding', body: { building: [state.building] } });
      await Promise.resolve(); await Promise.resolve(); await queue;
      assert.equal(protocolCalls.length, count, '退出后的配置与推送不能再发送协议');
    };
    return { client, state, settings, config, flags, stop, sleeps, reports, roundsDone, protocolCalls, finish, schedule, run, clean,
      abort: () => controller.abort(), getSettings: () => currentSettings, setSettings: value => { currentSettings = value; },
      scheduled: () => scheduled, isScheduled: () => active,
      sleepHook: fn => { sleepHook = fn; }, beforeRead: fn => { beforeRead = fn; }, afterWrite: fn => { afterWrite = fn; },
      reportHook: fn => { reportHook = fn; }, roundHook: fn => { roundHook = fn; } };
  }
  const test = async (name, work) => {
    wall = base;
    try { await work(); results.push(true); console.log('通过：' + name); }
    catch (error) { results.push(false); console.error('失败：' + name + '\n' + error.stack); }
  };
  const writes = f => f.protocolCalls.filter(row => ['GainFactoryProduceRequest', 'StartFactoryProduceRequest'].includes(row.name));
  const stopAfterRefill = f => f.reportHook(row => { if (row.step?.kind === 'startProduce' && row.status === 'confirmed') f.abort(); });

  await test('主循环一小时时仍按实际完工时间与服务端时差及时收货补产', async () => {
    const f = integration({ offset: 2000 }); stopAfterRefill(f);
    await f.run();
    assert.deepEqual(writes(f).map(row => row.name), ['GainFactoryProduceRequest', 'StartFactoryProduceRequest']);
    assert(writes(f)[0].at >= base + 5000 && writes(f)[0].at <= base + 6000, '应在五秒完工附近收货，不能等待主轮或三十秒兜底');
    assert.equal(f.roundsDone.length, 1, '辅助生产检查不能推进主轮计数');
    assert(f.scheduled() >= 2); await f.clean();
  });
  await test('缺少完工时间时按用户设置的七秒周期兜底检查', async () => {
    const f = integration({ finishAfterMs: null, fallbackSeconds: 7 }); stopAfterRefill(f);
    f.sleepHook(ms => { wall += ms; if (wall >= base + 7000) f.finish(); });
    await f.run();
    assert.equal(f.sleeps[0], 7000); assert.equal(writes(f)[0].at, base + 7000);
    assert.equal(writes(f).length, 2); await f.clean();
  });
  await test('三十秒升级巡检不会延后一百二十秒的生产兜底期限', async () => {
    const f = integration({ mainEveryMs: 600000, fallbackSeconds: 120 }); stopAfterRefill(f);
    f.state.building.factory.factoryQ = []; f.state.stock.set('木材', 0);
    Object.assign(f.settings.building, { enabled: true, upgrade: true }); f.flags.add('upgrade');
    f.sleepHook(ms => { wall += ms; if (wall > base + 30000) f.state.stock.set('木材', 100); });
    await f.run();
    assert.deepEqual(writes(f).map(row => row.name), ['StartFactoryProduceRequest']);
    assert.equal(writes(f)[0].at, base + 120000, '升级只读巡检不能不断推迟工厂补料期限');
    assert(f.sleeps.filter(ms => ms === 30000).length >= 4); await f.clean();
  });
  await test('工厂推送风暴提前唤醒，回调不发协议且在途推送不重复排产', async () => {
    const f = integration({ finishAfterMs: 600000, fallbackSeconds: 300 }); stopAfterRefill(f);
    const storm = () => {
      const count = f.protocolCalls.length;
      for (let n = 0; n < 30; n++) f.client.emit('message', { name: 'SCUpdateWaterBuilding', body: { building: [f.state.building] } });
      assert.equal(f.protocolCalls.length, count, '推送回调只能安排检查');
    };
    f.sleepHook((ms, index) => { if (index === 1) { wall += 1000; f.finish(); storm(); } else wall += ms; });
    f.afterWrite(storm);
    await f.run();
    assert.equal(writes(f).length, 2); assert(writes(f)[0].at <= base + 3000);
    await f.clean();
  });
  await test('配置启用会提前唤醒，读取期间关闭则取消尚未发送的生产', async () => {
    const f = integration(); f.settings.factory.enabled = false; f.finish(); stopAfterRefill(f);
    f.sleepHook((ms, index) => {
      if (index === 1) {
        wall += 1000; const next = structuredClone(f.getSettings()); next.factory.enabled = true; f.setSettings(next);
        const count = f.protocolCalls.length; f.client.emit('automationSettingsChanged');
        assert.equal(f.protocolCalls.length, count, '保存事件不能直接发送生产协议');
      } else wall += ms;
    });
    await f.run(); assert.equal(writes(f).length, 2); assert(writes(f)[0].at <= base + 3000); await f.clean();

    wall = base;
    const g = integration({ rounds: 1 }); g.finish(); let changed = false;
    g.beforeRead(name => {
      if (name === 'OnWaterRequest' && !changed) {
        changed = true; const next = structuredClone(g.getSettings()); next.factory.enabled = false; g.setSettings(next);
        g.client.emit('automationSettingsChanged');
      }
    });
    await g.run(); assert(changed); assert.equal(writes(g).length, 0); await g.clean();
  });
  await test('耗时业务结束的安全检查点先收货补产，再执行后续业务', async () => {
    const f = integration({ mainEveryMs: 1000 }); let guildReads = 0;
    f.roundHook(row => { if (row.round === 1) { f.flags.add('guildWelfare'); f.flags.add('guildTitleReward'); } });
    f.beforeRead(name => { if (name === 'GuildInfoRequest' && ++guildReads === 1) wall += 10000; });
    await f.run();
    const guild = f.protocolCalls.map((row, index) => ({ ...row, index })).filter(row => row.name === 'GuildInfoRequest');
    const gain = f.protocolCalls.findIndex(row => row.name === 'GainFactoryProduceRequest');
    assert.equal(guild.length, 2); assert(gain > guild[0].index && gain < guild[1].index, '工厂检查应插在完整业务之后、下个业务之前');
    assert.equal(writes(f).length, 2); assert.equal(writes(f)[0].job, guild[0].job, '主轮检查点直接复用当前账号队列，不嵌套排队');
    assert.equal(f.roundsDone.length, 2); await f.clean();
  });
  await test('命令行未传isEnabled也会在主轮之间独立检查生产', async () => {
    const f = integration({ cli: true }); stopAfterRefill(f);
    await f.run(); assert.equal(writes(f).length, 2); assert(writes(f)[0].at <= base + 6000);
    assert.equal(f.roundsDone.length, 1); await f.clean();
  });
  await test('暂停或断线终止连接轮次后不会残留生产检查', async () => {
    for (const disconnected of [false, true]) {
      wall = base; const f = integration();
      f.sleepHook(() => {
        wall += 1000; f.finish();
        if (disconnected) { f.client.connected = false; f.client.emit('disconnect'); }
        f.abort(); f.client.emit('message', { name: 'SCUpdateWaterBuilding', body: { building: [f.state.building] } });
      });
      await f.run(); assert.equal(writes(f).length, 0); await f.clean();
    }
  });
  await test('有限一轮完成即退出，不因生产计时器继续等待或后台运行', async () => {
    const f = integration({ rounds: 1 });
    const result = await f.run(); assert.equal(result.history.length, 1); assert.deepEqual(f.sleeps, []);
    assert.equal(writes(f).length, 0); f.finish(); await f.clean();
  });

  console.log('独立生产调度集成测试：' + results.filter(Boolean).length + '/' + results.length + ' 项通过');
  if (results.some(result => !result)) process.exitCode = 1;
} finally {
  Date.now = originalNow;
  if (originalDataDir === undefined) delete process.env.CW_DATA_DIR; else process.env.CW_DATA_DIR = originalDataDir;
  fs.rmSync(folder, { recursive: true, force: true });
}
