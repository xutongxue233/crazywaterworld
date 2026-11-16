import { exactAutomationId } from './automation-policy.mjs';
import { normalize } from './worlds.mjs';
import { reconcilePirateFlights } from './pirates.mjs';
import { emitDiagnostic } from './trace-log.mjs';

const fleetKey = /^(?:radar-send|world-boss|pirate-first|cityWar|treasureRepair|treasureFollow|treasure|silicon|silicon-repair|silicon-retreat|silicon-speed):(\d+):/;
const repairKinds = new Set(['cityRepair', 'treasureRepair']);
const integer = Number.isSafeInteger;
const dayOf = (seconds) => Math.floor((seconds + 28800) / 86400);
const zeroId = (value) =>
  value == null || value === 0 || value === '0' || (value.low === 0 && value.high === 0);

export function recordsInWorld(records, worldId) {
  const selected = {};
  for (const [key, record] of Object.entries(records)) {
    const match = fleetKey.exec(key);
    if (match && worldId && match[1] !== String(worldId)) continue;
    const d = record.details;
    // 早期的货轮和城战用键保存舰队编号。只恢复键能够确定的身份。
    const cargo = /^treasure:(\d+):(\d+):([1-9]\d*)$/.exec(key);
    const pirate = /^pirate-first:(\d+):(\d+):(\d+):(\d+)$/.exec(key);
    const slot = /^(cityWar|treasureRepair):(\d+):([1-9]\d*)$/.exec(key);
    if (cargo && (!d?.kind || !d.buildingId || !d.uid))
      selected[key] = {
        ...record,
        details: { kind: 'treasureDispatch', uid: cargo[2], buildingId: cargo[3] + '远征船', ...d }
      };
    else if (pirate && !d?.kind)
      selected[key] = {
        ...record,
        details: { kind: 'pirateFirst', world: pirate[1], type: Number(pirate[2]), level: Number(pirate[3]), ...d }
      };
    else if (slot && (!d?.kind || !d.buildingId))
      selected[key] = {
        ...record,
        details: {
          kind: slot[1] === 'cityWar' ? 'citySlot' : 'treasureRepair',
          buildingId: slot[3] + '远征船',
          ...d
        }
      };
    else selected[key] = record;
  }
  return selected;
}

export function fleetAtHome(fleet) {
  return (
    fleet?.state === 1 && fleet.curGridIdx === 0 && zeroId(fleet.treasureLootUid) && !fleet.chipWar?.rewardTs
  );
}

export function radarEvents(info) {
  if (!Array.isArray(info?.events)) return null;
  const events = info.events.map((e) => ({
    ...normalize(e),
    uid: exactAutomationId(e.uid),
    eventId: e.eventId,
    state: e.state,
    createTime: e.createTime,
    startTime: e.startTime,
    fixed: false
  }));
  if (info.fixedEvent?.eventId > 0) {
    const e = info.fixedEvent;
    events.push({
      ...normalize(e),
      uid: '1',
      eventId: e.eventId,
      state: e.state,
      createTime: e.createTime,
      startTime: e.startTime,
      fixed: true
    });
  }
  if (
    events.some(
      (e) =>
        !e.uid ||
        !integer(e.eventId) ||
        e.eventId <= 0 ||
        !integer(e.createTime) ||
        e.createTime < (e.fixed ? 1 : 0) ||
        ![1, 2, 3, 4].includes(e.state)
    )
  )
    return null;
  if (new Set(events.map(radarKey)).size !== events.length) return null;
  return events;
}

export const radarKey = (e) => (e.fixed ? 'fixed-' + e.eventId + '-' + e.createTime : e.uid);
export function radarDispatchConfirmed(snapshot, event, buildingId) {
  if (!event) return false;
  if (event.state === 3 || event.state === 4) return true;
  if (event.state !== 2 || !integer(event.gridIdx) || event.gridIdx < 0) return false;
  const fleet = snapshot.fleets.find((f) => f.buildingId === buildingId);
  return (
    !!fleet &&
    ((fleet.state === 2 && fleet.targetGridIdx === event.gridIdx) ||
      (fleet.state === 3 && fleet.curGridIdx === event.gridIdx))
  );
}

