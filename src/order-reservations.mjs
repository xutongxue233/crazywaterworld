import { readWeekOrder } from './activities.mjs';
import { toNumber } from './client.mjs';

const rows = (config, name) => config?.tables?.[name]?.data ?? [];
const now = client => Math.floor((Date.now() + (client.serverClockOffsetMs || 0)) / 1000);
// Guild orders and museum expeditions share processed goods. An acknowledged
// action can precede the inventory update, so readers must not reuse that old
// balance, even on a later loop or a replacement connection.
const materialSpends = new Map();

function idText(value) {
  if (value && Number.isInteger(value.low) && Number.isInteger(value.high)) {
    return ((BigInt(value.high) << 32n) + BigInt(value.low >>> 0)).toString();
  }
  if (typeof value === 'bigint' || Number.isSafeInteger(value) || (typeof value === 'string' && /^\d+$/.test(value))) return String(value);
  return null;
}

function amount(raw, name, positive = false) {
  const n = raw == null ? NaN : toNumber(raw);
  if (!Number.isSafeInteger(n) || n < (positive ? 1 : 0)) throw new Error('无法确认' + name);
  return n;
}

function list(value, name) {
  if (!Array.isArray(value)) throw new Error('未能读取' + name);
  return value;
}

function identity(player) {
  return JSON.stringify([idText(player?.playerId), idText(player?.guildId), idText(player?.worldId), player?.level]);
}

function accountKey(player) {
  const role = idText(player?.playerId), world = idText(player?.worldId);
  if (!role || BigInt(role) <= 0n || !world || BigInt(world) <= 0n) throw new Error('无法确认材料消费账号');
  // Joining a different guild must not discard an earlier inventory debit.
  return JSON.stringify([role, world]);
}

export function beginOrderMaterialSpend(player, costs, label) {
  const account = accountKey(player);
  if (materialSpends.has(account)) throw new Error('上次加工品扣款尚未确认，请等待库存同步');
  const remaining = new Map();
  for (const row of list(costs, '加工品消费清单')) {
    if (typeof row?.id !== 'string' || !row.id || remaining.has(row.id)) throw new Error('加工品消费材料编号异常');
    const have = amount(row.have, '消费前材料库存');
    const need = amount(row.need, '加工品消费数量', true);
    if (need > have) throw new Error('加工品消费超过已核对库存');
    remaining.set(row.id, have - need);
  }
  if (!remaining.size) throw new Error('加工品消费清单为空');
  const handle = { account, remaining, label };
  materialSpends.set(account, handle);
  return handle;
}

// Only a definite rejection may release an unobserved debit. Success, timeout
// and disconnect all wait for a complete inventory snapshot instead.
export function cancelOrderMaterialSpend(handle) {
  if (handle && materialSpends.get(handle.account) === handle) materialSpends.delete(handle.account);
}

export function confirmOrderMaterialSpends(player, stock) {
  const account = accountKey(player);
  const saved = materialSpends.get(account);
  if (!saved) return;
  for (const [id, after] of saved.remaining) {
    if ((stock.get(id) ?? 0) <= after) saved.remaining.delete(id);
  }
  if (!saved.remaining.size) { materialSpends.delete(account); return; }
  throw Object.assign(new Error((saved.label || '上次操作') + '的材料扣款尚未确认，等待库存同步后再使用加工品'), { code: 'ORDER_MATERIAL_SPEND_PENDING' });
}

function assets(value, name) {
  const map = new Map();
  for (const item of list(value, name)) {
    if (item?.type !== 0 || typeof item.id !== 'string' || !item.id) throw new Error('无法确认' + name + '的道具类型');
    map.set(item.id, amount((map.get(item.id) ?? 0) + amount(item.num, name + '数量', true), name + '总量', true));
  }
  return map;
}

