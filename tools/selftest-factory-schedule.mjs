import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createFactorySchedule, nextFactoryCheck } from '../src/factory-schedule.mjs';
import { defaultSettings } from '../src/automation-settings.mjs';
import { loadProtocol } from '../src/proto.mjs';

const protocol = loadProtocol();
let passed = 0;
const test = (name, work) => { work(); passed++; console.log('通过：' + name); };
const factory = (queue = [], finished = [], extra = {}) => ({ buildingId: '1材料厂', level: 1,
  factory: { factoryQ: queue, finishedProducts: finished }, ...extra });
const job = (idx, finishTime) => ({ idx, productId: '产品甲', ...(finishTime == null ? {} : { finishTime }) });
const item = num => ({ type: 0, id: '产品甲', num });
function fixture() {
  const client = new EventEmitter(); client.connected = true; client.serverClockOffsetMs = 2000;
  client.request = client.sendWatch = () => { throw new Error('调度器不得发送任何请求'); };
  const settings = defaultSettings(); settings.factory.checkEverySeconds = 30;
  const config = { tables: { BuildingCfg: { data: [{ buildingType: '材料厂' }, { buildingType: '民居' }] },
    BuildingProduceCfg: { data: [{ buildType: '材料厂' }] }, BuildingProduceParamCfg: { data: [{ paramName: '制造位上限', paramValue: 6 }] } } };
  const state = { now: 1_000_000, enabled: true, wakes: 0 };
  const scheduler = createFactorySchedule(client, { getSettings: () => settings, getConfig: () => config,
    isEnabled: () => state.enabled, now: () => state.now, onWake: () => { state.wakes++; } });
  const push = buildings => client.emit('message', { name: 'SCUpdateWaterBuilding', body: protocol.SCUpdateWaterBuilding.decode(protocol.SCUpdateWaterBuilding.encode({ building: buildings }).finish()) });
  return { client, settings, config, state, scheduler, push };
}