export function outstandingFleets(records, worldId) {
  return Object.entries(recordsInWorld(records, worldId)).filter(([key, r]) => {
    const match = fleetKey.exec(key),
      d = r.details;
    if (!match || match[1] !== String(worldId) || r.expired || !d?.buildingId) return false;
    if (d.kind === 'radarSend' || d.kind === 'worldBoss') return d.active !== false;
    if (d.kind === 'pirateFirst') return !['won', 'lost'].includes(d.outcome);
    return (
      repairKinds.has(d.kind) ||
      d.kind === 'citySlot' ||
      d.kind === 'cityDispatch' ||
      (d.kind === 'treasureDispatch' && !r.confirmed)
    );
  });
}

function personalBattleMatches(details, report) {
  const at = normalize(report?.createTime);
  if (!integer(at)) return false;
  if (details.kind === 'worldBoss')
    return (
      report.type === 5 &&
      report.worldBoss?.bossId === details.bossId &&
      dayOf(at) === details.day &&
      (!details.sentAt || at >= details.sentAt)
    );
  return (
    details.kind === 'pirateFirst' &&
    details.ownBattle === true &&
    integer(details.battleAt) &&
    report.type === 1 &&
    report.scenarioId === details.scenarioId &&
    report.pirate?.type === details.type &&
    report.pirate.level === details.level &&
    Math.abs(at - details.battleAt) <= 1 &&
    typeof report.win === 'boolean'
  );
}

