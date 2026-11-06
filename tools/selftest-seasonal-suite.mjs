import { runLoop } from '../src/loop.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createUsageLedger,
  importAutomationSettings,
  exportAutomationSettings,
  validateSettings
} from '../src/automation-settings.mjs';
import {
  militaryRewards,
  riverActivity,
  compassActivity,
  beautyActivity,
  leadingCandidate
} from '../src/seasonal-activities.mjs';
import { merchantActivity, merchantProgress } from '../src/merchant-activity.mjs';
import { seasonalFixture } from './fixtures/seasonal-suite.mjs';

const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-activity-')),
  file = () => path.join(folder, Math.random() + '.json');
let passed = 0;
async function test(name, run) {
  await run();
  passed++;
  console.log('通过：' + name);
}
function setup() {
  const f = seasonalFixture(),
    store = file(),
    ledger = createUsageLedger('fixture', { file: store }),
    reports = [];
  let enabled = true;
  const run = (service, key) =>
    service(f.client, f.config, {
      player: f.player,
      clientInfo: { appId: '14021170', channelId: '1400', originVersion: '74.0.0' },
      language: 'zh_CN',
      key,
      label: key,
      ledger,
      settings: () => f.settings,
      enabled: () => enabled,
      report: (r) => reports.push(r)
    });
  return {
    ...f,
    ledger,
    store,
    reports,
    run,
    pause: () => {
      enabled = false;
    },
    sent: (n) => f.state.writes.filter((r) => r.name === n)
  };
}
await test('军备五档积分与专属免费格分别领取，商城普通包与付费格不进入', async () => {
  const f = setup();
  await f.run(militaryRewards, 'armsRaceRewards');
  await f.run(militaryRewards, 'armsRaceRewards');
  assert.equal(f.sent('GetDailyRewardRequest').length, 1);
  assert.deepEqual(
    f.sent('LimitedShopGotFreeRequest').map((r) => r.body.id),
    [90000]
  );
  assert.equal(f.state.writes.length, 2);
});
await test('走江积分、战令及免费/广告助力分别回读，二次检查无重复', async () => {
  const f = setup();
  for (let i = 0; i < 2; i++)
    for (const key of ['riverScore', 'riverPass', 'riverHelp']) await f.run(riverActivity, key);
  assert.deepEqual(
    f.state.writes.map((r) => r.name),
    [
      'SnowballClaimRewardRequest',
      'BattlePassGotRewardRequest',
      'SnowballClaimGiftRequest',
      'WatchAdvRequest',
      'GotAdvRewardRequest'
    ]
  );
  assert.equal(f.sent('BattlePassGotRewardRequest')[0].body.type, 10);
  assert.deepEqual(f.sent('GotAdvRewardRequest')[0].body, { type: 4, id: 1001 });
});
await test('广告权益不足只领免费档，活动未开放不读写活动协议', async () => {
  const f = setup();
  f.player.vip.vipLevel = 0;
  await f.run(riverActivity, 'riverHelp');
  assert.equal(f.sent('GotAdvRewardRequest').length, 0);
  f.client.festivals[0].subActivity[0].openTime = f.now + 100;
  const before = f.state.reads.length;
  await f.run(riverActivity, 'riverScore');
  assert.equal(f.state.reads.length, before);
});
await test('罗盘免费日包、库存阈值和每批数量，真实编码后仅消耗铜钱', async () => {
  const f = setup();
  await f.run(compassActivity, 'compassDaily');
  await f.run(compassActivity, 'compassDaily');
  await f.run(compassActivity, 'compassReward');
  await f.run(compassActivity, 'compassReward');
  assert.equal(f.sent('ClaimCompassWheelRewardRequest').length, 1);
  assert.equal(f.sent('ClaimFreeSelectGiftRequest').length, 1);
  await f.run(compassActivity, 'compassSpin');
  await f.run(compassActivity, 'compassSpin');
  assert.equal(f.sent('SpinCompassWheelRequest').length, 1);
  assert.equal(f.sent('SpinCompassWheelRequest')[0].body.num, 10);
  assert.equal(f.state.stock['活动26捞尸人_抽奖券'], 2);
  f.settings.eventActions.compassThreshold = 20;
  f.settings.eventActions.compassDrawCount = 5;
  f.state.stock['活动26捞尸人_抽奖券'] = 25;
  await f.run(compassActivity, 'compassSpin');
  assert.equal(f.sent('SpinCompassWheelRequest').at(-1).body.num, 5);
  f.state.wheel.cost.id = 'RUBY';
  await f.run(compassActivity, 'compassSpin');
  assert.equal(f.sent('SpinCompassWheelRequest').length, 2);
});
await test('罗盘未知结果跨账本实例防重，暂停或中途提阈值不会发送', async () => {
  const f = setup();
  f.state.mode = 'unknown';
  await f.run(compassActivity, 'compassSpin');
  f.state.mode = '';
  await compassActivity(f.client, f.config, {
    key: 'compassSpin',
    label: '罗盘',
    ledger: createUsageLedger('fixture', { file: f.store }),
    enabled: () => true,
    settings: () => f.settings,
    report: (r) => f.reports.push(r)
  });
  assert.equal(f.sent('SpinCompassWheelRequest').length, 1);
  assert(f.reports.some((r) => r.status === 'pending' || r.reason?.includes('待确认')));
  const g = setup();
  let reads = 0;
  g.state.onRead = (name) => {
    if (name === 'AllItem' && ++reads === 2) g.settings.eventActions.compassThreshold = 30;
  };
  await g.run(compassActivity, 'compassSpin');
  assert.equal(g.state.writes.length, 0);
  const h = setup();
  h.pause();
  await h.run(compassActivity, 'compassSpin');
  assert.equal(h.state.writes.length, 0);
});
await test('风采只按服务端票数，平票按编号，当日已投1票补2票并领包', async () => {
  const f = setup();
  assert.equal(leadingCandidate(f.state.beauty, f.config).no, 620);
  for (let i = 0; i < 2; i++) {
    await f.run(beautyActivity, 'beautyVotes');
    await f.run(beautyActivity, 'beautyGift');
  }
  assert.deepEqual(
    f.sent('BeautyVoteRequest').map((r) => r.body),
    [{ no: 620, count: 2 }]
  );
  assert.equal(f.sent('GotBeautyVoteRequest').length, 1);
  assert.equal(f.state.stock['代颜人投票券'], 7);
  assert.equal(f.state.beauty.todayVote, 3);
});
await test('投票券不足只投已有数量，展示期和未知结果不重复投票', async () => {
  const f = setup();
  f.state.stock['代颜人投票券'] = 1;
  f.state.mode = 'unknown';
  await f.run(beautyActivity, 'beautyVotes');
  f.state.mode = '';
  f.state.beauty.player[0].vote = 100;
  await f.run(beautyActivity, 'beautyVotes');
  assert.equal(f.sent('BeautyVoteRequest').length, 1);
  const g = setup();
  g.client.beautyWindow.endTime = g.now;
  await g.run(beautyActivity, 'beautyVotes');
  assert.equal(g.state.writes.length, 0);
});
await test('海商王真实行情模型低价买入、按商情走商、到港盈利出售', async () => {
  const f = setup();
  await f.run(merchantActivity, 'merchantTrade');
  assert.deepEqual(f.sent('TradeBuyRequest')[0].body, { cityId: 10, goodsId: 1001, buyNum: 250 });
  await f.run(merchantActivity, 'merchantTrade');
  assert.deepEqual(f.sent('TradeMoveRequest')[0].body, { cityId: 10, mvToCityId: 20 });
  await f.run(merchantActivity, 'merchantTrade');
  assert.equal(f.state.writes.length, 2);
  Object.assign(f.state.trade.cargo, { cityId: 20, moveToCityId: 0, moveEndTime: 0 });
  f.state.markets[20].goods[0].price = 30;
  await f.run(merchantActivity, 'merchantTrade');
  assert.equal(f.sent('TradeSellRequest').length, 0);
  f.state.markets[20].goods[0].price = 65;
  await f.run(merchantActivity, 'merchantTrade');
  assert.equal(f.sent('TradeSellRequest').length, 1);
  assert(f.state.trade.player.profit > 6000);
});
await test('空船先买本港折价货，持货等待商情，成交后在新港重新买货', async () => {
  const f = setup();
  const radar = f.state.radar.radar;
  f.state.radar.radar = [];
  await f.run(merchantActivity, 'merchantTrade');
  assert.equal(f.sent('TradeBuyRequest').length, 1);
  await f.run(merchantActivity, 'merchantTrade');
  assert.equal(f.sent('TradeMoveRequest').length, 0);
  f.state.radar.radar = radar;
  await f.run(merchantActivity, 'merchantTrade');
  assert.equal(f.sent('TradeMoveRequest').length, 1);
  Object.assign(f.state.trade.cargo, { cityId: 20, moveToCityId: 0, moveEndTime: 0 });
  await f.run(merchantActivity, 'merchantTrade');
  assert.equal(f.sent('TradeSellRequest').length, 1);
  f.state.markets[20].goods = [{ goodsId: 1002, price: 35, stock: 0 }];
  await f.run(merchantActivity, 'merchantTrade');
  assert.equal(f.sent('TradeBuyRequest')[1].body.goodsId, 1002);
  const empty = setup();
  empty.state.markets[10].goods[0].price = 100;
  await empty.run(merchantActivity, 'merchantTrade');
  assert.equal(empty.state.writes.length, 0);
});
await test('先买跌幅最大的可购货；售罄顺延，尚余一件也优先', async () => {
  for (const [remaining, expectedId] of [[1, 4005], [0, 3008]]) {
    const f = setup();
    f.state.markets[10].goods = [
      { goodsId: 3008, price: 274, stock: 0 },
      { goodsId: 4005, price: 759, stock: 7000 - remaining },
      { goodsId: 3010, price: 322, stock: 0 }
    ];
    await f.run(merchantActivity, 'merchantTrade');
    const buy = f.sent('TradeBuyRequest')[0].body;
    assert.equal(buy.goodsId, expectedId);
    if (remaining) assert.equal(buy.buyNum, 1);
  }
});
await test('已售完、价格变化、非交易时段及临近结束不买入', async () => {
  for (const mutate of [
    (f) => (f.state.markets[10].goods[0].stock = 60000),
    (f) => (f.client.serverClockOffsetMs += 11 * 3600000),
    (f) => (f.client.tradeWindow.endTime = f.now + 400),
    (f) => {
      let n = 0;
      f.state.onRead = (name) => {
        if (name === 'TradeCity' && ++n === 2) f.state.markets[10].goods[0].price = 80;
      };
    }
  ]) {
    const f = setup();
    mutate(f);
    await f.run(merchantActivity, 'merchantTrade');
    assert.equal(f.sent('TradeBuyRequest').length, 0);
  }
});
await test('海商王完成进度区分持仓、计划商品和城池；缺商情时只等待', async () => {
  const f = setup();
  const progress = () => merchantProgress(f.config, f.window, f.state.trade, f.player, f.now,
    async (name) => name === 'TradeGuildRadar' ? f.state.radar : f.state.markets[f.state.trade.cargo.cityId], f.ledger);
  const buy = await progress();
  assert.match(buy, /当前商品：空载/);
  assert.match(buy, /计划买入：.+目标城池：/);
  await f.run(merchantActivity, 'merchantTrade');
  await f.run(merchantActivity, 'merchantTrade');
  const sailing = await progress();
  assert.match(sailing, /当前商品：.+ ×250/);
  assert.match(sailing, /目标城池：.+航行中/);
  Object.assign(f.state.trade.cargo, { cityId: 20, moveToCityId: 0, moveEndTime: 0 });
  assert.match(await progress(), /计划卖出：.+目标城池：/);
  for (const port of f.state.radar.radar) port.rareGoodsId = 0;
  assert.match(await progress(), /目标城池：待定.+等待联盟商情/);
  await f.run(merchantActivity, 'merchantTrade');
  assert.equal(f.sent('TradeSellRequest').length, 0, '即使本港有盈利报价，也应等待有效商情');
  assert.equal(f.state.writes.length, 2);
});
await test('海商王买入回包丢失，回读核对持仓后才进入下一步', async () => {
  const f = setup();
  f.state.mode = 'lostAfterApply';
  await f.run(merchantActivity, 'merchantTrade');
  f.state.mode = '';
  await f.run(merchantActivity, 'merchantTrade');
  assert.equal(f.sent('TradeBuyRequest').length, 1);
  assert.equal(f.sent('TradeMoveRequest').length, 0);
  await f.run(merchantActivity, 'merchantTrade');
  assert.equal(f.sent('TradeMoveRequest').length, 1);
});
await test('贸易战令、已达利润、联盟任务与商情礼包逐项核验', async () => {
  const f = setup();
  await f.run(merchantActivity, 'merchantRewards');
  await f.run(merchantActivity, 'merchantRewards');
  assert.equal(f.sent('BattlePassGotRewardRequest')[0].body.type, 3);
  assert.equal(f.sent('GotTradeAchievementRequest').length, 1);
  assert(f.sent('TradeGotTaskRequest').length > 0);
  assert.equal(f.sent('GotTradeReportRequest').length, 1);
});
await test('旧导出保留显式关闭值，新默认与罗盘阈值入参校验', () => {
  const f = setup(),
    doc = exportAutomationSettings(f.settings);
  delete doc.settings.eventActions;
  for (const k of [
    'armsRaceRewards',
    'riverScore',
    'riverPass',
    'riverHelp',
    'compassDaily',
    'compassSpin',
    'merchantTrade',
    'merchantRewards',
    'beautyVotes',
    'beautyGift'
  ])
    delete doc.settings.schedule[k];
  doc.settings.schedule.compassReward = false;
  const restored = importAutomationSettings(doc);
  assert.equal(restored.schedule.compassReward, false);
  assert.equal(restored.schedule.armsRaceRewards, true);
  for (const key of ['compassSpin', 'merchantTrade', 'beautyVotes']) assert.equal(restored.schedule[key], false, key + ' 消耗型任务需主动开启');
  assert.deepEqual(restored.eventActions, { compassThreshold: 10, compassDrawCount: 10 });
  restored.eventActions.compassDrawCount = 3;
  assert.throws(() => validateSettings(restored));
});
await test('跨日礼包核对、活动中途关闭和候选人名单按游戏客户端筛选', async () => {
  const f = setup();
  f.client.seriesSnapshotDay = Math.floor((f.now + 28800) / 86400) - 1;
  f.client.festivals[0].subActivity[2].dailySelectGift.boughtTimes[1000] = 1;
  await f.run(compassActivity, 'compassDaily');
  assert.equal(f.sent('ClaimFreeSelectGiftRequest').length, 1);
  const g = setup();
  g.state.beauty.player.push({ no: 999999, rank: 1, playerId: 1000, vote: 99999 });
  await g.run(beautyActivity, 'beautyVotes');
  assert.equal(g.sent('BeautyVoteRequest')[0].body.no, 620);
  const h = setup();
  let reads = 0;
  h.state.onRead = (name) => {
    if (name === 'BeautyInfo' && ++reads === 2) h.client.beautyWindow = { ...h.window, endTime: h.now };
  };
  await h.run(beautyActivity, 'beautyVotes');
  assert.equal(h.state.writes.length, 0);
});
await test('正常挂机循环从保存的开关执行投票与奖励，未启用的走商不会发送', async () => {
  const f = setup();
  Object.assign(f.settings.loop, { world: false, tasks: false, dailies: false, heroes: false });
  const enabled = new Set(['beautyVotes', 'beautyGift']);
  await runLoop(f.client, f.protocol, {
    config: f.config,
    player: f.player,
    rounds: 1,
    allowMutate: true,
    isEnabled: (k) => enabled.has(k),
    getSettings: () => f.settings,
    usageLedger: f.ledger,
    sleep: async () => {}
  });
  assert.deepEqual(
    f.state.writes.map((w) => w.name),
    ['BeautyVoteRequest', 'GotBeautyVoteRequest']
  );
});
console.log('活动专项 ' + passed + '/' + passed + ' 通过');