test('已知完整活跃队列按服务器绝对时间和毫秒偏移等待，不按固定30秒轮询', () => {
  const jobs = [job(0, 1100), job(1), job(2), job(3), job(4), job(5)];
  assert.equal(nextFactoryCheck([factory(jobs)], { now: 1_000_000, offset: 2000, slots: 6 }), 1_098_250);
});
test('取所有活跃生产格最早完成时间，不假定只有第一格生产', () => {
  const jobs = [job(0, 1120), job(1, 1090), job(2), job(3), job(4), job(5)];
  assert.equal(nextFactoryCheck([factory(jobs)], { now: 1_000_000, offset: -3000, slots: 6 }), 1_093_250);
});
test('真实协议全部排队项无finishTime时使用可调复查，不能推算成0秒完工', () => {
  const value = protocol.DispFactory.decode(protocol.DispFactory.encode({ factoryQ: [job(2),job(3),job(4),job(5),job(6)], finishedProducts:[item(1)] }).finish());
  assert.equal(nextFactoryCheck([factory([], [], { factory: value })], { now: 1_000_000, slots: 6, collect:false, checkEverySeconds:7 }), 1_007_000);
});
test('待收或已到期成品有进展时一秒接续，无进展则退回配置复查', () => {
  assert.equal(nextFactoryCheck([factory([], [item(1)])], { now: 1_000_000, slots:6, progressed:true }), 1_001_000);
  assert.equal(nextFactoryCheck([factory([], [item(1)])], { now: 1_000_000, slots:6, progressed:false, checkEverySeconds:17 }), 1_017_000);
  assert.equal(nextFactoryCheck([factory([job(1,999)])], { now: 1_000_000, slots:1, progressed:false, checkEverySeconds:17 }), 1_017_000);
});
test('空闲产能可按配置复查，满队列无时间时也不会无界等待', () => {
  assert.equal(nextFactoryCheck([factory([job(1,1100)])], { now:1_000_000, slots:6, checkEverySeconds:9 }), 1_009_000);
  assert.equal(nextFactoryCheck([factory(Array.from({length:6},(_,i)=>job(i)))], { now:1_000_000, slots:6, checkEverySeconds:9 }), 1_009_000);
  assert.equal(nextFactoryCheck([], { now:1_000_000, checkEverySeconds:0 }), 1_001_000);
  assert.equal(nextFactoryCheck([], { now:1_000_000, checkEverySeconds:999 }), 1_300_000);
});
test('未建成、禁用工厂不触发紧急检查；原生目标仍保留兜底复查', () => {
  assert.equal(nextFactoryCheck([factory([], [item(1)], {level:0})], {now:1_000_000,checkEverySeconds:19}),1_019_000);
  assert.equal(nextFactoryCheck([factory([], [item(1)])], {now:1_000_000,checkEverySeconds:19,eligible:()=>false}),1_019_000);
  const native = factory([job(0,1200)],[],{factory:{factoryQ:[job(0,1200)],finishedProducts:[],autoProductId:'产品甲'}});
  assert.equal(nextFactoryCheck([native],{now:1_000_000,slots:1,checkEverySeconds:19}),1_019_000);
});
test('新连接立即可检查，读取后独立于主挂机间隔管理到期', () => {
  const f=fixture(); assert.equal(f.scheduler.hasChecked(),false); assert.equal(f.scheduler.due(),true);
  f.scheduler.checked([factory([job(0,1100)])],{version:f.scheduler.version(),progressed:true,slots:1});
  assert.equal(f.scheduler.hasChecked(),true); assert.equal(f.scheduler.nextAt(),1_098_250); assert.equal(f.scheduler.due(),false);
  f.state.now=1_098_250; assert.equal(f.scheduler.due(),true); f.scheduler.dispose();
});
test('只对相关工厂推送唤醒，推送风暴合并并保持最短一秒', () => {
  const f=fixture(); f.scheduler.checked([factory([job(0,1100)])],{slots:1});
  f.client.emit('message',{name:'SCNewEmail',body:{}}); f.push([{buildingId:'1民居',level:1}]);
  assert.equal(f.state.wakes,0); const changed=factory([job(0,1080)]);
  for(let i=0;i<100;i++)f.push([changed]);
  assert.equal(f.state.wakes,1); assert.equal(f.scheduler.version(),1); assert.equal(f.scheduler.nextAt(),1_001_000);
  f.scheduler.dispose();
});
test('最终读取前自身推送可消化，读取过程中的新推送不得丢失', () => {
  const f=fixture(); f.scheduler.checked([factory([job(0,1100)])],{slots:1});
  f.push([factory([job(0,1090)])]); const version=f.scheduler.version();
  f.scheduler.checked([factory([job(0,1090)])],{version,progressed:true,slots:1});
  assert.equal(f.scheduler.nextAt(),1_088_250);
  const readVersion=f.scheduler.version(); f.push([factory([job(0,1080)])]);
  f.scheduler.checked([factory([job(0,1090)])],{version:readVersion,progressed:true,slots:1});
  assert.equal(f.scheduler.nextAt(),1_001_000); f.scheduler.dispose();
});
test('满仓滞留成品无成功动作不热循环，检查失败沿用配置退避', () => {
  const f=fixture(); f.settings.factory.checkEverySeconds=11;
  f.scheduler.checked([factory([],[item(1)])],{version:0,progressed:false,slots:6});
  assert.equal(f.scheduler.nextAt(),1_011_000);
  f.push([factory([],[item(2)])]); assert.equal(f.scheduler.nextAt(),1_001_000);
  f.state.now+=1000; f.scheduler.failed(); assert.equal(f.scheduler.nextAt(),1_012_000); assert.equal(f.scheduler.due(),false);
  f.scheduler.dispose();
});
test('配置修改立即唤醒，关闭工厂、暂停及断线时没有可执行期限', () => {
  const f=fixture(); f.scheduler.checked([factory([job(0,1100)])],{slots:1});
  f.state.now+=100; f.settings.factory.checkEverySeconds=3; f.client.emit('automationSettingsChanged');
  assert.equal(f.scheduler.due(),true); assert.equal(f.scheduler.nextAt(),f.state.now);
  f.settings.factory.enabled=false; assert.equal(f.scheduler.active(),false); assert.equal(f.scheduler.nextAt(),Infinity);
  f.settings.factory.enabled=true; f.state.enabled=false; assert.equal(f.scheduler.due(),false);
  f.state.enabled=true; f.client.connected=false; assert.equal(f.scheduler.active(),false);
  f.client.connected=true; assert.equal(f.scheduler.due(),true); f.scheduler.dispose();
});
test('collect仅为建筑收货时不误认为已开启工厂收货', () => {
  const f=fixture(); f.settings.factory.gain=false; f.settings.factory.produce=false; f.settings.factory.cooperateNative=false;
  assert.equal(f.scheduler.active(),false); f.settings.factory.cooperateNative=true; assert.equal(f.scheduler.active(),true); f.scheduler.dispose();
});
test('禁用类型或单厂的推送不唤醒，合法int64数量与已读状态比较一致', () => {
  const f=fixture(); f.settings.factory.gain=false; f.settings.factory.disabledTypes=['材料厂']; f.push([factory([],[item(2)])]); assert.equal(f.state.wakes,0);
  f.settings.factory.disabledTypes=[]; f.scheduler.checked([factory([],[item(2)])],{progressed:false,slots:6});
  f.push([factory([],[item(2)])]); assert.equal(f.state.wakes,0); f.scheduler.dispose();
});
test('禁用生产仍按领取开关关注完工时间和成品推送', () => {
  const f=fixture(); f.settings.factory.disabledTypes=['材料厂'];
  f.scheduler.checked([factory([job(0,1100)])],{version:0,slots:6});
  assert.equal(f.scheduler.nextAt(),1_098_250,'禁用生产的空格不触发备料兜底，但仍精确领取');
  f.push([factory([],[item(1)])]); assert.equal(f.scheduler.nextAt(),1_001_000); assert.equal(f.state.wakes,1);
  f.scheduler.dispose();
});
test('后缀扩展建筑ID用精确解锁配置识别工厂类型，非工厂空对象不唤醒', () => {
  const f=fixture(); f.config.tables.BuildingUnlockCfg={data:[{buildingId:'1材料厂B',buildingType:'材料厂'}]};
  f.settings.factory.gain=false; f.settings.factory.disabledTypes=['材料厂'];
  f.push([factory([],[item(1)],{buildingId:'1材料厂B'})]); assert.equal(f.state.wakes,0);
  f.settings.factory.disabledTypes=[]; f.push([{buildingId:'1民居',level:1,factory:{}}]); assert.equal(f.state.wakes,0);
  f.push([factory([],[item(1)],{buildingId:'1材料厂B'})]); assert.equal(f.state.wakes,1); f.scheduler.dispose();
});
test('服务器偏移变化重新计算绝对完工期限，不延后兜底检查起点', () => {
  const f=fixture(); f.scheduler.checked([factory([job(0,1100)])],{slots:1});
  f.client.serverClockOffsetMs=12000; f.client.emit('pong'); assert.equal(f.scheduler.nextAt(),1_088_250); assert.equal(f.state.wakes,1);
  f.scheduler.failed(); f.state.now+=5000; f.client.serverClockOffsetMs=15000; f.client.emit('pong');
  assert.equal(f.scheduler.nextAt(),1_030_000); f.scheduler.dispose();
});
test('dispose注销监听，新连接调度器不继承旧连接期限或推送', () => {
  const f=fixture(); f.scheduler.checked([factory([job(0,1100)])],{slots:1}); f.scheduler.dispose();
  assert.equal(f.client.listenerCount('message'),0); assert.equal(f.client.listenerCount('automationSettingsChanged'),0); assert.equal(f.client.listenerCount('pong'),0);
  f.push([factory([],[item(1)])]); f.client.emit('automationSettingsChanged'); f.client.emit('pong');
  assert.equal(f.state.wakes,0); assert.equal(f.scheduler.due(),false); assert.equal(f.scheduler.nextAt(),Infinity);
  const next=createFactorySchedule(f.client,{now:()=>f.state.now}); assert.equal(next.hasChecked(),false); assert.equal(next.due(),true); next.dispose();
});
console.log('工厂独立调度专项 '+passed+'/'+passed+' 通过');
