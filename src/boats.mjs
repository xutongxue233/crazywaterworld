import { displayMaterial } from './config.mjs';
import { normalize } from './worlds.mjs';
import { makeTypeResolver } from './world.mjs';

const boats = [
  { name: '潜水船坞', type: '潜水船', level: 'divingLevel', table: 'DiveLevelCfg', command: 'Diving',
    enhance: 'diveEnhance', collect: 'autoDive', param: 'DiveParamCfg', unlock: '自动潜水', materials: ['海藻', '金属', '玻璃'] },
  { name: '拾荒船', type: '探险船', level: 'salvageLevel', table: 'SalvageLevelCfg', command: 'Salvage',
    enhance: 'salvageEnhance', collect: 'autoSalvage', param: 'SalvageParamCfg', unlock: '自动拾荒', materials: ['塑料', '木材', '碎布'] },
];
const floaters = { 塑料: '塑料垃圾1', 木材: '木材垃圾1', 碎布: '布垃圾1' };

async function enhance(client, boat, info, cfg, next, buildingCount, enabled, options = {}) {
  if (options.settings && info.level >= options.settings.gather.targetLevel) return { reason: '已达到设置的目标等级 ' + options.settings.gather.targetLevel };
  if (!next) return { reason: '已满级' };
  const promote = (info.enhance ?? 0) >= cfg.enhance;
  if (promote) {
    if (next.condition[0] !== boat.type || buildingCount < next.condition[1]) return { reason: '升至下一级需要建成 ' + next.condition[1] + ' 座' + boat.name };
  } else {
    const [currency, cost] = cfg.cost;
    if (currency !== 'GOLD' || !(cost > 0)) return { reason: '强化消耗不明' };
    const res = normalize(await client.request('AllResourceRequest', {}, 'AllResourceResponse'));
    if (!res.list?.some(item => item.res === 3 && item.amount >= cost)) return { reason: '金币不足，需要 ' + cost };
  }
  if (!enabled(boat.enhance)) return;
  const action = { kind: boat.enhance, scope: 'base', setting: boat.enhance === 'diveEnhance' ? 'gather.upgradeDiving' : 'gather.upgradeSalvage',
    request: boat.command + 'LevelUpRequest', response: 'SC' + boat.command + 'LevelUpdate', body: {},
    costs: promote ? [] : [{ id: 'GOLD', num: cfg.cost[1] }], label: boat.name + '养成' };
  if (options.dryRun) return { action: { ...action, label: boat.name + (promote ? '升级至 ' + next.level + ' 级' : '强化一次') } };
  const ticket = await options.beforeAction?.(action);
  if (!enabled(boat.enhance)) { await options.cancelAction?.(action, ticket, { notSent: true }); return { reason: '已暂停' }; }
  let reply;
  try { reply = await client.request(action.request, action.body, action.response); }
  catch (error) {
    if (error.notSent === true || error.prompt && error.request === action.request) {
      await options.cancelAction?.(action, ticket, { notSent: error.notSent === true, error });
    }
    throw error;
  }
  const after = reply.levelInfo;
  if (!(after?.level > info.level || (after?.level === info.level && after.enhance > (info.enhance ?? 0)))) {
    throw new Error('未确认强化进度增加');
  }
  await options.afterAction?.(action, ticket, { ok: true, body: reply });
  return '已' + (promote ? '升级' : '强化') + '，等级 ' + after.level + '，强化 ' + (after.enhance ?? 0);
}

async function gather(client, config, boat, cfg, capacity, enabled, options = {}) {
  const threshold = config.tables[boat.param]?.data.find(row => row.paramName === boat.unlock)?.paramValue;
  if (!threshold || cfg.level < threshold) return { reason: boat.unlock + '需要玩法等级 ' + (threshold || '未知') };
  const bag = normalize(await client.request('AllItemRequest', {}, 'AllItemResponse'));
  const stock = new Map((bag.items ?? []).map(row => [row.itemId, row.num]));
  const salvage = boat.collect === 'autoSalvage';
  let budget = salvage ? cfg.warehouse : cfg.reduceTime;
  const targets = [];
  for (const id of [...boat.materials].sort((a, b) => (stock.get(a) ?? 0) - (stock.get(b) ?? 0))) {
    const num = Math.min(budget, capacity - (stock.get(id) ?? 0));
    if (num > 0) { targets.push({ id, num }); budget -= num; }
  }
  if (!targets.length) return { reason: '原料没有可补空间' };
  if (!enabled(boat.collect)) return;
  if (options.dryRun) return { action: { kind: boat.collect, label: boat.name + '采集一次（按当前库存空位安排）', costs: [] } };
  let reward;
  if (salvage) {
    await client.sendWatch('BeginSalvageRequest', {});
    const pickedFloaters = enabled(boat.collect) ? targets.map(({ id, num }) => ({ floaterId: floaters[id], num })) : [];
    const reply = await client.request('EndSalvageRequest', { pickedFloaters }, 'EndSalvageResponse');
    reward = reply.rewards;
  } else {
    const asset = targets.map(row => ({ type: 0, ...row }));
    reward = (await client.request('DivingRequest', { reward: { asset } }, 'DivingResponse')).reward;
  }
  const items = normalize(reward)?.asset ?? [];
  return items.length ? '收获 ' + items.map(r => displayMaterial(config, r.id) + ' ×' + r.num).join('、') : '本次结算没有获得材料';
}

export async function serviceBoats(client, config, enabled, report, options = {}) {
  const water = await client.request('OnWaterRequest', {}, 'OnWaterResponse');
  const resolve = makeTypeResolver(config);
  const buildings = (water.building ?? []).filter(b => b.level > 0);
  const upgrades = config.tables.BuildingUpgradeCfg.data;
  const capacity = buildings.reduce((sum, b) => {
    const row = upgrades.find(r => r.buildingType === resolve(b.buildingId) && r.level === b.level);
    return sum + (row?.effect?.find(e => e[0] === '资源储量上限')?.[1] ?? 0);
  }, 0);
  for (const boat of boats) {
    const info = water[boat.level];
    const levels = config.tables[boat.table].data;
    const cfg = levels.find(r => r.level === info?.level);
    const count = buildings.filter(b => resolve(b.buildingId) === boat.type).length;
    for (const key of [boat.enhance, boat.collect]) {
      if (!enabled(key)) continue;
      const label = boat.name + (key === boat.enhance ? '养成' : '采集');
      try {
        const result = !count || !cfg ? { reason: '建筑或玩法尚未解锁' } : key === boat.enhance
          ? await enhance(client, boat, info, cfg, levels.find(r => r.level === info.level + 1), count, enabled, options)
          : await gather(client, config, boat, cfg, capacity, enabled, options);
        if (result?.reason) report({ key, label, skipped: true, reason: result.reason });
        else if (result?.action) report({ key, label, planned: true, action: result.action });
        else if (result) report({ key, label: label + ' · ' + result, ok: true });
      } catch (error) { report({ key, label, ok: false, ...(error.code === 'AUTOMATION_SKIP' ? { skipped: true, reason: error.message } : {}), error: error.message }); }
    }
  }
}
