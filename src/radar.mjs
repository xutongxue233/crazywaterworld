import { uidText } from './hero-equipment.mjs';
import { describeLogError } from './log-errors.mjs';
import { registerFleetReservations, isFleetReserved, hasOtherFleetReservations } from './fleet-reservations.mjs';

export const radarFuelReserve = 10_000;
const sessions = new WeakMap();
const rows = (config, table) => config?.tables?.[table]?.data ?? [];
const safe = value => {
  if (typeof value === 'object' && value !== null && Number.isInteger(value.low) && Number.isInteger(value.high)) {
    value = Number((BigInt(value.high) << 32n) + BigInt(value.low >>> 0));
  }
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
};
const wireUid = id => ({ low: Number(BigInt.asIntN(32, BigInt(id))), high: Number(BigInt(id) >> 32n), unsigned: false });
const clock = client => Math.floor((Date.now() + (client.serverClockOffsetMs || 0)) / 1000);
const read = (client, name, body = {}) => client.request(name + 'Request', body, name + 'Response');

function stateFor(client) {
  if (!sessions.has(client)) {
    const session = { busy: false, events: new Map(), fleets: new Map(), claims: new Set(), reserves: [] };
    sessions.set(client, session);
    registerFleetReservations(client, 'radar', id => session.fleets.has(id),
      () => session.fleets.size > 0 || session.reserves.length > 0,
      snapshot => settle(session, { ...snapshot, fleets: snapshot.fleets.map(normalizeFleet) }));
  }
  return sessions.get(client);
}

function eventList(info) {
  if (!info || !Array.isArray(info.events)) throw new Error('未能读取完整的联盟情报列表');
  const result = info.events.map(raw => ({ ...raw, fixed: false, key: uidText(raw.uid) }));
  if (info.fixedEvent?.eventId > 0) {
    const raw = info.fixedEvent;
    result.push({ ...raw, fixed: true, key: `fixed:${raw.eventId}:${raw.createTime ?? 0}` });
  }
  const keys = new Set();
  for (const event of result) {
    if (!event.key || keys.has(event.key) || !Number.isSafeInteger(event.eventId) || event.eventId <= 0
      || ![1, 2, 3, 4].includes(event.state)) throw new Error('联盟情报编号或状态异常，暂停操作');
    keys.add(event.key);
  }
  return result;
}

export function freeFleet(fleet) {
  return /^\d+远征船$/.test(fleet?.buildingId ?? '') && fleet.state === 1 && !fleet.repairing
    && !fleet.autoFight?.isOn && safe(fleet.treasureLootUid) === 0 && !fleet.chipWar
    && !(fleet.curGridIdx > 0) && !(fleet.targetGridIdx > 0) && !(fleet.targetCityId > 0)
    && safe(fleet.durability) !== null && safe(fleet.maxDura) > 0 && fleet.durability <= fleet.maxDura;
}

export function normalizeFleet(fleet) {
  return { ...fleet, durability: safe(fleet.durability), maxDura: safe(fleet.maxDura),
    treasureLootUid: safe(fleet.treasureLootUid ?? 0) };
}

async function fleetStock(client) {
  // Sequential reads avoid attributing an untagged PromptResponse to another query.
  const rawFleets = (await read(client, 'MyFleets'))?.fleets;
  const items = (await read(client, 'AllItem'))?.items;
  if (!Array.isArray(rawFleets) || !Array.isArray(items)) throw new Error('未能读取舰队和库存，暂停情报操作');
  // Current WorldFleet encodes durability/maxDura/treasureLootUid as int32;
  // normalize numeric values here so later comparisons cannot coerce objects.
  const fleets = rawFleets.map(normalizeFleet);
  const ids = new Set();
  for (const fleet of fleets) {
    if (!fleet.buildingId || ids.has(fleet.buildingId)) throw new Error('舰队列表存在重复或缺失编号');
    ids.add(fleet.buildingId);
  }
  const stock = new Map();
  for (const item of items) {
    if (!item.itemId || stock.has(item.itemId) || safe(item.num) === null) throw new Error('库存数量无法确认，暂停情报操作');
    stock.set(item.itemId, safe(item.num));
  }
  return { fleets, stock, fuel: stock.get('汽油') ?? 0 };
}

