import { createHash } from 'node:crypto';
import { usageLimits, resourceReserve } from './automation-policy.mjs';
import { displayMaterial } from './config.mjs';
import { normalize } from './worlds.mjs';

const weekNames = { 1: '勇士战令', 2: '累计充值', 3: '英雄升星', 4: '幸运转盘', 5: '周订单', 6: '芯片活动', 7: '周翻牌' };
const serverNow = client => (Date.now() + (client.serverClockOffsetMs || 0)) / 1000;
const open = (activity, now) => activity.startTime <= now && now < activity.endTime;
const linkageNames = { 28: '龙王罗盘', 29: '酆都法旨', 30: '驱邪除祟' };
const linkageTasks = { 28: 'compassReward', 29: 'edict', 30: 'evilExpel' };

function playable(row, sub, now) {
  return open(row, now) && (!sub.openTime || sub.openTime <= now) && (!sub.closeTime || now < sub.closeTime);
}

const rejectedEdicts = new WeakMap();
const tribute = '活动26捞尸人_入场券';

async function solveEdict(client, config, request, allowed, report) {
  const label = '酆都法旨';
  const state = normalize(await request('EdictInfo'));
  let session = state.session;
  if (!session) {
    rejectedEdicts.delete(client);
    if (state.cost?.id !== tribute || state.cost.num !== 1) throw new Error('开局消耗不是 1 份贡品，已跳过');
    const bag = normalize(await client.request('AllItemRequest', {}, 'AllItemResponse'));
    if (!bag.items?.some(item => item.itemId === tribute && item.num >= 1)) {
      report({ label, skipped: true, reason: '贡品不足，等待补充' });
      return;
    }
    if (!allowed()) return;
    session = (await request('EdictStart')).session;
    report({ label: label + ' · 已使用 1 份贡品开局', ok: true });
  }
  const guess = session?.rune;
  if (!Array.isArray(guess) || guess.length !== 4 || !guess.every(Number.isSafeInteger)) {
    throw new Error('当前对局未返回四个符文，已保留对局');
  }
  const signature = guess.join(',');
  if (!allowed() || rejectedEdicts.get(client) === signature) return;
  const reply = normalize(await request('EdictGuess', { guess }));
  if (!reply.success) {
    rejectedEdicts.set(client, signature);
    throw new Error('服务端未确认解符成功，已停止重复提交本组符文');
  }
  rejectedEdicts.delete(client);
  const reward = (reply.reward?.asset ?? []).map(item => displayMaterial(config, item.id) + ' ×' + item.num).join('、');
  report({ label: label + ' · 解符成功，剩余耐心 ' + reply.patience + '，积分 ' + reply.score + (reward ? '，获得' + reward : ''), ok: true });
}

export async function runLinkage(client, config, enabled, report) {
  for (const row of client.festivals ?? []) {
    for (const sub of row.subActivity ?? []) {
      const expel = sub.subActivityType === 30;
      const key = linkageTasks[sub.subActivityType];
      if (!key) continue;
      const allowed = () => enabled(key) && playable(row, sub, serverNow(client));
      if (!allowed()) continue;
      const label = linkageNames[sub.subActivityType];
      const request = (name, fields = {}) => client.request(name + 'Request', { activityId: row.activityId, ...fields }, name + 'Response');
      try {
        if (key === 'edict') {
          await solveEdict(client, config, request, allowed, report);
          continue;
        }
        const state = await request(expel ? 'EvilExpelInfo' : 'CompassWheelInfo');
        let score = (expel ? state.killTotal : state.score) ?? 0;
        let claimed = (expel ? state.claimed : state.claimedId) ?? 0;
        const previousClaimed = claimed;
        for (let left = expel ? state.alive : 0; left > 0 && allowed(); left--) {
          const reply = await request('EvilExpelKill');
          if (!(reply.killTotal > score)) throw new Error('服务端未确认消灭数量增加');
          score = reply.killTotal;
          report({ label: label + ' · 已累计消灭 ' + score + ' 个', ok: true });
        }
        const table = expel ? 'LinkageLSREvilExpelTotalRewardCfg' : 'LinkageLSRCompassWheelScoreRewardCfg';
        const stages = config?.tables?.[table]?.data;
        if (!stages?.length) throw new Error('缺少累计奖励配置');
        while (allowed() && stages.some(stage => (expel ? stage.totalCount : stage.id) > claimed && score >= (expel ? stage.totalCount : stage.score))) {
          const reply = await request(expel ? 'EvilExpelClaim' : 'ClaimCompassWheelReward');
          const next = expel ? reply.claimed : reply.claimedId;
          if (!(next > claimed)) throw new Error('服务端未确认领取档位');
          claimed = next;
          report({ label: expel ? label + ' · 已领取累计消灭 ' + claimed + ' 个奖励' : label + ' · 已领取至第 ' + claimed + ' 档', ok: true });
        }
        if (previousClaimed === claimed && !(expel && state.alive)) {
          report({ label, skipped: true, reason: expel
            ? '暂无邪祟，累计消灭 ' + score + ' 个，已领取至 ' + claimed + ' 个奖励'
            : '当前 ' + score + ' 积分，已领至第 ' + claimed + ' 档，暂无可领取奖励' });
        }
      } catch (error) { report({ label, ok: false, error: error.message }); }
    }
  }
}

