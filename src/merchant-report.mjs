import { exactAutomationId } from './automation-policy.mjs';
import { clock, digest, moduleOpen, natural, positive, read, windowOpen } from './activity-actions.mjs';
import { merchantSettings, merchantTiming } from './merchant-planner.mjs';

const request = 'TradeCityReportRequest';
const actor = player => [player?.playerId, player?.worldId, player?.guildId].map(exactAutomationId);
const atPort = (state, event, cityId, time) => state?.period === event.period &&
  state?.cargo?.cityId === cityId && positive(cityId) && natural(state.cargo.moveEndTime) &&
  state.cargo.moveEndTime <= time && natural(state.cargo.moveToCityId) &&
  (!state.cargo.moveToCityId || state.cargo.moveToCityId === cityId);

// 共享没有对应 Response。静默发送不是成功；以本港 isReport 回读为证。
// 使用独立账本作用域，未知共享既不能重发，也不能阻塞买卖/出航。
export async function runMerchantReport(client, config, ctx, event, info, { market } = {}) {
  const emit = entry => {
    const result = { label: '海商王 · 共享情报', ...entry };
    try { ctx.report(result); } catch { /* 展示失败不改变已保存的业务结果。 */ }
    return result;
  };
  const skip = reason => emit({ skipped: true, reason });
  const identity = actor(ctx.player), [playerId, worldId, guildId] = identity;
  const cityId = info?.cargo?.cityId;
  const timing = () => merchantTiming(config, event, clock(client));
  const cycle = timing().tradeStartTime;
  const allowed = () => ctx.key === 'merchantTrade' && ctx.enabled() && client.connected !== false &&
    merchantSettings(ctx.settings?.()?.merchant).autoShareIntel &&
    actor(ctx.player).every((id, index) => id === identity[index]) &&
    moduleOpen(config, ctx.player, '海商王') && windowOpen(event, clock(client)) &&
    client.tradeWindow?.period === event?.period && client.tradeWindow?.startTime === event.startTime &&
    client.tradeWindow?.endTime === event.endTime && timing().tradingOpen && timing().tradeStartTime === cycle;
  if (!playerId || !worldId || !guildId || BigInt(guildId) % 1000n === 0n || !positive(event?.period) ||
    !positive(cycle) || !allowed() || !atPort(info, event, cityId, clock(client))) return;

  const scope = 'merchant-report:' + event.startTime + ':' + event.period;
  // 紧缺按每日首个贸易时刻刷新，不随每两小时的价格/库存刷新重置。
  const key = scope + ':' + digest([identity, cycle, cityId]);
  const expected = { request, playerId, worldId, guildId, cityId, cycle, period: event.period };
  const compatible = value => value && (value.cityId == null || value.cityId === cityId) &&
    (value.period == null || value.period === event.period) &&
    (value.startTime == null || value.startTime === event.startTime);
  const confirm = record => {
    ctx.ledger.resolveKey(key, true, { ...record.details, confirmedAt: clock(client), after: { isReport: true } });
    // 其他盟友可能先共享；此证据只能证明目标已完成，不能归因本人首报。
    return emit({ ok: true, status: 'confirmed', reason: '本港情报已共享，已回读确认' });
  };
  let ticket;
  try {
    market ??= await read(client, 'TradeCity', { cityId });
    if (!allowed() || !compatible(market)) return skip('开关、账号、港口或商情周期已变化');
    const previous = ctx.ledger?.keyRecords()[key];
    if (market.isReport === true) {
      if (previous && !previous.confirmed) return confirm(previous);
      return { skipped: true, reason: '本港情报已共享' };
    }
    if (market.isReport !== false) return skip('本港共享状态未同步');
    if (!ctx.ledger) return skip('账号执行记录不可用，暂不共享');
    if (previous) return skip(previous.confirmed ? '本周期已确认共享，等待商情更新' : '前次共享结果待确认，暂不重复发送');

    const fresh = await read(client, 'TradeInfo');
    if (!allowed() || !atPort(fresh, event, cityId, clock(client))) return skip('活动或商船位置已变化，暂不共享');
    const latest = await read(client, 'TradeCity', { cityId });
    if (!allowed() || !compatible(latest)) return skip('开关、账号、港口或商情周期已变化');
    if (latest.isReport === true) return { skipped: true, reason: '本港情报已由盟友共享' };
    if (latest.isReport !== false) return skip('本港共享状态未同步');
    ticket = ctx.ledger.reserve({}, {}, {}, { uniqueKey: key,
      details: { scope, expected, attemptedAt: clock(client), before: { isReport: false } } });
    if (!allowed()) {
      ctx.ledger.cancel(ticket);
      return skip('开关、账号或商情周期已变化，已取消共享');
    }
    let sendError;
    try {
      await client.sendWatch(request, { cityId });
    } catch (error) {
      // 仅原写请求的明确未发送/拒绝可以释放；回读失败不得走此分支。
      if (error.notSent === true || error.prompt && error.request === request) {
        ctx.ledger.cancel(ticket);
        return emit({ ok: false, status: error.notSent === true ? 'not-sent' : 'rejected', error: error.message });
      }
      sendError = error;
    }
    if (!allowed()) return emit({ ok: false, status: 'unknown', error: '共享已尝试，状态变化后保留记录待确认' });
    const afterInfo = await read(client, 'TradeInfo');
    if (!allowed() || !atPort(afterInfo, event, cityId, clock(client)))
      return emit({ ok: false, status: 'unknown', error: '共享后商船或活动状态已变化，保留记录待确认' });
    const after = await read(client, 'TradeCity', { cityId });
    if (allowed() && compatible(after) && after.isReport === true) return confirm(ctx.ledger.keyRecords()[key]);
    return emit({ ok: false, status: 'unknown', error: sendError?.message || '共享结果尚未确认，已保留记录，暂不重发' });
  } catch (error) {
    return emit({ ok: false, status: ticket ? 'unknown' : 'unavailable', error: error.message });
  }
}