function settle(session, snapshot, events = []) {
  // A lost response keeps its fleet reserved until the server shows the trip
  // progressing and returning. Merely seeing an idle fleet is not confirmation.
  for (const [id, pending] of session.fleets) {
    const fleet = snapshot.fleets.find(f => f.buildingId === id);
    if (!fleet) continue;
    if (pending.kind === 'repair') {
      if (fleet.repairing || fleet.state === 4) pending.seen = true;
      if (freeFleet(fleet) && fleet.durability >= pending.target) session.fleets.delete(id);
    } else {
      if (!freeFleet(fleet)) pending.seen = true;
      const event = events.find(e => e.key === pending.event);
      if (freeFleet(fleet) && (pending.seen || event?.state === 4)) session.fleets.delete(id);
    }
  }
  session.reserves = session.reserves.filter(r => snapshot.fuel > r.before - r.cost);
}

function eventPlan(event, config, season, stock) {
  const cfg = rows(config, event.fixed ? 'RadarFixedEventCfg' : 'RadarRandEventCfg').find(r => r.eventId === event.eventId);
  if (!cfg) return null;
  const name = String(cfg.eventName || '情报事件').replace(/\{(\d+)\}/g, (_, index) => cfg.eventNameParams?.[index] ?? '');
  let power = 0;
  const costs = new Map();
  if (event.fixed) power = safe(cfg.power);
  else if (cfg.type === '击退海盗') {
    const pirate = event.pirate;
    const matches = rows(config, 'WorldPirateCfg').filter(r => Number(r.season) === season && r.type === pirate?.type && r.level === pirate?.level);
    power = matches.length === 1 ? safe(matches[0].power) : null;
    if (safe(cfg.param1) !== pirate?.type) return null;
  } else if (!['收集资源', '救助海兽', '打捞宝箱'].includes(cfg.type)) return null;
  // Donation events must join the shared production/order reservation system
  // before they can spend goods. The first version only spends fleet fuel.
  if (event.refugee) return null;
  // Missing combat data must never turn a fight into a zero-power errand.
  if (power === null || ((event.fixed || cfg.type === '击退海盗') && power <= 0)) return null;
  const fuel = rows(config, 'WorldParamCfg').find(r => r.paramName === '情报事件消耗汽油')?.paramValue;
  if (safe(fuel) === null || fuel <= 0) return null;
  costs.set('汽油', (costs.get('汽油') ?? 0) + fuel);
  for (const [id, n] of costs) if (!Number.isSafeInteger(n) || (stock.get(id) ?? 0) < n + (id === '汽油' ? radarFuelReserve : 0)) return null;
  return { name, power: Math.ceil(power * 1.2), costs };
}