// 对已有派遣做结算，不发出游戏动作。先按读回前的记录编号限定范围，防止迟到快照释放新占用。
export function settleFleetSnapshot(
  ledger,
  { worldId, fleets, events, reports, kills, cargoUids, now, kinds, baseline }
) {
  if (!ledger?.keyRecords || !worldId || !Array.isArray(fleets)) return [];
  const records = ledger.keyRecords(),
    changes = [];
  for (const [key, r] of outstandingFleets(records, worldId)) {
    const d = r.details;
    if (
      (kinds && !kinds.includes(d.kind)) ||
      (baseline && (!baseline[key] || baseline[key].id !== r.id || baseline[key].confirmed !== r.confirmed))
    )
      continue;
    const own = fleets.filter((f) => f.buildingId === d.buildingId);
    if (own.length !== 1) continue;
    const fleet = own[0],
      home = fleetAtHome(fleet);
    if (d.kind === 'radarSend') {
      if (!Array.isArray(events) || !d.eventKey || key !== 'radar-send:' + worldId + ':' + d.eventKey)
        continue;
      const event = events.find((e) => radarKey(e) === d.eventKey);
      if (!r.confirmed && radarDispatchConfirmed({ fleets }, event, d.buildingId)) {
        ledger.resolveKey(key, true);
        changes.push({ key, reason: '确认情报派遣' });
      } else if (r.confirmed && home && (!event || event.state === 4 || event.state === 1)) {
        // 同一事件退回待处理、原舰队已经返航，也是这一次派遣的终态。
        const reason = !event ? '事件已离开列表' : event.state === 4 ? '情报可领奖' : '情报已退回待处理';
        ledger.updateKeyDetails(key, { ...d, active: false, releaseReason: reason });
        changes.push({ key, reason });
      }
      continue;
    }
    if (d.kind === 'worldBoss') {
      const atTarget =
        integer(d.grid) &&
        d.grid > 0 &&
        ((fleet.state === 2 && fleet.targetGridIdx === d.grid) ||
          ([3, 5].includes(fleet.state) && fleet.curGridIdx === d.grid));
      if (atTarget && (!r.confirmed || !d.observed)) {
        ledger.resolveKey(key, true, { ...d, observed: true });
        changes.push({ key, reason: '确认首战目标' });
      } else if (r.confirmed && home) {
        const ended = reports?.some((r) => personalBattleMatches(d, r));
        if (d.observed || ended || (integer(d.day) && integer(now) && dayOf(now) > d.day)) {
          ledger.updateKeyDetails(key, { ...d, active: false });
          changes.push({ key, reason: '首战舰队已返航' });
        }
      }
      continue;
    }
    if (d.kind === 'pirateFirst') {
      let outcome = d.outcome;
      // 个人首杀记录本身就是权威胜利证据；不能再要求此前已经收到派遣确认。
      if (kills?.some((k) => k.type === d.type && k.maxKilledLevel >= d.level)) {
        ledger.resolveKey(key, true, { ...d, outcome: 'won' });
        outcome = 'won';
        changes.push({ key, reason: '个人首杀等级已确认' });
      } else if (r.confirmed && home && d.ownBattle && integer(d.battleAt)) {
        const matches = (reports ?? []).filter((report) => personalBattleMatches(d, report));
        const competing = Object.values(recordsInWorld(records, worldId)).filter(
          (other) =>
            other.details?.kind === 'pirateFirst' &&
            other.details.type === d.type &&
            other.details.level === d.level &&
            Math.abs(other.details.battleAt - d.battleAt) <= 2
        );
        if (
          matches.length === 1 &&
          !matches[0].win &&
          competing.length === 1 &&
          exactAutomationId(matches[0].uid)
        ) {
          ledger.resolveKey(key, true, {
            ...d,
            outcome: 'lost',
            reportId: exactAutomationId(matches[0].uid)
          });
          outcome = 'lost';
          changes.push({ key, reason: '个人战报确认首杀战败并返航' });
        }
      }
      // 本人舰队归队可以解除占用，战果、目标防重和未知汽油仍保存在原记录中。
      // 未确认出征的请求先保留原有 15 分钟战果等待窗口，避免发送后状态尚未同步就释放。
      const sentAt = d.sentAt ?? ledger.reservationTime?.(key);
      const timedOut = Number.isFinite(sentAt) && integer(now) && now * 1000 - sentAt >= 900000;
      if (home && d.active !== false && !['won', 'lost'].includes(outcome) && (r.confirmed || timedOut)) {
        const reason = r.confirmed ? '首杀舰队已归队，战果继续待核对' : '首杀请求超过等待窗口且舰队已归队';
        ledger.updateKeyDetails(key, { ...d, active: false, releaseReason: reason, releasedAt: now });
        changes.push({ key, reason });
      }
      continue;
    }
    if (d.kind === 'treasureDispatch') {
      if (
        !r.confirmed &&
        d.uid > 0 &&
        exactAutomationId(fleet.treasureLootUid) === exactAutomationId(d.uid)
      ) {
        ledger.resolveKey(key, true);
        changes.push({ key, reason: '确认货轮派遣' });
      } else if (
        !r.confirmed &&
        home &&
        exactAutomationId(d.uid) &&
        Array.isArray(cargoUids) &&
        !cargoUids.includes(exactAutomationId(d.uid))
      ) {
        // 已消失的目标无法继续占用归队舰队。是否扣费仍未知，按原规则保留预算。
        ledger.resolveKey(key, false);
        changes.push({ key, reason: '货轮目标消失且舰队已归队' });
      }
      continue;
    }
    if (d.kind === 'citySlot') {
      if (r.confirmed && home) {
        ledger.releaseCompletedKey(key);
        changes.push({ key, reason: '已确认的旧城战槽位已归队' });
      }
      continue;
    }
    if (repairKinds.has(d.kind) || d.kind === 'cityDispatch') {
      let confirmed = r.confirmed;
      if (!confirmed) {
        const observed = repairKinds.has(d.kind)
          ? (fleet.state === 4 && fleet.repairing?.endTs > now) ||
            (integer(fleet.durability) &&
              integer(d.beforeDurability) &&
              fleet.durability > d.beforeDurability)
          : (fleet.state === 2 && fleet.targetCityId === d.cityId) ||
            (fleet.cityId === d.cityId &&
              ([3, 5].includes(fleet.state) || (fleet.state === 1 && fleet.curGridIdx > 0)));
        if (!observed) continue;
        ledger.resolveKey(key, true);
        confirmed = true;
        changes.push({ key, reason: '确认城战或维修' });
      }
      if (confirmed && home) {
        ledger.releaseCompletedKey(key);
        changes.push({ key, reason: '已返航，释放舰队槽位' });
      }
    }
  }
  return changes;
}