async function weekSchedule(client) {
  const reply = await client.request('WeekInfoRequest', {}, 'WeekInfoResponse');
  return (reply.activityTime ?? []).map(row=>({...normalize(row),type:row.type,startTime:row.startTime,endTime:row.endTime,period:row.period}));
}

async function weekly(client) {
  return (await weekSchedule(client)).filter(row => open(row, serverNow(client)));
}

export async function readWeekOrder(client, week, config) {
  const active = week ?? await weekly(client);
  const needed = new Map();
  const current = active.find(row => row.type === 5);
  if (!current) return { needed, finished: false };
  const order = normalize(await client.request('WeekOrderInfoRequest', {}, 'WeekOrderInfoResponse'));
  if (order?.isGotFinal) return { needed, finished: true };
  const prizes = config?.tables?.WeekOrderRwdCfg?.data?.filter(row => row.periodId === current.period && row.rwdId > 0);
  if (prizes?.length && prizes.every(row => order?.gotRwdId?.includes(row.rwdId))) {
    return { needed, finished: true, finalReady: true };
  }
  if (!order?.order?.length) throw new Error('未能确认当前周订单的材料清单');
  for (const item of order.order) {
    if (!item?.id || !Number.isSafeInteger(item.num) || item.num <= 0) throw new Error('周订单材料或数量不完整');
    needed.set(item.id, (needed.get(item.id) ?? 0) + item.num);
  }
  const identity = [current.period, current.startTime, current.endTime, order.gotRwdId, [...needed]];
  const orderKey = createHash('sha256').update(JSON.stringify(identity)).digest('hex');
  return { needed, finished: false, orderKey };
}

function lotteryProgress(config, period, info) {
  const stages = config?.tables.WeekLotteryTimesCfg?.data.filter(r => r.periodId === period);
  if (!stages?.length) throw new Error('缺少本期周抽奖次数奖励配置');
  const times = info?.times ?? 0;
  const claimed = info?.gotStage ?? 0;
  const next = stages.filter(r => r.rwdId > claimed).sort((a, b) => a.rwdId - b.rwdId)[0];
  return { times, claimed, required: next?.reqTimes, ready: Boolean(next && times >= next.reqTimes) };
}

