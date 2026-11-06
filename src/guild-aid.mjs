import { displayMaterial } from './config.mjs';
import { toNumber } from './client.mjs';
import { uidText } from './hero-equipment.mjs';
import { beginOrderMaterialSpend, cancelOrderMaterialSpend, readOrderReservedStock } from './order-reservations.mjs';

const key = 'guildAidHelp';
const label = '联盟互助';
export const maxAidHelpsPerRound = 1;
const busy = new WeakSet();

// 只用预留之外的余量。每轮只响应一次，下一轮读到库存已扣减后才继续，结果不明时不会重复消耗。
export function planGuildAid(asks, available, me, now, limit = maxAidHelpsPerRound) {
  const left = new Map(available);
  const picked = [];
  const sorted = [...asks].sort((a, b) => a.endTime - b.endTime);
  for (const ask of sorted) {
    if (picked.length >= limit) break;
    if (!ask?.reqItemId || !(ask.endTime >= now) || uidText(ask.asker?.playerId) === me) continue;
    const count = left.get(ask.reqItemId) ?? 0;
    if (count < 1) continue;
    left.set(ask.reqItemId, count - 1);
    picked.push(ask);
  }
  return picked;
}

export async function serviceGuildAid(client, protocol, config, { player, enabled = () => false, report = () => {}, scheduler } = {}) {
  const finish = entry => { const result = { key, label, ...entry }; report(result); return result; };
  const skip = reason => finish({ skipped: true, reason });
  const later = seconds => scheduler?.defer(key, scheduler.now() + seconds);
  if (!enabled()) return skip('已暂停');
  if (!(toNumber(player?.guildId) > 0)) { later(1800); return skip('当前账号未加入联盟'); }
  if (busy.has(client)) return skip('正在核对联盟互助');
  busy.add(client);
  try {
    const list = await client.request('GuildAidListRequest', { type: 0 }, 'GuildAidListResponse');
    if (!Array.isArray(list?.askItems)) throw new Error('服务器未返回联盟求助列表');
    if (!list.askItems.length) { later(300); return skip('当前没有成员求助'); }
    const { stock, available } = await readOrderReservedStock(client, protocol, config, { player, enabled });
    if (!enabled()) return skip('账号已暂停或连接已更换');
    const now = Math.floor((Date.now() + (client.serverClockOffsetMs || 0)) / 1000);
    const picked = planGuildAid(list.askItems, available, uidText(player.playerId), now);
    if (!picked.length) { later(300); return skip('留足周订单、贸易港和居民订单后，没有可用于互助的材料'); }
    const counts = new Map();
    for (const ask of picked) counts.set(ask.reqItemId, (counts.get(ask.reqItemId) ?? 0) + 1);
    const debit = beginOrderMaterialSpend(player, [...counts].map(([id, need]) => ({ id, need, have: stock.get(id) ?? 0 })), label);
    let reply;
    try {
      reply = await client.request('GuildAidHelpRequest', { reqId: picked.map(ask => ask.reqId) }, ['GotRewardResponse', 'OkResponse']);
    } catch (error) {
      if (error.prompt && error.request === 'GuildAidHelpRequest') cancelOrderMaterialSpend(debit);
      later(300);
      return finish({ ok: false, error: error.message });
    }
    later(60);
    const used = [...counts].map(([id, count]) => displayMaterial(config, id) + ' ×' + count).join('、');
    const rewards = (reply?.reward?.asset ?? []).map(item => displayMaterial(config, item.id) + ' ×' + toNumber(item.num)).join('、');
    return finish({ ok: true, label: label + ' · 响应 ' + picked.length + ' 次，用去 ' + used + (rewards ? '，获得 ' + rewards : '') });
  } catch (error) {
    later(300);
    if (!enabled()) return skip('账号已暂停或连接已更换');
    if (error.code === 'ORDER_MATERIAL_SPEND_PENDING') return skip(error.message);
    if (client.promptNames?.[error.prompt?.prompt] === 'NO_GUILD') { later(1800); return skip('当前账号未加入联盟'); }
    return finish({ ok: false, error: error.message });
  } finally {
    busy.delete(client);
  }
}