// 战报分轮读取。首杀必须读完整列表后才能确认同一战斗时间只有一份战报。
const reportCache = new WeakMap();
export function invalidateFleetReports(client) {
  reportCache.delete(client);
}
async function completionReports(client, worldId, records) {
  const signature = JSON.stringify([worldId, ...records.map((r) => [r.id, r.details.battleAt])]);
  const previous = reportCache.get(client);
  if (previous?.signature === signature && previous.finishedAt !== null && Date.now() - previous.finishedAt < 60000)
    return previous.reports;
  const scan = previous?.signature === signature && previous.finishedAt === null ? previous : {
    signature, total: null, received: 0, pageNo: 0, found: new Map(), seenIds: new Set(),
    consistent: true, complete: false, finishedAt: null, reports: []
  };
  reportCache.set(client, scan);
  const deadline = Date.now() + 8000;
  for (let count = 0; count < 2 && scan.pageNo < 200 && Date.now() < deadline; count++) {
    const page = await client.request('CampaignReportsRequest', { pageNo: scan.pageNo }, 'CampaignReportsResponse',
      Math.max(1, deadline - Date.now()));
    // 收到新战报推送时整次扫描作废，避免把前后两个列表拼成唯一战报证据。
    if (reportCache.get(client) !== scan) return [];
    if (!Array.isArray(page?.reports) || !integer(page.total) || page.total < 0) {
      scan.finishedAt = Date.now();
      break;
    }
    if (scan.total !== null && scan.total !== page.total) {
      reportCache.delete(client);
      return [];
    }
    scan.total = page.total;
    scan.received += page.reports.length;
    scan.pageNo++;
    for (const report of page.reports) {
      const id = exactAutomationId(report?.uid);
      if (!id || scan.seenIds.has(id)) scan.consistent = false;
      else scan.seenIds.add(id);
      if (records.some((r) => personalBattleMatches(r.details, report))) {
        if (id) scan.found.set(id, report);
        else if (report.type === 5) scan.found.set('boss:' + report.worldBoss.bossId, report);
      }
    }
    if (scan.received >= scan.total) {
      scan.complete = scan.consistent && scan.seenIds.size === scan.total;
      scan.finishedAt = Date.now();
      break;
    }
    if (
      !page.reports.length ||
      records.every(
        (r) =>
          r.details.kind === 'worldBoss' &&
          [...scan.found.values()].some((rep) => personalBattleMatches(r.details, rep))
      )
    ) {
      scan.finishedAt = Date.now();
      break;
    }
  }
  if (scan.pageNo >= 200) scan.finishedAt = Date.now();
  scan.reports = [...scan.found.values()].filter((r) => r.type === 5 || scan.complete);
  return scan.reports;
}

