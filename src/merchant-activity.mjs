import { exactAutomationId } from './automation-policy.mjs';
import { claimOnce } from './extra-free-rewards.mjs';
import {
  checkedAction,
  clock,
  dayOf,
  hasReward,
  moduleOpen,
  natural,
  positive,
  read,
  table,
  waiting,
  windowOpen
} from './activity-actions.mjs';
import { claimPass } from './seasonal-activities.mjs';

const param = (config, key) => table(config, 'ActivityTradeCfg').find((row) => row.key === key)?.value;
const hourOf = (time) => Math.floor(((time + 28800) % 86400) / 3600);
function tradingHours(config, time) {
  const range = String(param(config, '海商王贸易时间')).split('-').map(Number);
  return range.length === 2 && range.every(natural) && hourOf(time) >= range[0] && hourOf(time) < range[1];
}
const hasMerchantReport = (radar) => radar.radar.some((r) => positive(r.cityId) && positive(r.rareGoodsId));
const quantity = (state, id, city) =>
  state.goods.filter((g) => g.goodsId === id && g.cityId === city).reduce((sum, g) => sum + g.num, 0);
const fingerprint = (state) => ({
  coins: state.player.coins,
  profit: state.player.profit,
  goods: state.player.goods,
  cargo: state.cargo
});

// 只读取当前港成交价。联盟商情给出的异地紧缺货是选港信号，不能当作目的港实时报价。
export function planMerchant(config, event, state, market, radar, time, visited = []) {
  const wait = (reason) => ({ kind: 'wait', reason });
  if (!windowOpen(event, time) || state?.period !== event.period || !tradingHours(config, time))
    return wait('等待本期开放交易时段');
  const cargo = state.cargo,
    player = state.player;
  if (!positive(cargo?.cityId) || !positive(cargo.cargoLv) || !natural(cargo.moveEndTime))
    return wait('商船位置未同步');
  if (cargo.moveEndTime > time || (cargo.moveToCityId && cargo.moveToCityId !== cargo.cityId))
    return wait('商船航行中，等待到港确认');
  const ship = table(config, 'TradeShipCfg').find((s) => s.lv === cargo.cargoLv);
  if (
    !ship ||
    !positive(ship.capacity) ||
    !natural(ship.profitMargin) ||
    !natural(player?.coins) ||
    !natural(player.profit) ||
    !Array.isArray(player.goods) ||
    !Array.isArray(market?.goods) ||
    !Array.isArray(radar?.radar)
  )
    return wait('商船、港口报价或联盟商情未同步');
  // 港口特产常驻可见。只有有效的紧缺商品才表示本期有可用商情。
  if (player.goods.length && !hasMerchantReport(radar))
    return wait('暂无有效商情，等待联盟商情更新');
  const definitions = new Map(table(config, 'TradeGoodsCfg').map((g) => [g.goodsId, g]));
  const quotes = new Map(market.goods.map((g) => [g.goodsId, g]));
  if (
    quotes.size !== market.goods.length ||
    new Set(player.goods.map((good) => good.pid)).size !== player.goods.length ||
    player.goods.some(
      (g) =>
        !natural(g.pid) ||
        !positive(g.num) ||
        !positive(g.buyPrice) ||
        !positive(g.cityId) ||
        !positive(definitions.get(g.goodsId)?.capacity)
    )
  )
    return wait('货物批次或舱位未确认');
  const profitable = player.goods
    .filter(
      (g) =>
        g.cityId !== cargo.cityId &&
        positive(quotes.get(g.goodsId)?.price) &&
        quotes.get(g.goodsId).price > g.buyPrice
    )
    .map((g) => ({
      g,
      price: quotes.get(g.goodsId).price,
      gain: Math.ceil((quotes.get(g.goodsId).price - g.buyPrice) * g.num * (1 + ship.profitMargin / 10000))
    }))
    .sort((a, b) => b.gain - a.gain || a.g.pid - b.g.pid);
  if (profitable.length) {
    const { g, price, gain } = profitable[0];
    return {
      kind: 'sell',
      pid: g.pid,
      goodsId: g.goodsId,
      count: g.num,
      city: cargo.cityId,
      price,
      gain,
      label: '出售' + definitions.get(g.goodsId).itemName + ' ×' + g.num + '，报价预计盈利 ' + gain
    };
  }
  const minutes = Number(param(config, '海商王行驶时间')),
    arrival = time + minutes * 60;
  if (
    !positive(minutes) ||
    arrival >= event.endTime ||
    !tradingHours(config, arrival) ||
    dayOf(arrival) !== dayOf(time)
  )
    return wait('本时段剩余时间不足以完成下一程');
  const ports = radar.radar.filter((r) => positive(r.cityId) && r.cityId !== cargo.cityId);
  const reachable = ports.filter((r) => !visited.includes(r.cityId));
  const move = (port, goodsId) => ({
    goodsId,
    kind: 'move',
    city: cargo.cityId,
    destination: port.cityId,
    label: '商船从港口 ' + cargo.cityId + ' 前往 ' + port.cityId
  });
  if (player.goods.length) {
    const wanted = reachable.find((r) =>
      player.goods.some((g) => g.goodsId === r.rareGoodsId && g.cityId !== r.cityId)
    );
    return wanted ? move(wanted, wanted.rareGoodsId) : wait('本港尚无盈利卖价，等待可用的紧缺货商情');
  }
  const buys = [];
  for (const offer of market.goods) {
    const cfg = definitions.get(offer.goodsId);
    if (
      !cfg ||
      !positive(offer.price) ||
      !natural(offer.stock) ||
      !positive(cfg.capacity) ||
      !positive(cfg.unitPrice) ||
      offer.price >= cfg.unitPrice
    )
      continue;
    const count = Math.min(
      Math.floor(ship.capacity / cfg.capacity),
      Math.floor(player.coins / offer.price),
      cfg.maxCount - offer.stock
    );
    if (!positive(count)) continue;
    buys.push({
      kind: 'buy',
      city: cargo.cityId,
      goodsId: offer.goodsId,
      count,
      price: offer.price,
      discount: (cfg.unitPrice - offer.price) / cfg.unitPrice,
      estimate: (cfg.unitPrice - offer.price) * count,
      label: '买入' + cfg.itemName + ' ×' + count + '，单价 ' + offer.price
    });
  }
  buys.sort((a, b) => b.discount - a.discount || b.estimate - a.estimate || a.goodsId - b.goodsId);
  if (buys.length) return buys[0];
  if (!player.coins) return wait('商会币不足，等待补充');
  return wait('本港暂无可买的折价货，留港等待报价更新');
}

