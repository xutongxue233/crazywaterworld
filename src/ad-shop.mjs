import { displayMaterial } from './config.mjs';
import { normalize } from './worlds.mjs';

// V74 domestic mini-game builds: use the SDK's app/channel pair as well as the
// live AdvChannelCfg switch. Unknown or overseas packages must not use this path.
const apps = new Map([['1400', '14021170'], ['1422', '14021167']]);
const task = 'adShop';
const title = '广告商店免广告领奖';
const inProgress = new WeakSet();

function versionAtLeast(version, minimum) {
  if (!minimum) return true;
  if (![version, minimum].every(v => typeof v === 'string' && /^\d+(\.\d+)*$/.test(v))) return false;
  const actual = version.split('.').map(Number), required = minimum.split('.').map(Number);
  for (let i = 0; i < Math.max(actual.length, required.length); i++) {
    const diff = (actual[i] ?? 0) - (required[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return true;
}

export function channelUnavailable(tables, player, clientInfo, language) {
  const channel = String(clientInfo?.channelId ?? '');
  if (!apps.has(channel) || String(clientInfo?.appId) !== apps.get(channel) || language !== 'zh_CN'
    || (player?.channelId && String(player.channelId) !== channel)
    || (player?.appId && String(player.appId) !== apps.get(channel))) return '暂未确认此客户端支持国内免广告领奖';
  const settings = tables?.AdvChannelCfg?.data?.find(r => String(r.key) === channel);
  if (settings?.isOpen !== true || !versionAtLeast(clientInfo.originVersion, settings.minAppVersion)) return '当前渠道或客户端版本未开放广告商店';
  const level = tables?.ModuleOpenCfg?.data?.find(r => r.moduleId === '广告')?.playerLevel;
  if (!Number.isSafeInteger(level) || !Number.isSafeInteger(player?.level)) return '未能确认广告商店开放等级';
  if (player.level < level) return '角色达到 ' + level + ' 级开放';
  return null;
}

export async function hasSkipPrivilege(client, tables, player) {
  const vip = tables?.VipLevelCfg?.data?.find(row => row.level === player?.vip?.vipLevel);
  if (vip?.effects?.some(([name, value]) => name === '免广告' && Number(value) > 0)) return true;
  const state = await client.request('FirstChargeRequest', {}, 'FirstChargeResponse');
  return Array.isArray(state?.firstCharge?.record) && state.firstCharge.record.length > 0;
}

async function readShop(client) {
  const state = normalize(await client.request('AdvShopInfoRequest', {}, 'AdvShopInfoResponse'));
  const products = new Map();
  for (const item of state.product ?? []) {
    if (!Number.isSafeInteger(item.id) || item.id <= 0 || products.has(item.id)
      || ![item.max, item.gotTimes].every(n => Number.isSafeInteger(n) && n >= 0)) throw new Error('广告商店商品或领取次数异常，稍后复查');
    products.set(item.id, item);
  }
  return products;
}

export async function claimAdShop(client, config, { player, clientInfo, language, enabled, schedule, report }) {
  if (!enabled() || !schedule.due(task) || inProgress.has(client)) return;
  inProgress.add(client);
  const todayEnds = schedule.nextDay();
  const allowed = () => enabled() && schedule.now() < todayEnds;
  const retryIn = seconds => schedule.defer(task, Math.min(todayEnds, schedule.now() + seconds));
  try {
    const reason = channelUnavailable(config?.tables, player, clientInfo, language);
    if (reason || !await hasSkipPrivilege(client, config?.tables, player)) {
      report({ label: title, skipped: true, reason: reason ?? '当前账号没有免广告权益' });
      retryIn(1800);
      return;
    }
    if (!allowed()) return;
    let shop = await readShop(client);
    const ids = [...shop.keys()];
    let failed = false;
    let received = false;
    for (const id of ids) {
      const initial = shop.get(id);
      if (!initial || initial.gotTimes >= initial.max) continue;
      try {
        for (let count = initial.gotTimes; count < initial.max; count++) {
          if (!allowed()) return;
          const item = shop.get(id);
          if (!item || item.gotTimes >= item.max) break;
          // AdvUtils.playAdv sends WatchAdv first even when the legitimate skip
          // privilege applies. The domestic skip branch needs a server reply.
          await client.request('WatchAdvRequest', { type: 2, id }, 'OkResponse');
          if (!allowed()) return;
          await client.sendWatch('GotAdvRewardRequest', { id });
          shop = await readShop(client);
          const after = shop.get(id);
          if (!after || after.gotTimes !== item.gotTimes + 1) throw new Error('服务端未确认领取次数增加');
          received = true;
          const reward = item.asset?.id ? displayMaterial(config, item.asset.id) + ' ×' + item.asset.num : '商品奖励';
          report({ label: title + ' · ' + reward + '（今日已领 ' + after.gotTimes + '/' + after.max + ' 次）', ok: true });
        }
      } catch (error) {
        failed = true;
        report({ label: title + ' · ' + (initial.asset?.id ? displayMaterial(config, initial.asset.id) : '商品'), ok: false, error: error.message });
        if (client.connected === false) break;
      }
    }
    if (!allowed()) return;
    if (failed || [...shop.values()].some(item => item.gotTimes < item.max)) retryIn(300);
    else {
      if (!received) report({ label: title, skipped: true, reason: '今天没有可领取的商品' });
      schedule.defer(task, todayEnds);
    }
  } catch (error) {
    report({ label: title, ok: false, error: error.message });
    retryIn(300);
  } finally {
    inProgress.delete(client);
  }
}