const checking = new WeakMap();
export async function checkFleetSettlement(client, player, ledger, { afterPush = false } = {}) {
  const worldId = exactAutomationId(player?.worldId),
    owner = exactAutomationId(player?.playerId);
  const sameOwner = () =>
    exactAutomationId(player.worldId) === worldId && exactAutomationId(player.playerId) === owner;
  if (!ledger?.keyRecords || !worldId) return [];
  const active = checking.get(client);
  if (active) {
    if (!afterPush) return active;
    await active;
    return checkFleetSettlement(client, player, ledger);
  }
  const baseline = ledger.keyRecords(),
    outstanding = outstandingFleets(baseline, worldId);
  reconcilePirateFlights(client, baseline, worldId);
  if (!outstanding.length) return [];
  const job = (async () => {
    const kinds = new Set(outstanding.map(([, record]) => record.details.kind));
    const readErrors = [];
    const read = async (name) => {
      try {
        return await client.request(name + 'Request', {}, name + 'Response', 8000);
      } catch (error) {
        readErrors.push({ request: name + 'Request', error: error.message });
        return null;
      }
    };
    const [own, radar, pirate, cargo] = await Promise.all([
      read('MyFleets'),
      kinds.has('radarSend') ? read('RadarInfo') : null,
      kinds.has('pirateFirst') ? read('PirateKillRecord') : null,
      kinds.has('treasureDispatch') ? read('TreasureLootList') : null
    ]);
    if (!Array.isArray(own?.fleets) || !sameOwner() || client.connected === false) {
      emitDiagnostic(client, 'fleet-settlement', { worldId, readErrors, changes: [],
        reason: !Array.isArray(own?.fleets) ? '未取得完整本人舰队列表' : '账号、区服或连接已变化' });
      return [];
    }
    const now = Math.floor((Date.now() + (client.serverClockOffsetMs || 0)) / 1000);
    const cargoIds = Array.isArray(cargo?.treasure)
      ? cargo.treasure.map((t) => exactAutomationId(t.uid))
      : null;
    const snapshot = {
      worldId,
      fleets: own.fleets,
      events: radarEvents(radar?.radarInfo),
      kills: pirate?.records,
      cargoUids:
        cargoIds && cargoIds.every(Boolean) && new Set(cargoIds).size === cargoIds.length ? cargoIds : null,
      now,
      baseline
    };
    // 先按本人归队状态释放舰队，再补读战果，历史战报分页不能延长舰队占用。
    const changes = settleFleetSnapshot(ledger, snapshot);
    let reports;
    const needReport = outstanding
      .map(([, r]) => r)
      .filter((r) => {
        if (!r.confirmed || !own.fleets.some((f) => f.buildingId === r.details.buildingId && fleetAtHome(f)))
          return false;
        if (r.details.kind === 'worldBoss') return !r.details.observed && dayOf(now) === r.details.day;
        return (
          r.details.kind === 'pirateFirst' &&
          r.details.ownBattle &&
          integer(r.details.battleAt) &&
          !pirate?.records?.some((k) => k.type === r.details.type && k.maxKilledLevel >= r.details.level)
        );
      });
    if (needReport.length) {
      try {
        reports = await completionReports(client, worldId, needReport);
      } catch (error) {
        readErrors.push({ request: 'CampaignReportsRequest', error: error.message });
      }
    }
    if (!sameOwner() || client.connected === false) return changes;
    if (reports?.length) changes.push(...settleFleetSnapshot(ledger, { ...snapshot, reports }));
    const current = ledger.keyRecords();
    reconcilePirateFlights(client, current, worldId);
    const scan = needReport.length ? reportCache.get(client) : null;
    emitDiagnostic(client, 'fleet-settlement', {
        worldId, now, readErrors, changes,
        reportScan: scan ? { pageNo: scan.pageNo, total: scan.total, received: scan.received,
          uniqueReports: scan.seenIds.size, consistent: scan.consistent, complete: scan.complete,
          finishedAt: scan.finishedAt } : null,
        records: outstanding.map(([key, before]) => ({ key, before, after: current[key] ?? null })),
        fleets: own.fleets.map(f => ({ buildingId: f.buildingId, state: f.state, curGridIdx: f.curGridIdx,
          targetGridIdx: f.targetGridIdx, treasureLootUid: exactAutomationId(f.treasureLootUid),
          chipWarRewardTs: f.chipWar?.rewardTs })),
        kills: pirate?.records,
        reports: reports?.map(r => ({ uid: exactAutomationId(r.uid), type: r.type, createTime: normalize(r.createTime),
          scenarioId: r.scenarioId, pirate: r.pirate, worldBoss: r.worldBoss, win: r.win }))
    });
    return changes;
  })();
  checking.set(client, job);
  try {
    return await job;
  } finally {
    if (checking.get(client) === job) checking.delete(client);
  }
}