function marketEpoch(config, time) {
  const hours = String(param(config, '海商王刷新时间')).split(',').map(Number);
  return dayOf(time) + ':' + Math.max(0, ...hours.filter((h) => h <= hourOf(time)));
}

function visitedPorts(ledger, scope, epoch) {
  return Object.values(ledger?.keyRecords() ?? {})
    .filter((r) => r.details?.scope === scope && r.details.expected?.marketEpoch === epoch &&
      r.details.expected.request === 'TradeMoveRequest')
    .map((r) => r.details.expected.city);
}

async function readMerchantPlan(config, event, state, time, ask, visited) {
  let radar = { radar: [] };
  if (state.player?.goods?.length) {
    try { radar = await ask('TradeGuildRadar'); }
    catch { return { kind: 'wait', reason: '商情未同步，等待更新' }; }
    if (!Array.isArray(radar?.radar)) return { kind: 'wait', reason: '商情未同步，等待更新' };
    if (!hasMerchantReport(radar)) return { kind: 'wait', reason: '暂无有效商情，等待联盟商情更新' };
  }
  let market;
  try { market = await ask('TradeCity', { cityId: state.cargo.cityId }); }
  catch { return { kind: 'wait', reason: '等待本港报价更新' }; }
  return planMerchant(config, event, state, market, radar, time, visited);
}

export async function merchantProgress(config, event, state, player, time, ask, ledger) {
  const cargo = state.cargo;
  const goodsName = (id) => table(config, 'TradeGoodsCfg').find((g) => g.goodsId === id)?.itemName || '商品 ' + id;
  const cities = table(config, (player.scenarioId || 1) + '_CityCfg');
  const cityName = (id) => cities.find((c) => c.id === id)?.name || '港口 ' + id;
  const goods = state.player.goods;
  const stock = !Array.isArray(goods) ? '未同步' : goods.length ?
    goods.map((g) => goodsName(g.goodsId) + ' ×' + g.num).join('、') : '空载';
  const progress = ['当前商品：' + stock];
  const scope = 'merchant:' + event.startTime + ':' + event.period;
  if (cargo.moveEndTime > time || (cargo.moveToCityId && cargo.moveToCityId !== cargo.cityId)) {
    const leg = Object.values(ledger?.keyRecords() ?? {}).find((r) => {
      const e = r.details?.expected;
      return r.details?.scope === scope && e?.request === 'TradeMoveRequest' &&
        e.city === cargo.cityId && e.destination === cargo.moveToCityId &&
        Math.abs(e.start - cargo.moveStartTime) <= 2;
    });
    if (leg?.details.expected.goodsId) progress.push('本程商品：' + goodsName(leg.details.expected.goodsId));
    progress.push('目标城池：' + (positive(cargo.moveToCityId) ? cityName(cargo.moveToCityId) : '未同步'));
    progress.push(cargo.moveEndTime > time ? '航行中' : '等待到港确认');
    return progress.join(' · ');
  }
  if (positive(cargo.cityId)) progress.push('所在城池：' + cityName(cargo.cityId));
  const wait = (reason) => [...progress, '目标城池：待定', reason].join(' · ');
  if (!tradingHours(config, time)) return wait('等待开放交易时段');
  if (!exactGuild(player.guildId)) return wait('等待本盟商情');
  if (!positive(cargo.cityId)) return wait('等待商船位置同步');
  const plan = await readMerchantPlan(config, event, state, time, ask, visitedPorts(ledger, scope, marketEpoch(config, time)));
  if (plan.kind === 'wait') return wait(plan.reason);
  progress.push('计划' + ({buy:'买入', sell:'卖出', move:'走商'})[plan.kind] + '：' + goodsName(plan.goodsId));
  progress.push('目标城池：' + (plan.kind === 'buy' ? '买入后按商情选城' : cityName(plan.destination ?? plan.city)));
  return progress.join(' · ');
}