/** Two opt-in tasks. No purchase, map occupation, declaration or auto-fight takeover. */
export async function serviceRadar(client, protocol, config, {
  player, enabled = () => false, report = () => {}, scheduler,
} = {}) {
  const entries = [];
  const emit = entry => { entries.push(entry); report(entry); };
  const active = Object.fromEntries(['radarAuto', 'radarRepair'].map(key => [key, enabled(key) && (!scheduler || scheduler.due(key))]));
  if (!Object.values(active).some(Boolean)) return entries;
  const session = stateFor(client);
  if (session.busy) return entries;
  const initialGuild = uidText(player?.guildId);
  const initialPlayer = uidText(player?.playerId);
  const world = safe(player?.worldId);
  const sameAccount = () => uidText(player?.guildId) === initialGuild && uidText(player?.playerId) === initialPlayer && safe(player?.worldId) === world;
  const allowed = key => active[key] && enabled(key) && sameAccount();
  const defer = seconds => {
    for (const key of Object.keys(active).filter(k => active[k])) scheduler?.defer(key, (scheduler.now?.() ?? clock(client)) + seconds);
  };
  const skip = (key, reason) => emit({ key, label: key === 'radarRepair' ? '舰队维修' : '联盟情报', skipped: true, reason });
  const failed = (key, label, error) => emit({ key, label, ok: false, error: describeLogError(error.message).message });
  const otherPending = () => {
    if (!hasOtherFleetReservations(client, 'radar')) return false;
    for (const key of Object.keys(active).filter(k => allowed(k))) skip(key, '其他玩法出征尚待确认，等待舰队和汽油同步');
    defer(60);
    return true;
  };
  session.busy = true;
  try {
    const level = rows(config, 'ModuleOpenCfg').find(r => r.moduleId === '联盟情报')?.playerLevel;
    if (!Number.isSafeInteger(level) || !Number.isSafeInteger(player?.level) || player.level < level || !initialGuild || !initialPlayer) {
      for (const key of Object.keys(active).filter(k => active[k])) skip(key, !initialGuild ? '当前账号未加入联盟或联盟身份未确认' : `联盟情报需要角色 ${level || '指定'} 级及完整账号信息`);
      defer(300); return entries;
    }
    for (const name of ['GuildInfoRequest', 'GuildInfoResponse', 'MyFleetsRequest', 'MyFleetsResponse', 'AllItemRequest', 'AllItemResponse',
      ...(active.radarAuto ? ['RadarInfoRequest', 'RadarInfoResponse', 'RadarGetAllRewardsRequest', 'RadarSendFleetsRequest'] : []),
      ...(active.radarRepair ? ['FleetRepairParamRequest', 'FleetRepairParamResponse', 'RepairFleetRequest'] : [])]) {
      if (!protocol?.[name]) throw new Error('当前协议缺少联盟情报或维修接口');
    }
    const guild = (await read(client, 'GuildInfo'))?.guild;
    if (uidText(guild?.guildId) !== initialGuild || !sameAccount()) throw new Error('联盟或账号信息已变化，暂停情报操作');
    let events = active.radarAuto ? eventList((await read(client, 'RadarInfo'))?.radarInfo) : [];
    let snapshot = await fleetStock(client);
    settle(session, snapshot, events);
    let budget = new Map(snapshot.stock);
    const reconcileBudget = fresh => {
      for (const id of new Set([...budget.keys(), ...fresh.stock.keys()])) budget.set(id, Math.min(budget.get(id) ?? 0, fresh.stock.get(id) ?? 0));
    };
    budget.set('汽油', Math.max(0, snapshot.fuel - session.reserves.reduce((sum, r) => sum + r.cost, 0)));

    // Claim once per observed event, then confirm disappearance/state transition.
    const claimable = events.filter(e => e.state === 4);
    if (allowed('radarAuto') && claimable.length) {
      const fresh = eventList((await read(client, 'RadarInfo'))?.radarInfo);
      const ready = fresh.filter(e => e.state === 4);
      if (ready.length && ready.every(e => !session.claims.has(e.key)) && allowed('radarAuto')) {
        ready.forEach(e => session.claims.add(e.key));
        try {
          await client.sendWatch('RadarGetAllRewardsRequest', {}, { window: 500 });
          events = eventList((await read(client, 'RadarInfo'))?.radarInfo);
          if (ready.some(e => events.some(now => now.key === e.key && now.state === 4))) throw new Error('服务端未确认情报领奖，已暂停重复领取这批事件');
          emit({ key: 'radarAuto', label: `联盟情报 · 已确认领取 ${ready.length} 项事件奖励`, ok: true });
        } catch (error) {
          // An explicit refusal permits a future retry; an unknown outcome does not.
          if (error.prompt) ready.forEach(e => session.claims.delete(e.key));
          failed('radarAuto', '联盟情报领奖', error);
          defer(180); return entries;
        }
      } else if (ready.length) skip('radarAuto', '上一批情报领奖结果尚待确认，暂不重复领取');
    }

    // Claiming is free. Any unresolved fleet operation may still debit fuel,
    // including one using a different ship, so wait before all fuel spending.
    if (otherPending()) return entries;
    const used = new Set();
    const season = world === null ? 0 : Math.floor(world / 1e6) % 1000;
    if (allowed('radarAuto') && (!season || !rows(config, 'WorldPirateCfg').some(r => Number(r.season) === season))) {
      skip('radarAuto', '无法确认当前赛季的敌方配置，暂不派舰');
    } else if (allowed('radarAuto')) {
      const targets = events.filter(e => e.state === 1 && !(e.startTime > 0))
        .sort((a, b) => Number(b.fixed) - Number(a.fixed) || (b.color ?? 0) - (a.color ?? 0));
      for (const target of targets) {
        if (!allowed('radarAuto')) break;
        const attempt = session.events.get(target.key);
        if (attempt && (!attempt.retryAt || attempt.retryAt > clock(client))) continue;
        events = eventList((await read(client, 'RadarInfo'))?.radarInfo);
        snapshot = await fleetStock(client);
        settle(session, snapshot, events);
        reconcileBudget(snapshot);
        const current = events.find(e => e.key === target.key && e.state === 1 && !(e.startTime > 0));
        const plan = current && eventPlan(current, config, season, budget);
        if (!plan) continue;
        const fleet = snapshot.fleets.filter(f => freeFleet(f) && !used.has(f.buildingId) && !isFleetReserved(client, f.buildingId)
          && f.durability >= f.maxDura * 0.8 && safe(f.power) !== null && safe(f.power) >= plan.power)
          .sort((a, b) => safe(b.power) - safe(a.power))[0];
        if (otherPending()) return entries;
        if (!fleet || !allowed('radarAuto')) continue;
        const id = fleet.buildingId;
        const cost = plan.costs.get('汽油');
        const pending = { kind: 'dispatch', event: current.key, seen: false };
        session.events.set(current.key, {});
        session.fleets.set(id, pending);
        const reserve = { before: budget.get('汽油'), cost };
        session.reserves.push(reserve);
        used.add(id);
        for (const [material, amount] of plan.costs) budget.set(material, budget.get(material) - amount);
        try {
          const body = { fleetBuildingIds: [id], ...(current.fixed ? {} : { uid: wireUid(current.key) }) };
          await client.sendWatch('RadarSendFleetsRequest', body, { window: 500 });
          const after = eventList((await read(client, 'RadarInfo'))?.radarInfo);
          const changed = after.find(e => e.key === current.key);
          snapshot = await fleetStock(client);
          settle(session, snapshot, after);
          if (!changed || !(changed.state === 3 || changed.state === 4 || changed.startTime > 0)) throw new Error('服务端未确认情报出征，已保留这支舰队，等待状态更新');
          emit({ key: 'radarAuto', label: `联盟情报 · ${id} 已出征「${plan.name}」，汽油 ${cost}`, ok: true });
        } catch (error) {
          if (error.prompt) {
            session.events.set(current.key, { retryAt: clock(client) + 180 });
            session.fleets.delete(id);
            session.reserves = session.reserves.filter(r => r !== reserve);
          }
          failed('radarAuto', `联盟情报 · ${id} 出征`, error);
          // A late untagged rejection could otherwise be assigned to a new write.
          defer(180); return entries;
        }
      }
      if (!entries.some(e => e.key === 'radarAuto')) skip('radarAuto', '当前没有可领取或可安全出征的情报（检查舰队、耐久、战力、材料和汽油保留额）');
    }

    if (allowed('radarRepair')) {
      snapshot = await fleetStock(client);
      settle(session, snapshot, events);
      for (const initial of snapshot.fleets) {
        if (!allowed('radarRepair')) break;
        if (!freeFleet(initial) || initial.durability >= initial.maxDura * 0.8 || used.has(initial.buildingId) || isFleetReserved(client, initial.buildingId)) continue;
        const param = await read(client, 'FleetRepairParam', { buildingId: initial.buildingId });
        snapshot = await fleetStock(client);
        reconcileBudget(snapshot);
        const fleet = snapshot.fleets.find(f => f.buildingId === initial.buildingId);
        if (!freeFleet(fleet) || fleet.durability >= fleet.maxDura * 0.8 || isFleetReserved(client, fleet.buildingId)) continue;
        if (!(Number.isFinite(param?.unitRepairCost) && param.unitRepairCost > 0 && Number.isFinite(param.unitRepairTime) && param.unitRepairTime > 0)) {
          skip('radarRepair', `${initial.buildingId} 缺少可靠的维修费用和时长`); continue;
        }
        const cost = Math.ceil((fleet.maxDura - fleet.durability) * param.unitRepairCost);
        if (!Number.isSafeInteger(cost) || cost <= 0 || (budget.get('汽油') ?? 0) - cost < radarFuelReserve) {
          skip('radarRepair', `${fleet.buildingId} 修满需要 ${cost} 汽油，需另保留 ${radarFuelReserve} 汽油`); continue;
        }
        if (otherPending()) return entries;
        if (!allowed('radarRepair')) break;
        const reserve = { before: budget.get('汽油'), cost };
        session.reserves.push(reserve);
        session.fleets.set(fleet.buildingId, { kind: 'repair', target: fleet.maxDura, seen: false });
        budget.set('汽油', budget.get('汽油') - cost);
        try {
          await client.sendWatch('RepairFleetRequest', { buildingId: fleet.buildingId }, { window: 500 });
          snapshot = await fleetStock(client);
          settle(session, snapshot, events);
          const after = snapshot.fleets.find(f => f.buildingId === fleet.buildingId);
          if (!(after?.state === 4 && after.repairing?.endDura >= fleet.maxDura && after.repairing?.endTs > clock(client))
            && !(safe(after?.durability) >= fleet.maxDura)) throw new Error('服务端未确认舰队维修，已暂停重复维修这支舰队');
          emit({ key: 'radarRepair', label: `舰队维修 · ${fleet.buildingId} 已开始修满，汽油 ${cost}`, ok: true });
        } catch (error) {
          if (error.prompt) { session.fleets.delete(fleet.buildingId); session.reserves = session.reserves.filter(r => r !== reserve); }
          failed('radarRepair', `舰队维修 · ${fleet.buildingId}`, error);
          defer(180); return entries;
        }
      }
      if (!entries.some(e => e.key === 'radarRepair')) skip('radarRepair', '没有可维修的空闲舰队（仅修理耐久低于 80% 的舰队）');
    }
    defer(60);
  } catch (error) {
    failed(active.radarAuto ? 'radarAuto' : 'radarRepair', '联盟情报与舰队维修', error);
    defer(180);
  } finally { session.busy = false; }
  return entries;
}
