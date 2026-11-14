// Issue #32: production switches, shortest jobs, and bounded material planning.
import assert from 'node:assert/strict';
import { defaultSettings } from '../src/automation-settings.mjs';
import { planWorld } from '../src/world.mjs';

let passed = 0;
const test = (name, work) => { work(); passed++; console.log('通过：' + name); };
const table = data => ({ data });
function fixture() {
  const config = { materialName: id => id, tables: {
    BuildingCfg: table([{ buildingType: '食品厂', name: '食品厂' }, { buildingType: '民居', name: '民居' }]),
    BuildingProduceCfg: table([
      { itemId: '短时品', buildType: '食品厂', unlockLevel: 1, costItem: [['木材', 1]], produceTime: 1 },
      { itemId: '长时品', buildType: '食品厂', unlockLevel: 1, costItem: [['木材', 1]], produceTime: 60 },
    ]),
  } };
  const settings = defaultSettings();
  settings.factory.keepStock = 6; settings.factory.demandFirst = false;
  settings.factory.speedUp = settings.building.speedUp = false;
  const stock = new Map([['木材', 100], ['短时品', 2]]);
  const factory = { buildingId: '1食品厂', type: '食品厂', level: 1, product: [],
    factory: { factoryQ: [], finishedProducts: [] } };
  const survey = { now: 100, serverNow: 100, player: { level: 40 }, stock, have: id => stock.get(id) ?? 0,
    buildings: [factory], factories: [factory], orders: [], notes: [], weekOrder: new Map(), cargoOrder: new Map(),
    stockCap: 50, factorySlots: 6, population: 10, futurePopulation: 10, maxPopulation: 100,
    orderOfTheDay: { orderNum: 0, rewardedNum: 0 } };
  const plan = () => planWorld(survey, { config, settings, enabled: kind => ['startProduce', 'buildSupply'].includes(kind) });
  return { config, settings, stock, factory, survey, plan };
}
const products = plan => plan.actions.filter(step => step.request === 'StartFactoryProduceRequest').map(step => step.body.productId);

test('备货先排短时品，达到水位后再排长时品，一轮填满六个空槽', () => {
  const f = fixture();
  assert.deepEqual(products(f.plan()), ['短时品', '短时品', '短时品', '短时品', '长时品', '长时品']);
});
test('关闭原生协同不关闭普通按需生产，两个开关分别生效', () => {
  const f = fixture(); f.survey.cargoOrder.set('长时品', 2);
  f.settings.factory.demandFirst = true; f.settings.factory.demandPriority = ['cargo'];
  assert.equal(f.settings.factory.cooperateNative, false);
  assert.deepEqual(products(f.plan()).slice(0, 2), ['长时品', '长时品']);
  f.settings.factory.demandFirst = false;
  assert.equal(products(f.plan())[0], '短时品');
  f.settings.factory.produce = false;
  assert.equal(products(f.plan()).length, 0);
});
test('备货选中有订单需求的产品时，关闭按需优先后仍准确标记补库存', () => {
  const f = fixture(); f.survey.cargoOrder.set('短时品', 10);
  for (const step of f.plan().actions) { assert.match(step.label, /补库存/); assert.doesNotMatch(step.label, /贸易港缺/); }
});
test('同等需求来源先排短时，较大缺口不会抢先；来源优先级仍有效', () => {
  const f = fixture(); f.stock.set('短时品', 0); f.settings.factory.demandFirst = true;
  f.settings.factory.demandPriority = ['cargo', 'merchant'];
  f.survey.cargoOrder = new Map([['短时品', 1], ['长时品', 5]]);
  assert.deepEqual(products(f.plan()), ['短时品', '长时品', '长时品', '长时品', '长时品', '长时品']);
  f.survey.cargoOrder = new Map([['长时品', 1]]); f.survey.weekOrder.set('短时品', 5);
  assert.equal(products(f.plan())[0], '长时品');
});
test('库存、待收、在产共同计入水位，不重复补货或超过实际空位', () => {
  const f = fixture();
  f.factory.factory.factoryQ = [{ idx: 1, productId: '短时品' }, { idx: 2, productId: '短时品' }];
  f.factory.factory.finishedProducts = [{ id: '短时品', num: 2 }];
  assert.deepEqual(products(f.plan()), ['长时品', '长时品', '长时品', '长时品']);
  f.survey.factorySlots = 3;
  assert.deepEqual(products(f.plan()), ['长时品']);
  f.survey.factorySlots = 2;
  assert.deepEqual(products(f.plan()), []);
});
test('仓容与原料共同限制整批数量，保留周订单用料', () => {
  const f = fixture(); f.survey.stockCap = 3; f.stock.set('长时品', 3);
  assert.deepEqual(products(f.plan()), ['短时品']);
  f.survey.stockCap = 50; f.stock.set('木材', 5); f.survey.weekOrder.set('木材', 3);
  assert.deepEqual(products(f.plan()), ['短时品', '短时品']);
  f.stock.set('木材', 3);
  assert.deepEqual(products(f.plan()), []);
});
test('建筑升级按缺口安排多件，已有库存、在产与待收不重复生产', () => {
  const f = fixture(); f.settings.building.supply = true;
  f.settings.factory.keepStock = 0; f.settings.factory.demandFirst = true; f.settings.factory.demandPriority = ['building'];
  f.config.tables.BuildingUpgradeCfg = table([{ buildingType: '民居', level: 2, playerLevel: 1, curPeople: 1, consume: [['长时品', 5]] }]);
  f.survey.buildings.push({ buildingId: '1民居', type: '民居', level: 1, product: [] });
  f.stock.set('长时品', 1);
  f.factory.factory.factoryQ = [{ idx: 1, productId: '长时品' }];
  f.factory.factory.finishedProducts = [{ id: '长时品', num: 1 }];
  assert.deepEqual(products(f.plan()), ['长时品', '长时品']);
  f.settings.building.supply = false;
  assert.deepEqual(products(f.plan()), []);
});
test('原生自动生产保持原目标，仅明确开启协同才允许切换', () => {
  const f = fixture(); f.factory.factory.autoProductId = '短时品'; f.survey.autoProduceForever = true;
  f.settings.factory.demandFirst = true; f.settings.factory.demandPriority = ['cargo']; f.survey.cargoOrder.set('长时品', 6);
  assert.equal(f.plan().actions.length, 0);
  f.settings.factory.cooperateNative = true;
  assert.deepEqual(f.plan().actions.map(step => step.request), ['SetFactoryAutoProduceRequest']);
  f.settings.factory.produce = false;
  assert.deepEqual(f.plan().actions.map(step => step.request), ['SetFactoryAutoProduceRequest']);
});
console.log('工厂排产计划专项 ' + passed + '/' + passed + ' 通过');
