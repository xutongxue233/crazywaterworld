import { normalize } from './worlds.mjs';
import { AutomationSkip, createActionGuard, resourceReserve, worldActionAllowed } from './automation-policy.mjs';
import { goldAccountKey } from './gold-reservations.mjs';
import { farmInventory } from './farm-planting.mjs';
import { pendingOrderMaterialSpends, settleOrderMaterialState } from './order-reservations.mjs';
import { factoryProductionSnapshot, factoryProductionOperation } from './spend-evidence.mjs';

const pending = new Map(), busy = new Set();
const resourceIds = new Set(['GOLD', 'RUBY', 'EXP', 'ARENA_POINT', 'LEAGUE_POINT']);
const rows = (config, name) => config?.tables?.[name]?.data ?? [];
const clock = client => Math.floor((Date.now() + (client.serverClockOffsetMs || 0)) / 1000);
const costsOf = steps => {
  const costs = new Map();
  for (const step of steps) for (const row of step.costs ?? []) {
    if (typeof row?.id !== 'string' || !row.id || resourceIds.has(row.id) || !Number.isSafeInteger(row.num) || row.num < 0) throw new AutomationSkip('批次生产只支持已确认的道具原料');
    const total = (costs.get(row.id) ?? 0) + row.num;
    if (!Number.isSafeInteger(total)) throw new AutomationSkip('批次生产消耗超出安全范围');
    if (total) costs.set(row.id, total);
  }
  return [...costs].map(([id, num]) => ({ id, num }));
};
const skipped = (step, error) => ({ step, ok: false, skipped: true, error });

async function settlePrevious(client, player, account, key, enabled) {
  const previous = pending.get(key);
  if (!previous) return false;
  const check = () => {
    if (!enabled() || client.connected === false || goldAccountKey(player) !== account) throw new AutomationSkip('操作已暂停、断开或账号已切换，保留排产记录');
  };
  check();
  if (!previous.operation.confirmed && !await previous.operation.verify(client)) throw new AutomationSkip('上次批次排产结果待确认，暂缓领取和重复排产');
  check(); previous.operation.confirmed = true;
  const handles = pendingOrderMaterialSpends(player).filter(handle => handle.operation === previous.operation);
  const stock = farmInventory(normalize(await client.request('AllItemRequest', {}, 'AllItemResponse')));
  check();
  if (handles.length) settleOrderMaterialState(player, { account: handles[0].account, handles }, stock);
  pending.delete(key);
  return true;
}

// Harvesting removes finished-product evidence. Resolve a previous uncertain
// production first, otherwise retain its products until a later readable round.
export async function confirmFactoryProductionBeforeHarvest(client, protocol, buildingId, { player, enabled = () => true } = {}) {
  if (!player) return false;
  const account = goldAccountKey(player), key = account + ':' + buildingId;
  if (!pending.has(key)) return false;
  if (busy.has(key)) throw new AutomationSkip('工厂正在核对排产，暂缓领取成品');
  for (const name of ['OnWaterRequest', 'OnWaterResponse', 'AllItemRequest', 'AllItemResponse']) if (!protocol[name]) throw new AutomationSkip('当前协议无法核对上次排产，暂缓领取成品');
  busy.add(key);
  try { return await settlePrevious(client, player, account, key, enabled); }
  catch (error) { throw error.code === 'AUTOMATION_SKIP' ? error : new AutomationSkip('上次排产尚未完整核对，暂缓领取成品：' + error.message); }
  finally { busy.delete(key); }
}

