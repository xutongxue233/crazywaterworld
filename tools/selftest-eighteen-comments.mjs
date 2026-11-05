import assert from 'node:assert/strict';
import vm from 'node:vm';
import {commentsEighteenFixture} from './fixtures/comments-eighteen.mjs';
import {readActivityStatistics,activityRewardState} from '../src/activity-statistics.mjs';
import {activityRankCatalog,readActivityRanking} from '../src/activity-rankings.mjs';
import {readWorldOverview} from '../src/world-overview.mjs';
import {readWorldTarget} from '../src/world-target.mjs';
import {runtimeProgress} from '../src/runtime-progress.mjs';
import {PAGE} from '../src/page.mjs';
let count=0;const test=async(name,fn)=>{await fn();count++;console.log('通过：'+name);};
const ledger={keyRecords:()=>({}),snapshot:()=>({counters:{}}),pendingCounters:()=>({})};
await test('实际协议活动统计使用当期游戏名称，周订单按真实档数和战令档位计算',async()=>{
 const f=await commentsEighteenFixture(),result=await readActivityStatistics(f.client,f.config,f.player);
 assert.deepEqual(result.notes,[]);const item=id=>result.items.find(r=>r.id===id);
 assert.equal(item('week:3').name,'科技之心');assert.equal(item('week:5').name,'不差钱商人');assert.match(item('week:5').progress,/29\/32/);assert.match(item('week:1').progress,/第 10 档/);
 assert.match(item('week:1').rewards,/可领 1 档/);assert.equal(item('week:4').welfare,'免费礼包已领');assert.match(item('week:7').rewards,/可领 1 档/);
 assert(result.items.some(r=>r.id==='treasure'));assert(result.items.some(r=>r.id==='open:3'));assert(result.items.some(r=>r.name==='酆都法旨'));
 assert(!f.reads.some(r=>/Got|Claim|Send|Buy|Start|Challenge|Repair/.test(r.name)));
});
await test('未达成不等于全部领取，付费奖励未激活不计可领，读取失败不伪造已领',async()=>{
 assert.equal(activityRewardState([{n:1},{n:2}],t=>t.n===1,t=>t.n===1),'已达成已领 · 1/2 档');
 assert.match(activityRewardState([{n:1}],()=>false,()=>false),/^尚未达成/);
 const f=await commentsEighteenFixture();f.fail.add('WeekOrderInfoRequest');const r=await readActivityStatistics(f.client,f.config,f.player),row=r.items.find(r=>r.id==='week:5');assert.equal(row.progress,'未同步');assert.equal(row.rewards,'未同步');assert(r.notes.length===1);
});
await test('真实42击杀/已领40样本按击杀档位判断，不把40当作已领40档',async()=>{
 const f=await commentsEighteenFixture();Object.assign(f.responses.EvilExpelInfoRequest,{killTotal:42,claimed:40});
 let r=await readActivityStatistics(f.client,f.config,f.player);assert.equal(r.items.find(r=>r.name==='驱邪除祟').rewards,'已达成已领 · 8/15 档');
 f.responses.EvilExpelInfoRequest.killTotal=45;r=await readActivityStatistics(f.client,f.config,f.player);assert.match(r.items.find(r=>r.name==='驱邪除祟').rewards,/可领 1 档/);
});
await test('过期/未来冲榜入口移除，缺少开放快照不猜；不再发送无响应分页',async()=>{
 const f=await commentsEighteenFixture(),tabs=activityRankCatalog(f.client,f.config,f.player);assert(tabs.some(t=>t.key==='pirate'));assert(!tabs.some(t=>['orders','stages'].includes(t.key)));
 const first=await readActivityRanking(f.client,f.config,f.player,'pirate',1);assert.equal(first.totalPages,1);assert.match(first.reason,/分页暂不可用/);
 await assert.rejects(()=>readActivityRanking(f.client,f.config,f.player,'pirate',2),/只支持首屏/);assert(!f.reads.some(r=>r.name==='OpenRankLeaderBoardRequest'));
 f.client.openRankActivity=null;assert(!activityRankCatalog(f.client,f.config,f.player).some(t=>t.kind==='open'));
});
await test('地图宣战与普通/优先队列来自真实字段，舰队任务不采用允许任务清单',async()=>{
 const f=await commentsEighteenFixture();f.settings.treasure.enabled=true;f.settings.treasure.fleetIds=['1远征船'];
 const r=await readWorldOverview(f.client,f.config,f.player,f.settings,ledger,{mapLoader:async()=>f.map});
 const war=r.cityWars.find(w=>w.cityId===f.targetCity);assert.equal(war.attack,8);assert.equal(war.priorityAttack,2);assert.equal(war.battles,1);
 assert.equal(r.fleets[0].task,'空闲');assert.equal(r.fleets[0].target,'—');assert.equal(r.fleets[1].task,'城战');assert.equal(r.fleets[2].task,'万吨/货轮');
 assert(r.routes.some(route=>route.layer==='traffic'));assert.equal(r.points.filter(p=>p.layer==='traffic').length,1);assert.equal(r.treasures[0].inbound,2);
});
await test('地图缺少他人行军数据不写零，缺少目标坐标不造航线',async()=>{
 const f=await commentsEighteenFixture();f.fail.add('WorldInfoRequest');const r=await readWorldOverview(f.client,f.config,f.player,f.settings,ledger,{mapLoader:async()=>f.map});assert.equal(r.treasures[0].inbound,null);assert.equal(r.layers.traffic,'未同步');
 f.fail.clear();f.responses.WorldInfoRequest.fleets.at(-1).startGridIdx=0;const next=await readWorldOverview(f.client,f.config,f.player,f.settings,ledger,{mapLoader:async()=>f.map});assert(!next.routes.some(route=>route.layer==='traffic'));
});
await test('真实城战排队回包省略格子时按cityId识别，不把返程城市行军说成城战',async()=>{
 const f=await commentsEighteenFixture();Object.assign(f.fleets[1],{state:5,cityId:f.targetCity,targetCityId:0,curGridIdx:0});
 let r=await readWorldOverview(f.client,f.config,f.player,f.settings,ledger,{mapLoader:async()=>f.map});assert.equal(r.fleets[1].task,'城战');assert.match(r.fleets[1].state,/城战.*排队/);
 Object.assign(f.fleets[1],{state:2,targetCityId:f.fleets[0].cityId,targetGridIdx:f.map.cityInfo[f.fleets[0].cityId].gridIdx});
 r=await readWorldOverview(f.client,f.config,f.player,f.settings,ledger,{mapLoader:async()=>f.map});assert.equal(r.fleets[1].task,'城市行军');
});
await test('城战详情读取失败不把未知状态说成没有宣战',async()=>{
 const f=await commentsEighteenFixture();const r=await readWorldTarget(f.client,f.protocol,f.config,f.player,f.settings,ledger,{layer:'cities',key:'city-'+f.targetCity});assert(r.notes.some(n=>n.includes('未确认')));assert(!r.notes.some(n=>n.includes('不是本联盟当前有效宣战目标')));
});
await test('进度和条件分列，真实开关限制不被执行成功覆盖',()=>{
 const r=runtimeProgress({key:'schedule.pirate',enabled:true,blockedBy:[]},{text:'今日免费扫荡次数已用完（15/15）',state:'waiting'},{counters:{pirateSweeps:11}},{running:true,connected:true});assert.match(r.progress,/15\/15/);
 const blocked=runtimeProgress({key:'forge.enabled',enabled:true,blockedBy:['基地总控']},{text:'已完成',state:'ok'},{counters:{forgeStarts:2}},{running:true,connected:true});assert.match(blocked.condition,/基地总控/);
 const pending=runtimeProgress({key:'forge.enabled',enabled:false,blockedBy:[]},{text:'等待确认2单',state:'pending'},{counters:{}},{running:true,connected:true});assert.match(pending.condition,/已关闭.*等待确认/);
 const treasure={key:'treasure.enabled',enabled:true,blockedBy:[]};
 for(const reward of ['今日奖励 0/3','今日奖励 2/3','今日奖励 3/3','今日奖励未同步']){
  const view=runtimeProgress(treasure,{text:'当前没有可读取的万吨货轮',state:'waiting'},{counters:{treasureDispatches:4}},{running:true,connected:true,treasureReward:reward});
  assert.equal(view.progress,'本工具今日出征 4次 · '+reward);assert.equal(view.condition,'当前没有可读取的万吨货轮');
 }
 const gift=runtimeProgress({key:'schedule.guildTitleReward',enabled:true,blockedBy:[]},{text:'今日职级礼包已领取',state:'waiting'},{counters:{}},{running:true,connected:true});assert.equal(gift.progress,'今日职级礼包已领取');assert.equal(gift.condition,'—');
});
await test('页面脚本可解析，已覆盖的旧入口移除且独有编队保留',()=>{
 for(const m of PAGE.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
 for(const id of ['loot-run','tasks-plan','tasks-run','hunt-view','pirate-tracker','activities-list'])assert(!PAGE.includes('id="'+id+'"'),id);
 for(const id of ['formation-view','activity-stats-table','inventory-query','world-map-fleets'])assert.equal((PAGE.match(new RegExp('id="'+id+'"','g'))??[]).length,1,id);
 assert(PAGE.includes('当前进度'));assert(PAGE.includes('当前条件'));assert(PAGE.includes('width:165px'));assert(PAGE.includes('width:100px'));
});
console.log('十八项批注专项 '+count+'/'+count+' 通过');
