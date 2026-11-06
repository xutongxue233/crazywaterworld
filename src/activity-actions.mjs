import { createHash } from 'node:crypto';
import { exactAutomationId, automationWireId } from './automation-policy.mjs';
import { rewardData } from './missing-rewards.mjs';

export const natural = (value) => Number.isSafeInteger(value) && value >= 0;
export const positive = (value) => natural(value) && value > 0;
export const clock = (client) => Math.floor((Date.now() + (client.serverClockOffsetMs || 0)) / 1000);
export const dayOf = (time) => Math.floor((time + 28800) / 86400);
export const table = (config, name) => config?.tables?.[name]?.data ?? [];
export const read = async (client, name, body = {}) =>
  rewardData(await client.request(name + 'Request', body, name + 'Response'));
export const digest = (value) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 32);
export const waiting = (ctx, reason) => ctx.report({ label: ctx.label, skipped: true, reason });
export const hasReward = (reply) =>
  reply?.reward?.asset?.some((asset) => positive(Number(rewardData(asset.num)))) ||
  ['hero', 'antique', 'equipIds', 'badge', 'tickets', 'supply'].some((key) => !!reply?.[key]?.length);

export function moduleOpen(config, player, name) {
  const level = table(config, 'ModuleOpenCfg').find((row) => row.moduleId === name)?.playerLevel;
  return positive(level) && positive(player?.level) && player.level >= level;
}

export function windowOpen(entry, time) {
  return (
    positive(entry?.startTime) && positive(entry?.endTime) && entry.startTime <= time && time < entry.endTime
  );
}

export function liveSeries(client, type) {
  const now = clock(client);
  const candidates = [];
  for (const row of client.festivals ?? []) {
    if (
      row.type !== '捞尸人联动活动' &&
      !row.subActivity?.some((s) => [27, 28, 29, 30].includes(s.subActivityType))
    )
      continue;
    if (!windowOpen(row, now)) continue;
    const id = exactAutomationId(row.activityId);
    if (!id) continue;
    for (const sub of row.subActivity ?? []) {
      if (
        sub.subActivityType !== type ||
        !windowOpen({ startTime: sub.openTime || row.startTime, endTime: sub.closeTime || row.endTime }, now)
      )
        continue;
      candidates.push({ id, row, sub, body: { activityId: automationWireId(id) } });
    }
  }
  return candidates.length === 1 ? candidates[0] : null;
}

export async function itemBalance(client, id) {
  const bag = await read(client, 'AllItem');
  if (!Array.isArray(bag.items)) throw Error('库存未同步');
  const rows = bag.items.filter((item) => item.itemId === id);
  if (rows.some((item) => !natural(item.num))) throw Error('道具数量未确认');
  const total = rows.reduce((n, item) => n + item.num, 0);
  if (!natural(total)) throw Error('道具数量超出范围');
  return total;
}

// 对会消耗道具、商会币或投票券的操作，先写入已有账号账本，再发请求。
// 同一期同玩法的未知结果必须通过游戏状态核实，重新连接也不能换个目标绕过。
export async function checkedAction(
  ctx,
  { scope, before, expected, label, allowed, send, inspect, matches, accept }
) {
  if (!ctx.enabled() || !allowed()) return waiting(ctx, '开关或活动时间已变化');
  if (!ctx.ledger) return waiting(ctx, '账号执行记录不可用');
  const records = Object.entries(ctx.ledger.keyRecords());
  for (const [key, record] of records) {
    if (record.confirmed || record.details?.scope !== scope) continue;
    if (!matches(record.details.expected, before))
      return waiting(ctx, '前次操作结果待确认，等待游戏状态更新');
    ctx.ledger.resolveKey(key, true);
    ctx.report({ label, ok: true, status: 'confirmed', reason: '已回读确认前次操作' });
    return;
  }
  const identity = { ...expected };
  // 同一程调港按起点和终点防重，兼容早期未记录目标商品的账本。
  if (identity.request === 'TradeMoveRequest') delete identity.goodsId;
  delete identity.start; // 发送时刻用于回读核对，不改变动作的防重标识。
  const key = 'event-action:' + digest([scope, identity, before]);
  if (ctx.ledger.hasKey(key)) return waiting(ctx, '本次状态已处理，等待下一次更新');
  const ticket = ctx.ledger.reserve({}, {}, {}, { uniqueKey: key, details: { scope, expected } });
  if (!ctx.enabled() || !allowed()) {
    ctx.ledger.cancel(ticket);
    return;
  }
  try {
    const reply = await send();
    if (!accept(reply) || !matches(expected, await inspect())) throw Error('服务端结果待确认');
    ctx.ledger.confirm(ticket);
    ctx.report({ label, ok: true, status: 'confirmed' });
  } catch (error) {
    if (error.released) {
      ctx.ledger.cancel(ticket);
      return waiting(ctx, error.message);
    }
    if (error.prompt && error.request === expected.request) ctx.ledger.cancel(ticket);
    ctx.report({
      label,
      ok: false,
      status: error.prompt && error.request === expected.request ? 'rejected' : 'unknown',
      error: error.message
    });
  }
}