// The wire protocol accepts one product per request. Reserve a bounded batch,
// keep its writes serial, then reconcile it once against queue + finished stock.
export async function runFactoryProductionBatch(client, protocol, steps, {
  config, player, settings = null, getSettings, enabled = () => true,
  beforeStep, afterStep, cancelStep, window = 400, onStep, checkStep,
} = {}) {
  if (!Array.isArray(steps) || !steps.length) return { results: [] };
  const results = [], attemptedEntries = new Set(), current = () => getSettings?.() ?? settings;
  let account, lock, batch, batchStep, ticket, prepared = false, acquired = false, actionGuard;
  const publish = () => { for (const entry of results) onStep?.(entry); return { results }; };
  try {
    account = goldAccountKey(player);
    const buildingId = steps[0].body?.buildingId;
    if (typeof buildingId !== 'string' || !buildingId || steps.some(step => step.kind !== 'startProduce'
      || step.request !== 'StartFactoryProduceRequest' || step.body?.buildingId !== buildingId || typeof step.body.productId !== 'string' || !step.body.productId
      || Object.values(step.counters ?? {}).some(Boolean))) throw new AutomationSkip('批次必须属于同一工厂的普通排产');
    for (const name of ['StartFactoryProduceRequest', 'OnWaterRequest', 'OnWaterResponse', 'AllItemRequest', 'AllItemResponse']) if (!protocol[name]) throw new AutomationSkip('当前协议无法完整核对批次排产');
    lock = account + ':' + buildingId;
    if (busy.has(lock)) { for (const step of steps) results.push(skipped(step, '同一工厂正在处理排产')); return publish(); }
    busy.add(lock); acquired = true;
    const live = () => enabled('startProduce') && client.connected !== false && goldAccountKey(player) === account;
    const ensureLive = () => { if (!live()) throw new AutomationSkip('排产已暂停、断开或账号已切换'); };
    ensureLive();
    await settlePrevious(client, player, account, lock, live);
    const water = normalize(await client.request('OnWaterRequest', {}, 'OnWaterResponse'));
    ensureLive();
    const snapshot = factoryProductionSnapshot(water, buildingId);
    if (!snapshot) throw new AutomationSkip('无法完整确认工厂队列和待收成品');
    if (snapshot.building.buildStartTime > 0 || snapshot.building.buildFinishTime > 0) throw new AutomationSkip('工厂正在升级，等待重新排产');
    if (snapshot.building.factory.autoProductId && (water.autoProduceForever || water.autoProduceEndTime > clock(client))) throw new AutomationSkip('游戏自动生产已开启，保留原队列和目标');
    const slots = Number(rows(config, 'BuildingProduceParamCfg').find(row => row.paramName === '制造位上限')?.paramValue);
    if (!Number.isSafeInteger(slots) || slots < 1) throw new AutomationSkip('无法确认工厂制造位上限');
    const selected = steps.slice(0, Math.max(0, slots - snapshot.queue.length));
    if (!selected.length) throw new AutomationSkip('工厂生产格已满，等待下轮重新排产');
    const factorySettings = JSON.stringify(current()?.factory);
    const reserves = new Map(costsOf(selected).map(row => [row.id, resourceReserve(current(), row.id)]));
    const check = async step => {
      ensureLive();
      if (!worldActionAllowed(current(), step, config)) throw new AutomationSkip('普通排产已关闭或此工厂已禁用');
      if (JSON.stringify(current()?.factory) !== factorySettings) throw new AutomationSkip('工厂设置已变化，等待重新排产');
      if ([...reserves].some(([id, amount]) => resourceReserve(current(), id) > amount)) throw new AutomationSkip('材料保留量已提高，等待重新核对库存');
      const recipe = rows(config, 'BuildingProduceCfg').find(row => row.itemId === step.body.productId);
      if (!recipe || recipe.unlockLevel > snapshot.building.level || !buildingId.endsWith(recipe.buildType)) throw new AutomationSkip('工厂等级或配方条件已变化');
      const expected = costsOf([{ costs: (recipe.costItem ?? []).map(([id, num]) => ({ id, num: Number(num) })) }]);
      const actual = costsOf([step]);
      if (JSON.stringify([...expected].sort((a,b) => a.id.localeCompare(b.id))) !== JSON.stringify([...actual].sort((a,b) => a.id.localeCompare(b.id)))) throw new AutomationSkip('生产配方消耗已变化，等待重新排产');
      if (recipe.limitType || recipe.buildType === '活动工厂') {
        const now = clock(client);
        const open = Array.isArray(client.festivals) && client.festivals.some(event => event.festivalData?.limitTimeItem?.some(row => row.item === recipe.limitType
          && Number.isSafeInteger(row.openTime) && Number.isSafeInteger(row.closeTime) && row.openTime > 0 && row.openTime <= now && now <= row.closeTime));
        if (!open) throw new AutomationSkip('当前活动未开放此生产配方');
      }
      await checkStep?.(step);
      ensureLive();
      if (!worldActionAllowed(current(), step, config) || JSON.stringify(current()?.factory) !== factorySettings
        || [...reserves].some(([id, amount]) => resourceReserve(current(), id) > amount)) throw new AutomationSkip('生产设置已变化，等待重新核对');
    };
    for (const step of selected) await check(step);
    batch = { attempted: [], sealed: false };
    batch.operation = factoryProductionOperation(water, buildingId, batch);
    batchStep = { ...selected[0], costs: costsOf(selected), factoryBatch: batch, label: '工厂连续排产 ' + selected.length + ' 件' };
    actionGuard = beforeStep && afterStep && cancelStep ? { before: beforeStep, after: afterStep, cancel: cancelStep }
      : createActionGuard(client, current, null, { player, enabled: live });
    ticket = await actionGuard.before(batchStep, { waterSnapshot: water }); prepared = true;
    ensureLive();
    const stock = batch.checkedStock ?? farmInventory(normalize(await client.request('AllItemRequest', {}, 'AllItemResponse')));
    ensureLive();
    const baseCap = Number(rows(config, 'GameParamCfg').find(row => row.paramName === '产品存量初始上限')?.paramValue);
    const bonus = Number(rows(config, 'VipLevelCfg').find(row => row.level === player?.vip?.vipLevel)?.effects?.find(([id]) => id === '加工品存量上限')?.[1] ?? 0);
    const cap = baseCap + bonus;
    if (!Number.isSafeInteger(cap) || cap < 1) throw new AutomationSkip('无法确认加工品库存上限');
    const projected = new Map();
    for (const row of water.building ?? []) if (row.factory) {
      // A legal level-zero factory message may carry two empty repeated
      // fields. Its known zero stock must not block an unrelated built factory.
      if (row.level === 0 && Array.isArray(row.factory.factoryQ) && !row.factory.factoryQ.length
        && Array.isArray(row.factory.finishedProducts) && !row.factory.finishedProducts.length) continue;
      const other = factoryProductionSnapshot(water, row.buildingId);
      if (!other) throw new AutomationSkip('其他工厂的在产和待收库存不完整');
      for (const [id, count] of other.totals) projected.set(id, (projected.get(id) ?? 0) + count);
    }
    for (const step of selected) {
      const id = step.body.productId;
      projected.set(id, (projected.get(id) ?? 0) + 1);
      if ((stock.get(id) ?? 0) + projected.get(id) > cap) throw new AutomationSkip('库存、在产和待收合计将超过上限，等待重新排产');
      const preferences = current(), independent = preferences?.alliance?.enabled && (preferences.alliance.recruit && preferences.alliance.recruitProduction
        || preferences.guildShip?.enabled && preferences.guildShip.produceMissing);
      const stockOnly = step.demandDriven === false || step.demandDriven == null && preferences?.factory?.demandFirst === false && !independent;
      if (stockOnly && preferences && (stock.get(id) ?? 0) + projected.get(id) > preferences.factory.keepStock) throw new AutomationSkip('最新库存已达到备货水位，等待重新排产');
    }
    let stopped = '';
    for (const step of selected) {
      if (stopped) { results.push(skipped(step, stopped)); continue; }
      let attempted = false;
      try {
        await check(step);
        pending.set(lock, batch);
        batch.attempted.push({ body: { ...step.body }, costs: structuredClone(step.costs ?? []) }); attempted = true;
        const sent = await client.sendWatch(step.request, step.body, { window });
        const entry = { step, ok: false, status: 'unknown', sent, reason: '批次已发送，等待统一核对' };
        results.push(entry); attemptedEntries.add(entry);
      } catch (error) {
        const notSent = !attempted || error.notSent === true || error.prompt && error.request === step.request;
        if (attempted && notSent) batch.attempted.pop();
        const entry = { step, ok: false, ...(notSent ? { skipped: error.code === 'AUTOMATION_SKIP' } : { status: 'unknown' }), error: error.message, failureError: error };
        results.push(entry); if (attempted && !notSent) attemptedEntries.add(entry);
        stopped = '本批排产已停止，等待状态和设置重新核对';
      }
    }
    for (const step of steps.slice(selected.length)) results.push(skipped(step, '本次空闲生产格不足，等待下轮重新排产'));
    batch.sealed = true;
    if (!batch.attempted.length) {
      await actionGuard.cancel(batchStep, ticket, { notSent: true }); prepared = false; pending.delete(lock);
    } else {
      try {
        ensureLive();
        const confirmed = await batch.operation.verify(client);
        ensureLive();
        if (confirmed) {
          batch.operation.confirmed = true;
          const stock = farmInventory(normalize(await client.request('AllItemRequest', {}, 'AllItemResponse')));
          ensureLive(); batch.settledStock = stock;
        }
      } catch { /* Sent requests keep their immutable baseline across reconnect. */ }
      const outcome = { ok: false, sent: true, status: 'unknown' };
      await actionGuard.after(batchStep, ticket, outcome); prepared = false;
      if (batch.operation.confirmed && batch.settledStock && live()) {
        pending.delete(lock);
        for (const entry of attemptedEntries) {
          entry.ok = true; entry.status = 'confirmed'; entry.reason = '已统一核对队列、待收成品及库存'; delete entry.sent; delete entry.error; delete entry.failureError;
        }
      } else for (const entry of attemptedEntries) {
        entry.ok = false; entry.status = 'unknown'; entry.reason = '批次排产结果待确认，保留已发送部分，暂不重复提交';
      }
    }
  } catch (error) {
    if (batch) batch.sealed = true;
    if (prepared && !batch?.attempted.length) await actionGuard.cancel(batchStep, ticket, { notSent: true });
    if (batch?.attempted.length && prepared) {
      try { await actionGuard.after(batchStep, ticket, { ok: false, sent: true, status: 'unknown' }); } catch { /* Preserve shared pending evidence. */ }
    }
    for (const step of steps) if (!results.some(entry => entry.step === step)) results.push({ ...skipped(step, error.message), failureError: error });
  } finally { if (acquired) busy.delete(lock); }
  return publish();
}