export async function activityView(client, festivals = [], config = null) {
  const week = await weekly(client);
  const activities = week.map(row => ({ name: weekNames[row.type] ?? '周活动 ' + row.type, endTime: row.endTime }));
  for (const row of festivals) {
    const linkage = (row.subActivity ?? []).filter(sub => sub.subActivityType===27 || linkageNames[sub.subActivityType]);
    if (linkage.length) {
      for (const sub of linkage) {
        if (playable(row, sub, serverNow(client))) activities.push({ name: '捞尸人联动 · ' + (sub.subActivityType===27?'走江踏浪':linkageNames[sub.subActivityType]), taskKey: sub.subActivityType===27?'riverScore':linkageTasks[sub.subActivityType], endTime: Math.min(sub.closeTime || row.endTime, row.endTime) });
      }
    }
    if (open(row, serverNow(client))) activities.push({
      name: linkage.length || row.type === '捞尸人联动活动' ? '酆都诡事（捞尸人联动）'
        : row.type || ({ 1: '五一活动', 2: '端午活动', 3: '人鱼活动' })[row.festival] || '节日活动 ' + row.activityId,
      endTime: row.endTime,
    });
  }
  const lotteryRow = week.find(r => r.type === 4);
  let lottery, lotteryError;
  if (lotteryRow) {
    try {
      const info = await client.request('WeekLotteryInfoRequest', {}, 'WeekLotteryInfoResponse');
      lottery = lotteryProgress(config, lotteryRow.period, info.gotInfo);
    } catch (error) { lotteryError = error.message; }
  }
  if (!week.some(row => row.type === 5)) return { activities, lottery, lotteryError, order: null };
  try {
    const { needed, finished, finalReady, orderKey } = await readWeekOrder(client, week, config);
    if (finished) return { activities, lottery, lotteryError, order: { materials: [], finished, finalReady } };
    const bag = normalize(await client.request('AllItemRequest', {}, 'AllItemResponse'));
    if (!Array.isArray(bag?.items)) throw new Error('未能确认仓库库存');
    const stock = new Map();
    for (const item of bag.items ?? []) stock.set(item.itemId, (stock.get(item.itemId) ?? 0) + item.num);

    const materials = Array.from(needed, ([id, required]) => {
      const owned = stock.get(id) ?? 0;
      const crop = config?.tables.FarmlandPlantCfg?.data.find(r => r.id === id);
      const seed = crop ? { name: displayMaterial(config, crop.material[0]), count: stock.get(crop.material[0]) ?? 0 } : null;
      const price = config?.tables.ItemPriceCfg?.data.find(row => row.itemId === id)?.rubyPrice;
      return { id, seed, price: Number.isSafeInteger(price) && price > 0 ? price : null, sources: config?.materialSources?.(id) ?? [], name: displayMaterial(config, id), required, owned, missing: Math.max(0, required - owned) };
    });
    return { activities, lottery, lotteryError, order: { orderKey, materials, finished, ready: materials.every(m => m.missing === 0) } };
  } catch (error) {
    return { activities, lottery, lotteryError, order: null, orderError: error.message };
  }
}