const samePlan = (a, b) =>
  a.kind === b.kind &&
  ['city', 'destination', 'goodsId', 'pid', 'count', 'price'].every((k) => a[k] === b[k]);
function actionMatched(e, s) {
  if (!s?.cargo || !Array.isArray(s.goods)) return false;
  if (e.request === 'TradeBuyRequest')
    return s.coins === e.coins && quantity(s, e.goodsId, e.city) >= e.owned;
  if (e.request === 'TradeSellRequest')
    return s.coins > e.coins && s.profit > e.profit && !s.goods.some((g) => g.pid === e.pid);
  return (
    s.cargo.cityId === e.destination ||
    (s.cargo.moveToCityId === e.destination && s.cargo.moveEndTime >= e.start)
  );
}

export async function merchantActivity(client, config, ctx) {
  const event = client.tradeWindow;
  const allowed = () =>
    ctx.enabled() &&
    moduleOpen(config, ctx.player, '海商王') &&
    windowOpen(client.tradeWindow, clock(client)) &&
    client.tradeWindow?.period === event.period &&
    client.tradeWindow.startTime === event.startTime;
  if (!event?.period || !allowed()) return waiting(ctx, '海商王本期尚未开放');
  if (ctx.key === 'merchantTrade' && !exactGuild(ctx.player.guildId)) return waiting(ctx, '等待本盟商情');
  if (ctx.key === 'merchantTrade' && !tradingHours(config, clock(client)))
    return waiting(ctx, '等待游戏规定的贸易时段 ' + param(config, '海商王贸易时间'));
  const getState = () => read(client, 'TradeInfo');
  const info = await getState();
  if (info.period !== event.period || !info.player || !info.cargo)
    return waiting(ctx, '海商王期数或商船状态未确认');
  const scope = 'merchant:' + event.startTime + ':' + event.period;
  if (ctx.key === 'merchantRewards') {
    await merchantRewards(client, config, ctx, event, info, allowed, getState);
    return;
  }
  if (info.cargo.moveEndTime > clock(client))
    return waiting(
      ctx,
      '航行中，预计 ' +
        new Date(info.cargo.moveEndTime * 1000).toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai' }) +
        ' 到港'
    );
  const epoch = () => marketEpoch(config, clock(client));
  const currentEpoch = epoch();
  const visited = visitedPorts(ctx.ledger, scope, currentEpoch);
  const snapshot = (state) => readMerchantPlan(config, event, state, clock(client),
    (name, body) => read(client, name, body), visited);
  const plan = await snapshot(info);
  if (plan.kind === 'wait') return waiting(ctx, plan.reason);
  const fresh = await getState();
  if (fresh.period !== event.period || !allowed()) return waiting(ctx, '期数或活动状态已变化');
  const verified = await snapshot(fresh);
  if (!samePlan(plan, verified) || epoch() !== currentEpoch)
    return waiting(ctx, '港口价格、库存或目的港已变化，下一轮重算');
  const state = fingerprint(fresh);
  const common = {
    scope,
    before: state,
    label: plan.label,
    allowed: () => allowed() && tradingHours(config, clock(client)) && epoch() === currentEpoch,
    inspect: async () => {
      const r = await getState();
      return r.period === event.period ? fingerprint(r) : null;
    },
    matches: actionMatched
  };
  if (plan.kind === 'buy') {
    const expected = {
      request: 'TradeBuyRequest',
      city: plan.city,
      goodsId: plan.goodsId,
      owned: quantity(state, plan.goodsId, plan.city) + plan.count,
      coins: state.coins - plan.price * plan.count
    };
    return checkedAction(ctx, {
      ...common,
      expected,
      send: () =>
        client.request(
          expected.request,
          { cityId: plan.city, goodsId: plan.goodsId, buyNum: plan.count },
          'TradeBuyResponse'
        ),
      accept: (r) => r.player?.coins === expected.coins
    });
  }
  if (plan.kind === 'sell') {
    const expected = { request: 'TradeSellRequest', pid: plan.pid, coins: state.coins, profit: state.profit };
    return checkedAction(ctx, {
      ...common,
      expected,
      send: () =>
        client.request(
          expected.request,
          { cityId: plan.city, pid: plan.pid, sellNum: plan.count },
          'TradeSellResponse'
        ),
      accept: (r) => r.player?.profit > state.profit
    });
  }
  const expected = {
    request: 'TradeMoveRequest',
    city: plan.city,
    destination: plan.destination,
    goodsId: plan.goodsId,
    start: clock(client),
    marketEpoch: currentEpoch
  };
  return checkedAction(ctx, {
    ...common,
    expected,
    send: () =>
      client.request(
        expected.request,
        { cityId: plan.city, mvToCityId: plan.destination },
        'TradeMoveResponse'
      ),
    accept: (r) => r.cargo?.moveToCityId === plan.destination || r.cargo?.cityId === plan.destination
  });
}

