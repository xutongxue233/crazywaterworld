import assert from 'node:assert/strict';
import { loadProtocol } from '../src/proto.mjs';
import { defaultSettings } from '../src/automation-settings.mjs';
import { createActionGuard } from '../src/automation-policy.mjs';
import { runFactoryProductionBatch } from '../src/factory-production.mjs';
import { runWorld } from '../src/world.mjs';
import { pendingOrderMaterialSpends, beginOrderMaterialSpend, cancelOrderMaterialSpend } from '../src/order-reservations.mjs';

const protocol = loadProtocol(), now = () => Math.floor(Date.now() / 1000);
let serial = 32000000, passed = 0;
const test = async (name, work) => { await work(); passed++; console.log('通过：' + name); };
function fixture() {
  const player = { playerId: ++serial, worldId: 1, level: 40, vip: { vipLevel: 0 } }, settings = defaultSettings();
  const config = { tables: {
    BuildingCfg: { data: [{ buildingType: '材料厂' }] },
    BuildingProduceCfg: { data: [{ buildType: '材料厂', itemId: '产品甲', unlockLevel: 1, produceTime: 1, costItem: [['木材', 1]] },
      { buildType: '材料厂', itemId: '产品乙', unlockLevel: 1, produceTime: 1, costItem: [['金属', 1]] }] },
    BuildingProduceParamCfg: { data: [{ paramName: '制造位上限', paramValue: 6 }] },
    GameParamCfg: { data: [{ paramName: '产品存量初始上限', paramValue: 50 }] },
  } };
  const state = { stock: new Map([['木材', 100], ['金属', 100]]), reads: [], writes: [], harvests: 0, active: true, instant: false,
    building: { buildingId: '1材料厂', level: 10, factory: { factoryQ: [], finishedProducts: [] } }, mode: '', failAt: 0, inFlight: 0 };
  const codec = (name, body) => { const type = protocol[name]; assert(type, name); return type.decode(type.encode(body).finish()); };
  const add = productId => {
    const recipe = config.tables.BuildingProduceCfg.data.find(row => row.itemId === productId);
    for (const [id, count] of recipe.costItem) state.stock.set(id, state.stock.get(id) - count);
    if (state.instant) {
      let product = state.building.factory.finishedProducts.find(row => row.id === productId);
      if (!product) { product = { type: 0, id: productId, num: 0 }; state.building.factory.finishedProducts.push(product); }
      product.num++;
    } else state.building.factory.factoryQ.push({ idx: state.building.factory.factoryQ.reduce((n,row) => Math.max(n,row.idx + 1), 0), productId, finishTime: now() + 100 });
  };
  const client = { connected: true, festivals: [], async request(name, body = {}, response) {
    codec(name, body); state.reads.push(name);
    let result;
    if (name === 'GainFactoryProduceRequest') {
      const assets = state.building.factory.finishedProducts;
      for (const row of assets) state.stock.set(row.id, (state.stock.get(row.id) ?? 0) + row.num);
      result = { products: { asset: structuredClone(assets) } }; state.building.factory.finishedProducts = []; state.harvests++;
    } else if (name === 'OnWaterRequest') result = { building: [state.building, ...(state.otherBuildings ?? [])], workerOrder: [], ...state.water };
    else if (name === 'AllItemRequest') {
      if (state.badBag && state.writes.length) throw new Error('测试库存读取失败');
      result = { items: [...state.stock].map(([itemId, num]) => ({ itemId, num })) };
    } else throw new Error('禁止未声明读取：' + name);
    const reply = codec(response, result);
    await state.afterRead?.(name);
    return reply;
  }, async sendWatch(name, body) {
    assert.equal(++state.inFlight, 1, '批次写请求必须串行');
    try {
      const request = codec(name, body); assert.equal(name, 'StartFactoryProduceRequest');
      assert.deepEqual(Object.keys(request).sort(), ['buildingId', 'productId']);
      state.writes.push({ name, body });
      const failing = state.failAt === state.writes.length;
      if (failing && state.mode === 'reject') throw Object.assign(new Error('明确拒绝'), { prompt: {}, request: name });
      if (failing && state.mode === 'notSent') throw Object.assign(new Error('未发送'), { notSent: true });
      if (failing && state.mode === 'unknown') throw new Error('结果未知');
      add(body.productId);
      await state.afterSend?.(state.writes.length);
      if (failing && state.mode === 'lost') throw new Error('回包丢失');
      return { seq: state.writes.length };
    } finally { state.inFlight--; }
  } };
  const step = (productId = '产品甲') => ({ kind: 'startProduce', request: 'StartFactoryProduceRequest', response: null,
    body: { buildingId: '1材料厂', productId }, costs: config.tables.BuildingProduceCfg.data.find(row => row.itemId === productId).costItem.map(([id,num])=>({id,num})), label: '排产' });
  const options = () => ({ config, player, getSettings: () => settings, enabled: () => state.active, window: 0 });
  const batch = (steps = Array.from({ length: 6 }, () => step()), extra = {}) => runFactoryProductionBatch(client, protocol, steps, { ...options(), ...extra });
  return { player, settings, config, state, client, add, step, options, batch };
}

