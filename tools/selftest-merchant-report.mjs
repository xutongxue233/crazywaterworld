// 共享验证只使用真实协议编解码和临时账本，不登录游戏。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createUsageLedger } from '../src/automation-settings.mjs';
import { GameClient } from '../src/client.mjs';
import { merchantActivity, merchantProgress, readMerchantStatus } from '../src/merchant-activity.mjs';
import { runMerchantReport } from '../src/merchant-report.mjs';
import { seasonalFixture } from './fixtures/seasonal-suite.mjs';

const base = Date.UTC(2026, 10, 5, 4), originalNow = Date.now;
let wall = base, serial = 0, passed = 0;
Date.now = () => wall;
const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-merchant-report-'));
const requestName = 'TradeCityReportRequest';
const test = async (name, run) => { wall = base; await run(); passed++; console.log('通过：' + name); };

function fixture() {
  const f = seasonalFixture(), account = 'report-' + (++serial), file = path.join(folder, serial + '.json');
  const reports = [];
  let enabled = true;
  f.settings.schedule.merchantTrade = true;
  f.settings.merchant.autoShareIntel = true;
  f.state.markets[10].isReport = false;
  const ctx = {
    player: f.player, key: 'merchantTrade', label: '海商王',
    ledger: createUsageLedger(account, { file, now: () => wall }),
    settings: () => f.settings, enabled: () => enabled, report: row => reports.push(row)
  };
  return {
    ...f, ctx, reports, file,
    run: options => runMerchantReport(f.client, f.config, ctx,
      structuredClone(f.client.tradeWindow), structuredClone(f.state.trade), options),
    trade: () => merchantActivity(f.client, f.config, ctx),
    pause: () => { enabled = false; },
    reopen: () => { ctx.ledger = createUsageLedger(account, { file, now: () => wall }); },
    sent: () => f.state.writes.filter(row => row.name === requestName),
    records: () => Object.values(ctx.ledger.keyRecords()).filter(row => row.details?.scope?.startsWith('merchant-report:')),
    market: () => ({ ...structuredClone(f.state.markets[f.state.trade.cargo.cityId]),
      cityId: f.state.trade.cargo.cityId, observedAt: wall / 1000,
      period: f.client.tradeWindow.period, startTime: f.client.tradeWindow.startTime })
  };
}

