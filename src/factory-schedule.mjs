// A connection-local clock only. The loop owns all reads/writes and calls this
// scheduler at serial execution boundaries; push handlers never send requests.
import { normalize } from './worlds.mjs';
const MIN_CHECK_MS = 1000;
const positiveTime = value => Number.isSafeInteger(value) && value > 0;
const interval = value => Number.isFinite(Number(value)) ? Math.max(1, Math.min(300, Math.floor(Number(value)))) : 30;
const table = (config, name) => config?.tables?.[name]?.data ?? [];

export function nextFactoryCheck(buildings, {
  now = Date.now(), offset = 0, collect = true, produce = true, slots,
  checkEverySeconds = 30, progressed = true, eligible = () => true, produceEligible = () => true,
} = {}) {
  if (!collect && !produce) return Infinity;
  const fallback = now + interval(checkEverySeconds) * 1000;
  let deadline = Infinity, considered = false;
  for (const building of buildings ?? []) {
    const factory = building?.factory;
    if (!factory || !Number.isSafeInteger(building.level) || building.level < 1 || !eligible(building)) continue;
    considered = true;
    if (!Array.isArray(factory.factoryQ) || !Array.isArray(factory.finishedProducts)) { deadline = Math.min(deadline, fallback); continue; }
    const queue = factory.factoryQ;
    const finished = factory.finishedProducts.some(row => Number.isSafeInteger(row?.num) && row.num > 0);
    if (collect && finished) deadline = Math.min(deadline, progressed ? now + MIN_CHECK_MS : fallback);
    const times = queue.filter(job => positiveTime(job?.finishTime)).map(job => job.finishTime * 1000 - offset + 250);
    // Later waiting slots legitimately omit finishTime. A known active timer
    // is usable on its own; never invent a start time for the waiting slots.
    for (const time of times) deadline = Math.min(deadline, time > now ? time : progressed ? now + MIN_CHECK_MS : fallback);
    if (!times.length) deadline = Math.min(deadline, fallback);
    const canStart = produce && produceEligible(building) && !(building.buildStartTime > 0 || building.buildFinishTime > 0);
    if (canStart && (!Number.isSafeInteger(slots) || slots < 1 || queue.length < slots)) deadline = Math.min(deadline, fallback);
    // Existing native automation is never taken over here. A fallback check
    // still notices its expiry or a newly needed cooperative target.
    if (produce && produceEligible(building) && factory.autoProductId) deadline = Math.min(deadline, fallback);
  }
  if (!considered || !Number.isFinite(deadline)) deadline = fallback;
  return Math.max(now + MIN_CHECK_MS, deadline);
}

function signature(building) {
  building = normalize(building);
  return JSON.stringify([building?.buildingId, building?.level, building?.buildStartTime ?? 0, building?.buildFinishTime ?? 0,
    building?.factory ? [building.factory.autoProductId ?? '',
      building.factory.factoryQ?.map(job => [job.idx ?? 0, job.productId, job.finishTime ?? 0]),
      building.factory.finishedProducts?.map(row => [row.id, row.num])] : null]);
}

