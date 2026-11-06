import fs from 'node:fs';
import path from 'node:path';
import { toNumber } from './client.mjs';
import { DATA_DIR } from './accounts.mjs';

const KEEP_DAYS = 35;
const GOLD = 3;
const RUBY = 4;
export const incomeFields = [
  ['gold', '金币'], ['ruby', '钻石'], ['petrol', '汽油'], ['speedUp', '加速器'],
  ['power', '战力'], ['level', '等级'], ['stage', '主线关卡'],
].map(([key, label]) => ({ key, label }));

export const incomeFile = id => path.join(DATA_DIR, 'income-' + encodeURIComponent(id) + '.json');

export function beijingDate(time = Date.now()) {
  return new Date(time + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

function load(id) {
  try {
    const saved = JSON.parse(fs.readFileSync(incomeFile(id), 'utf8'));
    return saved?.days && typeof saved.days === 'object' ? saved : { days: {} };
  } catch {
    return { days: {} };
  }
}

function save(id, data) {
  const file = incomeFile(id);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data) + '\n');
  fs.renameSync(tmp, file);
}

export async function readIncomeSnapshot(client, player) {
  const resources = await client.request('AllResourceRequest', {}, 'AllResourceResponse');
  const items = await client.request('AllItemRequest', {}, 'AllItemResponse');
  const amount = res => {
    const row = resources?.list?.find(entry => entry.res === res);
    return row ? toNumber(row.amount) : null;
  };
  const item = id => (items?.items ?? []).filter(entry => entry.itemId === id).reduce((sum, entry) => sum + toNumber(entry.num), 0);
  return { gold: amount(GOLD), ruby: amount(RUBY), petrol: item('汽油'), speedUp: item('加速器'),
    power: player?.power == null ? null : toNumber(player.power), level: player?.level ?? null, stage: player?.mainlineStage ?? null };
}

export function recordIncome(id, snapshot, counts = {}, time = Date.now()) {
  const data = load(id);
  const date = beijingDate(time);
  const day = data.days[date] ??= { first: { ...snapshot, t: time }, rounds: 0, failures: 0, outages: 0 };
  day.last = { ...snapshot, t: time };
  for (const name of ['rounds', 'failures', 'outages']) day[name] = (day[name] ?? 0) + (counts[name] ?? 0);
  for (const old of Object.keys(data.days).sort().slice(0, -KEEP_DAYS)) delete data.days[old];
  save(id, data);
}

// 当天起点取前一个有记录日期的收盘值，夜间未采样的收益不会丢。
export function incomeView(id, limit = 7) {
  const { days } = load(id);
  const dates = Object.keys(days).sort();
  const rows = dates.map((date, index) => {
    const day = days[date];
    const start = index > 0 ? days[dates[index - 1]].last ?? days[date].first : day.first;
    const end = day.last ?? day.first;
    const delta = {};
    for (const { key } of incomeFields) {
      delta[key] = Number.isFinite(start?.[key]) && Number.isFinite(end?.[key]) ? end[key] - start[key] : null;
    }
    return { date, delta, end, updatedAt: end?.t ?? null, rounds: day.rounds ?? 0, failures: day.failures ?? 0, outages: day.outages ?? 0 };
  });
  return { fields: incomeFields, days: rows.reverse().slice(0, limit) };
}