async function merchantRewards(client, config, ctx, event, info, allowed, getState) {
  const scope = event.startTime + ':' + event.period;
  await claimPass(
    client,
    { ...ctx, label: '海商王战令' },
    { type: 3, tiers: table(config, 'TradePassCfg').filter((t) => t.period === info.period), scope, allowed }
  );
  if (!allowed()) return;
  const stages = table(config, 'TradeAchieveRewardCfg').filter(
    (t) => t.id === info.period && t.rewardId > info.gotAchieveRwdId && t.target <= info.player.profit
  );
  if (stages.length)
    await claimOnce(client, {
      key: 'trade-profit:' + scope + ':' + info.gotAchieveRwdId,
      ledger: ctx.ledger,
      enabled: allowed,
      title: '海商王 · 累计利润奖励',
      report: ctx.report,
      request: 'GotTradeAchievementRequest',
      response: 'GotTradeAchievementResponse',
      verify: async (r) =>
        hasReward(r) &&
        r.gotAchieveRwdId > info.gotAchieveRwdId &&
        (await getState()).gotAchieveRwdId >= r.gotAchieveRwdId
    });
  const day = dayOf(clock(client)),
    dayNum = day - dayOf(event.startTime) + 1;
  if (!allowed() || !exactGuild(ctx.player.guildId)) return;
  const getTasks = async () => (await read(client, 'TradeTask')).guildTask;
  const task = await getTasks();
  if (!Array.isArray(task?.gotTaskId) || !natural(task.profit) || !natural(task.tradeTimes))
    return waiting(ctx, '联盟贸易任务进度未同步');
  const eligible = table(config, 'TradeGuildTaskCfg').filter(
    (t) =>
      t.day <= dayNum &&
      !task.gotTaskId.includes(t.id) &&
      (t.taskType === 0 ? task.profit : task.tradeTimes) >= t.tragetCount
  );
  for (const taskDay of new Set(eligible.map((t) => t.day))) {
    const ids = eligible.filter((t) => t.day === taskDay).map((t) => t.id);
    await claimOnce(client, {
      ledger: ctx.ledger,
      key: 'trade-task:' + scope + ':' + taskDay + ':' + ids.join('-'),
      enabled: allowed,
      report: ctx.report,
      title: '海商王 · 第' + taskDay + '天联盟任务',
      request: 'TradeGotTaskRequest',
      response: 'TradeGotTaskResponse',
      body: { day: taskDay },
      verify: async (r) => {
        if (!hasReward(r) || !ids.every((id) => r.gotTaskId.includes(id))) return false;
        const after = await getTasks();
        return ids.every((id) => after.gotTaskId.includes(id));
      }
    });
  }
  const reportTiers = table(config, 'TradeDayRewardCfg').filter(
    (t) => t.id > info.gotReportRwdId && t.roleNum <= info.guildReportNum
  );
  if (reportTiers.length)
    await claimOnce(client, {
      ledger: ctx.ledger,
      key: 'trade-report:' + scope + ':' + day + ':' + info.gotReportRwdId,
      enabled: () => allowed() && dayOf(clock(client)) === day,
      report: ctx.report,
      title: '海商王 · 联盟商情礼包',
      request: 'GotTradeReportRequest',
      response: 'GotTTradeReportResponse',
      verify: async (r) =>
        hasReward(r) &&
        r.gotReportRwdId > info.gotReportRwdId &&
        (await getState()).gotReportRwdId >= r.gotReportRwdId
    });
}
function exactGuild(id) {
  const value = exactAutomationId(id);
  return !!value && BigInt(value) % 1000n > 0n;
}
