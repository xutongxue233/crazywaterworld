import fs from 'node:fs';
import { normalize } from './worlds.mjs';
import { exactAutomationId } from './automation-policy.mjs';
import { restorePirateFlight, reconcilePirateFlights } from './pirates.mjs';
import { savePirateOutcome } from './pirate-advance.mjs';

const SECOND = 1000;
const WINDOW = 15 * 60 * SECOND;

// 历史协议日志的正文最多400字符。只采用截断前已完整记录的 JSON 字段。
function readPrefix(text) {
  try {
    return JSON.parse(text);
  } catch {
    /* 尝试读取最后一个完整字段之前的内容。 */
  }
  const stack = [];
  let quoted = false,
    escaped = false,
    complete = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '{') stack.push('}');
    else if (char === '[') stack.push(']');
    else if (char === '}' || char === ']') {
      if (stack.pop() !== char) return null;
    } else if (char === ',') complete = text.slice(0, i) + [...stack].reverse().join('');
  }
  try {
    return JSON.parse(complete);
  } catch {
    return null;
  }
}

// 日志按文件上限轮转，顺序读取可保留完整长行和同一毫秒内的协议顺序。
function traceWindow(file, from, until) {
  return fs.readFileSync(file, 'utf8').split('\n').filter((line) => {
    const time = Date.parse(line.slice(0, 24));
    return time >= from && time <= until;
  });
}

export function replayPirateReceipt(lines, { accountId, player, record, sentAt, offset = 0 }) {
  const d = record.details;
  const owner = exactAutomationId(player.playerId);
  if (!owner || String(normalize(player.worldId)) !== d.world || !Number.isFinite(sentAt)) return null;
  const prefix = ' [' + accountId.slice(0, 8) + '] ';
  const events = [];
  for (const line of lines) {
    if (!line.startsWith(prefix, 24)) continue;
    const entry = line.slice(24 + prefix.length);
    const match = /^(-> )?\[(\w+)\] seq=\d+ (.*)$/.exec(entry);
    if (!match) continue;
    const at = Date.parse(line.slice(0, 24)) + offset;
    events.push({ at, name: match[2], out: !!match[1], text: match[3] });
  }
  const sends = events.filter(
    (e) => e.out && e.name === 'ChallengePirateRequest' && Math.abs(e.at - sentAt) <= 2 * SECOND
  );
  if (sends.length !== 1) return null;
  let grid = null,
    begin = null,
    fought = false,
    end = null,
    returned = false,
    personalWin = false;
  const reports = new Map();
  for (const e of events) {
    if (e.at < sends[0].at) continue;
    if (e.out) {
      if (e !== sends[0] && e.name === 'ChallengePirateRequest' && !returned) return null;
      continue;
    }
    if (
      ![
        'SCMyFleetUpdate',
        'SCPirateCampaignBegin',
        'SCPirateCampaignEnd',
        'CampaignReportsResponse',
        'PirateKillRecordResponse',
        'SCPirateKillRecordUpdate'
      ].includes(e.name)
    )
      continue;
    const body = readPrefix(e.text);
    if (!body) continue;
    if (e.name === 'SCMyFleetUpdate') {
      const fleet = body.fleets?.find(
        (f) => f.buildingId === d.buildingId && exactAutomationId(f.owner?.playerId) === owner
      );
      if (!fleet) continue;
      if (
        grid === null &&
        fleet.state === 2 &&
        fleet.targetGridIdx > 0 &&
        Math.abs(fleet.moveStartTs * SECOND - sentAt) <= 2 * SECOND
      ) {
        if (d.grid != null && d.grid !== fleet.targetGridIdx) return null;
        grid = fleet.targetGridIdx;
      }
      if (grid !== null && fleet.state === 3 && fleet.curGridIdx === grid && !end) fought = true;
      if (end && fleet.state === 2 && fleet.startGridIdx === grid && fleet.targetGridIdx !== grid)
        returned = true;
    } else if (e.name === 'SCPirateCampaignBegin' && grid !== null && body.uid === d.uid && !end) {
      if (begin !== null) return null;
      begin = Math.floor(e.at / SECOND);
    } else if (
      e.name === 'SCPirateCampaignEnd' &&
      body.uid === d.uid &&
      begin !== null &&
      fought &&
      !end &&
      typeof body.isWin === 'boolean'
    ) {
      end = { win: body.isWin };
    } else if (end?.win && ['PirateKillRecordResponse', 'SCPirateKillRecordUpdate'].includes(e.name)) {
      const records = body.records ?? [body.record];
      if (records.some((r) => r?.type === d.type && r.maxKilledLevel >= d.level)) personalWin = true;
    } else if (e.name === 'CampaignReportsResponse' && end) {
      for (const report of body.reports ?? []) {
        const id = exactAutomationId(report.uid),
          time = normalize(report.createTime);
        if (
          id &&
          report.type === 1 &&
          report.pirate?.type === d.type &&
          report.pirate.level === d.level &&
          report.scenarioId === (player.scenarioId || 1) &&
          Math.abs(time - begin) <= 1 &&
          typeof report.win === 'boolean'
        )
          reports.set(id, report);
      }
    }
  }
  if (
    !returned ||
    reports.size !== 1 ||
    !end ||
    [...reports.values()][0].win !== end.win ||
    (end.win && !personalWin)
  )
    return null;
  return { outcome: end.win ? 'won' : 'lost', grid, reportId: [...reports.keys()][0], battleAt: begin };
}

export function recoverPirateHunts(client, player, ledger, accountId, tracePath) {
  if (!player) return [];
  const world = String(normalize(player.worldId)),
    offset = client.serverClockOffsetMs || 0,
    results = [];
  const traceFiles = tracePath ? [tracePath, tracePath + '.1'].filter(file => fs.existsSync(file))
    .sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs) : [];
  for (const [key, record] of Object.entries(ledger.keyRecords())) {
    const d = record.details;
    if (
      record.expired ||
      d?.kind !== 'pirateFirst' ||
      d.world !== world ||
      ['won', 'lost'].includes(d.outcome)
    )
      continue;
    const sentAt = d.sentAt ?? ledger.reservationTime(key);
    if (!Number.isFinite(sentAt)) continue;
    if (traceFiles.length) {
      const from = sentAt - offset;
      const lines = [...new Set(traceFiles.flatMap(file => traceWindow(file, from - 2 * SECOND, from + WINDOW)))];
      lines.sort((a, b) => Date.parse(a.slice(0, 24)) - Date.parse(b.slice(0, 24)));
      const proof = replayPirateReceipt(lines, {
        accountId,
        player,
        record,
        sentAt,
        offset
      });
      if (proof) {
        ledger.resolveKey(key, true, { ...d, ...proof });
        results.push({ key, ...proof });
        continue;
      }
    }
    // 重连时仍在途的新版派遣继续监听本人舰队和个人记录，不发起新挑战。
    const age = Date.now() + offset - sentAt;
    if (d.active !== false && age >= 0 && age <= WINDOW && Number.isSafeInteger(d.grid) && d.grid >= 0)
      restorePirateFlight(client, d, (event) => savePirateOutcome(ledger, key, event), record.id);
  }
  reconcilePirateFlights(client, ledger.keyRecords(), world);
  return results;
}