try {
  await test('当前港首次共享以真实请求发送，回读确认后重复运行不重发', async () => {
    const f = fixture();
    assert.ok(f.protocol[requestName]);
    assert.equal(f.protocol.TradeCityReportResponse, undefined, '共享没有配套响应');
    await f.run();
    await f.run();
    assert.deepEqual(f.sent().map(row => row.body), [{ cityId: 10 }]);
    assert.equal(f.state.markets[10].isReport, true);
    assert.equal(f.records().length, 1);
    assert.equal(f.records()[0].confirmed, true);
    assert(f.reports.some(row => row.ok === true && row.status === 'confirmed'));
    assert.equal(f.state.writes.length, 1, '分享 helper 不得买卖、移动、领奖或消费');
  });
  await test('本港已经共享时不写入，也不冒称本账号贡献', async () => {
    const f = fixture();
    f.state.markets[10].isReport = true;
    await f.run();
    assert.equal(f.sent().length, 0);
    assert.equal(f.records().length, 0);
    assert.equal(f.reports.some(row => row.ok === true), false);
  });
  await test('关闭、断线、无联盟、未开放、未解锁和航行均不共享', async () => {
    for (const change of [
      f => { f.settings.merchant.autoShareIntel = false; },
      f => f.pause(),
      f => { f.client.connected = false; },
      f => { f.player.guildId = '0'; },
      f => { f.player.guildId = '1000'; },
      f => { f.player.level = 1; },
      f => { f.client.tradeWindow.endTime = wall / 1000; },
      f => { f.state.trade.period++; },
      f => { f.state.trade.cargo.cityId = 0; },
      f => { f.state.trade.cargo.moveEndTime = wall / 1000 + 60; },
      f => { f.state.trade.cargo.moveToCityId = 20; },
      f => { f.ctx.ledger = null; }
    ]) {
      const f = fixture(); change(f); await f.run();
      assert.equal(f.sent().length, 0, change.toString());
    }
  });
  await test('本港共享状态缺失或非布尔值时不能当作尚未共享', async () => {
    for (const isReport of [undefined, null, 0, 'false']) {
      const f = fixture(), request = f.client.request;
      f.client.request = async (name, body, response) => name === 'TradeCityRequest'
        ? { ...f.market(), isReport } : request(name, body, response);
      await f.run();
      assert.equal(f.sent().length, 0, String(isReport));
    }
  });
  await test('复用快照的港口、期次或活动起点不匹配时不共享', async () => {
    for (const change of [{ cityId: 20 }, { period: 1002 }, { startTime: 1 }]) {
      const f = fixture();
      await f.run({ market: { ...f.market(), ...change } });
      assert.equal(f.sent().length, 0);
    }
  });
  await test('发送前关闭开关、换号换盟、期次结束或离港都取消共享', async () => {
    for (const change of [
      f => { f.settings.merchant.autoShareIntel = false; },
      f => f.pause(),
      f => { f.player.playerId = '9007199254741999'; },
      f => { f.player.guildId = '9007199254741002'; },
      f => { f.client.tradeWindow.period++; },
      f => { f.client.tradeWindow.endTime = wall / 1000; },
      f => { f.state.trade.cargo.moveToCityId = 20; },
      f => { f.state.trade.cargo.cityId = 20; }
    ]) {
      const f = fixture();
      f.state.onRead = stem => { if (stem === 'TradeInfo') change(f); };
      await f.run({ market: f.market() });
      assert.equal(f.sent().length, 0, change.toString());
    }
  });
  await test('已预留后关闭开关会释放未发送记录', async () => {
    const f = fixture(), reserve = f.ctx.ledger.reserve;
    f.ctx.ledger.reserve = (...args) => { const ticket = reserve(...args); f.pause(); return ticket; };
    await f.run();
    assert.equal(f.sent().length, 0);
    assert.equal(f.records().length, 0);
  });
  await test('盟友在发送前抢先共享时跳过，不增加共享次数', async () => {
    const f = fixture();
    f.state.onRead = stem => { if (stem === 'TradeInfo') f.state.markets[10].isReport = true; };
    await f.run({ market: f.market() });
    assert.equal(f.sent().length, 0);
    assert.equal(f.state.trade.guildReportNum, 6);
  });
  await test('读取港口失败不发送共享', async () => {
    const f = fixture();
    f.state.onRead = stem => { if (stem === 'TradeCity') throw Error('读取超时'); };
    await f.run();
    assert.equal(f.sent().length, 0);
  });
  await test('发送结果未知跨重连保留记录，随后状态确认只补记不重发', async () => {
    const f = fixture(); f.state.mode = 'unknown';
    await f.run();
    assert.equal(f.sent().length, 1);
    assert.equal(f.records()[0].confirmed, false);
    f.reopen(); f.state.mode = '';
    await f.run();
    assert.equal(f.sent().length, 1, '未知请求不得重发');
    f.state.markets[10].isReport = true;
    await f.run();
    assert.equal(f.records()[0].confirmed, true);
    assert.equal(f.sent().length, 1);
  });
  await test('同一期活动延期不能绕过未知共享记录', async () => {
    const f = fixture(); f.state.mode = 'unknown';
    await f.run();
    assert.equal(f.sent().length, 1);
    f.client.tradeWindow.endTime += 86400;
    f.state.mode = ''; f.reopen();
    await f.run();
    assert.equal(f.sent().length, 1, '延长结束时间不得改变同一商情的防重身份');
    assert.equal(f.records().length, 1);
    assert.equal(f.records()[0].confirmed, false);
  });
  await test('共享已生效但发送观察失败，以回读状态恢复确认', async () => {
    const f = fixture(); f.state.mode = 'lostAfterApply';
    await f.run();
    f.reopen(); f.state.mode = '';
    await f.run();
    assert.equal(f.sent().length, 1);
    assert.equal(f.records()[0].confirmed, true);
  });
  await test('只有共享推送或联盟次数增长，不能代替本港回读确认', async () => {
    const f = fixture();
    f.client.sendWatch = async (name, body) => {
      f.protocol[name].decode(f.protocol[name].encode(body).finish());
      f.state.writes.push({ name, body });
      f.state.trade.guildReportNum++;
      f.client.emit('message', { name: 'SCTradeCityReport', body: {
        cityId: body.cityId, reportNum: f.state.trade.guildReportNum, reportName: '另一位盟友'
      } });
      return { sent: 1, name };
    };
    await f.run();
    assert.equal(f.sent().length, 1);
    assert.equal(f.records()[0].confirmed, false);
    assert.equal(f.reports.some(row => row.ok === true), false);
    await f.run();
    assert.equal(f.sent().length, 1);
  });
  await test('共享发送后身份变化保留未知记录，不将旧港状态用于确认', async () => {
    const f = fixture();
    f.state.onWrite = stem => { if (stem === 'TradeCityReport') f.player.guildId = '9007199254741002'; };
    await f.run();
    assert.equal(f.sent().length, 1);
    assert.equal(f.records()[0].confirmed, false);
    assert.equal(f.reports.some(row => row.ok === true), false);
  });
  await test('明确拒绝和原写请求未发送释放记录，可在下一次重试', async () => {
    for (const mode of ['reject', 'notSent']) {
      const f = fixture(), send = f.client.sendWatch;
      if (mode === 'reject') f.state.mode = 'reject';
      else f.client.sendWatch = async () => { throw Object.assign(Error('发送前断线'), { notSent: true }); };
      await f.run();
      assert.equal(f.records().length, 0, mode);
      f.state.mode = ''; f.client.sendWatch = send;
      await f.run();
      assert.equal(f.records()[0].confirmed, true, mode);
      assert.equal(f.state.markets[10].isReport, true);
    }
  });
  await test('已发送后的回读即使标记notSent也不能撤销共享记录', async () => {
    const f = fixture();
    f.state.onRead = stem => {
      if (stem === 'TradeCity' && f.sent().length)
        throw Object.assign(Error('回读未发送'), { notSent: true });
    };
    await f.run();
    assert.equal(f.sent().length, 1);
    assert.equal(f.records()[0].confirmed, false);
    f.state.onRead = null; f.state.markets[10].isReport = false; f.reopen();
    await f.run();
    assert.equal(f.sent().length, 1);
  });
  await test('同日价格刷新不能重复共享，次日10点重置后允许共享', async () => {
    const f = fixture();
    await f.run();
    f.state.markets[10].isReport = false;
    wall = base + 2 * 3600000;
    await f.run();
    assert.equal(f.sent().length, 1, '14点价格刷新不重置商情');
    wall = Date.UTC(2026, 10, 6, 1, 59, 59);
    await f.run();
    assert.equal(f.sent().length, 1, '次日10点前不共享新商情');
    wall += 1000;
    await f.run();
    assert.equal(f.sent().length, 2);
    assert.equal(f.records().filter(row => row.confirmed).length, 2);
  });
  await test('发送前跨商情周期边界取消原计划', async () => {
    const f = fixture();
    f.state.onRead = stem => { if (stem === 'TradeInfo') wall += 86400000; };
    await f.run({ market: f.market() });
    assert.equal(f.sent().length, 0);
  });
  await test('不同港口、联盟和活动期次分别防重', async () => {
    for (const change of [
      f => { f.state.trade.cargo.cityId = 20; f.state.markets[20].isReport = false; },
      f => { f.player.guildId = '9007199254741002'; f.state.markets[10].isReport = false; },
      f => { f.client.tradeWindow.period++; f.state.trade.period++; f.state.markets[10].isReport = false; },
      f => { f.client.tradeWindow.startTime--; f.state.markets[10].isReport = false; }
    ]) {
      const f = fixture(); await f.run(); change(f); await f.run();
      assert.equal(f.sent().length, 2, change.toString());
    }
  });
  await test('共享记录不占用交易恢复作用域', async () => {
    const f = fixture(); f.state.mode = 'unknown'; await f.run();
    const record = f.records()[0];
    assert.equal(record.confirmed, false);
    assert.notEqual(record.details.scope, 'merchant:' + f.window.startTime + ':' + f.window.period);
    f.state.mode = ''; await f.trade();
    assert(f.state.writes.some(row => row.name === 'TradeBuyRequest'), '未知共享不应卡住可执行交易');
    assert.equal(f.sent().length, 1);
  });
  await test('实际走商入口先共享当前港，再正常采购', async () => {
    const f = fixture();
    await f.trade();
    assert.deepEqual(f.state.writes.map(row => row.name), [requestName, 'TradeBuyRequest']);
  });
  await test('走商读取初始行情时身份变化，不在共享子流程重新接受新身份', async () => {
    const f = fixture();
    f.state.onRead = stem => { if (stem === 'TradeGuildRadar') f.player.guildId = '9007199254741002'; };
    await f.trade();
    assert.equal(f.state.writes.length, 0);
    assert.equal(f.records().length, 0);
  });
  await test('达到利润上限仍共享当前港，但不增加买卖或航程', async () => {
    const f = fixture(); f.settings.merchant.profitLimit = f.state.trade.player.profit;
    await f.trade();
    assert.deepEqual(f.state.writes.map(row => row.name), [requestName]);
  });
  await test('仅共享遭拒绝不阻塞本轮正常买卖', async () => {
    const f = fixture();
    f.client.sendWatch = async (name, body) => {
      assert.equal(name, requestName);
      f.state.writes.push({ name, body });
      throw Object.assign(Error('共享被拒绝'), { prompt: { prompt: 5 }, request: name });
    };
    await f.trade();
    assert.deepEqual(f.state.writes.map(row => row.name), [requestName, 'TradeBuyRequest']);
    assert.equal(f.records().length, 0);
  });
  await test('只读状态与进度查询不会主动共享', async () => {
    const f = fixture();
    await readMerchantStatus(f.client, f.config, { player: f.player, ledger: f.ctx.ledger, settings: f.settings });
    await merchantProgress(f.config, f.client.tradeWindow, f.state.trade, f.player, wall / 1000,
      (name, body) => f.client.request(name + 'Request', body, name + 'Response'), f.ctx.ledger, f.settings);
    assert.equal(f.state.writes.length, 0);
  });
  await test('仅领奖入口不会因默认开启共享而上报商情', async () => {
    const f = fixture(); f.ctx.key = 'merchantRewards';
    await f.trade();
    assert.equal(f.sent().length, 0);
  });
  await test('NO_GUILD错误归属共享请求，不将静默等待误认为通过', async () => {
    const f = fixture(), client = new GameClient({ protocol: f.protocol });
    client.send = () => 1;
    const result = client.sendWatch(requestName, { cityId: 10 }, { window: 20 });
    client.attributePrompt({ prompt: f.protocol.Prompt.NO_GUILD });
    await assert.rejects(result, error => error.request === requestName && !!error.prompt);
  });
  console.log(`海商王自动共享专项 ${passed}/${passed} 通过`);
} finally {
  Date.now = originalNow;
  fs.rmSync(folder, { recursive: true, force: true });
}