// 手动订单操作。点击时只接收页面看到的报价；发包前用服务器快照重算。
export async function runWeekOrder(client,config,settings,ledger,enabled,action,payload){
  const view=(await activityView(client,client.festivals,config)).order;
  if(!view?.orderKey || view.orderKey!==payload.orderKey)throw Error('订单已变化，请刷新');
  const buy=action==='buy',item=view.materials.find(row=>row.id===payload.itemId);
  let cost=0, rubyBefore;
  if(buy){
    if(!item?.price || !Number.isSafeInteger(item.missing) || item.missing<=0)throw Error('材料已齐或暂无钻石售价');
    cost=item.price*item.missing;
    if(!Number.isSafeInteger(cost)||cost!==payload.cost||item.missing!==payload.quantity)throw Error('缺口或报价已变化，请刷新');
    if(!settings.resources.allowDiamonds)throw Error('钻石消耗开关已关闭');
    const resources=normalize(await client.request('AllResourceRequest',{},'AllResourceResponse'));
    rubyBefore=resources.list?.find(r=>r.res===4)?.amount;
    if(!Number.isSafeInteger(rubyBefore)||rubyBefore-cost<resourceReserve(settings,'RUBY'))throw Error('钻石不足或低于保留量');
  }else if(action!=='submit'||!view.ready)throw Error('材料未齐，请先补齐');
  if(!enabled())throw Error('账号连接已变化');
  const key='week-order:'+createHash('sha256').update(JSON.stringify([action,view.orderKey,buy?item.id:null])).digest('hex');
  if(ledger.hasKey(key))throw Error('该操作已提交，请核对订单记录');
  const ticket=ledger.reserve(buy?{diamonds:cost}:{},usageLimits(settings),{},{uniqueKey:key});
  const name=buy?'CommonBuyGoods':'FinishWeekOrder';
  try{
    const result=await client.request(name+'Request',buy?{goods:[{itemId:item.id,num:item.missing}]}:{},name+'Response');
    if(buy){
      const bag=normalize(await client.request('AllItemRequest',{},'AllItemResponse'));
      const owned=bag.items?.filter(x=>x.itemId===item.id).reduce((n,x)=>n+x.num,0);
      const resources=normalize(await client.request('AllResourceRequest',{},'AllResourceResponse'));
      if(!(owned>=item.required)||resources.list?.find(r=>r.res===4)?.amount!==rubyBefore-cost)throw Error('库存或钻石变动待确认，请刷新核对');
    }else{
      const after=await client.request('WeekOrderInfoRequest',{},'WeekOrderInfoResponse');
      if(!result.randomRwdId||!after.gotRwdId?.includes(result.randomRwdId))throw Error('提交结果未确认');
    }
    ledger.confirm(ticket);
    return {message:buy?'已购买 '+item.name+' ×'+item.missing+'，花费 '+cost+' 钻石':'整单已提交'};
  }catch(error){
    if(error.prompt&&error.request===name+'Request')ledger.cancel(ticket);
    throw error;
  }
}

const passLocks = new WeakMap();