export function createFactorySchedule(client, {
  getSettings = () => null, isEnabled = () => true, getConfig = () => null,
  onWake = () => {}, now = Date.now,
} = {}) {
  let disposed = false, checkedOnce = false, checkedAt = now(), failed = false;
  let buildings = [], slots, progressed = false, version = 0, dirty = false, wakeAt = Infinity;
  let savedOffset = Number(client.serverClockOffsetMs) || 0;
  const signatures = new Map(), knownFactories = new Set();
  const preferences = () => getSettings()?.factory;
  const modes = () => {
    const settings = getSettings(), factory = settings?.factory;
    const common = !disposed && client.connected !== false && settings?.loop?.world !== false && factory?.enabled !== false;
    return { collect: common && factory?.gain !== false && !!isEnabled('collect'),
      produce: common && (factory?.produce !== false || factory?.cooperateNative === true) && !!isEnabled('startProduce') };
  };
  const active = () => { const mode = modes(); return mode.collect || mode.produce; };
  const typeOf = building => {
    const unlocked = table(getConfig(), 'BuildingUnlockCfg').find(row => row.buildingId === building?.buildingId);
    if (typeof unlocked?.buildingType === 'string' && unlocked.buildingType) return unlocked.buildingType;
    if (building?.type) return building.type;
    const config = getConfig(), types = [...new Set([...table(config, 'BuildingCfg').map(row => row.buildingType),
      ...table(config, 'BuildingProduceCfg').map(row => row.buildType)])].filter(type => typeof type === 'string' && type).sort((a,b) => b.length-a.length);
    return types.find(type => building?.buildingId?.endsWith(type));
  };
  const produceEligible = building => {
    const disabled = preferences()?.disabledTypes ?? [];
    return !disabled.includes(building?.buildingId) && !disabled.includes(typeOf(building));
  };
  const isFactory = building => {
    const recipes = table(getConfig(), 'BuildingProduceCfg');
    // Some snapshots contain empty nested messages on unrelated buildings.
    // With the config available, normal factories are identified by recipes.
    return recipes.length ? recipes.some(row => row.buildType === typeOf(building)) : !!building?.factory || knownFactories.has(building?.buildingId);
  };
  const eligible = building => isFactory(building) && (modes().collect || produceEligible(building));
  const relevant = building => {
    if (typeof building?.buildingId !== 'string' || !building.buildingId || !eligible(building)) return false;
    return isFactory(building);
  };
  const notify = () => { try { onWake(); } catch { /* A UI callback cannot break protocol delivery. */ } };
  const baseDeadline = () => {
    if (!checkedOnce) return checkedAt;
    if (failed) return checkedAt + interval(preferences()?.checkEverySeconds ?? 30) * 1000;
    const mode = modes();
    return nextFactoryCheck(buildings, { now: checkedAt, offset: Number(client.serverClockOffsetMs) || 0,
      ...mode, slots: slots ?? Number(table(getConfig(), 'BuildingProduceParamCfg').find(row => row.paramName === '制造位上限')?.paramValue),
      checkEverySeconds: preferences()?.checkEverySeconds ?? 30, progressed, eligible, produceEligible });
  };
  const nextAt = () => active() ? Math.min(baseDeadline(), wakeAt) : Infinity;
  const wake = (immediate = false) => {
    const next = immediate || !checkedOnce ? now() : Math.max(now(), checkedAt + MIN_CHECK_MS);
    const shouldNotify = !dirty || next < wakeAt;
    dirty = true; wakeAt = Math.min(wakeAt, next);
    if (shouldNotify) notify();
  };
  const onMessage = ({ name, body } = {}) => {
    if (disposed || name !== 'SCUpdateWaterBuilding' || !active() || !Array.isArray(body?.building)) return;
    let changed = false;
    for (const building of body.building) {
      if (!relevant(building)) continue;
      const next = signature(building);
      if (signatures.get(building.buildingId) === next) continue;
      signatures.set(building.buildingId, next); knownFactories.add(building.buildingId); changed = true;
    }
    if (changed) { version++; wake(); }
  };
  const onSettings = () => { if (!disposed) { version++; wake(true); } };
  const onPong = () => {
    if (disposed) return;
    const offset = Number(client.serverClockOffsetMs) || 0;
    if (offset !== savedOffset) { savedOffset = offset; if (active() && checkedOnce) notify(); }
  };
  client.on?.('message', onMessage); client.on?.('automationSettingsChanged', onSettings); client.on?.('pong', onPong);
  return {
    active, nextAt, due: () => active() && nextAt() <= now(),
    version: () => version, hasChecked: () => checkedOnce,
    checked(state, { version: readVersion = version, progressed: madeProgress = false, slots: observedSlots } = {}) {
      if (disposed) return;
      buildings = Array.isArray(state) ? structuredClone(state) : [];
      checkedAt = now(); checkedOnce = true; failed = false; progressed = !!madeProgress; slots = observedSlots;
      if (readVersion >= version) {
        dirty = false; wakeAt = Infinity; signatures.clear(); knownFactories.clear();
        for (const building of buildings) if (building?.factory && typeof building.buildingId === 'string' && isFactory(building)) {
          signatures.set(building.buildingId, signature(building)); knownFactories.add(building.buildingId);
        }
      } else {
        // Writes before the final read are consumed by its version; a newer
        // push received DURING that read must get another serial check.
        dirty = true; wakeAt = checkedAt + MIN_CHECK_MS;
      }
      savedOffset = Number(client.serverClockOffsetMs) || 0;
    },
    failed() {
      if (disposed) return;
      checkedAt = now(); checkedOnce = true; failed = true; dirty = false; wakeAt = Infinity;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      const remove = client.off?.bind(client) ?? client.removeListener?.bind(client);
      remove?.('message', onMessage); remove?.('automationSettingsChanged', onSettings); remove?.('pong', onPong);
      signatures.clear(); knownFactories.clear(); buildings = []; wakeAt = Infinity;
    },
  };
}
