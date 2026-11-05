import { readWeekOrder } from './activities.mjs';
import { displayMaterial } from './config.mjs';
import { normalize } from './worlds.mjs';
import { SPEED_UP_ITEM, SPEED_UP_ITEM_TYPE } from './world.mjs';

export async function serviceCargo(client, config, { enabled, log, testSpeedUp = false, getSettings, ledger, beforeAction, afterAction, dryRun = false }) {
  const ships = async () => normalize(await client.request('CargoShipsRequest', {})).ship ?? [];
  const initial = await ships();
  let available;
  let speedUsed = false;
  let plannedLoads = 0;
  for (const ship of initial) {
    if (!enabled()) break;
    const index = ship.index;
    const label = '贸易港 ' + index + ' 号船';
    let state = ship;
    if ((state.status ?? 0) === 0) {
      const pref = getSettings?.();
      const used = (ledger?.snapshot().counters?.cargoLoads ?? 0) + plannedLoads;
      if (pref?.cargo.dailyLoadLimit > 0 && used >= pref.cargo.dailyLoadLimit) {
        log(label + '今日装货已达上限 ' + pref.cargo.dailyLoadLimit, { skipped: true, reason: '达到每日装货上限' });
        continue;
      }
      if (!available) {
        const [inventory, order] = await Promise.all([
          client.request('AllItemRequest', {}).then(normalize), readWeekOrder(client, undefined, config),
        ]);
        available = new Map((inventory.items ?? []).map(item => [item.itemId, Number(item.num)]));
        if (!order.finished) for (const [id, num] of order.needed) available.set(id, (available.get(id) ?? 0) - num);
      }
      const slots = [], labels = [];
      for (const [i, slot] of (state.orderItem ?? []).entries()) {
        const { id, num } = slot.asset ?? {};
        if (slot.filled || !(num > 0) || (available.get(id) ?? 0) < num) continue;
        slots.push(i + 1);
        labels.push(displayMaterial(config, id) + ' ×' + num);
        available.set(id, available.get(id) - num);
      }
      if (slots.length && enabled()) {
        const action = { kind: 'cargoLoad', scope: 'base', setting: 'cargo.enabled', body: { shipIndex: index, cargoIndex: slots },
          costs: slots.map(slot => ({ id: state.orderItem[slot - 1].asset.id, num: Number(state.orderItem[slot - 1].asset.num) })), counters: { cargoLoads: 1 }, label: label + '装货' };
        if (dryRun) { plannedLoads++; log(action.label + '：' + labels.join('、'), { planned: true, action: { ...action, label: action.label + '：' + labels.join('、') } }); continue; }
        const ticket = await beforeAction?.(action);
        const reply = await client.request('FillCargoShipRequest', action.body);
        state = (await ships()).find(s => s.index === index);
        if (pref && (!state || ((state.status ?? 0) === 0 && slots.some(slot => !state.orderItem?.[slot - 1]?.filled)))) throw new Error('服务器尚未确认本批装货，额度暂时保留');
        await afterAction?.(action, ticket, { ok: true, body: reply });
        log(label + '交货：' + labels.join('、'));
      }
    }
    if (state?.status === 1 && testSpeedUp && !speedUsed && enabled()) {
      const stock = normalize(await client.request('AllItemRequest', {})).items ?? [];
      if (stock.some(item => item.itemId === SPEED_UP_ITEM && item.num > 0) &&
          state.arriveTime > (Date.now() + (client.serverClockOffsetMs || 0)) / 1000 && enabled()) {
        speedUsed = true;
        const action = { kind: 'cargoSpeed', scope: 'base', setting: 'cargo.enabled', costs: [{ id: SPEED_UP_ITEM, num: 1 }], label: label + '加速' };
        if (dryRun) { log(action.label, { planned: true, action }); continue; }
        const ticket = await beforeAction?.(action);
        await client.sendWatch('SpeedUpShipRequest', { index, speedUp: { type: SPEED_UP_ITEM_TYPE, useNum: 1 } });
        state = (await ships()).find(s => s.index === index);
        log(label + '测试加速 1 次，' + (state?.status === 2 ? '已到港' : '当前仍在运输'));
        await afterAction?.(action, ticket, { ok: true, sent: true });
      }
    }
    if (state?.status === 2 && enabled()) {
      if (dryRun) { log(label + '收货', { planned: true, action: { kind: 'cargoReward', label: label + '领取到港货物', costs: [] } }); continue; }
      const result = normalize(await client.request('DrawShipRewardRequest', { index }));
      const rewards = (result.reward?.asset ?? []).map(a => displayMaterial(config, a.id) + ' ×' + a.num);
      log(label + '已收货' + (rewards.length ? '：' + rewards.join('、') : ''));
    }
  }
}