export async function claimWeekly(client, config, enabled, report, playerLevel, scheduler) {
  const due = key => enabled(key) && (!scheduler || scheduler.due(key));
  if (!['weekPass', 'weekTimes', 'weekGift'].some(due)) return;
  const midnight = scheduler?.nextDay();
  const schedule = await weekSchedule(client);
  const time = serverNow(client);
  const week = schedule.filter(row => open(row, time));
  if (scheduler) {
    for (const [key, type] of [['weekPass', 1], ['weekGift', 4], ['weekTimes', 4]]) {
      if (!due(key) || week.some(row => row.type === type)) continue;
      const starts = schedule.filter(row => row.type === type && row.startTime > time).map(row => row.startTime);
      scheduler.defer(key, Math.min(starts.length ? Math.min(...starts) : time + 600, midnight));
    }
  }
  for (const row of week) {
    let lotteryInfo;
    const readLottery = () => client.request('WeekLotteryInfoRequest', {}, 'WeekLotteryInfoResponse');
    if (row.type === 4 && due('weekTimes')) {
      try {
        lotteryInfo = await readLottery();
        let state = lotteryProgress(config, row.period, lotteryInfo.gotInfo);
        while (state.ready && enabled('weekTimes') && open(row, serverNow(client))) {
          const reply = await client.request('WeekLotteryTimesRewardRequest', {}, 'WeekLotteryTimesRewardResponse');
          const after = lotteryProgress(config, row.period, reply.gotInfo);
          if (after.claimed <= state.claimed) throw new Error('服务端未确认周抽奖次数奖励档位');
          report({ label: '周抽奖次数奖励 · 已领至第 ' + after.claimed + ' 档（累计 ' + after.times + ' 次）', ok: true });
          state = after;
        }
        if (scheduler && enabled('weekTimes') && !state.ready) {
          scheduler.defer('weekTimes', Math.min(row.endTime, state.required == null ? midnight : scheduler.now() + 180));
        }
      } catch (error) { report({ label: '周抽奖次数奖励', ok: false, error: error.message }); }
    }
    const key = row.type === 1 ? 'weekPass' : row.type === 4 ? 'weekGift' : null;
    if (!key || !due(key)) continue;
    const allowed = () => enabled(key) && open(row, serverNow(client));
    const tables = config?.tables;
    try {
      if (key === 'weekPass') {
        const lock = passLocks.get(client);
        if (lock?.endTime === row.endTime && lock.level === playerLevel && serverNow(client) < lock.retryAt) continue;
        const state = normalize(await client.request('WeekBattlePassInfoRequest', {}, 'WeekBattlePassInfoResponse'));
        if (!tables?.WeekPassTaskCfg || !tables?.WeekBattlePassCfg) throw new Error('缺少周战令配置');
        let score = state.score ?? 0;
        for (const task of state.task ?? []) {
          const cfg = tables.WeekPassTaskCfg.data.find(t => t.taskId === task.taskId);
          if (!allowed()) break;
          if (!cfg || task.isGot || !(task.progress >= cfg.target)) continue;
          const result = await client.request('WeekBattlePassFinishTaskRequest', { taskId: task.taskId }, 'WeekBattlePassFinishTaskResponse');
          if(!Number.isSafeInteger(result.score)||result.score<score)throw new Error('战令任务积分尚未确认');
          const refreshed=await client.request('WeekBattlePassInfoRequest',{},'WeekBattlePassInfoResponse');
          if(!refreshed.task?.some(t=>t.taskId===task.taskId&&t.isGot))throw new Error('战令任务领取状态尚未确认');
          score = result.score;
          report({ label: '周战令积分 · ' + cfg.desc, ok: true });
        }
        const ready = tables.WeekBattlePassCfg.data.some(cfg => {
          if (cfg.periodId !== row.period || !(score >= cfg.reqScore)) return false;
          const got = state.got?.find(item => item.stage === cfg.rwdId);
          return (cfg.freeReward?.length && !got?.freeGot) || (state.activePay && cfg.payReward?.length && !got?.payGot);
        });
        if (ready && allowed()) {
          const reward=await client.request('WeekBattlePassGotRewardRequest', {}, 'WeekBattlePassGotRewardResponse');
          const refreshed=await client.request('WeekBattlePassInfoRequest',{},'WeekBattlePassInfoResponse');
          if(!Array.isArray(reward.got)||!refreshed.got?.some(g=>{const old=state.got?.find(x=>x.stage===g.stage);return g.freeGot&&!old?.freeGot || g.payGot&&!old?.payGot;}))throw new Error('战令档位领取状态尚未确认');
          report({ label: '周战令档位奖励', ok: true });
        }
      } else {
        const cfg = tables?.WeekLotteryPackCfg?.data.find(pack => pack.price === 0 && pack.limitedTimes > 0);
        if (!cfg) throw new Error('缺少周抽奖免费礼包配置');
        const claimed = info => info.gift?.find(item => item.giftId === cfg.packId)?.gotTimes ?? 0;
        // Recheck a claimed pack at rollover or when this event ends, whichever is first.
        const recheck = scheduler && Math.min(row.endTime, midnight);
        const before = claimed(lotteryInfo ?? await readLottery());
        if (before >= cfg.limitedTimes) {
          scheduler?.defer(key, recheck);
          continue;
        }
        if (!allowed()) continue;
        await client.sendWatch('WeekLotteryFreePackRequest', {});
        const after = claimed(await readLottery());
        if (after <= before) throw new Error('服务端尚未确认礼包领取');
        if (after >= cfg.limitedTimes) scheduler?.defer(key, recheck);
        report({ label: '周抽奖免费礼包', ok: true });
      }
    } catch (error) {
      if (key === 'weekPass' && error.message === 'server prompt: feature locked') {
        const threshold = tables?.ModuleOpenCfg?.data.find(entry => entry.moduleId === '周活动')?.playerLevel;
        const levelHint = playerLevel > 0 && playerLevel < threshold
          ? `（当前 ${playerLevel} 级，周活动 ${threshold} 级开放）` : '';
        const retryAt = Math.min(row.endTime, serverNow(client) + 1800);
        passLocks.set(client, { endTime: row.endTime, level: playerLevel, retryAt });
        scheduler?.defer('weekPass', retryAt);
        report({ label: weekNames[row.type], skipped: true, reason: '账号尚未解锁' + levelHint + '，稍后自动复查' });
      } else {
        report({ label: weekNames[row.type], ok: false, error: error.message });
      }
    }
  }
}