// A read-only snapshot for optional consumers of processed goods. Callers must
// obtain a fresh snapshot immediately before their write and keep their own
// per-account execution lock; these Maps do not reserve stock on the server.
export async function readOrderReservedStock(client, protocol, config, { player, enabled = () => true } = {}) {
  if (!player || !Number.isSafeInteger(player.level) || player.level < 1
    || !idText(player.playerId) || BigInt(idText(player.playerId)) <= 0n
    || !idText(player.worldId) || BigInt(idText(player.worldId)) <= 0n) throw new Error('无法确认材料预留的账号身份');
  const stamp = identity(player);
  const check = () => {
    if (!enabled()) throw new Error('账号已暂停或连接已更换');
    if (identity(player) !== stamp) throw new Error('账号身份已变化，不能使用原账号材料预留');
  };
  check();
  const get = async name => {
    check();
    const response = name.replace(/Request$/, 'Response');
    if (!protocol?.[name] || !protocol?.[response]) throw new Error('本地协议缺少' + name);
    const result = await client.request(name, {}, response);
    check();
    return result;
  };
  const cargoLevel = rows(config, 'CargoUnlockCfg').find(row => row.index === 1)?.playerLevel;
  if (!Number.isSafeInteger(cargoLevel) || cargoLevel < 1) throw new Error('无法确认贸易港开放条件');
  const [water, inventory, schedule, ships] = await Promise.all([
    get('OnWaterRequest'), get('AllItemRequest'), get('WeekInfoRequest'),
    player.level >= cargoLevel ? get('CargoShipsRequest') : { ship: [] },
  ]);
  const stock = new Map();
  for (const item of list(inventory?.items, '库存')) {
    if (typeof item?.itemId !== 'string' || !item.itemId || stock.has(item.itemId)) throw new Error('库存道具记录异常');
    stock.set(item.itemId, amount(item.num, '道具库存'));
  }
  check();
  confirmOrderMaterialSpends(player, stock);
  const reservations = { weekly: new Map(), cargo: new Map(), resident: new Map() };
  const add = (target, id, n) => target.set(id, amount((target.get(id) ?? 0) + n, '预留数量'));
  const times = list(schedule?.activityTime, '周活动时间');
  const time = now(client);
  for (const activity of times) {
    if (!Number.isSafeInteger(activity?.type) || !Number.isSafeInteger(activity.startTime)
      || !Number.isSafeInteger(activity.endTime) || activity.endTime <= activity.startTime
      || !Number.isSafeInteger(activity.period) || activity.period < 1) throw new Error('无法确认周订单活动时间');
  }
  const active = times.filter(row => row.startTime <= time && row.endTime > time);
  if (active.filter(row => row.type === 5).length > 1) throw new Error('周订单活动记录不唯一');
  if (active.some(row => row.type === 5)) {
    if (!protocol.WeekOrderInfoRequest || !protocol.WeekOrderInfoResponse) throw new Error('本地协议缺少周订单查询');
    check();
    const week = await readWeekOrder(client, active, config);
    check();
    if (!week.finished) reservations.weekly = week.needed;
  }
  const residentSlots = new Set();
  for (const order of list(water?.workerOrder, '居民订单')) {
    const slot = amount(order?.index, '居民订单槽位');
    if (residentSlots.has(slot)) throw new Error('居民订单槽位重复，无法确认材料预留');
    residentSlots.add(slot);
    const refreshing = amount(order.refreshTime ?? 0, '居民订单刷新状态');
    // v74 leaves the previous requirements in a refreshing slot. The marker
    // stays authoritative even after its timestamp passes, until a new order
    // arrives (same rule as world.mjs), so never reserve that stale demand.
    if (refreshing > 0) continue;
    const requirements = list(order.requirements, '居民订单材料');
    if (!requirements.length) {
      // An unassigned slot has no demand. A named/special order whose demand
      // disappeared is incomplete, so fail closed rather than spend its stock.
      if (amount(order.workerId ?? 0, '居民身份') || amount(order.textId ?? 0, '居民订单编号') || order.isSpecial) {
        throw new Error('活跃居民订单材料清单不完整');
      }
      continue;
    }
    const needs = assets(requirements, '居民订单材料');
    for (const [id, n] of needs) add(reservations.resident, id, n);
  }
  for (const ship of list(ships?.ship, '贸易港订单')) {
    if (![0, 1, 2].includes(ship?.status)) throw new Error('无法确认贸易港状态');
    if (ship.status !== 0) continue;
    for (const slot of list(ship.orderItem, '贸易港装货清单')) {
      if (typeof slot?.filled !== 'boolean') throw new Error('无法确认贸易港装货状态');
      if (slot.filled) continue;
      for (const [id, n] of assets([slot.asset], '贸易港材料')) add(reservations.cargo, id, n);
    }
  }
  const reserved = new Map();
  for (const entries of Object.values(reservations)) {
    for (const [id, count] of entries) add(reserved, id, count);
  }
  const available = new Map();
  for (const id of new Set([...stock.keys(), ...reserved.keys()])) {
    available.set(id, Math.max(0, (stock.get(id) ?? 0) - (reserved.get(id) ?? 0)));
  }
  check();
  return { stock, reservations, reserved, available };
}