await test('runWorld真实入口连续六件只在批首批末查询，不再逐件等待300毫秒', async () => {
  const f = fixture(), steps = Array.from({length:6}, () => f.step()), start = performance.now();
  const result = await runWorld(f.client, protocol, { actions: steps }, { ...f.options(), allowMutate: true });
  assert.equal(f.state.writes.length, 6); assert(result.results.every(row => row.status === 'confirmed'));
  assert.equal(f.state.reads.filter(name => name === 'OnWaterRequest').length, 2);
  assert.equal(f.state.reads.filter(name => name === 'AllItemRequest').length, 2);
  assert(performance.now() - start < 1200, '六件不应有逐件300毫秒固定等待');
  assert.equal(pendingOrderMaterialSpends(f.player).length, 0);
});
await test('秒产直接进入待收成品仍可确认整批，批内不无限补空槽', async () => {
  const f = fixture(); f.state.instant = true;
  const result = await f.batch(); assert.equal(f.state.writes.length, 6); assert(result.results.every(row => row.ok));
  assert.equal(f.state.building.factory.finishedProducts[0].num, 6);
  assert.equal(pendingOrderMaterialSpends(f.player).length, 0);
});
await test('runWorld仅剩一个空槽的秒产也确认成品，不残留材料锁', async () => {
  const f = fixture(); for (let i=0;i<5;i++) f.add('产品乙'); f.state.instant = true;
  const result = await runWorld(f.client, protocol, { actions: [f.step()] }, { ...f.options(), allowMutate: true });
  assert.equal(f.state.writes.length, 1); assert.equal(result.results[0].status, 'confirmed');
  assert.equal(pendingOrderMaterialSpends(f.player).length, 0);
});
await test('实际空槽仅四格时只发送四件，容量使用配置值', async () => {
  const f = fixture(); f.config.tables.BuildingProduceParamCfg.data[0].paramValue = 5; f.add('产品乙');
  const result = await f.batch(); assert.equal(f.state.writes.length, 4); assert.equal(result.results.filter(row => row.ok).length, 4);
});
await test('第二件明确拒绝只核对首件，未发原料不会遗留阻塞', async () => {
  const f = fixture(); f.state.mode = 'reject'; f.state.failAt = 2;
  const result = await f.batch(); assert.equal(f.state.writes.length, 2); assert.equal(result.results[0].status, 'confirmed');
  assert.equal(result.results[1].ok, false); assert.equal(pendingOrderMaterialSpends(f.player).length, 0);
  f.state.mode = ''; await f.batch(); assert.equal(f.state.writes.length, 7);
});
await test('第二件明确未发送释放剩余原料，共用guard可再次排产', async () => {
  const f = fixture(); f.state.stock.set('木材', 6); f.state.mode = 'notSent'; f.state.failAt = 2;
  const guard = createActionGuard(f.client, () => f.settings, null, { player: f.player, enabled: () => f.state.active });
  const options = { beforeStep: guard.before, afterStep: guard.after, cancelStep: guard.cancel };
  const first = await f.batch(undefined, options); assert.equal(first.results[0].ok, true);
  f.state.mode = ''; const next = await f.batch(undefined, options);
  assert.equal(next.results.filter(row => row.ok).length, 5); assert.equal(f.state.stock.get('木材'), 0);
});
await test('第二件未知只保留两件消耗，重连没有证据不重发', async () => {
  const f = fixture(); f.state.mode = 'unknown'; f.state.failAt = 2;
  const first = await f.batch(); assert.equal(first.results[0].status, 'unknown');
  const pending = pendingOrderMaterialSpends(f.player); assert.equal(pending.length, 1); assert.equal(pending[0].costs[0].need, 2);
  const second = await runFactoryProductionBatch({ ...f.client }, protocol, Array.from({length:6}, () => f.step()), f.options());
  assert(second.results.every(row => row.skipped)); assert.equal(f.state.writes.length, 2);
  f.add('产品甲'); f.state.mode = ''; const recovered = await f.batch();
  assert.equal(recovered.results.filter(row => row.ok).length, 4); assert.equal(pendingOrderMaterialSpends(f.player).length, 0);
});
await test('旧队列自然成熟不能证明未知的新排产', async () => {
  const f = fixture(); f.add('产品甲'); f.state.mode = 'unknown'; f.state.failAt = 1;
  f.state.afterRead = name => {
    if (name === 'OnWaterRequest' && f.state.writes.length) {
      f.state.building.factory.factoryQ = []; f.state.building.factory.finishedProducts = [{type:0,id:'产品甲',num:1}];
    }
  };
  await f.batch(); await f.batch(); assert.equal(f.state.writes.length, 1);
  assert.equal(pendingOrderMaterialSpends(f.player).length, 1);
});
await test('批中暂停停止后续发送；恢复时先确认已发部分再补剩余空槽', async () => {
  const f = fixture(); f.state.afterSend = count => { if (count === 2) f.state.active = false; };
  const first = await f.batch(); assert.equal(f.state.writes.length, 2); assert.equal(first.results[0].status, 'unknown');
  assert.equal(pendingOrderMaterialSpends(f.player)[0].costs[0].need, 2);
  f.state.active = true; f.state.afterSend = null;
  const next = await f.batch(); assert.equal(next.results.filter(row => row.ok).length, 4); assert.equal(f.state.writes.length, 6);
});
await test('批中关闭普通排产或切号都不会继续发后续请求', async () => {
  for (const mode of ['off','account']) {
    const f = fixture(), original = { ...f.player };
    f.state.afterSend = () => { if (mode === 'off') f.settings.factory.produce = false; else f.player.playerId++; };
    await f.batch(); assert.equal(f.state.writes.length, 1);
    if (mode === 'account') assert.equal(pendingOrderMaterialSpends(original)[0].costs[0].need, 1);
  }
});
await test('批首拒绝缺料、库存满、原生自动生产和活动未开放', async () => {
  for (const mode of ['material','cap','native','event']) {
    const f = fixture();
    if (mode === 'material') f.state.stock.set('木材', 2);
    if (mode === 'cap') f.state.stock.set('产品甲', 49);
    if (mode === 'native') { f.state.water = { autoProduceForever: true }; f.state.building.factory.autoProductId = '产品乙'; }
    if (mode === 'event') f.config.tables.BuildingProduceCfg.data[0].limitType = '活动甲';
    const result = await f.batch(); assert.equal(f.state.writes.length, 0, mode); assert(result.results.every(row => row.skipped), mode);
    assert.equal(pendingOrderMaterialSpends(f.player).length, 0, mode);
  }
});
await test('旧材料消费未确认时不可绕过共享预留', async () => {
  const f = fixture(), held = beginOrderMaterialSpend(f.player, [{ id: '木材', have: 100, need: 2 }], '旧未知消费', { operation: {confirmed:false} });
  await f.batch(); assert.equal(f.state.writes.length, 0); cancelOrderMaterialSpend(held);
});
await test('批末库存读取失败保留证据，恢复后不重发已成功部分', async () => {
  const f = fixture(); f.state.badBag = true;
  const first = await f.batch(); assert(first.results.every(row => row.status === 'unknown'));
  assert.equal(pendingOrderMaterialSpends(f.player).length, 1);
  f.state.badBag = false; const next = await f.batch();
  assert(next.results.every(row => row.skipped)); assert.equal(f.state.writes.length, 6);
  assert.equal(pendingOrderMaterialSpends(f.player).length, 0);
});
await test('不同产品的同批请求以各自数量证明，不能用一种成品冒充全部', async () => {
  const f = fixture(); f.state.instant = true;
  const result = await f.batch([f.step(), f.step('产品乙'), f.step(), f.step('产品乙')]);
  assert(result.results.every(row => row.ok)); assert.deepEqual(f.state.building.factory.finishedProducts.map(row => [row.id,row.num]), [['产品甲',2],['产品乙',2]]);
});
await test('第二个并发调用被拒不能释放第一个调用的锁给第三个调用', async () => {
  const f = fixture(); let release, entered;
  const waiting = new Promise(resolve => { entered = resolve; }), hold = new Promise(resolve => { release = resolve; });
  f.state.afterRead = async name => { if (name === 'OnWaterRequest' && !f.state.writes.length) { entered(); await hold; } };
  const first = f.batch(); await waiting;
  const second = await f.batch(), third = await f.batch();
  assert(second.results.every(row => row.skipped)); assert(third.results.every(row => row.skipped));
  assert.equal(f.state.reads.length, 1); release(); await first; assert.equal(f.state.writes.length, 6);
});
await test('外部计划重复使用同一step对象时拒绝项也不能误报为成功', async () => {
  const f = fixture(); f.state.mode = 'reject'; f.state.failAt = 2;
  const result = await f.batch(Array(6).fill(f.step()));
  assert.equal(result.results.filter(row => row.ok).length, 1); assert.equal(result.results[1].ok, false);
});
await test('无需求的备货遵守新鲜库存水位，独立需求仍能超过备货水位', async () => {
  const f = fixture(); f.settings.factory.demandFirst = false; f.settings.factory.keepStock = 10; f.state.stock.set('产品甲', 9);
  const result = await f.batch(); assert(result.results.every(row => row.skipped)); assert.equal(f.state.writes.length, 0);
  const next = await f.batch(Array.from({length:6}, () => ({ ...f.step(), demandDriven: true })));
  assert.equal(next.results.filter(row => row.ok).length, 6);
});
await test('原料为零的生产未知也按账号和工厂防重', async () => {
  const f = fixture(); f.config.tables.BuildingProduceCfg.data[0].costItem = []; f.state.mode = 'unknown'; f.state.failAt = 1;
  await f.batch(); await f.batch(); assert.equal(f.state.writes.length, 1);
  f.add('产品甲'); f.state.mode = ''; const next = await f.batch();
  assert.equal(next.results.filter(row => row.ok).length, 5);
});
await test('普通排产前提高原料保留量会停下整个待发送批次', async () => {
  const f = fixture(); f.config.tables.BuildingProduceCfg.data[0].costItem = [['加速器',1]]; f.state.stock.set('加速器',100);
  f.settings.resources.keepAccelerators = 0;
  f.state.afterSend = () => { f.settings.resources.keepAccelerators = 100; };
  await f.batch(); assert.equal(f.state.writes.length, 1); assert.equal(pendingOrderMaterialSpends(f.player).length, 0);
});
await test('批末水面读取短暂失败后，下一轮先确认旧批次再领取和续产', async () => {
  const f = fixture(); f.state.instant = true;
  f.state.afterRead = name => { if (name === 'OnWaterRequest' && f.state.writes.length) throw new Error('测试临时水面读取失败'); };
  const initial = await runWorld(f.client, protocol, { actions: Array.from({length:6},()=>f.step()) }, { ...f.options(), allowMutate: true });
  assert(initial.results.every(row => row.status === 'unknown')); assert.equal(pendingOrderMaterialSpends(f.player).length, 1);
  f.state.afterRead = null;
  const harvest = { kind: 'gainFactory', request: 'GainFactoryProduceRequest', response: 'GainFactoryProduceResponse', body: { buildingId: '1材料厂' } };
  const next = await runWorld(f.client, protocol, { actions: [harvest, ...Array.from({length:6},()=>f.step())] }, { ...f.options(), allowMutate: true });
  assert.equal(f.state.harvests, 1); assert.equal(f.state.writes.length, 12);
  assert(next.results.every(row => row.ok)); assert.equal(pendingOrderMaterialSpends(f.player).length, 0);
});
await test('上次排产仍缺证据时暂停领取，保留自然成熟后的旧成品', async () => {
  const f = fixture(); f.add('产品甲'); f.state.mode = 'unknown'; f.state.failAt = 1;
  await f.batch(); f.state.building.factory.factoryQ = []; f.state.building.factory.finishedProducts = [{type:0,id:'产品甲',num:1}];
  const harvest = { kind: 'gainFactory', request: 'GainFactoryProduceRequest', response: 'GainFactoryProduceResponse', body: { buildingId: '1材料厂' } };
  const next = await runWorld(f.client, protocol, { actions: [harvest, ...Array.from({length:6},()=>f.step())] }, { ...f.options(), allowMutate: true });
  assert.equal(f.state.harvests, 0); assert.equal(f.state.writes.length, 1); assert(next.results.every(row => row.skipped));
});
await test('无关零级工厂的合法空消息不阻塞已建工厂，异常产品仍保守', async () => {
  const f = fixture(); f.state.otherBuildings = [{ buildingId:'2材料厂', level:0, factory:{} }];
  const result = await f.batch(); assert.equal(result.results.filter(row => row.ok).length,6);
  const g = fixture(); g.state.otherBuildings = [{ buildingId:'2材料厂', level:0, factory:{ finishedProducts:[{type:0,id:'产品甲',num:1}] } }];
  const blocked = await g.batch(); assert.equal(g.state.writes.length,0); assert(blocked.results.every(row=>row.skipped));
});
console.log('生产批次专项 ' + passed + '/' + passed + ' 通过');
