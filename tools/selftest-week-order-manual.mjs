import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import { commentsEighteenFixture } from './fixtures/comments-eighteen.mjs';
import { activityEntries,activityView,runActivity,runWeekOrder } from '../src/activities.mjs';
import { createUsageLedger,defaultSettings } from '../src/automation-settings.mjs';
import { readOrderReservedStock } from '../src/order-reservations.mjs';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cw-week-order-'));
const f=await commentsEighteenFixture(),cfg=f.config,p=f.protocol,original=f.client.request;
const bag=f.responses.AllItemRequest.items,order=f.responses.WeekOrderInfoRequest;order.order=[{id:'冲浪板',num:1}];
const settings=defaultSettings();settings.resources.allowDiamonds=true;let ruby=2000,mode='normal';const writes=[];
f.client.request=async(n,b={},resp=n.replace(/Request$/,'Response'))=>{
 if(n==='AllResourceRequest')return {list:[{res:4,amount:ruby}]};
 if(n==='CargoShipsRequest')return {ship:[]};
 if(!['CommonBuyGoodsRequest','FinishWeekOrderRequest'].includes(n))return original(n,b,resp);
 const body=p[n].decode(p[n].encode(b).finish());writes.push(n);
 if(mode==='lost')throw Error('timeout');if(mode==='reject')throw Object.assign(Error('rejected'),{prompt:{prompt:5},request:n});
 if(n==='CommonBuyGoodsRequest'){assert.equal(body.goods[0].itemId,'冲浪板');assert.equal(body.goods[0].num,1);ruby-=320;bag.push({itemId:'冲浪板',num:1});return p[resp].decode(p[resp].encode({reward:{asset:[{id:'冲浪板',num:1}]}}).finish());}
 const id=cfg.tables.WeekOrderRwdCfg.data.find(x=>!order.gotRwdId.includes(x.rwdId)&&x.rwdId>0).rwdId;order.gotRwdId.push(id);order.order=[{id:'木材',num:2}];
 return p[resp].decode(p[resp].encode({randomRwdId:id,newOrder:order.order}).finish());
};
const ledger=createUsageLedger('week-test',{file:path.join(dir,'usage.json')});
const current=async()=>(await activityView(f.client,f.client.festivals,cfg)).order;
const call=(action,payload)=>runWeekOrder(f.client,cfg,settings,ledger,()=>true,action,payload,{player:f.player});
const reserved=(client=f.client,player=f.player)=>readOrderReservedStock(client,p,cfg,{player});
const initial=await current(),quote={orderKey:initial.orderKey,itemId:'冲浪板',quantity:1,cost:320};
assert.equal(initial.materials[0].price,320);
await assert.rejects(call('submit',quote),/未齐/);
await assert.rejects(call('buy',{...quote,cost:1}),/报价/);
settings.resources.allowDiamonds=false;await assert.rejects(call('buy',quote),/关闭/);settings.resources.allowDiamonds=true;
settings.resources.diamondThreshold=1900;await assert.rejects(call('buy',quote),/保留/);settings.resources.diamondThreshold=0;
assert.equal(writes.length,0);mode='reject';await assert.rejects(call('buy',quote));mode='normal';
await call('buy',quote);assert.equal(ledger.snapshot().counters.diamonds,320);await assert.rejects(call('buy',quote));
await call('submit',quote);await assert.rejects(call('submit',quote),/订单已变化/);
await assert.rejects(reserved(),{code:'ORDER_MATERIAL_SPEND_PENDING'},'成功回包但库存滞后时，其他材料消费者必须等待');
const next=await current();
await assert.rejects(call('submit',{orderKey:next.orderKey}),{code:'ORDER_MATERIAL_SPEND_PENDING'},'下一张订单也不能复用旧库存');
bag.find(row=>row.itemId==='冲浪板').num=0;
assert.equal((await reserved()).stock.get('冲浪板'),0,'完整库存确认扣款后解除预留');
mode='lost';await assert.rejects(call('submit',{orderKey:next.orderKey}));await assert.rejects(call('submit',{orderKey:next.orderKey}),/已提交/);
await assert.rejects(reserved({...f.client}),{code:'ORDER_MATERIAL_SPEND_PENDING'},'超时后的预留跨连接保留');
await reserved(f.client,{...f.player,playerId:'9007199254740995'});
await assert.rejects(reserved(),{code:'ORDER_MATERIAL_SPEND_PENDING'},'其他账号的完整库存不能解除本账号预留');
const activity=activityEntries(f.client,f.responses.WeekInfoRequest.activityTime).find(row=>row.weekType===5);
await assert.rejects(runActivity(f.client,cfg,{activityId:activity.id,taskKey:'weekOrderSubmit',getSettings:()=>settings,ledger,player:f.player}),/已提交/);
assert.equal(writes.length,4);

// A definite server rejection releases both ledgers; a local failure before
// sending must not create a persistent operation record either.
const rejected=await commentsEighteenFixture(),rejectedLedger=createUsageLedger('reject',{file:path.join(dir,'reject.json')});
rejected.player.playerId='9007199254740997';let rejectedWrites=0,reject=true;
const rejectedRequest=rejected.client.request;
rejected.client.request=async(n,b={},resp=n.replace(/Request$/,'Response'))=>{
 if(n!=='FinishWeekOrderRequest')return rejectedRequest(n,b,resp);
 rejectedWrites++;
 if(reject)throw Object.assign(Error('rejected'),{prompt:{prompt:5},request:n});
 const row=rejected.responses.WeekOrderInfoRequest,id=cfg.tables.WeekOrderRwdCfg.data.find(x=>!row.gotRwdId.includes(x.rwdId)&&x.rwdId>0).rwdId;
 row.gotRwdId.push(id);return {randomRwdId:id};
};
const rejectedOrder=(await activityView(rejected.client,rejected.client.festivals,cfg)).order;
const rejectedCall=player=>runWeekOrder(rejected.client,cfg,settings,rejectedLedger,()=>true,'submit',{orderKey:rejectedOrder.orderKey},{player});
await assert.rejects(rejectedCall(null),/材料消费账号/);assert.equal(rejectedWrites,0);assert.deepEqual(rejectedLedger.keyRecords(),{});
await assert.rejects(rejectedCall(rejected.player),/rejected/);assert.deepEqual(rejectedLedger.keyRecords(),{});
reject=false;await rejectedCall(rejected.player);assert.equal(rejectedWrites,2);
console.log('周订单专项通过：价格与资源保护、拒绝释放、整单回读、未知结果防重、库存同步前材料预留及跨连接/账号隔离。');
