import { serveClientAsset } from './ui-assets.mjs';
import { createTraceLog, traceJson, redactLog } from './trace-log.mjs';
import { createResourceUpdater } from './resource-updater.mjs';
import {checkFleetSettlement,invalidateFleetReports} from './fleet-settlement.mjs';
import { recoverPirateHunts } from './pirate-recovery.mjs';
import {readGuildTech,upgradeGuildTech} from './guild-tech.mjs';
import {resourceFieldRows,resourceFieldTotals} from './resource-fields.mjs';
import {activityRankCatalog,readActivityRanking} from './activity-rankings.mjs';
import {readActivityStatistics} from './activity-statistics.mjs';
import { merchantActivity, readMerchantStatus, readMerchantJournal, merchantJournalSummary } from './merchant-activity.mjs';
import { watchMerchant } from './merchant-monitor.mjs';
import { giftCodeStatus, giftCodeSummary, startGiftCodeBatch } from './gift-codes.mjs';
import { initialGiftCodeCatalog } from './gift-code-catalog.mjs';
import {runtimeProgress, museumRuntimeStatus} from './runtime-progress.mjs';
import {watchTreasureTravel} from './treasure-follow.mjs';
import { watchGuildShipPushes } from './guild-ships.mjs';
import { watchHeroRaidPushes } from './hero-raid-automation.mjs';
import { watchSiliconMining } from './silicon-mining.mjs';
import { previewExtended } from './extended-preview.mjs';
import {watchFleetMaintenance,fleetMaintenanceEnabled} from './fleet-maintenance.mjs';
import {watchFleetSpeed,readFleetSpeed,planFleetSpeed} from './fleet-speed.mjs';
import {observeOwnedFleets,ownedFleetCatalog} from './fleet-catalog.mjs';
import {readPirateSweeps} from './pirate-sweeps.mjs';
import {readWorldTarget} from './world-target.mjs';
import {readWorldBoss} from './world-boss.mjs';
import { readWeekCalendar, claimReportRewards, rewardData } from './missing-rewards.mjs';
import { readWorldOverview } from './world-overview.mjs';
import { readAllianceRadar } from './alliance-radar.mjs';
import { planRadarPreview, pendingPetrol } from './dispatch-preview.mjs';
import { inspectHunt } from './pirates.mjs';
import { selectPirateAdvance, runSinglePirateHunt } from './pirate-advance.mjs';
import { fleetRecordReason, dispatchReservationReason, fleetDispatchView, dispatchLabels, bridgeFleetReservations } from './fleet-availability.mjs';
import { watchFreeRewardClock } from './extra-free-rewards.mjs';
import { createPirateAdvanceTask } from './pirate-advance.mjs';
import { automationControlView, setAutomationControl } from './automation-controls.mjs';
import { activityAvailability, isActivityTaskAvailable } from './activity-availability.mjs';
import { activityAutomationFields, activityAutomationControl } from './activity-automation.mjs';
import http from 'node:http';
import { setTimeout as recoveryWait } from 'node:timers/promises';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import zlib from 'node:zlib';
import { GameClient, toNumber } from './client.mjs';
import { challengeTrial, trialProgress, createTrialTask } from './trials.mjs';
import { readTrialSweeps, executeTrialSweep } from './trial-sweeps.mjs';
import { readHeroEquipment, equipHeroEmptySlots, enhanceHeroEquipment, uidText } from './hero-equipment.mjs';
import { readEquipmentCrafting, startEquipmentCraft, collectEquipmentCraft } from './equipment-crafting.mjs';
import { readLineups, applyLineup } from './lineups.mjs';
import { getLineupCatalog, readLineupEditor, validateLineupSettings } from './saved-lineups.mjs';
import { readLineupRuntime, recoverLineup } from './lineup-runtime.mjs';
import { createLineupExecutor, lineupRole, selectedSavedLineup } from './lineup-execution.mjs';
import { lineupArt } from './lineup-art.mjs';
import { pirateBoard } from './pirate-board.mjs';
import { readGuild, readGuildMembers, claimGuildWelfare, claimMyGuildAid } from './guild.mjs';
import { createGuildMutualTask, readMutualOptions, mutualOptions, loadMutualPreset, saveMutualPreset } from './guild-mutual.mjs';
import { readFleetFormations, initializeFleetFormation } from './fleet-formation.mjs';
import { loadProtocol } from './proto.mjs';
import { PAGE } from './page.mjs';
import { iconThumb } from './art-thumbs.mjs';
import { listWorlds, enterWorld, describeRole } from './worlds.mjs';
import { collectState, summarize, formatState, ENTRY_QUERIES } from './game.mjs';
import { claimRewards } from './claim-rewards.mjs';
import { fishView, newbieView } from './collections.mjs';
import { normalize } from './worlds.mjs';
import { pirateTracker, pirateHuntOptions, startPirateHunt } from './pirates.mjs';
import { activityEntries, activityView, runActivity, runWeekOrder } from './activities.mjs';
import { activityCatalogPushNames, readActivityCatalog, rememberActivityCatalog, rememberActivityPush } from './activity-catalog.mjs';
import { displayMaterial, getConfig } from './config.mjs';
import { planHeroes, runHeroPlan, formatHeroPlan } from './heroes.mjs';
import { appointments } from './appointments.mjs';
import { APPOINTMENT_PRIORITIES } from './appointment-priorities.mjs';
import { surveyDailies, runDailies, formatSurvey } from './dailies.mjs';
import { dailySingleState, addDailyOptions, runDailySingle } from './daily-single.mjs';
import { surveyTasks, runTasks, formatTaskPlan, selectTaskSettings } from './tasks.mjs';
import { makeTypeResolver, weekFactoryInfo, surveyWorld, planWorld, runWorldRound, submitResidentOrder, rerollResidentOrder, watchResidentRefreshes, formatWorldPlan, formatFieldReport, loadMapAsset } from './world.mjs';
import { runLoop, formatLoopRound, formatLoopStep } from './loop.mjs';
import { describeLogError } from './log-errors.mjs';
import { classifyLog } from './log-categories.mjs';
import { createLogAccountLabels } from './log-accounts.mjs';
import { operationLabels } from './operation-labels.mjs';
import { automationTasks, defaultFishingGoldReserve, defaultCompassSpinCount, maxCompassSpinCount, taskSettings, worldTaskKey, dailyTaskKey } from './automation.mjs';
import { rewardSchedule } from './reward-schedule.mjs';
import { rememberTournament } from './side-rewards.mjs';
import { beijingDay, loadAutomationSettings, saveAutomationSettings, validateSettings, settingsCatalog, settingsFromNative, nativeTaskValues, applyNativeTask, hasExtraWork, createUsageLedger, exportAutomationSettings, importAutomationSettings, SettingsError, settingsUiRules } from './automation-settings.mjs';
import { budgetPreview, exactAutomationId, createActionGuard, nativePreferenceEnabled, needsCargoDemand, AutomationSkip } from './automation-policy.mjs';
import { readTreasureLoot, planTreasureLoot, treasureAutomationEnabled } from './treasure-loot.mjs';
import { readCityWar, planCityWar, cityWarEnabled, cityWarReservedFleets, refreshCityWarReservations } from './city-war.mjs';
import { readWorldOnlineReward, worldOnlineRewardKey } from './world-online-rewards.mjs';
import { readEquipmentForge, planEquipmentForge, releaseStaleEquipmentForge, forgeEnabled } from './equipment-forge.mjs';
import { reconcileManualForge } from './manual-forge-sync.mjs';
import { readAntiqueUpgrade, planAntiqueUpgrade, antiqueEnabled } from './antique-upgrade.mjs';
import { watchBasePushes, surveyBaseAutomation, planBaseAutomation, baseDemands, previewNativeAutomation } from './base-automation.mjs';
import { reconcileManualProduction } from './manual-production-sync.mjs';
import { readProductionSnapshot } from './production-snapshot.mjs';
import { planProduction } from './production-planning.mjs';
import { watchProductionTimings } from './production-timing.mjs';
import { captureManualProductionMaterialState } from './order-reservations.mjs';
import { createStageTask } from './stages.mjs';
import { createChallengeRun } from './challenge-automation.mjs';
import { runAction } from './actions.mjs';
import { accountId, loadStore, saveStore, upsertAccount, removeAccount, setActive, pickAccount, describeAccount, revealAccount, rememberSeen, DATA_DIR } from './accounts.mjs';
import { ACCOUNT_BACKUP_MAX_BYTES, exportAccountBackup, previewAccountImport, importAccountBackup } from './account-backup.mjs';
import { startCapture, stopCapture, captureState, inspectCaptureRecovery, recoverCapture, DEFAULT_PROXY_PORT } from './capture.mjs';
import { createPhoneLogin, loadDeviceProfile, saveDeviceProfile, DEVICE_PROFILE_PATH } from './phone-login.mjs';
import { createAlipayLogin } from './alipay-login.mjs';
import { iconIndex, atlasFile, itemIcon, resourceIcon, materialIcon, heroIcon, heroCard, buildingIcon, workerIcon } from './art.mjs';

const LOG_LIMIT = 400;
const STREAM_BUFFER_LIMIT = 1024 * 1024;
const RUN_VERSION = new Date().toISOString();
const validSpinCount = count => Number.isSafeInteger(count) && count >= 1 && count <= maxCompassSpinCount;
const merchantTaskKeys = ['merchantTrade', 'merchantRewards', 'tradeTasks'];
const overviewQueries = ENTRY_QUERIES.filter(({ name }) => [
  'AllResourceRequest', 'AllItemRequest', 'AllHeroRequest', 'MainTaskInfoRequest', 'DailyTaskInfoRequest',
  'AchievementInfoRequest', 'EmailBoxRequest', 'AfkInfoRequest', 'OnWaterRequest', 'MyResFieldsRequest', 'MonthCardRequest',
].includes(name));
// 协议帧不再进界面，但仍然要能事后查。默认只写文件，CW_DEBUG=1 时才同时打到终端。
const TRACE_PATH = path.join(DATA_DIR, 'protocol.log');
const TRACE_MAX_BYTES = (() => {
  const value = Number(process.env.CW_PROTOCOL_LOG_MAX_BYTES);
  return Number.isSafeInteger(value) && value > 0 ? value : 5 * 1024 * 1024;
})();
// 基地回包包含全部建筑、库存和海兽；截到 400 字会丢掉核销生产/种植/进阶所需的证据。
const FULL_TRACE_MESSAGE = /Fleet|Pirate|TreasureLoot|CampaignReport|DailyTaskInfo|Fishing|GainBig|^(?:OnWater|AllItem|AllResource|AllPet)Response$|^SC(?:Factory|Farm|Pet)/;

const STATE_TEXT = {
  IDLE: '未连接',
  CONNECTING: '连接中',
  READY: '已连接',
  FAILED: '连接失败',
  REJECTED: '服务器拒绝登录',
  CLOSED: '连接已断开',
  STOPPED: '已停止',
};

const pageRaw = Buffer.from(PAGE);
const pageAsset = {
  raw: pageRaw,
  gzip: zlib.gzipSync(pageRaw, { level: 9 }),
  etag: '"' + createHash('sha1').update(pageRaw).digest('hex').slice(0, 16) + '"',
};

export function createConsole({ host = '127.0.0.1', port = 17321, onLog, recoveryDelayMs, resourceUpdates = false, resourceUpdater = null, protocol: protocolOverride,
  alipayLoginController = null, authorize = null,
  captureController = { startCapture, stopCapture, captureState, inspectCaptureRecovery, recoverCapture } } = {}) {
  // 保留测试/嵌入调用方注入延迟的能力；正常运行时由当前账号的登录设置决定。
  const injectedRecoveryDelay = typeof recoveryDelayMs === 'function' ? recoveryDelayMs : null;
  const protocol = protocolOverride ?? loadProtocol();
  const alipayLogin = alipayLoginController ?? createAlipayLogin({ protocol });
  let alipaySaving = false;
  let pendingAlipayLogin = null;
  let cancelledAlipayLoginId = null;
  const traceLog = createTraceLog(TRACE_PATH, { maxBytes: TRACE_MAX_BYTES });
  const globalLog = [];
  const streams = new Set();
  const sessions = new Map();
  let closing = false;
  const resources = resourceUpdater || (resourceUpdates ? createResourceUpdater({ onEvent: ({ level, message }) => emit(null, level, message) }) : null);
  // 先认证并查询已有区服角色，用户选择具体角色后再保存凭证。
  // 密码只用于当次请求；待保存凭证和待选账号只放在内存，十分钟后清理。
  const pendingPhoneLogins = new Map();
  const phonePreviewClients = new Set();
  const smsSendAt = new Map();
  const smsPending = new Set();
  let phoneLoginBusy = false;
  const PHONE_PENDING_MS = 10 * 60 * 1000;
  const maskPhone = (value) => {
    const text = String(value ?? '');
    return /^1\d{10}$/.test(text) ? `${text.slice(0, 3)}****${text.slice(-4)}` : text;
  };
  function prunePhonePending() {
    const cutoff = Date.now() - PHONE_PENDING_MS;
    for (const [id, entry] of pendingPhoneLogins) if (entry.createdAt < cutoff) pendingPhoneLogins.delete(id);
  }
  function phoneLoginStatus() {
    const device = loadDeviceProfile();
    const devicePath = path.resolve(process.env.CW_EWAN_DEVICE || DEVICE_PROFILE_PATH);
    return {
      deviceReady: Boolean(device),
      devicePath,
      deviceModel: device?.model ?? null,
      deviceSource: device?.source ?? null,
      deviceError: !device && fs.existsSync(devicePath) ? '设备档案无法读取或格式无效，请修复文件或重新导入。' : null,
    };
  }

  function clearAlipayRoles() {
    pendingAlipayLogin?.controller?.abort();
    clearTimeout(pendingAlipayLogin?.expiryTimer);
    pendingAlipayLogin = null;
  }

  function readAlipayRoles(pending) {
    if (pending.reading) return pending.reading;
    pending.entry.choices = [];
    pending.entry.roleError = null;
    pending.controller = new AbortController();
    const reading = readPhoneRoles(pending.entry, { signal: pending.controller.signal }).finally(() => {
      if (pending.reading === reading) pending.reading = null;
    });
    pending.reading = reading;
    return reading;
  }

  function alipayLoginStatus(id) {
    const state = alipayLogin.status(id);
    if (cancelledAlipayLoginId !== state.id) cancelledAlipayLoginId = null;
    if (state.id && state.id === cancelledAlipayLoginId) {
      clearAlipayRoles();
      return { ...state, phase: 'cancelled', qrImage: null };
    }
    if (state.phase !== 'captured') {
      clearAlipayRoles();
      return state;
    }
    if (pendingAlipayLogin?.id !== state.id) {
      clearAlipayRoles();
      const credential = alipayLogin.takeCredential(state.id);
      if (!accountId(credential) || credential.source !== 'alipay') throw new Error('支付宝游戏登录凭证无效，请重新扫码');
      pendingAlipayLogin = {
        id: state.id, reading: null, controller: null,
        entry: { credential, userName: '支付宝账号', choices: [], roleError: null },
      };
      const pending = pendingAlipayLogin;
      pending.expiryTimer = setTimeout(() => {
        if (pendingAlipayLogin === pending) clearAlipayRoles();
      }, Math.max(0, state.expiresAt - Date.now()));
      pending.expiryTimer.unref?.();
      void readAlipayRoles(pendingAlipayLogin);
    }
    const pending = pendingAlipayLogin;
    const store = loadStore();
    const idOfAccount = accountId(pending.entry.credential);
    const existing = store.accounts.find(account => account.id === idOfAccount);
    return {
      ...state,
      phase: pending.reading ? 'reading-roles' : 'captured',
      choices: roleChoices(pending.entry, store),
      roleError: pending.entry.roleError,
      account: { id: idOfAccount, title: existing ? describeAccount(existing).title : '支付宝账号' },
    };
  }

  function requireAlipayRoles(id) {
    if (closing) throw new Error('控制台已关闭');
    const state = alipayLoginStatus(id);
    const pending = pendingAlipayLogin;
    if (!pending || pending.id !== id || !['captured', 'reading-roles'].includes(state.phase)
      || state.expiresAt <= Date.now()) throw new Error('扫码结果已过期或已保存，请重新扫码');
    return pending;
  }

  async function saveAlipayRole(pending, choice) {
    // 排队期间扫码可能被取消、过期或刷新，落盘前重新检查本次选择。
    if (requireAlipayRoles(pending.id) !== pending || pending.reading || !pending.entry.choices.includes(choice)) {
      throw new Error('角色列表已变化，请重新选择角色');
    }
    pending.entry.credential = alipayLogin.takeCredential(pending.id);
    const result = await saveSelectedRole(pending.entry, choice, { sourceLabel: '支付宝扫码', stopExisting: true });
    pending.entry.credential = null;
    pending.entry.choices = [];
    cancelledAlipayLoginId = pending.id;
    clearAlipayRoles();
    return result;
  }

  async function readPhoneWorlds(credential, { signal } = {}) {
    if (closing) throw new Error('控制台已关闭');
    signal?.throwIfAborted();
    const session = sessions.get(accountId(credential));
    if (session?.connecting) await session.connecting.catch(() => {});
    signal?.throwIfAborted();
    const activeClient = session?.client;
    if (activeClient?.connected && !session.paused) {
      const generation = session.generation;
      return readJob(session, () => {
        signal?.throwIfAborted();
        if (closing || session.client !== activeClient || !activeClient.connected || session.generation !== generation || session.paused) {
          throw new Error('账号连接已变化，请重新读取角色列表');
        }
        return listWorlds(activeClient);
      });
    }
    const client = new GameClient({ url: credential.url, protocol });
    phonePreviewClients.add(client);
    const stop = () => client.stop();
    signal?.addEventListener('abort', stop, { once: true });
    try {
      // 只登录最近区服并查询列表，选择阶段不逐个进入其他区服。
      await client.connect({ ...credential.login, worldId: 0 });
      signal?.throwIfAborted();
      if (closing) throw new Error('控制台已关闭');
      return await listWorlds(client);
    } finally {
      signal?.removeEventListener('abort', stop);
      client.stop();
      phonePreviewClients.delete(client);
    }
  }

  async function readPhoneRoles(entry, options) {
    try {
      const worlds = await readPhoneWorlds(entry.credential, options);
      const previous = new Map(entry.choices.map(choice => [choice.worldId, choice.id]));
      const seen = new Set();
      entry.choices = worlds.recentWorlds.filter(world => {
        if (!uidText(world.role?.id) || !Number.isSafeInteger(world.worldId) || world.worldId <= 0 || seen.has(world.worldId)) return false;
        seen.add(world.worldId);
        return true;
      }).map(world => ({ ...world, id: previous.get(world.worldId) || randomUUID() }));
      entry.roleError = null;
    } catch (error) {
      entry.roleError = describeLogError(error.message || '角色列表读取失败，请重试').message;
    }
  }

  function roleChoices(entry, store) {
    const idOfAccount = accountId(entry.credential);
    const existing = store.accounts.find(account => account.id === idOfAccount);
    return entry.choices.map(choice => ({
      id: choice.id, accountId: idOfAccount, userName: entry.userName,
      nickname: choice.role.nickname || '未命名角色', level: choice.role.level ?? null, power: choice.role.power ?? null,
      worldId: choice.worldId, worldName: choice.worldName,
      roleWorldId: choice.role.worldId || choice.worldId, roleWorldName: choice.role.worldName || choice.worldName,
      matched: Boolean(existing), existingTitle: existing ? describeAccount(existing).title : null,
    }));
  }

  function phonePreview(pending) {
    const store = loadStore();
    const choices = [];
    const failures = [...pending.authenticationFailures];
    const emptyAccounts = [];
    for (const entry of pending.entries) {
      if (entry.roleError) failures.push({ userName: entry.userName, error: entry.roleError, retryable: true });
      else if (!entry.choices.length) emptyAccounts.push({ userName: entry.userName });
      choices.push(...roleChoices(entry, store));
    }
    return { ok: true, id: pending.id, phone: maskPhone(pending.phone), choices, failures, emptyAccounts,
      linkedAccountCount: pending.linkedAccountCount, expiresAt: pending.createdAt + PHONE_PENDING_MS };
  }

  async function saveSelectedRole(entry, choice, { sourceLabel = 'APP 登录', stopExisting = false } = {}) {
    const idOfAccount = accountId(entry.credential);
    const session = sessions.get(idOfAccount);
    if (session?.connectionDrain) await session.connectionDrain;
    if (closing) throw new Error('控制台已关闭');
    const roleWorldId = choice.role.worldId || choice.worldId;
    const previous = loadStore().accounts.find(account => account.id === idOfAccount);
    const currentRoleId = uidText(session?.player?.playerId ?? session?.player?.id);
    const selectedRoleId = uidText(choice.role.id);
    const sameRole = currentRoleId && selectedRoleId ? currentRoleId === selectedRoleId
      : toNumber(session?.player?.worldId) === roleWorldId
        && toNumber(session?.player?.bornWorldId || previous?.login?.worldId) === choice.worldId;
    if (session && (stopExisting || !sameRole || session.loginBlocked || session.loginRecoveryJob)) {
      const reason = stopExisting ? '支付宝账号已重新扫码，正在更新连接'
        : sameRole ? '账号凭证已更新，正在恢复连接' : '已选择其他角色，停止旧角色任务';
      requireProductionSync(session);
      session.generation++;
      stopLoop(session, reason, { preserveAutoStart: true });
      saveAutomation(session.id, { enabled: false });
      session.stages.stop(reason);
      session.mutualAid.stop(reason);
      for (const task of session.trials.values()) task.stop(reason);
      await closeSessionConnection(session, { includeWorld: true });
    }
    if (closing) throw new Error('控制台已关闭');
    const store = loadStore();
    const existing = store.accounts.find(account => account.id === idOfAccount);
    const credential = { ...entry.credential, login: { ...entry.credential.login, worldId: choice.worldId } };
    const fallbackLabel = entry.credential.source === 'alipay' ? '未命名角色' : entry.userName;
    const label = existing?.label && existing.label !== existing.lastSeen?.nickname ? existing.label : choice.role.nickname || fallbackLabel;
    const { account, created } = upsertAccount(store, credential, { label });
    account.automation = { ...account.automation, autoStart: autoStartEnabled(account), loginBlocked: false, loginRecovery: null };
    rememberSeen(account, { ...choice.role, nickname: choice.role.nickname || '未命名角色', worldId: roleWorldId });
    setActive(store, account.id);
    saveStore(store);
    rememberLogAccounts(store.accounts);
    emit(null, 'info', `${sourceLabel}${created ? '已新增' : '已更新'}账号 ${describeAccount(account).title}，已选择 ${choice.worldName} ${choice.role.nickname || '未命名角色'}`);
    const savedSession = sessionFor(account.id);
    savedSession.loginBlocked = false;
    savedSession.loginRecovery = null;
    void startAutomaticLoop(savedSession);
    return {
      ok: true,
      account: { ...describeAccount(account, { active: true }), status: accountStatus(savedSession) },
      selectedRole: { nickname: choice.role.nickname || '未命名角色', worldId: choice.worldId, worldName: choice.worldName,
        roleWorldId, roleWorldName: choice.role.worldName || choice.worldName },
    };
  }

  async function savePhoneRole(pending, entry, choice) {
    const result = await saveSelectedRole(entry, choice);
    pendingPhoneLogins.delete(pending.id);
    return result;
  }
  let logId = 0;
  const logAccountLabels = new Map();
  function rememberLogAccounts(accounts) {
    for (const [id, label] of createLogAccountLabels(accounts)) logAccountLabels.set(id, label);
  }
  trace(null, 'runtime', { startedAt: RUN_VERSION, node: process.version });

  const logLimit = (list) => {
    while (list.length > LOG_LIMIT) list.shift();
  };

  // Browsers only subscribe to progress. A closed or slow tab must never stop
  // the account's background job or keep buffering logs without a limit.
  function writeStream(res, payload) {
    if (res.destroyed || res.writableEnded) { streams.delete(res); return false; }
    try {
      if (res.writableLength + Buffer.byteLength(payload) > STREAM_BUFFER_LIMIT) {
        streams.delete(res);
        res.destroy();
        return false;
      }
      res.write(payload);
      return true;
    } catch {
      streams.delete(res);
      res.destroy();
      return false;
    }
  }

  function emit(session, level, message, extra) {
    const display = describeLogError(message, extra);
    const operationDetail = extra?.operationId ? [
      '操作 ' + extra.operationId,
      extra.dedupeKey ? '防重键 ' + extra.dedupeKey : '',
      '阶段 ' + extra.phase + ' / ' + extra.result,
    ].filter(Boolean).join('\n') : '';
    const detail = [extra?.diagnostic, display.detail, operationDetail].filter(Boolean).join('\n');
    const entry = redactLog({ id: ++logId, t: Date.now(), level, category: classifyLog(display.message, extra), message: display.message, detail: detail || undefined, extra, account: session?.id ?? null,
      accountName: session ? logAccountLabels.get(session.id) || session.player?.nickname || '未命名账号' : undefined,
      operationId: extra?.operationId, dedupeKey: extra?.dedupeKey, module: extra?.module, phase: extra?.phase, result: extra?.result });
    trace(session, 'business', entry);
    const list = session ? session.log : globalLog;
    list.push(entry);
    logLimit(list);
    // Logging is an observer too: a broken terminal sink cannot cancel a job.
    try { if (onLog) Promise.resolve(onLog(entry)).catch(() => {}); } catch { /* Preserve the in-memory log. */ }
    const payload = `id: ${entry.id}\ndata: ${JSON.stringify(entry)}\n\n`;
    for (const res of streams) {
      if (!res.allAccounts && entry.account !== null && res.account !== entry.account) continue;
      writeStream(res, payload);
    }
    return entry;
  }

  // 协议层细节（帧、序号、字节数、原始 JSON）只落盘，不进运行记录。
  function trace(session, line, data) {
    try {
      const detail = data === undefined ? '' : ' ' + traceJson(data);
      const text = `${new Date().toISOString()} [${session?.id.slice(0, 8) ?? 'system'}] ${line}${detail}\n`;
      traceLog.write(text);
      if (process.env.CW_DEBUG === '1') process.stdout.write(text);
    } catch { /* 诊断记录失败不得影响请求、调度与网页日志。 */ }
  }

  function enqueue(session, work, label, { recoverFormation = true } = {}) {
    if (closing || session.connectionDrain) return Promise.reject(new Error('账号正在结束当前挑战并恢复阵容，请稍后操作'));
    if (session.queueTail && label) emit(session, 'info', label + '已排队，当前操作结束后执行');
    const generation = session.generation;
    const run = async () => {
      if (closing || session.connectionDrain || session.paused || generation !== session.generation) throw new Error('账号已暂停，已取消排队操作');
      if (recoverFormation && !session.lineupJob && session.client?.connected && session.player
        && readLineupRuntime(session.id).pending) {
        await recoverSessionLineup(session);
        if (session.paused || generation !== session.generation) throw new Error('账号已暂停，已完成阵容恢复');
      }
      return work();
    };
    const job = (session.queueTail ?? Promise.resolve()).then(run, run);
    session.queueTail = job;
    const clear = () => { if (session.queueTail === job) session.queueTail = null; };
    job.then(clear, clear);
    return job;
  }

  function newSession(id) {
    const accounts = loadStore().accounts;
    rememberLogAccounts(accounts);
    const saved = accounts.find(account => account.id === id)?.automation;
    const detailed = loadAutomationSettings(id);
    const preferences = detailed.revision ? detailed.settings : null;
    return {
      id,
      preferences,
      preferencesRevision: detailed.revision,
      preferencesSavedAt: detailed.savedAt,
      paused: saved?.paused === true,
      loginBlocked: saved?.loginBlocked === true,
      loginRecovery: saved?.loginRecovery ?? null,
      loginRecoveryJob: null,
      loginRecoveryController: null,
      loginRecoveryWait: null,
      productionSyncRequired: saved?.productionSyncRequired === true,
      productionSyncDrain: null,
      syncingProduction: null,
      generation: 0,
      client: null,
      connecting: null,
      connectionDrain: null,
      player: null,
      pirateAdvance: createPirateAdvanceTask(),
      stages: createStageTask(),
      trials: new Map(),
      mutualAid: createGuildMutualTask(),
      busy: null,
      overviewRead: null,
      claiming: null,
      reportClaim: null,
      heroJob: null,
      queueTail: null,
      lineupJob: null,
      lineupState: { phase: 'idle' },
      appointmentJob: null,
      residentJobs: new Map(),
      progressionJobs: new Map(),
      log: [],
      logClearBefore: 0,
      logClearAt: 0,
      dailySingle: dailySingleState(),
      loop: {
        running: false,
        autoStart: saved?.autoStart ?? saved?.enabled ?? false,
        rounds: preferences?.loop.rounds ?? saved?.rounds ?? 0,
        completed: 0,
        everyMs: (preferences?.loop.everySeconds ?? saved?.everySeconds ?? 60) * 1000,
        tasks: preferences ? nativeTaskValues(preferences, taskSettings(saved?.tasks)) : taskSettings(saved?.tasks),
        fishingGoldReserve: preferences?.gather.fishingGoldReserve ?? saved?.fishingGoldReserve ?? defaultFishingGoldReserve,
        compassSpinCount: validSpinCount(saved?.compassSpinCount) ? saved.compassSpinCount : defaultCompassSpinCount,
        controller: null, job: null,
        attemptController: null, connectionFailure: null, recovery: null,
        history: [],
        error: null,
      },
    };
  }

  // Share identical clicks until this account's queued operation has finished.
  // 页面读取：队列空闲时照常排队；挂机一轮可持续一分钟以上，此时改在它两次请求之间读取，不等整轮结束。
  function readJob(session, work) {
    if (closing || session.connectionDrain) return Promise.reject(new Error('账号正在结束当前挑战并恢复阵容，请稍后操作'));
    const client = session.client, generation = session.generation;
    if (!session.queueTail || !client?.connected || !client.interleaveRead
      || session.connecting || session.syncingProduction || session.productionSyncRequired) return enqueue(session, work);
    return client.interleaveRead(() => {
      if (closing || session.connectionDrain || session.paused || generation !== session.generation) throw new Error('账号已暂停，已取消排队操作');
      return work();
    });
  }

  function progressionJob(session, account, key, label, action, { read = false } = {}) {
    if (!session.progressionJobs.has(key)) {
      const generation = session.generation;
      const schedule = read ? work => readJob(session, work) : work => enqueue(session, work, label);
      const job = schedule(async () => {
        const client = await ensureConnected(session, account);
        const enabled = () => session.client === client && client.connected && !session.paused && generation === session.generation;
        if (!enabled()) throw new Error('账号连接已变化，请刷新后再试');
        return action(client, enabled);
      }).finally(() => session.progressionJobs.delete(key));
      session.progressionJobs.set(key, job);
    }
    return session.progressionJobs.get(key);
  }

  function sessionFor(id) {
    if (!sessions.has(id)) {
      const session = newSession(id);
      sessions.set(id, session);
      try {
        const audit = JSON.parse(fs.readFileSync(factoryReportFile(id), 'utf8'));
        if (audit.lines?.length) emit(session, 'info', '上次工厂检查 · ' + audit.time, { diagnostic: audit.lines.join('\n') });
      } catch { /* 新账号没有历史核对记录 */ }
    }
    return sessions.get(id);
  }

  function usageFor(session) {
    return createUsageLedger(session.id, { now: () => Date.now() + (session.client?.serverClockOffsetMs ?? 0) });
  }

  function adoptPreferences(session, entry) {
    const previousLogin = JSON.stringify(session.preferences?.login);
    session.preferences = entry.settings;
    session.preferencesRevision = entry.revision;
    session.preferencesSavedAt = entry.savedAt;
    session.loop.tasks = nativeTaskValues(entry.settings, session.loop.tasks);
    session.loop.fishingGoldReserve = entry.settings.gather.fishingGoldReserve;
    session.loop.everyMs = entry.settings.loop.everySeconds * 1000;
    if (!session.loop.running) session.loop.rounds = entry.settings.loop.rounds;
    session.client?.emit?.('automationSettingsChanged');
    if (previousLogin !== JSON.stringify(entry.settings.login)) refreshLoginRecovery(session);
  }

  function settingsView(session) {
    const saved = loadAutomationSettings(session.id);
    if (saved.revision && saved.revision !== session.preferencesRevision) adoptPreferences(session, saved);
    const settings = saved.revision ? saved.settings : settingsFromNative(session.loop.tasks, {
      rounds: session.loop.rounds, everySeconds: session.loop.everyMs / 1000, fishingGoldReserve: session.loop.fishingGoldReserve,
    });
    const baseRevision = createHash('sha256').update(JSON.stringify([session.loop.tasks, session.loop.rounds, session.loop.everyMs, session.loop.fishingGoldReserve])).digest('hex');
    const availability = activityAvailability(session.client);
    return { settings, revision: saved.revision, savedAt: saved.savedAt, baseRevision, catalog: ownedFleetCatalog(session,settingsCatalog(loadConfigSafe())),
      tasks: automationTasks.filter(task => !availability.hiddenTasks.includes(task.key)), rules: { ...settingsUiRules(), hiddenFields: availability.hiddenFields },
      usage: usageFor(session).snapshot(), pendingUsage: usageFor(session).pendingCounters(), running: session.loop.running };
  }

  function lineupPresetsView(session) {
    const current = settingsView(session);
    const recovery = readLineupRuntime(session.id);
    syncLineupRecoveryState(session, recovery);
    return { ...current.settings.lineups, revision: current.revision,
      trialRaids: current.catalog.trialRaids, catalog: getLineupCatalog(loadConfigSafe()),
      recovery: session.lineupJob ? { ...recovery, ...session.lineupState } : recovery };
  }

  function observeLineup(session, event) {
    session.lineupState = event;
    const labels = { switching: '正在切换挑战阵容', battling: event.lineupId ? '使用所选阵容挑战' : '使用游戏当前阵容挑战', restoring: '正在恢复原阵容',
      pending: '原阵容待恢复', conflict: '阵容恢复需要处理', idle: '阵容核对完成' };
    emit(session, event.phase === 'pending' || event.phase === 'conflict' ? 'warn' : 'state',
      labels[event.phase] + (event.reason ? ' · ' + event.reason : ''), { lineupChanged: true });
  }

  function syncLineupRecoveryState(session, recovery) {
    const tasks = [session.stages, ...session.trials.values()];
    const progress = [['stageAuto', session.loop.challengeRun?.mainline],
      ...Object.entries(session.loop.challengeRun?.trials ?? {}).map(([id, state]) => ['trialAuto:' + id, state])];
    if (!tasks.some(task => task.view().lineupRestorePending) && !progress.some(([, state]) => state?.lineupRestorePending)) return;
    if (session.lineupJob || (recovery ?? readLineupRuntime(session.id)).pending) return;
    for (const task of tasks) task.lineupRestored();
    for (const [key, state] of progress) {
      if (!state?.lineupRestorePending) continue;
      state.lineupPhase = 'idle';
      state.lineupRestorePending = false;
      state.reason = '阵容核对已完成，请重新开始挂机以继续该挑战';
      session.loop.controlStatus?.set(key, { text: state.reason, state: 'waiting', checkedAt: Math.floor(Date.now() / 1000) });
    }
  }

  async function recoverSessionLineup(session, options = {}) {
    const job = recoverLineup(session.client, { accountId: session.id, role: lineupRole(session.player),
      ...options, onPhase: event => observeLineup(session, event) });
    session.lineupJob = job;
    try { return await job; }
    finally { if (session.lineupJob === job) session.lineupJob = null; }
  }

  function sessionLineupExecutor(session, client, presetId) {
    const generation = session.generation;
    const execute = createLineupExecutor(client, {
      accountId: session.id, presetId, getPlayer: () => session.player,
      getConfig: loadConfigSafe, getSettings: () => settingsView(session).settings,
      enabled: () => session.client === client && client.connected && !session.paused && session.generation === generation,
      onPhase: event => observeLineup(session, event),
    });
    return async (work, context) => {
      const job = execute(work, context);
      session.lineupJob = job;
      try { return await job; }
      finally { if (session.lineupJob === job) session.lineupJob = null; }
    };
  }

  async function finishSessionLineup(session, { client, player, lineupJob }) {
    if (lineupJob) await lineupJob.catch(() => {});
    if (!client?.connected || !player) return;
    try {
      if (readLineupRuntime(session.id).pending) {
        await recoverLineup(client, { accountId: session.id, role: lineupRole(player),
          onPhase: event => observeLineup(session, event) });
      }
    }
    catch (error) { emit(session, 'warn', '已保留待恢复阵容，下一次连接时继续核对 · ' + error.message); }
  }

  function closeSessionConnection(session, { includeWorld = false } = {}) {
    if (session.connectionDrain) return session.connectionDrain;
    const { client, player, lineupJob, worldClient, connecting, generation } = session;
    const drain = (async () => {
      try { await finishSessionLineup(session, { client, player, lineupJob }); }
      finally {
        client?.stop();
        if (includeWorld) worldClient?.stop();
        if (session.generation === generation && session.client === client) {
          session.client = session.player = null;
          if (session.connecting === connecting) session.connecting = null;
        }
      }
    })();
    session.connectionDrain = drain;
    const clear = () => { if (session.connectionDrain === drain) session.connectionDrain = null; };
    drain.then(clear, clear);
    return drain;
  }

  function saveLineupPreferences(session, payload, update) {
    const current = settingsView(session);
    if (!Number.isSafeInteger(payload.revision) || payload.revision !== current.revision) {
      throw new SettingsError({ revision: '阵容或游戏配置已更新，请刷新后再保存' });
    }
    const settings = structuredClone(current.settings);
    update(settings.lineups);
    settings.lineups = validateLineupSettings(settings.lineups);
    const entry = saveAutomationSettings(session.id, settings, { revision: current.revision });
    adoptPreferences(session, entry);
    return lineupPresetsView(session);
  }

  function saveLineupPreset(session, payload, formation) {
    const normalized = validateLineupSettings({ presets: [{ id: 'validation', name: payload.name, formation }] }).presets[0].formation;
    const config = loadConfigSafe();
    if (config?.tables?.FormationTypePositionCfg) {
      const seats = new Set(config.tables.FormationTypePositionCfg.data.filter(row => row.id === normalized.presetId)
        .map(row => row.position.join(',')));
      const heroes = new Set(config.tables.HeroCfg?.data.map(hero => hero.id) ?? []);
      const capacity = Math.max(0, ...(config.tables.FormationHeroNumCfg?.data ?? []).map(row => row.heroNum));
      if (!seats.size || normalized.heroPositions.some(slot => !seats.has(slot.pos.x + ',' + slot.pos.y))) {
        throw new Error('所选阵型或英雄站位无效');
      }
      if (normalized.heroPositions.some(slot => !heroes.has(slot.heroId))) throw new Error('阵容包含未知英雄');
      if (capacity && normalized.heroPositions.length > capacity) throw new Error('上阵英雄超过人数上限');
    }
    const id = payload.id === undefined ? randomUUID() : payload.id;
    const result = saveLineupPreferences(session, payload, lineups => {
      const index = lineups.presets.findIndex(preset => preset.id === id);
      if (payload.id !== undefined && index < 0) throw new Error('此阵容已删除，请刷新后重新选择');
      const preset = { id, name: payload.name, formation: normalized };
      if (index < 0) lineups.presets.push(preset);
      else lineups.presets[index] = preset;
    });
    return { ...result, savedId: id };
  }

  function weekOrderSettingsView(session) {
    const current = settingsView(session);
    return {
      settings: {
        enabled: current.settings.weekOrder.enabled,
        autoSubmit: current.settings.schedule.weekOrderSubmit,
        allowDiamonds: current.settings.weekOrder.allowDiamonds,
        autoFinal: current.settings.schedule.weekOrderFinal,
      },
      revision: current.revision,
      baseRevision: current.baseRevision,
    };
  }

  function heroRaidSettingsView(session) {
    const current = settingsView(session);
    return { settings: current.settings.heroRaid, revision: current.revision, baseRevision: current.baseRevision };
  }

  function guildShipSettingsView(session) {
    const current = settingsView(session);
    return {
      settings: { guildShip: current.settings.guildShip },
      catalog: { materials: current.catalog.materials },
      rules: { numbers: Object.fromEntries(Object.entries(current.rules.numbers).filter(([key]) => key.startsWith('guildShip.'))) },
      revision: current.revision,
      baseRevision: current.baseRevision,
    };
  }

  function appointmentSettingsView(session) {
    const current = settingsView(session);
    return {
      settings: current.settings.appointments,
      revision: current.revision,
      baseRevision: current.baseRevision,
      options: APPOINTMENT_PRIORITIES.map(({ id, label }) => ({ value: id, label })),
    };
  }

  function merchantSettingsView(session) {
    const current = settingsView(session);
    return {
      settings: {
        merchant: current.settings.merchant,
        schedule: Object.fromEntries(merchantTaskKeys.map(key => [key, current.settings.schedule[key]])),
      },
      rules: { numbers: Object.fromEntries(Object.entries(current.rules.numbers).filter(([key]) => key.startsWith('merchant.'))) },
      revision: current.revision,
      baseRevision: current.baseRevision,
    };
  }

  function activityCatalogView(session, activities, catalogOnly = false) {
    const current = settingsView(session);
    const keys = new Set(['fishBook', 'vipDaily', 'campaignReports', 'openRankRewards', ...activities.flatMap(row => row.taskKeys ?? [])]);
    return {
      activities: activities.map(row => {
        const control = activityAutomationControl(row);
        if (!control) return row;
        const [group, field] = control.key.split('.');
        return { ...row, automation: { key: control.key, enabled: current.settings[group][field] } };
      }), catalogOnly,
      eventTasks: automationTasks.filter(task => keys.has(task.key)).map(({ key, label }) => ({ key, label, enabled: session.loop.tasks[key] })),
      compassSpinCount: current.settings.eventActions.compassDrawCount,
      compassSpinEditable: !session.preferences,
      serverNow: (Date.now() + (session.client?.serverClockOffsetMs || 0)) / 1000,
    };
  }

  function activitySettingsView(session) {
    const current = settingsView(session);
    return {
      settings: Object.fromEntries(activityAutomationFields.map(({ key }) => {
        const [group, field] = key.split('.');
        return [key, current.settings[group][field]];
      })),
      controls: activityAutomationFields,
      revision: current.revision,
      baseRevision: current.baseRevision,
    };
  }

  async function refreshFleetReservations(session,settings) {
    await refreshCityWarReservations(session.client, protocol, loadConfigSafe(), session.player,
      () => session.preferences ?? settings);
  }
  function actionGuard(session, client) {
    const generation = session.generation;
    return createActionGuard(client, () => session.preferences, usageFor(session), {
      player: session.player,
      enabled: () => !session.paused && session.generation === generation && session.client === client && client.connected,
    });
  }

  function factoryReportFile(id) {
    return path.join(DATA_DIR, 'factory-report-' + encodeURIComponent(id) + '.json');
  }

  function wire(session, instance) {
    watchBasePushes(instance);
    watchProductionTimings(instance, loadConfigSafe);
    watchGuildShipPushes(instance);
    watchHeroRaidPushes(instance);
    watchSiliconMining(instance);
    instance.on('message', ({name,body}) => {
      if (session.client===instance && ['MyFleetsResponse','SCMyFleetUpdate'].includes(name))
        observeOwnedFleets(session,body?.fleets,{complete:name==='MyFleetsResponse'});
      if(name==='RecruitInfoResponse')instance.freeRecruitTimes={hero:body.hero?.freeEndTimeSeconds,antique:body.antique?.freeEndTimeSeconds};
      if(name==='RecruitStartResponse'||name==='AntiqueRecruitResponse'){
        instance.freeRecruitTimes??={};instance.freeRecruitTimes[name==='RecruitStartResponse'?'hero':'antique']=body.recruitData?.freeEndTimeSeconds;
      }
      if (name === 'TreasureLootStatsResponse') recordTreasureRewards(instance, body);
    });
    instance.on('login',()=>{session.loop.controlStatus=new Map();});
    watchFreeRewardClock(instance);
    watchTreasureTravel(instance);
    watchFleetMaintenance(instance);
    watchFleetSpeed(instance);
    // 任务已停或关闭自动派遣时也处理返航。合并同一批推送，进入账号原有的串行队列。
    let settlementTimer=null, settlementBusy=false, settlementDirty=false;
    const current=()=>session.client===instance && instance.connected && session.player && !session.paused && !session.productionSyncRequired;
    function scheduleSettlement(){
      if(!current())return;
      settlementDirty=true;
      if(settlementTimer||settlementBusy)return;
      settlementTimer=setTimeout(()=>{
        settlementTimer=null;
        if(!current())return;
        settlementBusy=true;
        enqueue(session,async()=>{
          settlementDirty=false;
          if(current()){const changes=await checkFleetSettlement(instance,session.player,usageFor(session),{afterPush:true});
            for(const change of changes)if(change.repairRecovery)emit(session,'info','战后维修 · '+change.buildingId+' · '+change.reason+'（已确认）');}
        }).catch(error=>{if(current())emit(session,'warn','舰队归队状态待核对：'+error.message);}).finally(()=>{
          settlementBusy=false;
          if(settlementDirty&&current())scheduleSettlement();
        });
      },250);
      settlementTimer.unref?.();
    }
    instance.on('message',({name})=>{
      if(name==='SCNewCampaignReport'){
        invalidateFleetReports(instance);
        if(session.client===instance)emit(session,'info','收到新战报',{pirateUpdated:true});
        // 推送领奖遵循当前挂机状态与活动开关，排队和发送前继续核对。
        const generation=session.generation;
        const enabled=()=>current()&&generation===session.generation&&session.loop.running&&session.loop.tasks.campaignReports&&nativePreferenceEnabled(session.preferences,'campaignReports');
        if(enabled()&&!session.reportClaim){
          session.reportClaim=enqueue(session,()=>claimReportRewards(instance,loadConfigSafe(),{
            enabled,ledger:usageFor(session),report:entry=>emit(session,entry.ok||entry.skipped?'info':'warn',
              '战报 · '+(entry.reason||entry.error||entry.label),{pirateUpdated:true}),
          })).catch(error=>{if(current())emit(session,'warn','领取战报奖励失败：'+error.message);})
            .finally(()=>{session.reportClaim=null;});
        }
      }
      if(['SCNewCampaignReport','SCMyFleetUpdate','SCRadarEventState','SCPirateCampaignEnd','SCPirateKillRecordUpdate'].includes(name))scheduleSettlement();
    });
    instance.on('close',()=>{clearTimeout(settlementTimer);settlementTimer=null;settlementDirty=false;});
    instance.on('message', ({ name, body }) => {
      if (session.client === instance && session.player && name === 'SCVipUpdate' && Number.isSafeInteger(body.vipLevel)) {
        session.player.vip = { ...session.player.vip, vipLevel: body.vipLevel, vipExp: body.vipExp };
      }
      if (session.client === instance && session.player && name === 'SCForgeLevelUpdate') {
        session.player.forgeLevel = body.forgeLevel; session.player.forgeExp = body.forgeExp;
      }
      if (session.client === instance && session.player && name === 'SCPlayerPower' && toNumber(body.power) > 0) {
        session.player.power = body.power;
      }
      if (session.client === instance && ['SCGuildAidHelp', 'SCGuildAidRemove', 'SCGuildAidNew'].includes(name) && (body?.type ?? 0) === 0) {
        for (const stream of streams) if (stream.allAccounts || stream.account === session.id) writeStream(stream, `event: guild-aid-changed\ndata: ${JSON.stringify({ account: session.id })}\n\n`);
      }
      if (session.client === instance && session.player) {
        if (name === 'SCJoinGuild') session.player.guildId = body.guildId;
        if (name === 'SCLeaveGuild') session.player.guildId = 0;
      }
      // The loop keeps a reference to this login's player object. Update it in place
      // so crossing an unlock level takes effect without restarting the console.
      if (name === 'SCPlayerExpUpdate' && session.client === instance && session.player && body.level > 0) {
        if (session.player.level !== body.level) {
          for (const key of ['adShop', 'afkAd', 'adSpeedUpProduce', 'adSpeedUpBuilding', 'adSpeedUpMuseum', 'weekPass', 'trialSweep', 'dailyRewards', 'chests',
            'museumCollect', 'museumExplore', 'petCollect', 'petBreed', 'worldOnline', 'tradeTasks', 'seasonTasks',
            'museumRevenue', 'museumAchievements', 'heroGrowth', 'stageAuto', 'treasureLoot', 'comicDrama', 'tournamentDailyGift']) rewardSchedule(instance).clearTask(key);
        }
        session.player.level = body.level;
        session.player.exp = body.exp;
      }
      if (name === 'SCVipUpdate' && session.client === instance && session.player) {
        Object.assign(session.player.vip ??= {}, { vipLevel: body.vipLevel, vipExp: body.vipExp });
      }
      rememberTournament(instance, name, body);
      if (name === 'SCAllActivity' || name === 'SCNewbieActivityUpdate') instance.newbieActivity = normalize(body.newbieActivity);
      if(name==='SCActivityActiveScoreUpdate'){
        const activity=instance.festivals?.find(row=>exactAutomationId(row.activityId)===exactAutomationId(body.activityId));
        const data=activity?.subActivity?.find(sub=>sub.subActivityType===11)?.dailyActive;
        if(data)data.activeScore=body.activeScore;
      }
      if (name === 'SCAllActivity') {
        instance.openRankActivity = body.openRankActivity ? rewardData(body.openRankActivity) : null;
        instance.festivals = body.festivalActivities ?? [];
        instance.seriesSnapshotDay = Math.floor(((Date.now()+(instance.serverClockOffsetMs||0))/1000+28800)/86400);
        instance.tradeWindow = body.trade ? rewardData(body.trade) : null;
        instance.beautyWindow = body.beauty ? rewardData(body.beauty) : null;
        trace(session, '节日活动目录 ' + JSON.stringify(instance.festivals.map(row => ({
          type: row.type, start: row.startTime, end: row.endTime, open: row.openTime, close: row.closeTime,
          subs: row.subActivity.map(sub => sub.subActivityType),
        }))));
      }
      if (activityCatalogPushNames.has(name)) {
        rememberActivityPush(instance, name, body);
        if (name === 'WeekInfoResponse') instance.weekActivities = (body.activityTime ?? []).map(row => ({
          type: row.type, period: row.period, startTime: row.startTime, endTime: row.endTime,
        }));
        try {
          const now = (Date.now() + (instance.serverClockOffsetMs || 0)) / 1000;
          rememberActivityCatalog(session.id, activityEntries(instance, instance.weekActivities ?? [], instance.festivals ?? [], { includeInactive: true }), now);
        } catch (error) { emit(session, 'warn', '保存活动目录失败：' + error.message); }
      }
    });
    instance.on('state', (event) => {
      trace(session, 'state', event);
      emit(session, 'state', STATE_TEXT[event.state] ?? event.state);
    });
    instance.on('frame', ({ dir, name, seq, bytes, body }) => trace(session,
      `${dir === 'out' ? '->' : '<-'} [${name}] seq=${seq} ${bytes.byteLength}B`,
      dir === 'out' && name !== 'LoginRequest' ? body : undefined));
    instance.on('message', ({ seq, name, body }) => {
      try {
        const data = traceJson(body);
        trace(session, `[${name}] seq=${seq} ${FULL_TRACE_MESSAGE.test(name) || data.length <= 400 ? data : data.slice(0, 400) + ' [正文已截断]'}`);
      } catch { /* 记录失败不影响回包处理。 */ }
    });
    instance.on('diagnostic', data => {
      if (data.event === 'operation' || data.event === 'ad-path') {
        const phases = { reserved: '已预留', sent: '已发送，等待确认', confirmed: '已确认', unknown: '结果待确认', cancelled: '已释放预留' };
        const message = data.message ?? `${data.label || data.request} · ${phases[data.phase] ?? data.phase}`;
        emit(session, data.phase === 'unknown' ? 'warn' : 'info', message, data);
      } else trace(session, 'diagnostic', data);
    });
    instance.on('pong', ({ latencyMs, offsetMs }) => trace(session, `pong ${latencyMs}ms offset=${offsetMs}ms`));
    instance.on('drop', ({ name, reason }) => emit(session, reason === 'duplicate' ? 'info' : 'warn',
      reason === 'duplicate' ? '已忽略服务器重复发送的消息' : '服务器消息序号不连续，已跳过这条消息',
      { diagnostic: name + ' · ' + reason }));
    instance.on('warn', (message) => emit(session, 'warn', message === 'ping timeout' ? '服务器心跳超时，连接可能已经断了' : message));
    instance.on('fatal', ({ reason }) => {
      const message = reason === 'SCChannelExpired' ? '这个账号在别处登录了，本条连接被顶掉' : `连接被服务器中断（${reason}）`;
      instance.fatalReason = reason;
      emit(session, 'error', message);
    });
    instance.on('error', (error) => {
      trace(session, 'error', error);
      emit(session, 'error', error.message);
    });
    instance.on('close', () => {
      connectionLost(session, instance);
      emit(session, 'state', '连接已断开');
    });
  }

  function reconnectPolicy(session) {
    try {
      const configured = settingsView(session).settings.login;
      return { autoReconnect: configured?.autoReconnect === true, intervalSeconds: Number(configured?.intervalSeconds) || 900,
        jitterSeconds: Number(configured?.jitterSeconds) || 0, quietHours: configured?.quietHours === true,
        quietStart: configured?.quietStart ?? '02:00', quietEnd: configured?.quietEnd ?? '07:00',
        quietIntervalSeconds: Number(configured?.quietIntervalSeconds) || 60, maxRetries: Number(configured?.maxRetries) || 10 };
    } catch {
      return { autoReconnect: false, intervalSeconds: 900, jitterSeconds: 0, quietHours: false, quietStart: '02:00', quietEnd: '07:00', quietIntervalSeconds: 60, maxRetries: 10 };
    }
  }

  // 登录设置页使用秒与嵌套的深夜窗口，内部挂机配置同样保持秒级字段。
  function loginSettingsView(session) {
    const current = settingsView(session);
    const login = current.settings.login;
    return {
      settings: {
        reconnectEnabled: login.autoReconnect === true,
        baseDelaySeconds: Number(login.intervalSeconds) || 900,
        jitterSeconds: Number(login.jitterSeconds) || 0,
        maxRetries: Number(login.maxRetries) || 5,
        deep: {
          enabled: login.quietHours === true,
          start: login.quietStart || '02:00',
          end: login.quietEnd || '07:00',
          delaySeconds: Number(login.quietIntervalSeconds) || 60,
        },
      },
      revision: current.revision,
      savedAt: current.savedAt,
    };
  }

  function loginSettingsInput(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SettingsError({ settings: '登录设置必须是对象' });
    const deep = value.deep;
    if (!deep || typeof deep !== 'object' || Array.isArray(deep)) throw new SettingsError({ 'deep': '深夜空窗期设置必须是对象' });
    const integer = (name, raw, min, max) => {
      const number = Number(raw);
      if (!Number.isSafeInteger(number) || number < min || number > max) throw new SettingsError({ [name]: `请输入 ${min}–${max} 之间的整数` });
      return number;
    };
    const time = (name, raw) => {
      if (typeof raw !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(raw)) throw new SettingsError({ [name]: '请输入有效时间（HH:mm）' });
      return raw;
    };
    if (typeof value.reconnectEnabled !== 'boolean') throw new SettingsError({ reconnectEnabled: '自动重连必须是开关值' });
    if (typeof deep.enabled !== 'boolean') throw new SettingsError({ 'deep.enabled': '深夜空窗期必须是开关值' });
    return {
      autoReconnect: value.reconnectEnabled,
      intervalSeconds: integer('baseDelaySeconds', value.baseDelaySeconds ?? (value.baseDelayMinutes == null ? undefined : Number(value.baseDelayMinutes) * 60), 1, 86400),
      jitterSeconds: integer('jitterSeconds', value.jitterSeconds ?? (value.jitterMinutes == null ? undefined : Number(value.jitterMinutes) * 60), 0, 86400),
      quietHours: deep.enabled,
      quietStart: time('deep.start', deep.start),
      quietEnd: time('deep.end', deep.end),
      quietIntervalSeconds: integer('deep.delaySeconds', deep.delaySeconds ?? (deep.delayMinutes == null ? undefined : Number(deep.delayMinutes) * 60), 1, 86400),
      maxRetries: integer('maxRetries', value.maxRetries, 1, 1000),
    };
  }

  function inReconnectQuietHours(policy, now = Date.now()) {
    if (!policy.quietHours) return false;
    const parse = value => { const [hour, minute] = String(value).split(':').map(Number); return hour * 60 + minute; };
    const start = parse(policy.quietStart), end = parse(policy.quietEnd);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
    const minutes = Math.floor(((now + 8 * 3600_000) % 86_400_000) / 60_000);
    return start === end ? true : start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
  }

  function reconnectDelayMs(session, attempt, kicked = false) {
    if (!kicked) {
      if (injectedRecoveryDelay) return Math.max(1, Number(injectedRecoveryDelay(attempt)) || 1);
      return Math.min(60000, 3000 * 2 ** Math.min(attempt - 1, 5));
    }
    if (injectedRecoveryDelay) return Math.max(1, Number(injectedRecoveryDelay(attempt)) || 1);
    const policy = reconnectPolicy(session);
    const base = inReconnectQuietHours(policy) ? policy.quietIntervalSeconds : policy.intervalSeconds;
    const jitter = Math.max(0, Math.min(policy.jitterSeconds, 86400));
    const offset = jitter ? Math.floor(Math.random() * (jitter * 2 + 1)) - jitter : 0;
    // 页面单位是秒；抖动即使把结果推到基准值以下，也至少保留一秒。
    return Math.max(1000, (base + offset) * 1000);
  }

  function blockImplicitLogin(session, recovering = false) {
    if (session.loginBlocked) return;
    saveAutomation(session.id, { loginBlocked: true });
    session.loginBlocked = true;
    emit(session, 'warn', recovering ? '账号在别处登录，将按登录设置等待自动重连，连接后自动同步生产状态'
      : '账号在别处登录，已停止自动登录。自行上号结束后，请点击「恢复托管」「连接」或「开始挂机」', { loginBlocked: true });
  }

  function loginRecoveryActive(session) {
    return ['waiting', 'connecting'].includes(session.loginRecovery?.status);
  }

  function saveLoginRecovery(session, state, { loginBlocked = session.loginBlocked } = {}) {
    saveAutomation(session.id, { loginRecovery: state, loginBlocked });
    session.loginRecovery = state;
    session.loginBlocked = loginBlocked;
    if (session.loop.running) session.loop.recovery = loginRecoveryActive(session) ? {
      attempt: state.attempts + (state.status === 'waiting' ? 1 : 0),
      nextAttemptAt: state.nextAttemptAt,
      reason: '账号在别处登录，连接被顶掉',
    } : null;
  }

  function cancelLoginRecovery(session, status = 'cancelled') {
    const state = session.loginRecovery;
    session.loginRecoveryController?.abort();
    session.loginRecoveryWait?.abort();
    if (state?.status === 'connecting') {
      session.generation++;
      session.client?.stop();
    }
    if (state && state.status !== status) {
      saveLoginRecovery(session, { ...state, status });
      if (status === 'cancelled' && ['waiting', 'connecting'].includes(state.status)) {
        emit(session, 'state', '已取消异地登录自动重连', { pauseChanged: true });
      }
    }
  }

  function scheduleLoginRecovery(session, waitStartedAt = Date.now()) {
    const attempts = session.loginRecovery?.attempts ?? 0;
    const policy = reconnectPolicy(session);
    if (!policy.autoReconnect) {
      saveLoginRecovery(session, { status: 'disabled', attempts, waitStartedAt, nextAttemptAt: null });
      return;
    }
    if (attempts >= policy.maxRetries) {
      saveLoginRecovery(session, { status: 'exhausted', attempts, waitStartedAt, nextAttemptAt: null });
      emit(session, 'error', `自动重连已达到最大重试次数（${policy.maxRetries} 次），已停止重试`, { pauseChanged: true });
      return;
    }
    const delay = reconnectDelayMs(session, attempts + 1, true);
    saveLoginRecovery(session, { status: 'waiting', attempts, waitStartedAt, nextAttemptAt: waitStartedAt + delay });
    emit(session, 'warn', `账号在别处登录；${Math.ceil(Math.max(0, waitStartedAt + delay - Date.now()) / 1000)} 秒后自动重连（第 ${attempts + 1}/${policy.maxRetries} 次），连接后自动同步生产状态`,
      { reconnect: { attempt: attempts + 1, maxRetries: policy.maxRetries, delayMs: delay }, pauseChanged: true });
  }

  function refreshLoginRecovery(session) {
    const state = session.loginRecovery;
    if (!state || !session.loginBlocked || session.paused || closing || ['cancelled', 'failed', 'connected'].includes(state.status)) return;
    if (!reconnectPolicy(session).autoReconnect) {
      cancelLoginRecovery(session, 'disabled');
      emit(session, 'state', '已关闭异地登录自动重连', { pauseChanged: true });
      return;
    }
    if (state.status !== 'connecting') {
      scheduleLoginRecovery(session, state.status === 'waiting' ? state.waitStartedAt : Date.now());
      session.loginRecoveryWait?.abort();
      startLoginRecovery(session);
    }
  }

  // 账号级恢复独立于挂机循环。页面读取只能观察等待，循环在旧轮次退出后复用这次恢复。
  function startLoginRecovery(session) {
    if (closing || sessions.get(session.id) !== session || session.paused || !loginRecoveryActive(session) || session.loginRecoveryJob) return session.loginRecoveryJob;
    const controller = new AbortController();
    session.loginRecoveryController = controller;
    const active = () => !controller.signal.aborted && !closing && !session.paused;
    const job = Promise.resolve().then(async () => {
      while (active() && loginRecoveryActive(session)) {
        const policy = reconnectPolicy(session);
        const state = session.loginRecovery;
        if (!policy.autoReconnect) { cancelLoginRecovery(session, 'disabled'); break; }
        if (state.attempts >= policy.maxRetries) { scheduleLoginRecovery(session); break; }
        const delay = Math.max(0, state.nextAttemptAt - Date.now());
        if (delay > 0) {
          const wait = new AbortController();
          session.loginRecoveryWait = wait;
          const cancel = () => wait.abort();
          controller.signal.addEventListener('abort', cancel, { once: true });
          try { await recoveryWait(delay, undefined, { signal: wait.signal }); }
          catch (error) { if (error.name !== 'AbortError') throw error; }
          finally {
            controller.signal.removeEventListener('abort', cancel);
            if (session.loginRecoveryWait === wait) session.loginRecoveryWait = null;
          }
          continue;
        }
        // 顶号可能发生在认证/同步中，先等旧连接收尾，避免并发登录和旧操作跨会话执行。
        await session.connecting?.catch(() => {});
        await session.productionSyncDrain;
        if (!active() || session.loginRecovery !== state) continue;
        const account = loadStore().accounts.find(row => row.id === session.id);
        if (!account) {
          session.loginRecovery = null;
          break;
        }
        saveLoginRecovery(session, { ...state, status: 'connecting', attempts: state.attempts + 1 });
        const generation = session.generation;
        try {
          await connect(session, account, { loginRecoveryController: controller });
          if (!active()) break;
          if (!session.client?.connected || session.generation !== generation) throw Object.assign(new Error('连接尚未恢复'), { recoverable: true });
          // 挂机完整一轮后才清零，防止刚登录又被顶号无限重试。
          saveLoginRecovery(session, session.loop.running || autoStartEnabled(account)
            ? { ...session.loginRecovery, status: 'connected' } : null, { loginBlocked: false });
          emit(session, 'state', '游戏连接已恢复', { pauseChanged: true });
          void startAutomaticLoop(session);
          return;
        } catch (error) {
          if (!active()) break;
          const client = session.client;
          const cause = client?.closeReason;
          client?.stop();
          if (error.loginResponse || error.recoverable === false || ['protocol', 'login-rejected'].includes(cause)) {
            saveLoginRecovery(session, { ...session.loginRecovery, status: 'failed', error: error.message });
            emit(session, 'error', '自动重连已停止：' + error.message, { pauseChanged: true });
            break;
          }
          emit(session, 'warn', '自动重连暂未成功：' + error.message);
          scheduleLoginRecovery(session);
        }
      }
    }).catch(error => {
      if (active()) {
        saveLoginRecovery(session, { ...session.loginRecovery, status: 'failed', error: error.message });
        emit(session, 'error', '自动重连已停止：' + error.message, { pauseChanged: true });
      }
    }).finally(() => {
      if (session.loginRecoveryJob === job) {
        session.loginRecoveryJob = null;
        session.loginRecoveryController = null;
        // 关闭后重新开启设置可能发生在旧尝试收尾期间。
        if (loginRecoveryActive(session)) startLoginRecovery(session);
      }
    });
    session.loginRecoveryJob = job;
    return job;
  }

  function requireProductionSync(session) {
    saveAutomation(session.id, { productionSyncRequired: true });
    session.productionSyncRequired = true;
    // 只等待交接时已经存在的操作。outer loop.job 会执行自动重连，不能等待它自己。
    const oldJobs = [session.productionSyncDrain, session.queueTail, session.client?.readTail];
    session.productionSyncDrain = Promise.allSettled(oldJobs);
  }

  function connectionLost(session, instance) {
    if (instance.lostHandled || instance.stopping || session.client !== instance) return;
    instance.lostHandled = true;
    const kicked = instance.fatalReason === 'SCChannelExpired';
    const policy = reconnectPolicy(session);
    const reason = kicked ? '账号在别处登录，连接被顶掉' : instance.closeReason === 'heartbeat-timeout' ? '服务器心跳连续超时' : '连接已断开';
    session.stages.stop(reason);
    session.pirateAdvance.stop(reason);
    session.mutualAid.stop(reason);
    for (const task of session.trials.values()) task.stop(reason);
    const loop = session.loop;
    if (kicked) {
      requireProductionSync(session);
      blockImplicitLogin(session, policy.autoReconnect);
    }
    session.generation++;
    if (kicked && (!session.loginRecoveryJob || !loginRecoveryActive(session))) {
      if (session.loginRecovery?.status !== 'connected') saveLoginRecovery(session, null);
      scheduleLoginRecovery(session);
      startLoginRecovery(session);
    }
    if (!loop.running || loop.controller?.signal.aborted) return;
    const recoverable = (kicked ? policy.autoReconnect : instance.closeReason !== 'protocol' && instance.closeReason !== 'login-rejected');
    loop.connectionFailure = { reason, recoverable };
    if (recoverable) loop.attemptController?.abort();
    else stopLoop(session, reason + '，已停止挂机', { cancelRecovery: false, preserveAutoStart: true });
  }

  // 每次连接把服务端给的昵称/等级/区服写回账号文件，账号列表里就能看到人话标记。
  function persistIdentity(account, player) {
    try {
      const store = loadStore();
      const target = store.accounts.find((entry) => entry.id === account.id);
      if (!target) return;
      const role = describeRole(player);
      target.lastSeen = { nickname: role?.nickname ?? null, level: role?.level ?? null, power: role?.power ?? null, worldId: role?.worldId ?? null, at: new Date().toISOString() };
      if (!target.label && role?.nickname) target.label = role.nickname;
      saveStore(store);
      rememberLogAccounts(store.accounts);
    } catch {
      /* 回填失败不影响连接 */
    }
  }

  async function loginSession(session, account) {
    if (session.client?.connected) throw new Error('这个账号已经连上了');
    const generation = session.generation, drain = session.productionSyncDrain;
    const syncToken = session.productionSyncRequired ? {} : null;
    if (syncToken) session.syncingProduction = syncToken;
    const client = new GameClient({ url: account.url, protocol });
    wire(session, client);
    session.client = client;
    session.player = null;
    if (syncToken) {
      emit(session, 'info', '正在自动同步手动操作后的生产状态，等待旧任务退出后读取工厂、农田和库存', { pauseChanged: true });
      await drain;
      if (session.generation !== generation || session.paused || session.client !== client || client.stopping) {
        if (session.syncingProduction === syncToken) session.syncingProduction = null;
        client.stop();
        emit(session, 'state', '生产状态同步已取消，保留原记录', { pauseChanged: true });
        throw Object.assign(new Error('连接已取消，保留待同步生产记录'), { recoverable: false });
      }
    }
    try {
    const response = await client.connect(account.login);
    if (session.client !== client || session.generation !== generation || session.paused) {
      client.stop();
      throw new Error('连接已取消');
    }
    session.player = response.playerInfo || null;
    watchResidentRefreshes(client,usageFor(session),session.player);
    client.send('LoginFinishRequest', {});
    if (readLineupRuntime(session.id).pending) {
      try { await recoverSessionLineup(session); }
      catch (error) { emit(session, 'warn', '登录后阵容仍待恢复 · ' + error.message, { lineupChanged: true }); }
    }
    if (syncToken) {
      const player = session.player;
      const enabled = () => session.generation === generation && !session.paused && session.client === client
        && session.player === player && client.connected;
      try {
        const result = await reconcileManualProduction(client, protocol, { player, enabled });
        const forge = await reconcileManualForge(client, protocol, loadConfigSafe(), { player, ledger: usageFor(session), enabled });
        if (!enabled()) throw new Error('同步期间账号连接已变化');
        saveAutomation(session.id, { productionSyncRequired: false });
        session.productionSyncRequired = false;
        if (session.productionSyncDrain === drain) session.productionSyncDrain = null;
        emit(session, 'info', result.message + '；继续按当前状态执行已启用任务', { pauseChanged: true });
        if (forge.factories.length) emit(session, 'info', '已同步手动操作后的装备厂，后续按当前批次和库存继续执行。历史锻造用量仍计入预算。');
      } catch (error) {
        // 读取暂时失败可以自动重试，但不能开放任何经营写操作。
        const cause = client.closeReason;
        const recoverable = !session.paused && session.client === client && !error.loginResponse
          && !['protocol', 'login-rejected'].includes(cause)
          && (enabled() || ['network', 'heartbeat-timeout', 'sequence-gap'].includes(cause)
            || cause === 'kicked' && reconnectPolicy(session).autoReconnect);
        client.stop();
        error.recoverable = recoverable;
        error.productionSyncRetry = recoverable && cause !== 'kicked' && client.fatalReason !== 'SCChannelExpired';
        error.productionSyncGeneration = session.generation;
        emit(session, 'warn', '生产状态暂未同步，保留原记录并暂停本次操作，后续连接会自动重试：' + error.message);
        throw error;
      }
    }
    try {
      const samePrefix = loadStore().accounts.filter(a => a.id.slice(0,8) === account.id.slice(0,8));
      const recovered = recoverPirateHunts(client, session.player, usageFor(session), account.id,
        samePrefix.length === 1 ? TRACE_PATH : null);
      for (const result of recovered) emit(session,'info','已核对首杀战报 '+result.reportId+'，已结算汽油并释放历史首杀占用');
    } catch (error) { emit(session,'warn','首杀历史战果待核对：'+error.message); }

    try {await checkFleetSettlement(client,session.player,usageFor(session));}
    catch(error){emit(session,'warn','舰队历史占用待核对：'+error.message);}
    if (session.client !== client || session.generation !== generation || session.paused || !client.connected) {
      throw new Error('连接初始化期间已断开或取消');
    }
    persistIdentity(account, session.player);
    const role = describeRole(session.player);
    emit(session, 'info', `已进入游戏：${role?.nickname ?? '未知角色'}（${role?.level ?? '?'} 级）`);
    return { url: account.url, result: response.result, initSeqNo: response.initSeqNo, playerInfo: session.player };
    } finally {
      if (syncToken && session.syncingProduction === syncToken) {
        session.syncingProduction = null;
        emit(session, 'state', session.productionSyncRequired ? '生产状态仍待同步，保留原记录' : '生产状态已同步', { pauseChanged: true });
      }
    }
  }

  async function connect(session, account, { backgroundRecovery = false, explicitLogin = false, loginRecoveryController = null } = {}) {
    if (closing || session.connectionDrain) throw new Error('账号正在结束当前挑战并恢复阵容，请稍后连接');
    if (session.paused) throw new Error('账号已暂停，请先恢复托管');
    const authorizedRecovery = loginRecoveryController && loginRecoveryController === session.loginRecoveryController
      && !loginRecoveryController.signal.aborted && reconnectPolicy(session).autoReconnect;
    if (loginRecoveryActive(session) && !authorizedRecovery) throw new Error('账号在别处登录，正在按登录设置等待自动重连');
    if (session.loginBlocked && !explicitLogin && !authorizedRecovery) throw new Error('账号在别处登录，已停止自动登录；退出游戏后请点击「恢复托管」「连接」或「开始挂机」');
    if (session.loop.running && (session.loop.recovery || session.loop.connectionFailure) && !backgroundRecovery && !authorizedRecovery) throw new Error('后台正在恢复连接，请稍后重试');
    if (session.connecting) return session.connecting;
    if (explicitLogin && session.loginRecovery) saveLoginRecovery(session, null);
    const connecting = loginSession(session, account);
    session.connecting = connecting;
    try {
      const result = await connecting;
      if (explicitLogin && session.loginBlocked && session.client?.connected) {
        saveLoginRecovery(session, null, { loginBlocked: false });
        emit(session, 'state', '游戏连接已恢复', { pauseChanged: true });
      }
      return result;
    } catch (error) {
      if (explicitLogin && error.productionSyncRetry && session.loginBlocked && !session.paused
        && session.generation === error.productionSyncGeneration) {
        saveAutomation(session.id, { loginBlocked: false });
        session.loginBlocked = false;
        emit(session, 'state', '已允许重新连接，生产状态同步将在后续读取时自动重试', { pauseChanged: true });
      }
      throw error;
    } finally {
      if (session.connecting === connecting) session.connecting = null;
    }
  }

  async function ensureConnected(session, account, options) {
    if (closing || session.connectionDrain) throw new Error('账号正在结束当前挑战并恢复阵容，请稍后操作');
    if (session.paused) throw new Error('账号已暂停，请先恢复托管');
    if (session.connecting || !session.client?.connected || !session.player) await connect(session, account, options);
    if (!options?.allowLineupPending && !session.lineupJob && readLineupRuntime(session.id).pending) await recoverSessionLineup(session);
    bridgeFleetReservations(session.client, () => session.preferences, usageFor(session), exactAutomationId(session.player?.worldId));
    return session.client;
  }

  // 每个请求都带 ?account=<id>；不给就是当前选中的那个账号。
  function resolve(url) {
    const store = loadStore();
    rememberLogAccounts(store.accounts);
    const account = pickAccount(store, url.searchParams.get('account'));
    if (!account) throw new Error('还没有任何账号，先在「账号」页添加一个');
    return { store, account, session: sessionFor(account.id) };
  }

  function accountStatus(session) {
    return {
      paused: session.paused,
      syncingProduction: Boolean(session.syncingProduction),
      loginBlocked: session.loginBlocked,
      reconnecting: session.loginBlocked && loginRecoveryActive(session),
      loginRecovery: session.loginRecovery,
      connected: Boolean(session.client?.connected),
      state: session.client?.snapshot?.().state ?? 'IDLE',
      busy: session.busy,
      looping: session.loop.running,
      loopStopping: Boolean(session.loop.running && session.loop.controller?.signal.aborted),
    };
  }

  function loadConfigSafe() {
    try {
      return getConfig();
    } catch {
      return null;
    }
  }

  // ---- 只读汇总 -------------------------------------------------------------

  // 登录回包中的战力可能落后于服务器；总览打开时按游戏角色详情接口刷新，失败则保留上次已知值。
  async function refreshPlayerPower(session, instance) {
    const playerId = uidText(session.player?.playerId);
    if (!playerId) return;
    try {
      const reply = await instance.request('OtherPlayerInfoRequest', { playerId }, 'OtherPlayerInfoResponse', 8000);
      if (session.client === instance && session.player && toNumber(reply.power) > 0) session.player.power = reply.power;
    } catch (error) {
      emit(session, 'warn', `总览：未能读取最新战力：${error.message}`, { diagnostic: 'OtherPlayerInfoRequest' });
    }
  }

  async function overview(session, account) {
    const instance = await ensureConnected(session, account);
    const [{ ok, failed }] = await Promise.all([
      collectState(instance, protocol, { queries: overviewQueries, signals: [], timeout: 8000 }),
      refreshPlayerPower(session, instance),
    ]);
    const sections = { AllResourceRequest: '资源', AllItemRequest: '仓库', AllHeroRequest: '英雄', MainTaskInfoRequest: '主线任务',
      DailyTaskInfoRequest: '每日任务', AchievementInfoRequest: '成就', EmailBoxRequest: '邮件', AfkInfoRequest: '挂机收益',
      OnWaterRequest: '海面建筑', MyResFieldsRequest: '资源田', MonthCardRequest: '月卡' };
    for (const [name, error] of Object.entries(failed)) emit(session, 'warn', `总览：未能读取${sections[name] ?? '游戏数据'}：${error}`, { diagnostic: name });
    const config = loadConfigSafe();
    const view = summarize({ ok }, { config });
    const daily = view.daily;
    const inventory=normalize(ok.AllItemRequest)?.items;
    const worldResources=['种子','公会科技点','汽油'].map(id=>{
      const quantities=Array.isArray(inventory)?inventory.filter(item=>item.itemId===id).map(item=>item.num):null;
      const total=quantities?.reduce((sum,n)=>sum+n,0);
      const amount=quantities?.every(n=>Number.isSafeInteger(n)&&n>=0)&&Number.isSafeInteger(total)?total:null;
      return {res:id,name:displayMaterial(config,id),amount,sources:config?.materialSources(id),icon:itemIcon(id)};
    });
    return {
      account: describeAccount(account, { active: account.id === loadStore().activeId }),
      status: accountStatus(session),
      player: describeRole(session.player),
      weekCalendar: await readWeekCalendar(instance).then(items=>({items})).catch(error=>({items:[],error:error.message})),
      resources: [...view.resources.map((entry) => ({ ...entry, sources: config?.materialSources(entry.res), icon: resourceIcon(entry.res) })), ...worldResources],
      items: {
        ...view.items,
        top: view.items.top.map((item) => ({ itemId: item.itemId, name: displayMaterial(config, item.itemId), num: item.num, sources: config?.materialSources(item.itemId), icon: itemIcon(item.itemId) })),
      },
      claimable: {
        mainTask: view.mainTask ? 1 : 0,
        daily: daily?.claimable ?? 0,
        achievement: view.achievements?.claimable ?? 0,
        email: view.email?.unclaimed ?? 0,
        afk: view.afk ? Math.max((view.afk.level ?? 0) - (view.afk.rewardedLevel ?? 0), 0) : 0,
      },
      afk: view.afk,
      heroes: {
        count: view.heroes.count,
        power: view.heroes.power,
        list: view.heroes.list.slice(0, 12).map((hero) => ({ ...hero, icon: heroCard(hero.heroId) ?? heroIcon(hero.heroId) })),
      },
      water: view.water,
      resFields: view.resFields,
      monthCard: view.monthCard,
      unreadable: Object.keys(failed),
      text: formatState(view),
    };
  }

  async function tasks(session, account) {
    const instance = await ensureConnected(session, account);
    const survey = selectTaskSettings(await surveyTasks(instance, protocol, { config: loadConfigSafe(), player: session.player }), session.preferences);
    return { ...survey, text: formatTaskPlan(survey) };
  }

  async function world(session, account, allowAccelerators = false) {
    const instance = await ensureConnected(session, account);
    const config = loadConfigSafe();
    const survey = await surveyWorld(instance, protocol, { config, player: session.player, includeCargo: session.loop.tasks.cargo || needsCargoDemand(session.preferences) });
    const settings = session.preferences;
    const usage = usageFor(session).snapshot();
    const extra = settings ? await surveyBaseAutomation(instance, protocol, config, session.player, settings, survey, { ledger: usageFor(session), enabled: () => session.client === instance && instance.connected !== false }) : null;
    const plan = planWorld(survey, { config, settings, usage, extraDemand: extra ? baseDemands(extra, config, settings) : [],
      allowSpeedUp: allowAccelerators && (!settings || session.loop.tasks.speedUp),
      ...(settings ? { enabled: kind => session.loop.tasks[worldTaskKey(kind)] === true, allowReroll: settings.resident.reroll, minOrderExp: settings.resident.minExp } : {}) });
    plan.actions = plan.actions.filter(step => allowAccelerators || !(step.costs ?? []).some(cost => cost.id === '加速器' && cost.num > 0));
    // Manual preview and idle execution can use different toggles. The order
    // table describes what the account's idle loop can actually deliver.
    const autoOrders = survey.orders.length ? planWorld(survey, {
      config, enabled: kind => session.loop.tasks[worldTaskKey(kind)] === true,
      allowReroll: session.loop.tasks.denyOrder, minOrderExp: null,
      settings, usage,
    }).orderDecisions : [];
    let map = null, mapError;
    try {
      map = await loadMapAsset(Number(session.player?.scenarioId ?? 0), config?.resources ?? null);
    } catch (error) {
      mapError = error.message;
    }
    let guilds=null;try{guilds=(await instance.request('AllGuildAbstractionRequest',{},'AllGuildAbstractionResponse')).guilds;}catch{/*主城动态等级读取失败时显示未同步。*/}
    const fields = { ...survey.resFields, text: formatFieldReport(survey, map, mapError), rows:resourceFieldRows(config,session.player,survey.resFields,guilds) };
    fields.totals=resourceFieldTotals(survey.resFields,fields.rows);
    const typeNames = new Map(config?.tables?.BuildingCfg?.data.map(row => [row.buildingType, row.name]));
    const now = Date.now() / 1000;
    return {
      serverNow:survey.serverNow,
      population: `${survey.population}/${survey.maxPopulation}`,
      farms: survey.buildings.filter(b => b.type === '农田').map(b => {
        const productId = b.farm?.productId || null;
        const productName = productId ? displayMaterial(config, productId) : null;
        const ripeTime = Number.isFinite(b.farm?.ripeTime) && b.farm.ripeTime > 0 ? b.farm.ripeTime : null;
        const finishTime = !b.level && Number.isFinite(b.buildFinishTime) && b.buildFinishTime > 0 ? b.buildFinishTime : null;
        let state = 'unknown', status = '未同步';
        if (!b.level) {
          state = finishTime ? 'building' : 'unbuilt';
          status = finishTime ? (finishTime > survey.serverNow ? '建造中' : '待竣工') : '未建成';
        } else if (b.farm && !productId) {
          state = 'idle'; status = '空闲';
        } else if (productId) {
          if (ripeTime) state = ripeTime <= survey.serverNow ? 'ready' : 'growing';
          status = productName + ' · ' + ({ ready: '已成熟', growing: '生长中', unknown: '成熟时间未同步' })[state];
        }
        return { plot: b.buildingId, level: b.level, productId, productName, ripeTime, finishTime, state, status };
      }),
      factories: survey.factories.map(b => {
        const queueKnown = Array.isArray(b.factory.factoryQ);
        const jobs = queueKnown ? b.factory.factoryQ.map((job, index) => ({
          index: Number.isSafeInteger(job?.idx) && job.idx >= 0 ? job.idx : index,
          productId: job?.productId || null,
          name: job?.productId ? displayMaterial(config, job.productId) : '产物未同步',
          finishTime: Number.isFinite(job?.finishTime) && job.finishTime > 0 ? job.finishTime : null,
        })) : [];
        return {
          buildingId: b.buildingId, type: b.type, typeName: typeNames.get(b.type), level: b.level,
          queue: jobs.length, queueKnown, jobs,
          capacity: Number.isSafeInteger(survey.factorySlots) && survey.factorySlots > 0 ? survey.factorySlots : null,
          auto: b.factory.autoProductId ? displayMaterial(config, b.factory.autoProductId) : null,
          autoEnabled: !!b.factory.autoProductId && (survey.autoProduceForever || survey.autoProduceEndTime > survey.serverNow),
          icon: buildingIcon(b.type),
        };
      }),
      orders: survey.orders.map((order) => ({
        ...order,
        workerIcon: workerIcon(order.workerId),
        decision: autoOrders.find(row => row.index === order.index),
        manualRefresh:{allowed:!!order.orderKey&&!order.refreshTime&&!order.refreshPending&&order.requirements.length>0&&session.player?.level>=12,reason:order.refreshPending?'上次换单待确认':order.refreshTime?'等待新订单':session.player?.level<12?'角色12级开放':!order.orderKey?'订单身份待确认':!order.requirements.length?'订单需求未同步':''},
        manualDecision: order.orderKey ? planWorld({ ...survey, orders: [order] }, {
          config, enabled: kind => kind === 'finishOrder',
        }).orderDecisions[0] : { status: 'unknown', reason: '无法确认这条居民订单，请刷新后再试' },
        requirements: order.requirements.map((need) => ({ ...need, name: displayMaterial(config, need.id), sources: config?.materialSources(need.id), icon: materialIcon(need.id) })),
        missing: (order.missing ?? []).map((need) => ({ ...need, name: displayMaterial(config, need.id), sources: config?.materialSources(need.id), icon: materialIcon(need.id) })),
      })),
      // 建筑全表：level=0 的是空位（正在盖或还没盖），界面靠它解释「为什么没在建造」。
      buildings: survey.buildings.map((b) => ({
        buildingId: b.buildingId, type: b.type ?? null, level: b.level,
        typeName: typeNames.get(b.type),
        building: b.buildFinishTime > now,
        awaitingFinish: b.buildFinishTime > 0 && b.buildFinishTime <= now,
        icon: buildingIcon(b.type),
      })),
      idleRunning: session.loop.running && !session.loop.controller?.signal.aborted,
      autoDeliverOrders: session.loop.tasks.finishOrder,
      stock: [...survey.stock].filter(([, num]) => num > 0).sort((a, b) => b[1] - a[1]).map(([id, num]) => ({ id, name: displayMaterial(config, id), num, category:config?.tables?.ItemCfg?.data?.find(row=>row.id===id)?.type||(config?.tables?.ResourceCfg?.data?.some(row=>row.id===id)?'基础资源':'其他'), sources: config?.materialSources(id), icon: materialIcon(id) })),
      resFields: fields,
      plan: plan.actions,
      notes: [...survey.notes, ...plan.notes],
      text: formatWorldPlan(survey, plan),
    };
  }

  async function heroes(session, account) {
    const instance = await ensureConnected(session, account);
    const heroList = await instance.request('AllHeroRequest', {}, 'AllHeroResponse', 15000);
    const itemList = await instance.request('AllItemRequest', {}, 'AllItemResponse', 15000);
    const counts = new Map();
    for (const item of itemList.items ?? []) {
      const id = item.itemId ?? item.id;
      counts.set(id, (counts.get(id) ?? 0) + Number(item.num ?? item.count ?? 0));
    }
    const config = loadConfigSafe();
    if (!config) throw new Error('没有配置表，算不出英雄养成计划');
    const plan = planHeroes({ config, heroes: heroList.heroes ?? [], itemNum: (id) => counts.get(id) ?? 0, playerLevel: describeRole(session.player)?.level ?? 1, settings: session.preferences });
    return {
      steps: plan.steps,
      notes: plan.notes,
      maxLevel: plan.maxLevel,
      maxStar: plan.maxStar,
      text: formatHeroPlan(plan),
      heroes: (heroList.heroes ?? []).map((hero) => ({ ...hero, icon: heroCard(hero.heroId), head: heroIcon(hero.heroId) })),
    };
  }

  async function dailies(session, account) {
    const instance = await ensureConnected(session, account);
    const survey = await surveyDailies(instance, protocol, { config: loadConfigSafe(), player: session.player, settings: session.preferences });
    return { ...addDailyOptions(survey, session.dailySingle), text: formatSurvey(survey) };
  }

  // ---- 从电脑微信采集登录 ---------------------------------------------------

  // 用户提供的小程序码仅作为游戏入口展示；它没有与本机捕获会话关联。
  function qrInfo() {
    if (fs.existsSync(path.join(DATA_DIR, 'qrcode.png'))) {
      return { kind: 'image', url: '/api/capture/qrcode', note: '你提供的游戏入口码：请在电脑微信中识别。手机扫码不会把登录凭证传到本工具。' };
    }
    return { kind: 'none', note: '请直接在电脑版微信中打开《疯狂水世界》。此游戏包未发现独立扫码授权接口。' };
  }

  // 抓到登录包就落库；顺手连一次把昵称/等级/区服回填，账号列表才看得到人话。
  async function addCapturedAccount({ url, body, rawFrameHex }, platform) {
    if (platform === 'douyin' && !['openId', 'token', 'sign', 'timestamp'].every(key => body?.eworldParams?.[key])) {
      throw new Error('抖音游戏登录报文缺少凭证字段');
    }
    const credential = { url, login: body, loginFrameHex: rawFrameHex, source: platform === 'douyin' ? 'douyin-mitm' : 'mitm', capturedAt: new Date().toISOString() };
    const store = loadStore();
    const { account, created } = upsertAccount(store, credential);
    account.automation = { ...account.automation, autoStart: autoStartEnabled(account) };
    saveStore(store);
    const title = describeAccount(account).title;
    emit(null, 'info', created ? `新账号已入库：${title}` : `账号凭证已刷新：${title}`);

    const session = sessionFor(account.id);
    if (session.paused) return { id: account.id };
    if (autoStartEnabled(account)) {
      if (session.loginBlocked && !loginRecoveryActive(session)) {
        cancelLoginRecovery(session);
        saveLoginRecovery(session, null, { loginBlocked: false });
      }
      await startAutomaticLoop(session);
      return { id: account.id };
    }
    try {
      await ensureConnected(session, account, { explicitLogin: true });
      emit(null, 'info', `${title} 的角色信息已读取（游戏那边会被顶下线一次，重进即可）`);
      if (!session.loop.running && !session.stages.view().running && !session.mutualAid.view().running && ![...session.trials.values()].some(task => task.view().running)) {
        session.client?.stop();
        session.client = null;
        session.player = null;
      }
    } catch (error) {
      emit(null, 'warn', `读取角色信息失败，账号本身已经存好了：${error.message}`);
    }
    return { id: account.id };
  }

  // ---- 路由 -----------------------------------------------------------------

  async function handle(req, res, body) {
    const parsed = new URL(req.url, 'http://localhost');
    if (serveClientAsset(req, res, parsed.pathname)) return;
    const route = `${req.method} ${parsed.pathname}`;
    const acceptsGzip = /\bgzip\b/.test(req.headers['accept-encoding'] ?? '');
    const json = (value, code = 200) => {
      if (res.destroyed || res.writableEnded) return;
      const text = JSON.stringify(value);
      const headers = { 'content-type': 'application/json; charset=utf-8' };
      // 轮询和地图响应动辄几十上百 KB，通过隧道用手机访问时差别明显。
      if (acceptsGzip && text.length >= 1024) {
        res.writeHead(code, { ...headers, 'content-encoding': 'gzip', vary: 'Accept-Encoding' });
        res.end(zlib.gzipSync(text, { level: 1 }));
        return;
      }
      res.writeHead(code, headers);
      res.end(text);
    };
    const jsonBody = () => JSON.parse(body || '{}');
    const needConfirm = (payload) => {
      if (payload.confirm !== true) throw new Error('这个操作会改动游戏里的状态，需要先确认');
    };
    const longRunning = /^(GET|POST) \/api\/(heroes|dailies|tasks|world|overview|loop)(\/|$)/.test(route);
    let scoped = null;
    let releaseWrite;
    // 所有账号相关的路由都先过这里：拿到账号、对应会话，长请求再挂个忙碌标记。
    const scoped_ = (url) => {
      const found = resolve(url);
      scoped = found.session;
      if (req.method === 'POST' && found.session.syncingProduction
        && !['/api/accounts/pause', '/api/disconnect', '/api/loop/stop', '/api/stages/stop', '/api/pirates/advance/stop',
          '/api/guild/mutual/stop', '/api/loop/auto-start', '/api/loop/interval', '/api/settings', '/api/settings/validate', '/api/login-settings', '/api/week-order/settings', '/api/hero-raid/settings', '/api/merchant/settings', '/api/guild-ship/settings', '/api/activities/settings', '/api/appointments/settings', '/api/logs/clear',
          '/api/lineup-presets/save', '/api/lineup-presets/delete', '/api/lineup-presets/bind'].includes(parsed.pathname)) {
        throw new Error('正在自动同步手动操作后的生产状态，请等待同步完成后操作');
      }
      if (longRunning) found.session.busy = route;
      return found;
    };
    try {
      if (['POST /api/dailies/run', 'POST /api/tasks/run', 'POST /api/world/run', 'POST /api/worlds/enter'].includes(route)) {
        const { session } = resolve(parsed);
        parsed.searchParams.set('account', session.id);
        await new Promise((acquired, reject) => {
          enqueue(session, () => new Promise(release => { releaseWrite = release; acquired(); })).catch(reject);
        });
      }
      if (route === 'GET /') {
        const headers = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache', etag: pageAsset.etag, vary: 'Accept-Encoding' };
        if (req.headers['if-none-match'] === pageAsset.etag) {
          res.writeHead(304, headers);
          res.end();
        } else if (acceptsGzip) {
          res.writeHead(200, { ...headers, 'content-encoding': 'gzip' });
          res.end(pageAsset.gzip);
        } else {
          res.writeHead(200, headers);
          res.end(pageAsset.raw);
        }
        return;
      }
      if (parsed.pathname.startsWith('/api/settings') && body.length > 262144) throw new SettingsError({ import: '配置文件不能超过 256 KB' });
      if (route === 'GET /api/resources') {
        json(resources?.view() ?? { enabled: false, status: 'disabled' });
        return;
      }
      if (route === 'GET /api/settings') {
        const { session } = scoped_(parsed);
        const client=session.client;
        if (parsed.searchParams.get('fleets')==='1' && client?.connected && session.player && (!session.ownedFleets || Date.now()-session.ownedFleets.checkedAt>30000 ||
          session.ownedFleets.worldId!==exactAutomationId(session.player.worldId) || session.ownedFleets.playerId!==exactAutomationId(session.player.playerId))) {
          try { await readJob(session,async()=>{
            const response=await client.request('MyFleetsRequest',{},'MyFleetsResponse',8000);
            if(session.client===client)observeOwnedFleets(session,response.fleets,{complete:true});
          }); } catch { /* 读取失败保留上次已确认名单；从未同步时不展示虚构舰队。 */ }
        }
        json(settingsView(session));
        return;
      }
      if (route === 'GET /api/activities/settings') {
        const { session } = scoped_(parsed);
        json(activitySettingsView(session));
        return;
      }
      if (route === 'POST /api/activities/settings') {
        const payload = jsonBody();
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)
          || typeof payload.key !== 'string' || typeof payload.value !== 'boolean'
          || Object.keys(payload).some(key => !['key', 'value', 'revision', 'baseRevision', 'confirm'].includes(key))) {
          throw new SettingsError({ settings: '请选择有效的活动自动挂机开关' });
        }
        const control = activityAutomationFields.find(field => field.key === payload.key);
        if (!control) throw new SettingsError({ settings: '请选择有效的活动自动挂机开关' });
        needConfirm(payload);
        const { session } = scoped_(parsed);
        const current = settingsView(session);
        if (!Number.isSafeInteger(payload.revision) || payload.revision !== current.revision
          || !current.revision && payload.baseRevision !== current.baseRevision) {
          throw new SettingsError({ revision: '活动设置已变化，请重新读取后再保存' });
        }
        const next = structuredClone(current.settings);
        const [group, field] = control.key.split('.');
        next[group][field] = payload.value;
        adoptPreferences(session, saveAutomationSettings(session.id, next, { revision: current.revision }));
        if (session.client) {
          for (const key of control.taskKeys) rewardSchedule(session.client).clearTask(key);
          if (['activityAutomation.weekLottery', 'activityAutomation.weekChip', 'activityAutomation.weekUnique'].includes(control.key)) {
            rewardSchedule(session.client).clearTask('weekSupplyFree');
          }
          if (control.key === 'merchant.enabled') watchMerchant(session.client).invalidate('海商王自动挂机设置已变化');
        }
        emit(session, 'info', control.label + '自动挂机设置已保存');
        json(activitySettingsView(session));
        return;
      }
      if (route === 'GET /api/week-order/settings') {
        const { session } = scoped_(parsed);
        json(weekOrderSettingsView(session));
        return;
      }
      if (route === 'POST /api/week-order/settings') {
        const payload = jsonBody();
        const fields = {
          enabled: ['weekOrder', 'enabled'],
          autoSubmit: ['schedule', 'weekOrderSubmit'],
          allowDiamonds: ['weekOrder', 'allowDiamonds'],
          autoFinal: ['schedule', 'weekOrderFinal'],
        };
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)
          || typeof payload.key !== 'string' || !Object.hasOwn(fields, payload.key)
          || typeof payload.enabled !== 'boolean'
          || Object.keys(payload).some(key => !['key', 'enabled', 'revision', 'baseRevision', 'confirm'].includes(key))) {
          throw new SettingsError({ settings: '请选择有效的商人活动开关' });
        }
        needConfirm(payload);
        const { session } = scoped_(parsed);
        const current = settingsView(session);
        if (!Number.isSafeInteger(payload.revision) || payload.revision !== current.revision
          || !current.revision && payload.baseRevision !== current.baseRevision) {
          throw new SettingsError({ revision: '商人活动设置已变化，请重新读取后再保存' });
        }
        const next = structuredClone(current.settings);
        const [group, field] = fields[payload.key];
        next[group][field] = payload.enabled;
        adoptPreferences(session, saveAutomationSettings(session.id, next, { revision: current.revision }));
        if (session.client) {
          rewardSchedule(session.client).clearTask('weekOrderSubmit');
          rewardSchedule(session.client).clearTask('weekOrderFinal');
        }
        emit(session, 'info', '不差钱商人设置已保存');
        json(weekOrderSettingsView(session));
        return;
      }
      if (route === 'GET /api/appointments/settings') {
        const { session } = scoped_(parsed);
        json(appointmentSettingsView(session));
        return;
      }
      if (route === 'POST /api/appointments/settings') {
        const payload = jsonBody();
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)
          || Object.keys(payload).some(key => !['settings', 'revision', 'baseRevision'].includes(key))
          || !payload.settings || typeof payload.settings !== 'object' || Array.isArray(payload.settings)) {
          throw new SettingsError({ settings: '请选择有效的英雄委任设置' });
        }
        const { session } = scoped_(parsed);
        const current = settingsView(session);
        if (!Number.isSafeInteger(payload.revision) || payload.revision !== current.revision
          || !current.revision && payload.baseRevision !== current.baseRevision) {
          throw new SettingsError({ revision: '英雄委任设置已变化，请重新读取后再保存' });
        }
        const next = structuredClone(current.settings);
        next.appointments = payload.settings;
        adoptPreferences(session, saveAutomationSettings(session.id, next, { revision: current.revision }));
        emit(session, 'info', '英雄委任设置已保存');
        json(appointmentSettingsView(session));
        return;
      }
      if (route === 'GET /api/hero-raid/settings') {
        const { session } = scoped_(parsed);
        json(heroRaidSettingsView(session));
        return;
      }
      if (route === 'POST /api/hero-raid/settings') {
        const payload = jsonBody();
        const fields = {
          'heroRaid.enabled': 'enabled',
          'heroRaid.challenge': 'challenge',
          'heroRaid.retryTimes': 'retryTimes',
          'heroRaid.orders': 'orders',
          'heroRaid.lottery': 'lottery',
          'heroRaid.rewards': 'rewards',
        };
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)
          || typeof payload.key !== 'string' || !Object.hasOwn(fields, payload.key)
          || Object.keys(payload).some(key => !['key', 'value', 'revision', 'baseRevision', 'confirm'].includes(key))) {
          throw new SettingsError({ settings: '请选择有效的超凡英雄活动设置' });
        }
        needConfirm(payload);
        const { session } = scoped_(parsed);
        const current = settingsView(session);
        if (!Number.isSafeInteger(payload.revision) || payload.revision !== current.revision
          || !current.revision && payload.baseRevision !== current.baseRevision) {
          throw new SettingsError({ revision: '超凡英雄活动设置已变化，请重新读取后再保存' });
        }
        const next = structuredClone(current.settings);
        next.heroRaid[fields[payload.key]] = payload.value;
        adoptPreferences(session, saveAutomationSettings(session.id, next, { revision: current.revision }));
        emit(session, 'info', '超凡英雄活动设置已保存');
        json(heroRaidSettingsView(session));
        return;
      }
      if (route === 'GET /api/guild-ship/settings') {
        const { session } = scoped_(parsed);
        json(guildShipSettingsView(session));
        return;
      }
      if (route === 'POST /api/guild-ship/settings') {
        const payload = jsonBody();
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)
          || typeof payload.key !== 'string'
          || Object.keys(payload).some(key => !['key', 'value', 'revision', 'baseRevision', 'confirm'].includes(key))) {
          throw new SettingsError({ settings: '请选择有效的联盟商船活动设置' });
        }
        needConfirm(payload);
        const { session } = scoped_(parsed);
        const current = settingsView(session);
        const fields = new Set(Object.keys(current.settings.guildShip).map(key => 'guildShip.' + key));
        if (!fields.has(payload.key)) throw new SettingsError({ settings: '请选择有效的联盟商船活动设置' });
        if (!Number.isSafeInteger(payload.revision) || payload.revision !== current.revision
          || !current.revision && payload.baseRevision !== current.baseRevision) {
          throw new SettingsError({ revision: '联盟商船活动设置已变化，请重新读取后再保存' });
        }
        const next = structuredClone(current.settings);
        next.guildShip[payload.key.slice('guildShip.'.length)] = payload.value;
        adoptPreferences(session, saveAutomationSettings(session.id, next, { revision: current.revision }));
        emit(session, 'info', '联盟商船活动设置已保存');
        json(guildShipSettingsView(session));
        return;
      }
      if (route === 'GET /api/merchant/settings') {
        const { session } = scoped_(parsed);
        json(merchantSettingsView(session));
        return;
      }
      if (route === 'POST /api/merchant/settings') {
        const payload = jsonBody();
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)
          || typeof payload.key !== 'string'
          || Object.keys(payload).some(key => !['key', 'value', 'revision', 'baseRevision', 'confirm'].includes(key))) {
          throw new SettingsError({ settings: '请选择有效的海商王活动设置' });
        }
        needConfirm(payload);
        const { session } = scoped_(parsed);
        const current = settingsView(session);
        const fields = new Set([
          ...Object.keys(current.settings.merchant).map(key => 'merchant.' + key),
          ...merchantTaskKeys.map(key => 'schedule.' + key),
        ]);
        if (!fields.has(payload.key)) throw new SettingsError({ settings: '请选择有效的海商王活动设置' });
        if (!Number.isSafeInteger(payload.revision) || payload.revision !== current.revision
          || !current.revision && payload.baseRevision !== current.baseRevision) {
          throw new SettingsError({ revision: '海商王活动设置已变化，请重新读取后再保存' });
        }
        const next = structuredClone(current.settings);
        const [group, field] = payload.key.split('.');
        next[group][field] = payload.value;
        adoptPreferences(session, saveAutomationSettings(session.id, next, { revision: current.revision }));
        if (session.client) {
          for (const key of merchantTaskKeys) rewardSchedule(session.client).clearTask(key);
          watchMerchant(session.client).invalidate('海商王设置已变化');
        }
        emit(session, 'info', '海商王活动设置已保存');
        json(merchantSettingsView(session));
        return;
      }
      if (route === 'GET /api/login-settings') {
        const { session } = scoped_(parsed);
        json(loginSettingsView(session));
        return;
      }
      if (route === 'POST /api/login-settings') {
        const { session } = scoped_(parsed);
        const payload = jsonBody();
        const current = settingsView(session);
        if (!Number.isSafeInteger(payload.revision) || payload.revision !== current.revision) {
          throw new SettingsError({ revision: '登录设置已在其他页面更新，请重新载入后再保存' });
        }
        const login = loginSettingsInput(payload.settings);
        const next = structuredClone(current.settings);
        next.login = login;
        // 登录策略不依赖本地游戏配置表；避免配置表暂时不可用时无法保存连接设置。
        const entry = saveAutomationSettings(session.id, next, { revision: current.revision });
        adoptPreferences(session, entry);
        emit(session, 'info', '登录设置已保存，后续连接恢复将使用新策略');
        json(loginSettingsView(session));
        return;
      }
      if (route === 'GET /api/settings/players') {
        const { session } = scoped_(parsed);
        if (!session.client?.connected || session.paused) throw new Error('请先连接当前账号，再读取盟友名单');
        const client = session.client;
        const members = await enqueue(session, async () => {
          if (session.client !== client || !client.connected || session.paused) throw new Error('账号连接已变化，请重新读取盟友名单');
          return readGuildMembers(client, loadConfigSafe(), session.player);
        });
        json(members);
        return;
      }
      if (route === 'POST /api/settings/validate') {
        const { session } = scoped_(parsed);
        const payload = jsonBody();
        const options = { catalog: settingsCatalog(loadConfigSafe()) };
        const settings = payload.document ? importAutomationSettings(payload.document, options) : validateSettings(payload.settings, options);
        json({ settings, revision: session.preferencesRevision });
        return;
      }
      if (route === 'GET /api/settings/export') {
        const { session } = scoped_(parsed);
        res.setHeader('content-disposition', "attachment; filename*=UTF-8''" + encodeURIComponent('疯狂水世界-游戏配置.json'));
        json(exportAutomationSettings(settingsView(session).settings));
        return;
      }
      if (route === 'POST /api/settings') {
        const { session } = scoped_(parsed);
        const payload = jsonBody();
        const current = settingsView(session);
        if (!current.revision && payload.baseRevision !== current.baseRevision) throw new SettingsError({ revision: '现有挂机开关已变化，请重新载入后再保存' });
        const entry = saveAutomationSettings(session.id, payload.settings, { revision: payload.revision, catalog: settingsCatalog(loadConfigSafe()) });
        adoptPreferences(session, entry);
        if (session.client) for (const task of automationTasks) rewardSchedule(session.client).clearTask(task.key);
        emit(session, 'info', '游戏配置已保存。正在运行的任务从下次检查开始使用新配置。');
        json(settingsView(session));
        return;
      }
      if (route === 'POST /api/settings/preview') {
        const { session } = scoped_(parsed);
        const payload = jsonBody();
        const config = loadConfigSafe();
        if (!config) throw new Error('缺少游戏配置表，暂时不能预览');
        const settings = validateSettings(payload.settings ?? settingsView(session).settings, { catalog: settingsCatalog(config) });
        const category = payload.category ?? 'base';
        if (!['base', 'world', 'heroes', 'daily', 'runtime', 'cityWar', 'forge', 'antique', 'activity', 'radar', 'pirateHunt', 'fleetDispatch','fleetSpeed','worldBoss','pirateSweep','alliance','guildShip','guildFort','silicon','heroRaid'].includes(category)) throw new Error('不支持的预览分类');

        if (category === 'runtime') {
          json({ checkedAt: new Date().toISOString(), usage: usageFor(session).snapshot(), actions: [], counts: {}, viewOnly: true, scopeLabel: '运行安排（仅查看，不执行）',
            notes: [`当前${session.loop.running ? '正在挂机' : '未在挂机'}；配置轮数${settings.loop.rounds === 0 ? '持续运行' : settings.loop.rounds}，间隔${settings.loop.everySeconds}秒。`,
              '已启用：' + automationTasks.filter(task => isActivityTaskAvailable(task.key, session.client) && nativeTaskValues(settings, session.loop.tasks)[task.key]).map(task => task.label).join('、'),
              '运行安排不是游戏动作计划。基地、英雄、日常、活动、联盟/城战和锻造请在范围中分别选择。'] }); return;
        }
        if (!session.client?.connected || session.paused) throw new Error('请先连接当前账号，再读取真实游戏状态');
        const result = await enqueue(session, async () => {
          const client = session.client;
          const usage = usageFor(session).snapshot();
          if (['alliance','guildShip','guildFort','silicon','heroRaid'].includes(category)) return previewExtended(category, client, protocol, config, session.player, settings, usageFor(session));
          const output = (plan, counts, scopeLabel) => ({ checkedAt: new Date().toISOString(), usage, pendingUsage:usageFor(session).pendingCounters(), counts, scopeLabel,
            actions: plan.actions.map(step => ({ label: step.label, kind: step.kind, costs: (step.costs ?? []).map(item => ({ name: displayMaterial(config, item.id), num: item.num })) })),
            notes: [...new Set(plan.notes ?? [])],
          });
          // 草稿预览的预留结果仅在本请求使用，绝不写入运行中的调度缓存。
          let previewCityReserved=[];
          if(['radar','pirateHunt','worldBoss'].includes(category)&&settings.cityWar.enabled&&settings.cityWar.reserveDuringWar){
            const war=await readCityWar(client,protocol,config,session.player,settings.cityWar);
            previewCityReserved=war.reason?[...settings.cityWar.fleetIds]:cityWarReservedFleets(war,settings);
          }
          if(category==='fleetSpeed'){
            const snapshot=await readFleetSpeed(client,session.player);
            const plan=planFleetSpeed(snapshot,config,settings,usageFor(session));
            return {...output(plan,{fleets:plan.rows.length},'联盟城战 · 逐队加速'),viewOnly:true,fleetSpeed:{rows:plan.rows}};
          }
          if(category==='fleetDispatch'){
            const own=await client.request('MyFleetsRequest',{},'MyFleetsResponse');
            if(!Array.isArray(own.fleets))throw Error('舰队状态未同步');
            const table=fleetDispatchView(client,settings,usageFor(session),own.fleets,exactAutomationId(session.player.worldId));
            return {...output({actions:[],notes:['任务顺序：'+settings.fleetDispatch.priority.map(k=>dispatchLabels[k]).join(' → '),'意向仅表示配置允许；派遣前仍核对目标和费用，正在执行的任务不抢占。']},{fleets:table.length},'舰队调度'),viewOnly:true,dispatch:{fleets:table.map(f=>({name:f.buildingId,reason:[f.reason,...f.reserved.map(r=>'预留给'+r),'允许顺序：'+(f.intents.map(i=>i.label).join(' → ')||'无'),'当前目标：'+(f.targetGrid??'主城')].filter(Boolean).join('；')}))}};
          }
          if(category==='pirateSweep'){
            const state=await readPirateSweeps(client,config,session.player,settings),notes=[state.name+' · 今日已用 '+(state.used??'未同步')+'/'+(state.limit??'未同步')+' 次，剩余 '+(state.left??'未同步')+' 次'];
            if(state.reason)notes.push(state.reason);if(!settings.schedule.pirate)notes.push('海盗日常扫荡开关未开启');
            notes.push('三种海盗共用每日次数，不派遣舰队，不消耗汽油、耐久或钻石。');
            return output({actions:!state.reason&&settings.schedule.pirate?[{kind:'pirateSweep',label:'扫荡'+state.name+' '+state.level+'级（本次最多使用剩余 '+state.left+' 次；逐次回读确认）',costs:[]}]:[],notes},{remaining:state.left},'海盗日常扫荡');
          }
          if(category==='worldBoss'){
            const state=await readWorldBoss(client,config,session.player,settings,usageFor(session),{cityReservedFleetIds:previewCityReserved});
            const plan={actions:[],notes:[state.reason||'当前可执行每日首战派遣']};
            if(!settings.worldBoss.enabled)plan.notes.push('世界Boss自动首战未开启');
            else if(!state.reason)plan.actions.push({kind:'worldBoss',label:state.fleets.find(f=>!f.reason).buildingId+' → 世界Boss '+state.boss.bossId,costs:[{id:'汽油',num:state.cost}]});
            return {...output(plan,{fleets:state.fleets.length},'世界Boss首战'),dispatch:{fleets:state.fleets,fuel:state.fuel,pending:pendingPetrol(usageFor(session))}};
          }
          if (category === 'radar') {
            const state=await readAllianceRadar(client,config,session.player),ledger=usageFor(session);
            const plan=planRadarPreview(state,settings,ledger,client,{cityReservedFleetIds:previewCityReserved});
            return {...output(plan,{fleets:state.fleets.length,targets:state.events.length},'联盟情报'),dispatch:{fleets:plan.fleets,fuel:state.fuel,pending:pendingPetrol(ledger)}};
          }
          if (category === 'pirateHunt') {
            const snapshot=await inspectHunt(client,config,session.player),ledger=usageFor(session);
            for(const fleet of snapshot.view.fleets??[])fleet.reason ||= (!settings.pirateHunt.fleetIds.includes(fleet.buildingId)?'未选择此舰队':'')|| fleetRecordReason(ledger.keyRecords(),fleet.buildingId,exactAutomationId(session.player.worldId))||(previewCityReserved.includes(fleet.buildingId)?'城战时段预留':dispatchReservationReason(client,settings,'pirateHunt',fleet.buildingId,{ignoreOwners:['cityWar']}));
            const progress=pirateRunState(session);
            const selection=progress.halted?{reason:progress.reason}:selectPirateAdvance(snapshot,settings.pirateHunt,{spent:progress.spent??0,pendingFuel:pendingPetrol(ledger)});
            const plan={actions:selection.reason?[]:[{kind:'pirateFirst',label:selection.fleet.name+' → '+selection.target.name+' '+selection.target.level+'级',costs:[{id:'汽油',num:selection.cost}]}],notes:[selection.reason||'开启海盗讨伐后随挂机每轮检查；也可单独手动启动，此处仅预览下一次派遣']};
            return {...output(plan,{fleets:snapshot.view.fleets?.length??0,targets:snapshot.view.targets?.length??0},'海盗首杀'),dispatch:{fleets:snapshot.view.fleets,fuel:snapshot.view.fuel,pending:pendingPetrol(ledger)}};
          }
          if (category === 'antique') {
            const state = await readAntiqueUpgrade(client, protocol, config, session.player);
            const plan = planAntiqueUpgrade(state, config, settings, { usage, keys: usageFor(session).keyRecords() });
            return { ...output(plan, { antiques: state.antiques.length, suits: state.suits.length }, '藏品养成'),
              antique: { count: state.antiques.length, suits: state.suits.length, masterLv: state.masterLv, gold: state.gold } };
          }
          if (category === 'cityWar') {
            const state = await readCityWar(client, protocol, config, session.player, settings.cityWar);
            const ledger = usageFor(session), pending = ledger.pendingCounters();
            const plan = planCityWar(state, settings, { usage, keys: ledger.keyRecords(), pendingPetrol: (pending.cityWarPetrol ?? 0) + (pending.treasurePetrol ?? 0) + (pending.piratePetrol ?? 0) + (pending.radarPetrol ?? 0) + (pending.worldBossPetrol ?? 0) + (pending.siliconPetrol ?? 0) });
            const online = await readWorldOnlineReward(client, config, session.player);
            if (!settings.schedule.worldOnlineRewards) plan.notes.push('城战在线奖励自动领取未开启');
            else if (online.ready && worldOnlineRewardKey(session.player, online)) {
              if (ledger.hasKey(worldOnlineRewardKey(session.player, online))) plan.notes.push('本档在线奖励已发送，等待计数确认，不重复领取');
              else plan.actions.push({ kind: 'worldOnlineReward', label: `领取城战在线奖励第 ${online.stage} 档`, costs: [] });
            }
            if (online.reason) plan.notes.push('城战在线奖励：' + online.reason);
            if (settings.schedule.guildWelfare) {
              const guild = await readGuild(client, config, session.player);
              if (guild.welfareCount > 0) plan.actions.push({ kind: 'guildWelfare', label: `领取联盟福利礼包（${guild.welfareCount}份）`, costs: [] });
              else plan.notes.push('联盟福利：' + (guild.reason || (guild.welfareCount === 0 ? '当前无待领礼包' : '待领数量未确认')));
            }
            if (settings.fleetSpeed.enabled) {
              const speed=planFleetSpeed(await readFleetSpeed(client,session.player),config,settings,ledger);
              plan.actions.push(...speed.actions);plan.notes.push(...speed.notes);
            }
            return { ...output(plan, { fleets: state.fleets.length, targets: state.targets.length }, '联盟城战'), onlineReward: online, cityWar: {
              fleets: plan.fleets, targets: plan.targets, nativeLimit: state.nativeLimit, nativeCommissionLimit: plan.nativeCommissionLimit,
              nativeOffFleetIds: plan.nativeOffFleetIds, startTime: state.startTime,
              endTime: state.endTime, inWindow: state.inWindow, fuel: state.fuel, reservedFleetIds: plan.reservedFleetIds } };
          }
          if (category === 'activity') {
            const state = await activityView(client, client.festivals ?? [], config);
            return { ...output({ actions: [], notes: ['此范围只读取活动开放状态，不推算充值、抽奖、消耗道具或付费动作。',
              ...(state.activities?.length ? state.activities.map(row => row.name + (row.endTime ? '：截至' + new Date(row.endTime * 1000).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '：开放时间未确认')) : ['当前未读到开放活动']),
              ...(state.lotteryError ? ['周抽奖状态未确认：' + state.lotteryError] : []), ...(state.orderError ? ['商人订单状态未确认：' + state.orderError] : [])] }, { activities: state.activities?.length ?? 0 }, '活动状态（只读）'), viewOnly: true };
          }
          if (category === 'forge') {
            const state = await readEquipmentForge(client, protocol, config, session.player);
            const plan = planEquipmentForge(state, config, settings, { usage, keys: usageFor(session).keyRecords() });
            return { ...output(plan, { factories: state.buildings.length }, '装备锻造'), forge: {
              factories: plan.factories, gold: state.gold, season: state.season, forgeLevel: state.forgeLevel } };
          }
          if (category === 'world') {
            const snapshot = await readTreasureLoot(client, protocol, config, session.player, { preferences: settings.treasure });
            const ledger = usageFor(session);
            const pendingFuel = pendingPetrol(ledger);
            let reservedFleetIds = [];
            if (cityWarEnabled(settings)) {
              const war = await readCityWar(client, protocol, config, session.player, settings.cityWar);
              reservedFleetIds = war.reason && settings.cityWar.reserveDuringWar ? [...settings.cityWar.fleetIds]
                : planCityWar(war, settings, { usage, keys: ledger.keyRecords(), pendingPetrol: pendingFuel }).reservedFleetIds;
            }
            const task = settings.treasure.follow ? 'follow' : 'treasure';
            const unavailableFleets = Object.fromEntries(settings.treasure.fleetIds.map(id => [id,
              dispatchReservationReason(client, settings, task, id, { ignoreOwners: ['cityWar'] })]));
            const plan = planTreasureLoot(snapshot, config, settings, { usage, keys: ledger.keyRecords(), pendingFuel,
              pendingDiamonds: ledger.pendingCounters().diamonds ?? 0, reservedFleetIds, unavailableFleets });
            return { ...output(plan, plan.counts, '万吨巨轮'), treasure: { targets: plan.targets, fleets: plan.fleets, fuel: snapshot.fuel,
              fuelPerFleet: snapshot.fuelPerFleet, todayRewardTimes: snapshot.todayRewardTimes, rewardLimit: snapshot.rewardLimit,
              participationMode: settings.treasure.participationMode, nextRefreshTime: snapshot.nextRefreshTime } };
          }
          if (category === 'heroes') {
            const list = normalize(await client.request('AllHeroRequest', {}, 'AllHeroResponse'));
            const bag = normalize(await client.request('AllItemRequest', {}, 'AllItemResponse'));
            const stock = new Map((bag.items ?? []).map(item => [item.itemId, Number(item.num)]));
            const plan = planHeroes({ config, heroes: list.heroes ?? [], itemNum: id => stock.get(id) ?? 0, playerLevel: session.player?.level ?? 1, settings });
            const actions = plan.steps.map(step => ({ ...step, label: step.kind === 'level' ? `${step.heroId} 从 ${step.from} 级升至 ${step.to} 级` : step.kind === 'star' ? `${step.heroId} 升至 ${step.to} 星` : `${step.heroId} 技能 ${step.slot + 1} 升至 ${step.to} 级` }));
            const checked = budgetPreview(actions, stock, settings, usage);
            return output({ ...checked, notes: [...plan.notes, ...checked.notes, ...(settings.loop.heroes ? [] : ['英雄养成未加入挂机，可在英雄页手动按本配置执行'])] }, { heroes: list.heroes?.length ?? 0 }, '英雄养成');
          }
          if (category === 'daily') {
            const flags = nativeTaskValues(settings, session.loop.tasks);
            const daily = await surveyDailies(client, protocol, { config, player: session.player, settings });
            const tasks = selectTaskSettings(await surveyTasks(client, protocol, { config, player: session.player }), settings);
            const actions = [...tasks.plan];
            const trialNotes = [];
            for (const entry of daily.tasks) for (const action of entry.actions ?? []) {
              const key = dailyTaskKey(entry.task.id, action);
              if (!key || !flags[key] || !nativePreferenceEnabled(settings, key)) continue;
              actions.push({ ...action, kind: 'daily', label: `${entry.task.title}：${action.note ?? '执行一次'}` });
            }
            if (settings.dailies.enabled) {
              if (settings.dailies.claimTasks) for (const task of daily.daily?.dailyTask ?? []) if (task.progress >= task.targetProgress && !task.rewardClaimed) actions.push({ kind: 'reward', label: `领取每日任务 ${task.id} 奖励` });
              for (const action of daily.chests?.actions ?? []) if (action.request === 'DrawWeeklyRewardRequest' ? settings.dailies.claimWeeklyChest : settings.dailies.claimDailyChest) actions.push({ ...action, kind: 'reward', label: action.note });
              if (settings.dailies.claimGift) for (const action of daily.gift?.actions ?? []) actions.push({ ...action, kind: 'reward', label: action.note });
            }
            if (settings.trials.paid || settings.trials.ads) {
              const account = scoped_(parsed).account, ledger = usageFor(session);
              let plannedDiamonds = usage.counters?.trialDiamonds ?? 0;
              for (const id of settings.trials.raidIds) {
                const state = await readTrialSweeps(client, protocol, config, session.player, settings, Number(id), {
                  channel:{clientInfo:account.login?.eworldClientInfo,language:account.login?.language},usage,records:ledger.keyRecords(),pendingDiamonds:ledger.pendingCounters().diamonds ?? 0 });
                for (const mode of ['ad','paid']) {
                  if (!(mode==='paid'?settings.trials.paid:settings.trials.ads)) continue;
                  const option=state[mode], label=state.name+(mode==='paid'?'钻石扫荡':'免广告扫荡');
                  if (!option.allowed) { trialNotes.push(label+'：'+option.reason); continue; }
                  if (mode==='paid' && plannedDiamonds+option.cost>settings.trials.dailyDiamondBudget) { trialNotes.push(label+'：会超过试炼每日钻石预算'); continue; }
                  actions.push({kind:mode==='paid'?'trialPaidSweep':'trialAdSweep',label,costs:mode==='paid'?[{id:'RUBY',num:option.cost}]:[]});
                  if (mode==='paid') plannedDiamonds+=option.cost;
                }
              }
            }
            const checked = budgetPreview(actions, new Map([['RUBY', daily.ruby]]), settings, usage);
            return output({ ...checked, notes: [...tasks.notes, ...trialNotes, ...daily.tasks.filter(entry => entry.reason).map(entry => entry.task.title + '：' + entry.reason), ...checked.notes,
              '此处预览日常任务与领奖。限时活动、挑战的开放状态可在对应页面查看。'] }, { dailyTasks: daily.tasks.length }, '日常与任务奖励');
          }
          const survey = await surveyWorld(client, protocol, { config, player: session.player, includeCargo: settings.cargo.enabled || settings.factory.demandPriority.includes('cargo') });
          const extra = await surveyBaseAutomation(client, protocol, config, session.player, settings, survey, { ledger: usageFor(session), enabled: () => session.client === client && client.connected !== false });
          const flags = nativeTaskValues(settings, session.loop.tasks);
          const worldPlan = planWorld(survey, { config, settings, usage, extraDemand: baseDemands(extra, config, settings),
            enabled: kind => flags[worldTaskKey(kind)] === true, allowSpeedUp: flags.speedUp, allowReroll: settings.resident.reroll, minOrderExp: settings.resident.minExp });
          const extraPlan = planBaseAutomation(extra, config, settings, usage);
          const nativePlan = await previewNativeAutomation(client, config, session.player, settings, flags, survey, usage);
          const plan = budgetPreview([...worldPlan.actions, ...extraPlan.actions, ...nativePlan.actions], survey.stock, settings, usage);
          return { checkedAt: new Date().toISOString(), usage, scopeLabel: '基地与点金',
            actions: plan.actions.map(step => ({ label: step.label, kind: step.kind, setting:step.setting, costs: (step.costs ?? []).map(item => ({ name: displayMaterial(config, item.id), num: item.num })) })),
            notes: [...new Set([...survey.notes, ...worldPlan.notes, ...extraPlan.notes, ...nativePlan.notes, ...plan.notes])],
            counts: { buildings: survey.buildings.length, factories: survey.factories.length, orders: survey.orders.length, maps: extra.museum?.exploreStages?.length ?? 0 },
          };
        }, '读取配置执行计划');
        json(result);
        return;
      }
      if (route === 'GET /api/art/index') {
        json(iconIndex());
        return;
      }
      if (route.startsWith('GET /api/lineups/art/') && route.endsWith('.png')) {
        const name = decodeURIComponent(parsed.pathname.slice('/api/lineups/art/'.length, -4));
        const image = await lineupArt(name);
        if (!image) { json({ error: '布阵素材暂未同步' }, 404); return; }
        res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'public, max-age=3600' });
        res.end(image);
        return;
      }
      if (route.startsWith('GET /api/art/icon/') && route.endsWith('.png')) {
        const name = decodeURIComponent(parsed.pathname.slice('/api/art/icon/'.length, -'.png'.length));
        const png = await iconThumb(name);
        if (!png) {
          json({ error: 'not found' }, 404);
          return;
        }
        // 地址带图标在图集里的位置，内容变了地址也会变。
        res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'public, max-age=31536000, immutable' });
        res.end(png);
        return;
      }
      // 图标是游戏自己的贴图，从 FairyGUI 图集里按图集页整张给出去，裁切交给浏览器。
      if (route.startsWith('GET /api/art/atlas/')) {
        const [, , , , bundle, file] = route.split('/').map((part) => decodeURIComponent(part));
        const found = atlasFile(bundle, file);
        if (!found) {
          json({ error: 'not found' }, 404);
          return;
        }
        res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' });
        res.end(fs.readFileSync(found));
        return;
      }
      if (route === 'POST /api/logs/clear') {
        needConfirm(jsonBody());
        const { session } = scoped_(parsed);
        const cleared = { account: session.id, before: logId, at: Date.now() };
        session.log.length = 0;
        session.logClearBefore = cleared.before;
        session.logClearAt = cleared.at;
        for (const stream of streams) {
          if (stream.allAccounts || stream.account === session.id) writeStream(stream, `event: logs-cleared\ndata: ${JSON.stringify(cleared)}\n\n`);
        }
        json(cleared);
        return;
      }
      if (route === 'GET /api/events') {
        res.writeHead(200, {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          connection: 'keep-alive',
        });
        res.account = parsed.searchParams.get('account');
        res.allAccounts = parsed.searchParams.get('scope') === 'all';
        streams.add(res);
        res.once('close', () => streams.delete(res));
        const logSession = sessions.get(res.account);
        const logSessions = res.allAccounts ? [...sessions.values()] : logSession ? [logSession] : [];
        const since = Math.max(Number(req.headers['last-event-id'] ?? 0) || 0, res.allAccounts ? 0 : logSession?.logClearBefore ?? 0);
        for (const item of logSessions) {
          if (item.logClearAt && !writeStream(res, `event: logs-cleared\ndata: ${JSON.stringify({ account: item.id, before: item.logClearBefore, at: item.logClearAt })}\n\n`)) return;
        }
        const entries = [...globalLog, ...logSessions.flatMap(item => item.log)]
          .sort((a, b) => a.id - b.id).slice(-LOG_LIMIT);
        for (const entry of entries) {
          if (entry.id > since && !writeStream(res, `id: ${entry.id}\ndata: ${JSON.stringify(entry)}\n\n`)) return;
        }
        res.flushHeaders();
        return;
      }

      // ---- 账号 ----
      if (route === 'GET /api/accounts') {
        const store = loadStore();
        rememberLogAccounts(store.accounts);
        json({
          activeId: store.activeId,
          accounts: store.accounts.map((account) => ({
            ...describeAccount(account, { active: account.id === store.activeId }),
            status: accountStatus(sessionFor(account.id)),
          })),
        });
        return;
      }
      if (route === 'POST /api/accounts/export') {
        const { id, ids, all, includeSettings = false } = jsonBody();
        const store = loadStore();
        const backup = exportAccountBackup(store, { id, ids, all, includeSettings,
          getSettings: account => settingsView(sessionFor(account.id)).settings });
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store',
          'content-disposition': 'attachment; filename="' + (includeSettings ? 'accounts-with-settings' : 'accounts') + '.json"' });
        res.end(JSON.stringify(backup, null, 2));
        return;
      }
      if (route === 'POST /api/accounts/import/preview' || route === 'POST /api/accounts/import') {
        if (Buffer.byteLength(body, 'utf8') > ACCOUNT_BACKUP_MAX_BYTES + 1024) throw new Error('账号文件不能超过 10 MB');
        let payload;
        try { payload = jsonBody(); } catch { throw new Error('文件不是有效 JSON，请选择本工具导出的账号文件'); }
        if (!payload || typeof payload !== 'object') throw new Error('请选择有效的账号文件');
        res.setHeader('cache-control', 'no-store');
        if (route.endsWith('/preview')) {
          json(previewAccountImport(payload.document));
          return;
        }
        needConfirm(payload);
        const result = importAccountBackup(payload.document, payload.token);
        rememberLogAccounts(loadStore().accounts);
        for (const entry of result.saved) {
          const session = sessions.get(entry.id);
          if (!session) continue;
          adoptPreferences(session, entry);
          if (session.client) {
            for (const task of automationTasks) rewardSchedule(session.client).clearTask(task.key);
            watchMerchant(session.client).invalidate('账号配置已导入');
          }
        }
        emit(null, 'info', `账号导入完成：新增 ${result.created} 个，更新 ${result.updated} 个，恢复 ${result.settingsCount} 份配置`);
        json({ ok: true, created: result.created, updated: result.updated, settingsCount: result.settingsCount, activeId: result.activeId });
        return;
      }
      if (route === 'GET /api/accounts/credential') {
        const store = loadStore();
        const account = pickAccount(store, parsed.searchParams.get('account'));
        if (!account) throw new Error('没有这个账号');
        json(parsed.searchParams.get('reveal') === '1' ? revealAccount(account) : describeAccount(account, { active: account.id === store.activeId }));
        return;
      }
      if (route === 'POST /api/accounts/active') {
        const payload = jsonBody();
        needConfirm(payload);
        const store = loadStore();
        const account = pickAccount(store, payload.id);
        if (!account) throw new Error('没有这个账号');
        setActive(store, account.id);
        saveStore(store);
        emit(null, 'info', `当前账号切到 ${describeAccount(account).title}`);
        json({ ok: true, activeId: account.id });
        return;
      }
      if (route === 'POST /api/accounts/label') {
        const payload = jsonBody();
        needConfirm(payload);
        const store = loadStore();
        const account = pickAccount(store, payload.id);
        if (!account) throw new Error('没有这个账号');
        account.label = String(payload.label ?? '').trim() || null;
        saveStore(store);
        rememberLogAccounts(store.accounts);
        json({ ok: true });
        return;
      }
      if (route === 'POST /api/accounts/remove') {
        const payload = jsonBody();
        needConfirm(payload);
        const store = loadStore();
        const account = pickAccount(store, payload.id);
        if (!account) throw new Error('没有这个账号');
        removeAccount(store, account.id);
        saveStore(store);
        const removed = sessions.get(account.id);
        if (removed) removed.generation += 1;
        removed?.loginRecoveryController?.abort();
        removed?.loginRecoveryWait?.abort();
        removed?.loop.controller?.abort();
        removed?.pirateAdvance.stop('账号已删除'); removed?.stages.stop('账号已删除'); removed?.mutualAid.stop('账号已删除'); for (const task of removed?.trials.values() ?? []) task.stop('账号已删除');
        if (removed) await closeSessionConnection(removed, { includeWorld: true });
        sessions.delete(account.id);
        emit(null, 'info', `已删除账号 ${describeAccount(account).title}`);
        json({ ok: true });
        return;
      }

      // ---- 支付宝扫码登录 ----
      if (route === 'POST /api/accounts/alipay-login/start') {
        needConfirm(jsonBody());
        if (closing) throw new Error('控制台已关闭');
        if (alipaySaving) throw new Error('正在保存支付宝账号，请稍候');
        const previous = alipayLogin.status();
        if (previous.id && previous.id === cancelledAlipayLoginId) await alipayLogin.cancel(previous.id);
        const starting = alipayLogin.start();
        const currentState = alipayLogin.status();
        if (pendingAlipayLogin && (pendingAlipayLogin.id !== currentState.id || currentState.phase !== 'captured')) clearAlipayRoles();
        const state = await starting;
        json(alipayLoginStatus(state.id));
        return;
      }
      if (route === 'GET /api/accounts/alipay-login/status') {
        json(alipayLoginStatus(parsed.searchParams.get('id') || undefined));
        return;
      }
      if (route === 'POST /api/accounts/alipay-login/cancel') {
        const { id } = jsonBody();
        if (typeof id !== 'string' || !id) throw new Error('请选择要取消的扫码会话');
        alipayLogin.status(id);
        cancelledAlipayLoginId = id;
        clearAlipayRoles();
        await alipayLogin.cancel(id);
        json({ ok: true });
        return;
      }
      if (route === 'POST /api/accounts/alipay-login/roles') {
        const payload = jsonBody();
        needConfirm(payload);
        if (typeof payload.id !== 'string' || !payload.id) throw new Error('扫码结果已过期，请重新扫码');
        if (alipaySaving) throw new Error('正在保存支付宝账号，请稍候');
        const pending = requireAlipayRoles(payload.id);
        void readAlipayRoles(pending);
        json(alipayLoginStatus(payload.id));
        return;
      }
      if (route === 'POST /api/accounts/alipay-login/save') {
        const payload = jsonBody();
        needConfirm(payload);
        if (typeof payload.id !== 'string' || !payload.id) throw new Error('扫码结果已过期，请重新扫码');
        if (alipaySaving) throw new Error('正在保存支付宝账号，请稍候');
        const pending = requireAlipayRoles(payload.id);
        if (pending.reading) throw new Error('正在读取区服和角色，请稍候');
        if (pending.entry.roleError) throw new Error('角色列表读取失败，请重试后再保存');
        const choices = pending.entry.choices;
        const choice = payload.choiceId ? choices.find(item => item.id === String(payload.choiceId))
          : choices.length === 1 ? choices[0] : null;
        if (!choice || payload.worldId !== undefined) throw new Error('请选择列表中的区服和角色后再保存');
        alipaySaving = true;
        try {
          const session = sessions.get(accountId(pending.entry.credential));
          const save = () => saveAlipayRole(pending, choice);
          const result = session && !session.paused ? await enqueue(session, save) : await save();
          // 凭证已落盘，临时浏览器清理失败也应返回已保存的账号。
          try { await alipayLogin.cancel(payload.id); } catch {}
          json(result);
        } finally {
          alipaySaving = false;
        }
        return;
      }

      // ---- 手机号登录 ----
      if (route === 'GET /api/accounts/phone-login/status') {
        json(phoneLoginStatus());
        return;
      }
      if (route === 'POST /api/accounts/phone-login/device') {
        const payload = jsonBody();
        needConfirm(payload);
        saveDeviceProfile(payload.profile);
        json(phoneLoginStatus());
        return;
      }
      if (route === 'POST /api/accounts/phone-login') {
        const payload = jsonBody();
        needConfirm(payload);
        if (phoneLoginBusy) throw new Error('已有 APP 登录正在进行，请稍候');
        phoneLoginBusy = true;
        try {
          prunePhonePending();
          const phone = String(payload.phone ?? '').trim();
          const password = String(payload.password ?? '');
          const code = String(payload.code ?? '').trim();
          if (!phone) throw new Error('请输入手机号或账号');
          if (!password && !code) throw new Error('请输入密码或短信验证码');
          const client = createPhoneLogin();
          const pending = { id: randomUUID(), phone, entries: [], authenticationFailures: [], linkedAccountCount: 1 };
          async function addAccount(result) {
            if (closing) throw new Error('控制台已关闭');
            const game = await client.gameLogin(result);
            const credential = client.credential(game, { account: phone });
            const openId = credential.login.eworldParams.openId;
            if (pending.entries.some(entry => entry.credential.login.eworldParams.openId === openId)) return;
            const entry = { credential, userName: result.ewan?.userName || result.selectedAccount?.userName || maskPhone(phone), choices: [], roleError: null };
            pending.entries.push(entry);
            await readPhoneRoles(entry);
          }
          if (password) {
            await addAccount(await client.loginWithPassword(phone, password));
          } else {
            const verified = await client.verifySmsAccounts(phone, code);
            pending.linkedAccountCount = verified.accounts.length;
            for (const selected of verified.accounts) {
              if (closing) throw new Error('控制台已关闭');
              try {
                await addAccount(await client.loginSmsAccount(verified, selected));
              } catch (error) {
                pending.authenticationFailures.push({ userName: selected?.userName || selected?.username || '关联 APP 账号',
                  error: error.message || '该账号认证失败，请重新登录', retryable: false });
              }
            }
          }
          if (closing) throw new Error('控制台已关闭');
          pending.createdAt = Date.now();
          pendingPhoneLogins.set(pending.id, pending);
          json(phonePreview(pending));
        } finally {
          phoneLoginBusy = false;
        }
        return;
      }
      if (route === 'POST /api/accounts/phone-login/roles') {
        const payload = jsonBody();
        needConfirm(payload);
        if (phoneLoginBusy) throw new Error('已有 APP 登录正在进行，请稍候');
        prunePhonePending();
        const pending = pendingPhoneLogins.get(String(payload.id ?? ''));
        if (!pending) throw new Error('登录结果已过期，请重新登录');
        if (pending.busy) throw new Error('正在处理此登录结果，请稍候');
        pending.busy = true;
        phoneLoginBusy = true;
        try {
          for (const entry of pending.entries) if (entry.roleError) await readPhoneRoles(entry);
          if (pendingPhoneLogins.get(pending.id) !== pending || Date.now() - pending.createdAt >= PHONE_PENDING_MS) {
            throw new Error('登录结果已过期，请重新登录');
          }
          json(phonePreview(pending));
        } finally {
          pending.busy = false;
          phoneLoginBusy = false;
        }
        return;
      }
      if (route === 'POST /api/accounts/phone-login/send-code') {
        const payload = jsonBody();
        needConfirm(payload);
        const phone = String(payload.phone ?? '').trim();
        if (!/^1[3-9]\d{9}$/.test(phone)) throw new Error('手机号格式不正确');
        if (smsPending.has(phone)) throw new Error('正在发送验证码，请稍候');
        const last = smsSendAt.get(phone) ?? 0;
        if (Date.now() - last < 60000) throw new Error('验证码已发送，请 60 秒后再试');
        smsPending.add(phone);
        try {
          const client = createPhoneLogin();
          const result = await client.requestSmsCode(phone);
          smsSendAt.set(phone, Date.now());
          json({ ok: true, validatecode: result?.validatecode ?? '', cooldown: 60 });
        } finally {
          smsPending.delete(phone);
        }
        return;
      }
      if (route === 'POST /api/accounts/phone-login/save') {
        const payload = jsonBody();
        needConfirm(payload);
        prunePhonePending();
        const pending = pendingPhoneLogins.get(String(payload.id ?? ''));
        if (!pending) throw new Error('登录结果已过期，请重新登录');
        if (pending.busy) throw new Error('正在处理此登录结果，请稍候');
        const available = pending.entries.flatMap(entry => entry.choices.map(choice => ({ entry, choice })));
        const selected = payload.choiceId
          ? available.find(item => item.choice.id === String(payload.choiceId))
          : available.length === 1 ? available[0] : null;
        if (!selected) throw new Error('请选择列表中的区服和角色后再保存');
        pending.busy = true;
        try {
          const session = sessions.get(accountId(selected.entry.credential));
          const save = () => {
            if (closing) throw new Error('控制台已关闭');
            if (pendingPhoneLogins.get(pending.id) !== pending || Date.now() - pending.createdAt >= PHONE_PENDING_MS) {
              throw new Error('登录结果已过期，请重新登录');
            }
            return savePhoneRole(pending, selected.entry, selected.choice);
          };
          json(session && !session.paused ? await enqueue(session, save) : await save());
        } finally {
          pending.busy = false;
        }
        return;
      }
      if (route === 'POST /api/accounts/phone-login/cancel') {
        const payload = jsonBody();
        if (payload.id) pendingPhoneLogins.delete(String(payload.id));
        json({ ok: true });
        return;
      }

      // ---- 连接 ----
      if (route === 'POST /api/accounts/pause') {
        const { account, session } = scoped_(parsed);
        const payload = jsonBody();
        const { paused, start = false } = payload;
        if (typeof paused !== 'boolean') throw new Error('请选择暂停或恢复');
        if (typeof start !== 'boolean' || (start && paused)) throw new Error('开始托管需要先恢复账号');
        if (start) needConfirm(payload);
        if (session.connectionDrain) await session.connectionDrain;
        if (closing || sessions.get(session.id) !== session || !loadStore().accounts.some(entry => entry.id === account.id)) {
          throw new Error('账号已移除或控制台已关闭');
        }
        if (!paused && !session.paused && loginRecoveryActive(session) && (!start || session.loop.running)) {
          json(accountStatus(session));
          return;
        }
        if (session.paused !== paused || (!paused && session.loginBlocked) || (paused && session.syncingProduction)) {
          cancelLoginRecovery(session);
          saveAutomation(account.id, { paused, ...(!paused ? { loginBlocked: false } : {}) });
          session.paused = paused;
          if (!paused) {
            session.loginBlocked = false;
            saveLoginRecovery(session, null);
          }
          session.generation++;
          if (paused) {
            requireProductionSync(session);
            stopLoop(session, '账号暂停，结束挂机', { preserveAutoStart: true });
            session.stages.stop('账号已暂停'); session.mutualAid.stop('账号已暂停'); for (const task of session.trials.values()) task.stop('账号已暂停');
            await closeSessionConnection(session, { includeWorld: true });
            emit(session, 'state', '账号已暂停，可以自行上号', { pauseChanged: true });
          } else {
            emit(session, 'state', '账号已恢复托管', { pauseChanged: true });
            if (!start) await startAutomaticLoop(session);
          }
        }
        if (start) {
          const generation = session.generation;
          if (session.loop.controller?.signal.aborted) await session.loop.job;
          if (!closing && sessions.get(session.id) === session && generation === session.generation && !session.loop.running && !session.paused) {
            startLoop(session, account, { explicitLogin: true });
          }
        }
        json(accountStatus(session));
        return;
      }
      if (route === 'POST /api/connect') {
        const payload = jsonBody();
        const { account, session } = scoped_(parsed);
        const result = await connect(session, account, { explicitLogin: true });
        await startAutomaticLoop(session);
        json(result);
        return;
      }
      if (route === 'POST /api/disconnect') {
        const { session } = scoped_(parsed);
        if (session.connectionDrain) await session.connectionDrain;
        requireProductionSync(session);
        session.generation++;
        stopLoop(session, '账号已断开');
        session.stages.stop('账号已断开'); session.mutualAid.stop('账号已断开'); for (const task of session.trials.values()) task.stop('账号已断开');
        await closeSessionConnection(session);
        json({ ok: true });
        return;
      }

      // ---- 从电脑微信采集登录 ----
      if (route === 'GET /api/capture') {
        json({ ...captureController.captureState(), qr: qrInfo() });
        return;
      }
      if (route === 'GET /api/capture/qrcode') {
        const file = path.join(DATA_DIR, 'qrcode.png');
        if (!fs.existsSync(file)) {
          json({ error: '没有 data/qrcode.png' }, 404);
          return;
        }
        res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' });
        res.end(fs.readFileSync(file));
        return;
      }
      if (route === 'POST /api/capture/start') {
        const payload = jsonBody();
        needConfirm(payload);
        if (captureController.captureState().running) throw new Error('已经在抓包了');
        const platform = payload.platform ?? 'wechat';
        if (!['wechat', 'douyin'].includes(platform)) throw new Error('未知的采集渠道');
        emit(null, 'info', `开始抓包：本地 CA 与系统代理（127.0.0.1:${DEFAULT_PROXY_PORT}）都是当前用户范围，抓到即自动还原`);
        await captureController.startCapture({
          port: DEFAULT_PROXY_PORT,
          platform,
          onLog: (line) => emit(null, /失败|超时/.test(line) ? 'error' : 'info', line),
          onLogin: record => addCapturedAccount(record, platform),
        });
        json({ ...captureController.captureState(), qr: qrInfo() });
        return;
      }
      if (route === 'POST /api/capture/stop') {
        needConfirm(jsonBody());
        await captureController.stopCapture('用户点了停止');
        json({ ...captureController.captureState(), qr: qrInfo() });
        return;
      }
      if (route === 'POST /api/capture/recover') {
        needConfirm(jsonBody());
        await captureController.recoverCapture();
        emit(null, 'info', '上次采集残留已核对并恢复', { category: 'system' });
        json({ ...captureController.captureState(), qr: qrInfo() });
        return;
      }

      // ---- 只读视图 ----
      if(route==='GET /api/gift-codes/initial'){
        json(initialGiftCodeCatalog());return;
      }
      if(route==='GET /api/gift-codes'){
        const {session}=scoped_(parsed);
        json(giftCodeStatus(session.id));return;
      }
      if(route==='GET /api/gift-codes/accounts'){
        json({accounts:loadStore().accounts.map(account=>{
          const session=sessionFor(account.id);
          const base={id:account.id,title:describeAccount(account).title,paused:session.paused,connected:Boolean(session.client?.connected)};
          try{return {...base,...giftCodeSummary(account.id)};}
          catch(error){return {...base,running:false,total:0,counts:{},error:error.message};}
        })});return;
      }
      if(route==='POST /api/gift-codes/redeem'){
        if(req.headers.origin && req.headers.origin!=='http://'+req.headers.host)throw Error('仅接受本地控制台的兑换请求');
        const payload=jsonBody();needConfirm(payload);
        if(!Array.isArray(payload.accounts)||!payload.accounts.length||payload.accounts.some(id=>typeof id!=='string'))throw Error('请至少选择一个账号');
        const known=new Map(loadStore().accounts.map(account=>[account.id,account]));
        const targets=[...new Set(payload.accounts)].map(id=>{
          const account=known.get(id);
          if(!account)return {id,title:id,blocked:'账号不存在'};
          const session=sessionFor(id),generation=session.generation;
          return {id,session,title:describeAccount(account).title,blocked:session.paused?'账号已暂停托管':'',dispatch:action=>{
            const latest=loadStore().accounts.find(item=>item.id===id);
            if(!latest||session.generation!==generation||session.paused)throw Error('原账号连接已变化');
            return progressionJob(session,latest,'gift-code-redeem',null,action);
          }};
        });
        const results=startGiftCodeBatch(targets,payload.codes).map((result,index)=>({...result,...targets[index]}));
        const started=results.filter(result=>result.accepted);
        if(!started.length)throw Error(results.map(result=>result.title+'：'+result.error).join('；'));
        for(const {done,session} of started)done.then(()=>emit(session,'info','礼包兑换完成，请查看兑换记录'),()=>emit(session,'error','礼包兑换中断，请核对记录'));
        if(started.length>1)Promise.allSettled(started.map(result=>result.done)).then(()=>emit(null,'info','批量礼包兑换结束：共 '+started.length+' 个账号，请查看兑换记录'));
        json({accepted:started.length,results:results.map(({id,title,accepted,error})=>({id,title,accepted,error}))});return;
      }
      if(route==='GET /api/merchant/history'){
        const { session } = scoped_(parsed), ledger = usageFor(session);
        json({ summary: merchantJournalSummary(ledger), entries: readMerchantJournal(ledger) }); return;
      }
      if(route==='GET /api/merchant'){
        const { account, session } = scoped_(parsed);
        const value = await progressionJob(session, account, route, null, client =>
          readMerchantStatus(client, loadConfigSafe(), { player: session.player, ledger: usageFor(session), settings: settingsView(session).settings }), { read: true });
        json(value); return;
      }
      if(route==='POST /api/merchant/step'){
        needConfirm(jsonBody());
        const { account, session } = scoped_(parsed);
        const value = await progressionJob(session, account, route, '海商王单步验证', async (client, enabled) => {
          const results = [], preferences = () => settingsView(session).settings;
          const allowed = () => enabled() && preferences().schedule.merchantTrade && nativePreferenceEnabled(preferences(), 'merchantTrade');
          if (!allowed()) throw Error('请先开启海商王走商及所属分组开关');
          await merchantActivity(client, loadConfigSafe(), { player: session.player, key: 'merchantTrade', label: '海商王单步验证',
            settings: preferences, ledger: usageFor(session), enabled: allowed,
            get everyMs() { return preferences().loop.everySeconds * 1000; },
            report: entry => { results.push(entry); emit(session, entry.ok ? 'info' : entry.skipped ? 'info' : 'error',
              '海商王单步验证 · ' + (entry.reason || entry.error || entry.label || entry.status)); } });
          session.activityStatistics = null;
          return { results, state: await readMerchantStatus(client, loadConfigSafe(), { player: session.player, ledger: usageFor(session), settings: preferences() }) };
        });
        json(value); return;
      }
      if(route==='GET /api/activity-statistics'){
        const {account,session}=scoped_(parsed);
        const result=await progressionJob(session,account,route,null,async client=>{
          const cached=session.activityStatistics;
          if(parsed.searchParams.get('refresh')!=='1'&&cached?.client===client&&Date.now()-cached.at<60000)return cached.value;
          const value=await readActivityStatistics(client,loadConfigSafe(),session.player,usageFor(session),session.preferences);
          session.activityStatistics={client,at:Date.now(),value};return value;
        },{read:true});json(result);return;
      }
      if(route==='GET /api/activity-ranks'||route==='GET /api/activity-ranks/view'){
        const {account,session}=scoped_(parsed);
        const result=await progressionJob(session,account,route+':'+(parsed.searchParams.get('key')||'catalog')+':'+(parsed.searchParams.get('page')||1),null,client=>route.endsWith('/view')?readActivityRanking(client,loadConfigSafe(),session.player,parsed.searchParams.get('key'),Number(parsed.searchParams.get('page')||1)):{tabs:activityRankCatalog(client,loadConfigSafe(),session.player).map(({key,label})=>({key,label}))},{read:true});
        json(result);return;
      }
      if (route === 'GET /api/overview') {
        const { account, session } = scoped_(parsed);
        if (session.claiming) await session.claiming;
        session.overviewRead ??= (session.queueTail && session.client?.connected && session.client.interleaveRead
          && !session.connecting && !session.syncingProduction && !session.productionSyncRequired
          ? session.client.interleaveRead(() => overview(session, account)) : overview(session, account)).finally(() => { session.overviewRead = null; });
        json(await session.overviewRead);
        return;
      }
      if (route === 'GET /api/heroes') {
        const { account, session } = scoped_(parsed);
        json(await heroes(session, account));
        return;
      }
      if (route === 'GET /api/pirates') {
        const { account, session } = scoped_(parsed);
        const result = await progressionJob(session, account, route, null, client => pirateTracker(client, loadConfigSafe(), session.player), { read: true });
        for (const message of result.errors) emit(session, 'warn', '海盗首杀查询：' + message);
        json(result);
        return;
      }
      if (route === 'GET /api/equipment/crafting') {
        const { account, session } = scoped_(parsed);
        json(await progressionJob(session, account, route, null, client => readEquipmentCrafting(client, loadConfigSafe(), session.player), { read: true }));
        return;
      }
      if (route === 'POST /api/equipment/forge/recover') {
        const { account, session } = scoped_(parsed);
        const payload = jsonBody();
        needConfirm(payload);
        if (typeof payload.buildingId !== 'string' || !/^([1-9]\d*)装备厂$/.test(payload.buildingId)) throw new Error('工厂标识无法识别');
        const key = JSON.stringify([route, payload.buildingId]);
        json(await progressionJob(session, account, key, '解除装备锻造阻塞', async (client, enabled) => {
          const snapshot = await readEquipmentForge(client, protocol, loadConfigSafe(), session.player, { enabled });
          const result = releaseStaleEquipmentForge(snapshot, usageFor(session), payload.buildingId);
          if (result.status === 'released') emit(session, 'warn', payload.buildingId + '：已按用户确认解除旧锻造记录，未退回已确认消耗');
          return { ...result, buildingId: payload.buildingId };
        }));
        return;
      }
      if (route === 'POST /api/equipment/crafting/start' || route === 'POST /api/equipment/crafting/collect') {
        const { account, session } = scoped_(parsed);
        const payload = jsonBody();
        needConfirm(payload);
        const craft = parsed.pathname.endsWith('/start') ? startEquipmentCraft : collectEquipmentCraft;
        const key = JSON.stringify([route, payload.buildingId, payload.makeId, payload.previewKey]);
        json(await progressionJob(session, account, key, operationLabels[parsed.pathname], async (client, enabled) => {
          const result = await craft(client, loadConfigSafe(), session.player, { ...payload, enabled });
          emit(session, 'info', result.label);
          return result;
        }));
        return;
      }
      if (route === 'GET /api/pirates/board') {
        const { account, session } = scoped_(parsed);
        json(await progressionJob(session, account, route, null, client => pirateBoard(client, loadConfigSafe(), session.player), { read: true }));
        return;
      }
      if (route === 'GET /api/guild/tech' || route === 'GET /api/trials' || route === 'GET /api/equipment' || route === 'GET /api/guild' || route === 'GET /api/pirates/hunt' || route === 'GET /api/fleets/formation') {
        const { account, session } = scoped_(parsed);
        json(await progressionJob(session, account, route, null, async client => {
          const config = loadConfigSafe(), player = session.player;
          if(route==='GET /api/guild/tech')return readGuildTech(client,config,player,{ledger:usageFor(session)});
          if (route === 'GET /api/equipment') return readHeroEquipment(client, config, player.level);
          if (route === 'GET /api/guild') {
            const guild = await readGuild(client, config, player);
            guild.mutualAid = mutualView(session);
            if (guild.aidError) emit(session, 'warn', '读取联盟求助失败：' + guild.aidError);
            if (guild.myAidError) emit(session, 'warn', '读取我的求助失败：' + guild.myAidError);
            return guild;
          }
          if (route === 'GET /api/fleets/formation') return readFleetFormations(client, config, player);
          if (route === 'GET /api/pirates/hunt') return pirateHuntOptions(client, config, player);
          const rows = await trialProgress(client, config, player.level);
          syncLineupRecoveryState(session);
          for (const row of rows) {
            row.task = session.trials.get(row.raidId)?.view() ?? { running: false, reason: '尚未开启', wins: 0, failures: 0 };
          }
          const sweepSettings = settingsView(session).settings, ledger = usageFor(session);
          for (const row of rows) row.sweeps = await readTrialSweeps(client, protocol, config, player, sweepSettings, row.raidId, {
            channel: { clientInfo: account.login?.eworldClientInfo, language: account.login?.language },
            usage: ledger.snapshot(), records: ledger.keyRecords(), pendingDiamonds: ledger.pendingCounters().diamonds ?? 0 });
          for (const row of rows.filter(r => r.failed)) emit(session, 'warn', row.name + '：' + row.reason);
          return rows;
        }, { read: true }));
        return;
      }
      if (route === 'POST /api/guild/tech/upgrade' || route === 'POST /api/equipment/wear' || route === 'POST /api/equipment/enhance' || route === 'POST /api/guild/welfare' || route === 'POST /api/guild/aid/claim' || route === 'POST /api/pirates/hunt' || route === 'POST /api/fleets/formation') {
        const { account, session } = scoped_(parsed);
        const payload = jsonBody();
        needConfirm(payload);
        const label = operationLabels[parsed.pathname];
        const key = JSON.stringify([route, payload.techId, payload.heroId, payload.uid, payload.expectedLevel, payload.maxCost, payload.targetKey, payload.fleetKey, payload.buildingId, payload.previewKey]);
        json(await progressionJob(session, account, key, label, async (client, enabled) => {
          const config = loadConfigSafe(), player = session.player;
          if(route==='POST /api/guild/tech/upgrade'){const result=await upgradeGuildTech(client,config,player,{...payload,enabled,ledger:usageFor(session)});emit(session,'info',result.label);return result;}
          if (route === 'POST /api/equipment/wear') {
            const result = await equipHeroEmptySlots(client, config, player.level, payload.heroId, enabled);
            for (const line of result.lines) emit(session, 'info', line);
            return result;
          }
          if (route === 'POST /api/equipment/enhance') {
            const result = await enhanceHeroEquipment(client, config, player.level, { ...payload, enabled });
            emit(session, 'info', result.label);
            return result;
          }
          if (route === 'POST /api/guild/welfare') {
            const result = await claimGuildWelfare(client, config, { player, enabled });
            emit(session, 'info', result.skipped ? result.reason : result.label);
            return result;
          }
          if (route === 'POST /api/guild/aid/claim') {
            const result = await claimMyGuildAid(client, config, { player, enabled });
            emit(session, result.ok ? 'info' : 'warn', result.label);
            return result;
          }
          if (route === 'POST /api/fleets/formation') {
            const result = await initializeFleetFormation(client, config, player, { ...payload, enabled });
            emit(session, 'info', result.label);
            return result;
          }
          await refreshFleetReservations(session,settingsView(session).settings);
          const result = await runSinglePirateHunt(client, config, player, { ...payload, enabled, getSettings:()=>settingsView(session).settings,ledger:usageFor(session),
            prepareDispatch:()=>refreshFleetReservations(session,settingsView(session).settings),
            report: entry => emit(session, 'info', typeof entry === 'string' ? entry : entry.label) });
          emit(session, 'info', result.label);
          return result;
        }));
        return;
      }
      if (route === 'GET /api/lineup-presets') {
        json(lineupPresetsView(scoped_(parsed).session));
        return;
      }
      if (route === 'GET /api/lineup-editor') {
        const { session, account } = scoped_(parsed);
        json(await progressionJob(session, account, route, '读取布阵信息', async client => ({
          ...await readLineupEditor(client, loadConfigSafe(), session.player), ...lineupPresetsView(session),
        })));
        return;
      }
      if (route === 'POST /api/lineup-presets/save') {
        const payload = jsonBody(); needConfirm(payload);
        json(saveLineupPreset(scoped_(parsed).session, payload, payload.formation));
        return;
      }
      if (route === 'POST /api/lineup-presets/capture') {
        const payload = jsonBody(); needConfirm(payload);
        const { session, account } = scoped_(parsed);
        json(await progressionJob(session, account, route, '保存当前游戏阵容', async client => {
          const editor = await readLineupEditor(client, loadConfigSafe(), session.player);
          return saveLineupPreset(session, payload, editor.formation);
        }));
        return;
      }
      if (route === 'POST /api/lineup-presets/delete') {
        const payload = jsonBody(); needConfirm(payload);
        json(saveLineupPreferences(scoped_(parsed).session, payload, lineups => {
          if (!lineups.presets.some(preset => preset.id === payload.id)) throw new Error('此阵容已删除，请刷新');
          lineups.presets = lineups.presets.filter(preset => preset.id !== payload.id);
          if (lineups.mainlinePresetId === payload.id) lineups.mainlinePresetId = '';
          lineups.trialPresets = lineups.trialPresets.filter(binding => binding.presetId !== payload.id);
        }));
        return;
      }
      if (route === 'POST /api/lineup-presets/bind') {
        const payload = jsonBody(); needConfirm(payload);
        const { session } = scoped_(parsed);
        const raids = new Set(settingsCatalog(loadConfigSafe()).trialRaids.map(raid => String(raid.value)));
        if (!Array.isArray(payload.trialPresets) || payload.trialPresets.some(binding => !raids.has(binding?.raidId))) {
          throw new Error('请选择有效的试炼副本');
        }
        json(saveLineupPreferences(session, payload, lineups => {
          lineups.mainlinePresetId = payload.mainlinePresetId;
          lineups.trialPresets = payload.trialPresets;
        }));
        return;
      }
      if (route === 'POST /api/lineup-presets/recover') {
        const payload = jsonBody(); needConfirm(payload);
        const { session, account } = scoped_(parsed);
        if (!['auto', 'restore', 'keep'].includes(payload.resolution)) throw new Error('请选择有效的阵容恢复方式');
        if (typeof payload.expectedTransactionId !== 'string') throw new Error('请刷新待恢复阵容后再处理');
        json(await enqueue(session, async () => {
          await ensureConnected(session, account, { allowLineupPending: true });
          await recoverSessionLineup(session, { resolution: payload.resolution, expectedTransactionId: payload.expectedTransactionId });
          return lineupPresetsView(session);
        }, '核对待恢复阵容', { recoverFormation: false }));
        return;
      }
      if (route === 'GET /api/lineups') {
        const { account, session } = scoped_(parsed);
        json(await progressionJob(session, account, route, null, client => readLineups(client, loadConfigSafe(), session.player), { read: true }));
        return;
      }
      if (route === 'POST /api/lineups/apply') {
        const { account, session } = scoped_(parsed);
        const payload = jsonBody();
        needConfirm(payload);
        const key = JSON.stringify([route, payload.targetKey, payload.previewKey]);
        json(await progressionJob(session, account, key, operationLabels[parsed.pathname], async (client, enabled) => {
          const result = await applyLineup(client, loadConfigSafe(), session.player, { targetKey: payload.targetKey, previewKey: payload.previewKey, enabled });
          emit(session, 'info', result.label);
          return result;
        }));
        return;
      }
      if(route==='POST /api/week-order/buy'||route==='POST /api/week-order/submit'){
        const payload=jsonBody();needConfirm(payload);
        const {account,session}=scoped_(parsed),action=route.endsWith('/buy')?'buy':'submit';
        const result=await progressionJob(session,account,route+':'+payload.orderKey+':'+String(payload.itemId||''),null,
          (client,enabled)=>runWeekOrder(client,loadConfigSafe(),session.preferences,usageFor(session),enabled,action,payload,{player:session.player}));
        emit(session,'info','商人订单 · '+result.message);json(result);return;
      }
      if (route === 'GET /api/activities/catalog') {
        const { session } = scoped_(parsed);
        const now = (Date.now() + (session.client?.serverClockOffsetMs || 0)) / 1000;
        json({ status: {}, ...activityCatalogView(session, readActivityCatalog(session.id, now), true) });
        return;
      }
      if (route === 'GET /api/activities') {
        const { account, session } = scoped_(parsed);
        const client = await ensureConnected(session, account);
        const view = await activityView(client, client.festivals, loadConfigSafe(), session.player);
        view.vipLevel = session.player?.vip?.vipLevel ?? 0;
        view.compassSpinCount = session.preferences?.eventActions.compassDrawCount ?? session.loop.compassSpinCount;
        view.compassSpinEditable = !session.preferences;
        view.newbie = newbieView(client);
        try { view.fish = await fishView(client, loadConfigSafe()); }
        catch (error) { emit(session, 'error', '读取钓鱼图鉴失败：' + error.message); }
        if (view.order?.materials.length && !view.order.finished) {
          const config = loadConfigSafe();
          const typeOf = makeTypeResolver(config);
          let buildings;
          try {
            const water = await client.request('OnWaterRequest', {}, 'OnWaterResponse');
            buildings = (water.building ?? []).map(b => ({ ...b, type: typeOf(b.buildingId) }));
          } catch (error) {
            emit(session, 'error', '读取商人订单工厂等级失败：' + error.message);
          }
          for (const row of view.order.materials) {
            row.factory = weekFactoryInfo(config, row.id, buildings);
            if (!row.seed) continue;
            const plots = buildings?.filter(b => b.type === '农田' && b.level > 0);
            const growing = plots?.find(b => b.farm?.productId === row.id);
            row.farmStatus = !plots ? '状态未知' : !plots.length ? '农田未建成' : growing ? '已种植，等待收获'
              : row.seed.count ? '种子库存 ' + row.seed.count : '缺' + row.seed.name;
          }
        }
        if (view.lotteryError) emit(session, 'error', '读取周抽奖进度失败：' + view.lotteryError);
        if (view.orderError) emit(session, 'error', '读取商人订单失败：' + view.orderError);
        const now = (Date.now() + (client.serverClockOffsetMs || 0)) / 1000;
        let activities = view.activities;
        try { activities = rememberActivityCatalog(session.id, activities, now); }
        catch (error) {
          view.catalogError = '活动历史暂未保存，请稍后刷新重试。';
          emit(session, 'warn', '保存活动目录失败：' + error.message);
        }
        Object.assign(view, activityCatalogView(session, activities));
        json(view);
        return;
      }
      if (route === 'POST /api/activities/run') {
        const payload = jsonBody();
        needConfirm(payload);
        const { account, session } = scoped_(parsed);
        if (payload.spinCount !== undefined && !validSpinCount(payload.spinCount)) throw new Error('抽奖券张数必须是 1 到 ' + maxCompassSpinCount + ' 的整数');
        const result = await progressionJob(session, account, route + ':' + payload.activityId + ':' + payload.taskKey, '执行活动操作', async (client, enabled) => {
          const result = await runActivity(client, loadConfigSafe(), { ...payload, getSettings: () => settingsView(session).settings, ledger: usageFor(session), spinCount: payload.spinCount ?? session.preferences?.eventActions.compassDrawCount ?? session.loop.compassSpinCount, enabled, player: session.player, playerLevel: session.player?.level,
            channel: { clientInfo: account.login?.eworldClientInfo, language: account.login?.language },
            report: entry => emit(session, entry.ok || entry.skipped ? 'info' : 'error', entry.label || entry.error || '活动操作') });
          return result;
        });
        json(result);
        return;
      }
      if (route === 'GET /api/dailies') {
        const { account, session } = scoped_(parsed);
        json(await dailies(session, account));
        return;
      }
      if (route === 'GET /api/tasks') {
        const { account, session } = scoped_(parsed);
        json(await tasks(session, account));
        return;
      }
      if(route==='GET /api/world/target'){
        const {session}=scoped_(parsed);
        if(!session.client?.connected||session.paused)throw Error('请先连接当前账号，再读取目标详情');
        const result=await readJob(session,()=>readWorldTarget(session.client,protocol,loadConfigSafe(),session.player,settingsView(session).settings,usageFor(session),{layer:parsed.searchParams.get('layer'),key:parsed.searchParams.get('key'),pirateSpent:pirateRunState(session).spent??0}));json(result);return;
      }
      if (route === 'GET /api/world/overview') {
        const {session}=scoped_(parsed);
        if(!session.client?.connected||session.paused)throw new Error('请先连接当前账号，再读取世界概览');
        if(!session.mapRead) { const job=readJob(session,()=>readWorldOverview(session.client,loadConfigSafe(),session.player,settingsView(session).settings,usageFor(session),{pirateSpent:pirateRunState(session).spent??0})).finally(()=>{if(session.mapRead===job)session.mapRead=null;});session.mapRead=job; }
        json(await session.mapRead);return;
      }
      if (route === 'GET /api/world/production-plan') {
        const { session } = scoped_(parsed);
        if (!session.client?.connected || session.paused || session.productionSyncRequired) throw new Error('请先连接并同步当前账号，再计算联合排产');
        if (!session.productionPlanRead) {
          const client = session.client, generation = session.generation, player = session.player;
          const view = settingsView(session), settingsKey = JSON.stringify(view.settings);
          const enabled = () => session.client === client && client.connected && !session.paused
            && session.player === player
            && session.generation === generation && !session.productionSyncRequired
            && JSON.stringify(settingsView(session).settings) === settingsKey;
          const job = readJob(session, async () => {
            if (!enabled()) throw new Error('账号或排产设置已变化，请重新计算');
            const config = loadConfigSafe();
            const timing = watchProductionTimings(client, loadConfigSafe);
            const snapshot = await readProductionSnapshot(client, protocol, config, player, view.settings,
              { enabled, observedDurations: timing.snapshot() });
            if (!enabled()) throw new Error('账号或排产设置已变化，请重新计算');
            if (loadConfigSafe() !== config) throw new Error('游戏配置已更新，请重新计算');
            snapshot.timing.observedDurations = timing.snapshot();
            const result = planProduction(snapshot, config, view.settings,
              { pendingMaterials: captureManualProductionMaterialState(session.player).all });
            if (!enabled()) throw new Error('账号或排产设置已变化，请重新计算');
            return result;
          }).finally(() => { if (session.productionPlanRead === job) session.productionPlanRead = null; });
          session.productionPlanRead = job;
        }
        json(await session.productionPlanRead);
        return;
      }
      if (route === 'GET /api/world') {
        const { account, session } = scoped_(parsed);
        const allowAccelerators = parsed.searchParams.get('speedUp') === 'true';
        if (!session.worldRead || session.worldReadSpeedUp !== allowAccelerators) {
          const job = readJob(session, () => world(session, account, allowAccelerators)).finally(() => { if (session.worldRead === job) session.worldRead = null; });
          session.worldRead = job; session.worldReadSpeedUp = allowAccelerators;
        }
        json(await session.worldRead);
        return;
      }
      if (route === 'POST /api/world/order/submit' || route === 'POST /api/world/order/reroll') {
        const { session } = scoped_(parsed);
        const payload = jsonBody();
        needConfirm(payload);
        const { index, orderKey } = payload;
        if (!Number.isSafeInteger(index) || index < 0 || index > 2147483647 || typeof orderKey !== 'string' || !orderKey.length || orderKey.length > 512) {
          throw new Error('订单信息不完整，请刷新居民订单');
        }
        const isReroll=route.endsWith('/reroll');
        const key = route+':'+index + ':' + orderKey;
        let job = session.residentJobs.get(key);
        if (!job) {
          const client = session.client, generation = session.generation;
          const enabled = () => client?.connected && session.client === client && !session.paused && session.generation === generation;
          job = enqueue(session, async () => {
            if (!enabled()) throw new Error('账号连接已变化，请刷新居民订单');
            const result = await (isReroll?rerollResidentOrder:submitResidentOrder)(client, protocol, { index, orderKey, enabled, ledger:usageFor(session),
              config: loadConfigSafe(), player: session.player, cargoEnabled: () => session.loop.tasks.cargo });
            emit(session, 'info', result.label, { worldUpdated: true });
            return { ok: true, ...result };
          }, (isReroll?'手动换单 #':'手动提交居民订单 #') + index).finally(() => session.residentJobs.delete(key));
          session.residentJobs.set(key, job);
        }
        json(await job);
        return;
      }
      if (route === 'GET /api/worlds') {
        const { account, session } = scoped_(parsed);
        const instance = await ensureConnected(session, account);
        json({ ...(await listWorlds(instance)), currentPlayer: describeRole(session.player) });
        return;
      }
      // 进服自己开一条短连接，所以不会打扰控制台这边正在跑的会话。
      if (route === 'POST /api/worlds/enter') {
        const payload = jsonBody();
        needConfirm(payload);
        const { account, session } = scoped_(parsed);
        if (!payload.worldId) throw new Error('要指定 worldId');
        if (session.paused) throw new Error('账号已暂停，请先恢复托管');
        const client = new GameClient({ url: account.url, protocol });
        session.worldClient = client;
        try {
          const entered = await enterWorld({ client, login: account.login }, Number(payload.worldId));
          json({ player: describeRole(entered.player) });
        } finally {
          client.stop();
          session.worldClient = null;
        }
        return;
      }

      // ---- 写操作 ----
      if (route === 'GET /api/pirates/advance') {json(scoped_(parsed).session.pirateAdvance.view());return;}
      if (route === 'POST /api/pirates/advance/start' || route === 'POST /api/pirates/advance/stop') {
        const payload=jsonBody();needConfirm(payload);const {session,account}=scoped_(parsed);
        if(route.endsWith('/stop')){json(session.pirateAdvance.stop());return;}
        if(session.paused)throw new Error('账号已暂停，请先恢复托管');
        const options=settingsView(session).settings.pirateHunt;
        const generation=session.generation;
        let lastReason='';
        if (session.loop.running && options.enabled) throw new Error('海盗自动讨伐已随挂机运行，请先暂停挂机再手动开始');
        json(session.pirateAdvance.start(options,async()=>{
          const client=await ensureConnected(session,account);
          return {client,player:session.player,config:loadConfigSafe(),ledger:usageFor(session),getSettings:()=>settingsView(session).settings,
            enabled:()=>!session.paused && session.generation===generation && session.client===client && client.connected,
            prepareDispatch:()=>refreshFleetReservations(session,settingsView(session).settings),
            schedule:work=>enqueue(session,work)};
        },state=>{if(state.reason!==lastReason){emit(session,'info','海盗首杀 · '+state.reason+'（已首杀'+state.wins+'级，本次汽油'+state.spent+'）');lastReason=state.reason;}},payload.maxFailures??1));return;
      }
      if (route === 'GET /api/guild/mutual') { json(mutualView(scoped_(parsed).session)); return; }
      if (route === 'POST /api/guild/mutual/preset') {
        const {account}=scoped_(parsed);
        json({preset:saveMutualPreset(account.id,jsonBody())});return;
      }
      if (route === 'GET /api/guild/mutual/options') {
        const {session,account}=scoped_(parsed);
        json(await progressionJob(session,account,route,null,client=>readMutualOptions(client,loadConfigSafe(),session.player),{read:true}));return;
      }
      if (route === 'POST /api/guild/mutual/start' || route === 'POST /api/guild/mutual/stop') {
        const payload=jsonBody();needConfirm(payload);const {session,account}=scoped_(parsed);
        if(route.endsWith('/stop')){json(session.mutualAid.stop());return;}
        if(session.paused)throw new Error('账号已暂停，请先恢复托管');
        if(session.mutualAid.view().running)throw new Error('当前账号已有互助任务，请先停止或等待完成');
        const options=mutualOptions(payload);saveMutualPreset(account.id,options);
        const generation=session.generation;
        json(session.mutualAid.start(options,async()=>{
          const client=await ensureConnected(session,account),player=session.player;
          return {client,player,config:loadConfigSafe(),ledger:usageFor(session),schedule:work=>enqueue(session,work),
            enabled:()=>!session.paused && session.generation===generation && session.client===client && session.player===player && client.connected};
        },state=>emit(session,state.failed||state.pending?'warn':'info',`联盟互助 · ${state.reason}（本轮发起${state.published}条，已确认赠送${state.sent}次，领取${state.received}份）`)));
        return;
      }
      if (route === 'POST /api/trials/sweep') {
        const payload = jsonBody(); needConfirm(payload);
        const { session, account } = scoped_(parsed);
        if (!['paid','ad'].includes(payload.mode) || !payload.expected || !Number.isSafeInteger(payload.expected.cost)) throw new Error('请刷新试炼状态并核对扫荡方式与费用');
        if (session.trials.get(payload.raidId)?.view().running) throw new Error('该副本正在连续推关，请先停止后再扫荡');
        json(await progressionJob(session, account, JSON.stringify([route,payload.raidId,payload.mode,payload.expected]), '试炼扫荡', async (client, enabled) => {
          const initial = settingsView(session).settings;
          const result = await executeTrialSweep(client, protocol, loadConfigSafe(), session.player, payload.raidId, payload.mode, {
            getSettings: () => session.preferences ?? initial, ledger: usageFor(session), enabled, expected: payload.expected, manual: true,
            channel: { clientInfo: account.login?.eworldClientInfo, language: account.login?.language } });
          emit(session, result.ok || result.skipped ? 'info' : 'error', `试炼 · ${result.title || '扫荡'}：${result.note || result.reason || result.error}`);
          return result;
        })); return;
      }
      if (route === 'GET /api/trials/tasks') {
        const { session } = scoped_(parsed);
        syncLineupRecoveryState(session);
        json(Object.fromEntries([...session.trials].map(([id, task]) => [id, task.view()]))); return;
      }
      if (route === 'POST /api/trials/start' || route === 'POST /api/trials/stop') {
        const payload = jsonBody(); needConfirm(payload);
        const { session, account } = scoped_(parsed), config = loadConfigSafe();
        const raid = config?.tables?.TrialRaidCfg?.data?.find(r => r.raidId === payload.raidId);
        if (!raid) throw new Error('请选择有效试炼副本');
        if (route.endsWith('/stop')) { json(session.trials.get(payload.raidId)?.stop() ?? { running: false }); return; }
        if (session.paused) throw new Error('账号已暂停，请先恢复托管');
        selectedSavedLineup(settingsView(session).settings, { presetId: payload.lineupId ?? '' });
        let task = session.trials.get(payload.raidId);
        if (!task) { task = createTrialTask(payload.raidId); session.trials.set(payload.raidId, task); }
        const generation = session.generation;
        const progression = settingsView(session).settings.progression;
        if (session.loop.running && progression.enabled && progression.trials && progression.raidIds.includes(String(payload.raidId))) throw new Error('该试炼已随挂机推关，请先暂停挂机再手动开始');
        json(task.start(payload, async () => {
          const client = await ensureConnected(session, account);
          return { client, player: session.player, config, schedule: work => enqueue(session, work),
            executeBattle: sessionLineupExecutor(session, client, payload.lineupId ?? ''),
            enabled: () => !session.paused && session.generation === generation && session.client === client && client.connected };
        }, state => emit(session, state.failed ? 'error' : 'info', `试炼 · ${raid.title}：${state.reason}（通过${state.wins}关，连续失败${state.failures}次）`)));
        return;
      }
      if (route === 'POST /api/trials/challenge') {
        const { session, account } = scoped_(parsed);
        const { raidId, stageId, lineupId = '' } = jsonBody();
        selectedSavedLineup(settingsView(session).settings, { presetId: lineupId });
        if (session.trials.get(raidId)?.view().running) throw new Error('该试炼正在连续推关，请先停止再单次挑战');
        const message = await progressionJob(session, account, JSON.stringify([route, raidId, stageId, lineupId]), '试炼挑战', async (client, enabled) => {
          const message = await challengeTrial(client, loadConfigSafe(), session.player?.level ?? 0, raidId, stageId, enabled,
            { executeBattle: sessionLineupExecutor(session, client, lineupId) });
          emit(session, 'info', message);
          return message;
        });
        json({ message });
        return;
      }
      if (route === 'GET /api/appointments' || route === 'POST /api/appointments/run') {
        const assign = req.method === 'POST';
        if (assign) needConfirm(jsonBody());
        const { session, account } = scoped_(parsed);
        const previous = session.appointmentJob;
        // 查看可复用任命的最终状态；任命遇到在途查询则等它结束再写。
        if (previous && (!assign || previous.assign)) {
          json(await previous.promise);
          return;
        }
        const job = { assign };
        job.promise = enqueue(session, async () => {
          const client = await ensureConnected(session, account);
          const result = await appointments(client, loadConfigSafe(), session.player?.level, {
            assign, priorities: session.preferences?.appointments?.priorities,
          });
          if (assign) emit(session, 'info', `英雄任命 · ${result.occupied}/${result.slots.length} 个开放职位有人，${result.changed} 个职位有变化`);
          return result;
        }).finally(() => {
          if (session.appointmentJob === job) session.appointmentJob = null;
        });
        session.appointmentJob = job;
        json(await job.promise);
        return;
      }
      if (route === 'POST /api/loot/run') {
        needConfirm(jsonBody());
        const { account, session } = scoped_(parsed);
        session.claiming ??= enqueue(session, async () => {
          if (session.overviewRead) await session.overviewRead;
          const instance = await ensureConnected(session, account);
          emit(session, 'info', '开始一键领取');
          const results = await claimRewards(instance, protocol, loadConfigSafe(), ({ label, ok, error }) =>
            emit(session, ok ? 'info' : 'error', ok ? `领取 · ${label}` : `领取 · ${label}失败：${error}`), undefined, undefined, undefined, session.player, { settings: session.preferences });
          try { await claimReportRewards(instance,loadConfigSafe(),{enabled:()=>!session.paused&&instance.connected,ledger:usageFor(session),report:entry=>{results.push(entry);emit(session,entry.ok||entry.skipped?'info':'error','战报 · '+(entry.reason||entry.error||entry.label));}}); }
          catch(error){results.push({label:'战报奖励',ok:false,error:error.message});}
          const failed = results.filter((entry) => !entry.ok&&!entry.skipped).length;
          const summary = `本轮确认成功 ${results.filter(entry=>entry.ok).length} 项，跳过 ${results.filter(entry=>entry.skipped).length} 项，失败或待确认 ${failed} 项`;
          emit(session, failed ? 'warn' : 'info', summary);
          return { results, summary };
        }, '一键领取').finally(() => { session.claiming = null; });
        json(await session.claiming);
        return;
      }
      if (route === 'POST /api/heroes/run') {
        const payload = jsonBody();
        needConfirm(payload);
        const { account, session } = scoped_(parsed);
        session.heroJob ??= enqueue(session, async () => {
          const instance = await ensureConnected(session, account);
          const plan = await heroes(session, account);
          const started = Date.now();
          const steps = [];
          const guard = actionGuard(session, instance);
          const results = await runHeroPlan(instance, protocol, plan, {
            allowMutate: true,
            timeout: 8000,
            enabled: () => !session.paused && instance.connected,
            getSettings: () => session.preferences, beforeAction: guard.before, afterAction: guard.after, cancelAction: guard.cancel,
            onStep: (entry) => {
              const step = entry.step;
              const label = step.kind === 'level' ? `${step.heroId} 升级请求 · 目标 ${entry.targetLevel} 级` : step.kind === 'star' ? `${step.heroId} 升到 ${step.to} 星` : `${step.heroId} 技能 ${step.slot + 1}`;
              steps.push({ label, ok: entry.ok, skipped: entry.skipped === true, error: entry.error });
              if (entry.skipped) emit(session, 'warn', `英雄 ${label} 已跳过：${entry.error}`);
              else emit(session, entry.ok ? 'info' : 'error', entry.ok ? `英雄 ${label}` : `英雄 ${label} 失败：${entry.error}`);
            },
          });
          const after = await instance.request('AllHeroRequest', {}, 'AllHeroResponse', 15000);
          const upgraded = new Set(results.filter((r) => r.targetLevel != null).map((r) => r.step.heroId));
          for (const hero of after.heroes ?? []) {
            if (upgraded.has(hero.heroId)) emit(session, 'info', `养成后 · ${hero.heroId} 当前 ${hero.level} 级`);
          }
          const skipped = results.filter((r) => r.skipped).length;
          return { sent: results.length - skipped, failed: results.filter((r) => !r.ok && !r.skipped).length,
            skipped, ms: Date.now() - started, steps, heroes: after.heroes ?? [] };
        }, '英雄养成').finally(() => { session.heroJob = null; });
        json(await session.heroJob);
        return;
      }
      if (route === 'POST /api/dailies/single') {
        const payload = jsonBody();
        needConfirm(payload);
        if (typeof payload.token !== 'string') throw new Error('请先刷新日常并选择一项操作');
        const { account, session } = scoped_(parsed);
        json(await progressionJob(session, account, route + ':' + payload.token, '完成单项日常', async (client, enabled) => {
          const result = await runDailySingle(client, protocol, { state: session.dailySingle, token: payload.token, paid: payload.paid === true,
            config: loadConfigSafe(), player: session.player, settings: session.preferences, guard: actionGuard(session, client), enabled });
          emit(session, result.ok ? 'info' : 'warn', result.label);
          return result;
        }));
        return;
      }
      if (route === 'POST /api/dailies/run') {
        const payload = jsonBody();
        needConfirm(payload);
        const { account, session } = scoped_(parsed);
        const instance = await ensureConnected(session, account);
        const config = loadConfigSafe();
        const survey = await surveyDailies(instance, protocol, { config, player: session.player, settings: session.preferences });
        const started = Date.now();
        const guard = actionGuard(session, instance);
        const results = await runDailies(instance, protocol, survey, {
          allowMutate: true,
          allowPaid: payload.paid === true,
          settings: session.preferences, beforeAction: guard.before, afterAction: guard.after, cancelAction: guard.cancel,
          onStep: (entry) => {
            if (entry.skipped) emit(session, 'warn', `日常「${entry.title}」跳过：${entry.reason}`);
            else emit(session, entry.ok ? 'info' : 'error', entry.ok ? `日常「${entry.title}」${entry.note}` : `日常「${entry.title}」${entry.note ?? ''}失败：${entry.error}`,
              entry.ok ? undefined : { request: entry.request, way: entry.way });
          },
        });
        // 任务奖励、活跃度宝箱与每日赠礼的领取都在 runDailies 内部收尾，这里只把结果重新读一遍给页面。
        await new Promise((resolve) => setTimeout(resolve, 1200));
        const after = await surveyDailies(instance, protocol, { config, player: session.player });
        const claimed = results
          .filter((entry) => entry.ok && (entry.request === 'DrawDailyTaskRewardRequest' || entry.id === 'activityChest' || entry.id === 'freeDailyPack'))
          .map((entry) => entry.note);
        json({ results, claimed, ms: Date.now() - started, ...addDailyOptions(after, session.dailySingle) });
        return;
      }
      if (route === 'POST /api/tasks/run') {
        const payload = jsonBody();
        needConfirm(payload);
        const { account, session } = scoped_(parsed);
        const instance = await ensureConnected(session, account);
        const survey = await tasks(session, account);
        const results = await runTasks(instance, protocol, survey, {
          allowMutate: true,
          settings: session.preferences,
          onStep: (entry) => {
            if (entry.skipped) emit(session, 'warn', `任务「${entry.step.label}」跳过：${entry.error}`);
            else emit(session, entry.ok ? 'info' : 'error', entry.ok ? `领取 ${entry.step.label}` : `领取 ${entry.step.label} 失败：${entry.error}`);
          },
        });
        await new Promise((resolve) => setTimeout(resolve, 1200));
        const after = await tasks(session, account);
        json({ results: results.map((r) => ({ label: r.step.label, ok: r.ok, skipped: r.skipped, error: r.error })), plan: after.plan, text: after.text });
        return;
      }
      if (route === 'POST /api/world/run') {
        const payload = jsonBody();
        needConfirm(payload);
        const allowAccelerators = payload.speedUp === true;
        const { account, session } = scoped_(parsed);
        const generation = session.generation;
        const instance = await ensureConnected(session, account);
        const config = loadConfigSafe();
        const protectCargo = session.loop.tasks.cargo || needsCargoDemand(session.preferences);
        const survey = await surveyWorld(instance, protocol, { config, player: session.player, includeCargo: protectCargo });
        const settings = session.preferences;
        const usage = usageFor(session).snapshot();
        const extra = settings ? await surveyBaseAutomation(instance, protocol, config, session.player, settings, survey, { ledger: usageFor(session), enabled: () => session.client === instance && instance.connected !== false }) : null;
        const plan = planWorld(survey, { config, settings, usage, extraDemand: extra ? baseDemands(extra, config, settings) : [],
          allowSpeedUp: allowAccelerators && (!settings || session.loop.tasks.speedUp), allowReroll: settings ? settings.resident.reroll : payload.reroll === true,
          ...(settings ? { enabled: kind => session.loop.tasks[worldTaskKey(kind)] === true, minOrderExp: settings.resident.minExp } : {}) });
        plan.actions = plan.actions.filter(step => allowAccelerators || !(step.costs ?? []).some(cost => cost.id === '加速器' && cost.num > 0));
        const guard = actionGuard(session, instance);
        const { results } = await runWorldRound(instance, protocol, plan, {
          config, player: session.player, allowMutate: true,
          settings, getSettings: () => session.preferences, getUsage: () => usageFor(session).snapshot(),
          beforeStep: step => {
            if (!allowAccelerators && (step.costs ?? []).some(cost => cost.id === '加速器' && cost.num > 0)) throw new AutomationSkip('本轮未允许花加速器');
            return guard.before(step);
          }, afterStep: guard.after, cancelStep: guard.cancel,
          cargoEnabled: () => protectCargo || session.loop.tasks.cargo,
          enabled: kind => generation === session.generation && !session.paused &&
            (!['finishOrder', 'denyOrder'].includes(kind) || protectCargo || !session.loop.tasks.cargo),
          onStep: (entry) => {
            if (entry.skipped) emit(session, 'warn', `海面「${entry.step.label}」跳过：${entry.error}`);
            else emit(session, entry.ok ? 'info' : 'error', entry.ok ? `海面 ${entry.step.label}` : `海面 ${entry.step.label} 失败：${entry.error}`);
          },
        });
        await new Promise((resolve) => setTimeout(resolve, 1200));
        let after;
        try {
          if (generation !== session.generation || session.paused) throw new Error('账号托管状态已变更');
          after = await world(session, account, allowAccelerators);
        } catch (error) {
          emit(session, 'warn', '海面操作已结束，刷新状态失败：' + error.message);
          after = { refreshError: error.message };
        }
        json({ ...after, results: results.map((r) => ({ label: r.step.label, ok: r.ok, skipped: r.skipped, error: r.error })) });
        return;
      }
      if (route === 'GET /api/stages') {
        const { session } = scoped_(parsed);
        syncLineupRecoveryState(session);
        json(session.stages.view());
        return;
      }
      if (route === 'POST /api/stages/start') {
        const payload = jsonBody();
        needConfirm(payload);
        const { session, account } = scoped_(parsed);
        if (session.paused) throw new Error('账号已暂停，请先恢复托管');
        selectedSavedLineup(settingsView(session).settings, { presetId: payload.lineupId ?? '' });
        const progression = settingsView(session).settings.progression;
        if (session.loop.running && progression.enabled && progression.mainline) throw new Error('主线已随挂机推关，请先暂停挂机再手动开始');
        json(session.stages.start(payload, async () => {
          const client = await ensureConnected(session, account);
          const config = loadConfigSafe();
          let nextCheck = 0;
          return { client, player: session.player, config, schedule: work => enqueue(session, work),
            executeBattle: sessionLineupExecutor(session, client, payload.lineupId ?? ''), async beforeBattle(signal) {
            const enabled = key => key === 'afk' && session.loop.tasks.afk && !session.loop.running && !signal.aborted;
            if (!enabled('afk') || Date.now() < nextCheck) return;
            nextCheck = Date.now() + 60_000;
            await claimRewards(client, protocol, config, ({ label, ok, error }) =>
              emit(session, ok ? 'info' : 'error', ok ? label : label + '：' + error),
              enabled, time => { nextCheck = time; });
          } };
        }, (error) => emit(session, 'error', `主线推关失败：${error.message}`)));
        return;
      }
      if (route === 'POST /api/stages/stop') {
        needConfirm(jsonBody());
        json(scoped_(parsed).session.stages.stop());
        return;
      }
      // 循环：开启后立刻返回，进度走 /api/loop 与事件流。
      if (route === 'GET /api/loop') {
        const { session } = scoped_(parsed);
        void refreshTreasureRewards(session);
        const client=session.client;
        if(client?.connected && session.player && (!client.freeRecruitTimes || !Number.isSafeInteger(client.freeRecruitTimes.hero) || !Number.isSafeInteger(client.freeRecruitTimes.antique))
          && Date.now()-(client.recruitTimeAttempt||0)>60000){
          client.recruitTimeAttempt=Date.now();
          void readJob(session,async()=>{
            if(session.client!==client || !client.connected)return;
            try {const r=await client.request('RecruitInfoRequest',{},'RecruitInfoResponse',8000);
              client.freeRecruitTimes={hero:r.hero?.freeEndTimeSeconds,antique:r.antique?.freeEndTimeSeconds};
            }catch { /* 未取到时间时沿用已有的实际观察，不推算冷却。 */ }
          }).catch(()=>{});
        }
        json(loopView(session));
        return;
      }
      if (route === 'POST /api/loop/start') {
        const payload = jsonBody();
        needConfirm(payload);
        const { account, session } = scoped_(parsed);
        startLoop(session, account, { rounds: payload.rounds, everySeconds: payload.everySeconds, explicitLogin: true });
        json({ ...loopView(session), status: accountStatus(session) });
        return;
      }
      if (route === 'POST /api/loop/interval') {
        const payload = jsonBody();
        needConfirm(payload);
        const { session } = scoped_(parsed);
        const { everySeconds } = payload;
        if (!Number.isSafeInteger(everySeconds) || everySeconds < 1 || everySeconds > 86400) throw new Error('间隔秒数需要为 1–86400 的整数');
        const current = settingsView(session);
        if (payload.revision !== current.revision) throw new SettingsError({ revision: '配置已变化，请刷新挂机设置后再操作' });
        const next = structuredClone(current.settings);
        next.loop.everySeconds = everySeconds;
        adoptPreferences(session, saveAutomationSettings(session.id, next, { revision: current.revision, catalog: settingsCatalog(loadConfigSafe()) }));
        emit(session, 'info', `挂机间隔已保存为 ${everySeconds} 秒，下次检查使用新设置`);
        json(loopView(session));
        return;
      }
      if (route === 'POST /api/loop/auto-start') {
        const payload = jsonBody();
        needConfirm(payload);
        if (typeof payload.autoStart !== 'boolean') throw new Error('自动开始挂机必须是开关值');
        const { account, session } = scoped_(parsed);
        saveAutomation(account.id, { autoStart: payload.autoStart, enabled: payload.autoStart });
        if (payload.autoStart) await startAutomaticLoop(session);
        json(loopView(session));
        return;
      }
      if (route === 'POST /api/loop/stop') {
        const payload = jsonBody();
        needConfirm(payload);
        const { session } = scoped_(parsed);
        stopLoop(session, '已暂停挂机', { stopManualTasks: false });
        json({ ok: true, running: session.loop.running, status: accountStatus(session) });
        return;
      }

      if (route === 'POST /api/loop/compass-spin-count') {
        const { session } = scoped_(parsed);
        const { compassSpinCount } = jsonBody();
        if (!validSpinCount(compassSpinCount)) throw new Error('抽奖券张数必须是 1 到 ' + maxCompassSpinCount + ' 的整数');
        if (session.preferences) throw new Error('请在挂机配置中修改罗盘每次抽奖次数');
        saveAutomation(session.id, { compassSpinCount });
        session.loop.compassSpinCount = compassSpinCount;
        emit(session, 'info', '风水罗盘每次最多使用 ' + compassSpinCount + ' 张抽奖券');
        json({ compassSpinCount });
        return;
      }
      if (route === 'POST /api/loop/fishing-reserve') {
        const { session } = scoped_(parsed);
        const { fishingGoldReserve } = jsonBody();
        if (!Number.isSafeInteger(fishingGoldReserve) || fishingGoldReserve < 0) throw new Error('预留金币必须是非负整数');
        if (session.preferences) {
          const next = structuredClone(settingsView(session).settings);
          next.gather.fishingGoldReserve = fishingGoldReserve;
          adoptPreferences(session, saveAutomationSettings(session.id, next, { revision: session.preferencesRevision }));
        } else saveAutomation(session.id, { fishingGoldReserve });
        session.loop.fishingGoldReserve = fishingGoldReserve;
        emit(session, 'info', '钓具强化将保留 ' + fishingGoldReserve.toLocaleString('zh-CN') + ' 金币');
        json({ fishingGoldReserve });
        return;
      }
      if (route === 'POST /api/loop/control') {
        const payload=jsonBody();needConfirm(payload);const {session}=scoped_(parsed);
        const current=settingsView(session);
        if(payload.revision!==current.revision) throw new SettingsError({revision:'配置已变化，请刷新挂机设置后再操作'});
        const next=setAutomationControl(current.settings,payload.key,payload.enabled);
        adoptPreferences(session,saveAutomationSettings(session.id,next,{revision:current.revision,catalog:settingsCatalog(loadConfigSafe())}));
        if(session.client) for(const task of automationTasks) rewardSchedule(session.client).clearTask(task.key);
        emit(session,'info','挂机设置已保存，下次检查使用新设置');json(loopView(session));return;
      }
      if (route === 'POST /api/loop/task') {
        const payload = jsonBody();
        needConfirm(payload);
        const { session } = scoped_(parsed);
        const task = automationTasks.find(item => item.key === payload.key);
        if (!task || typeof payload.enabled !== 'boolean') throw new Error('无效的自动任务设置');
        const tasks = { ...session.loop.tasks, [task.key]: payload.enabled };
        if (session.preferences) {
          const current = settingsView(session);
          const next = applyNativeTask(current.settings, task.key, payload.enabled);
          adoptPreferences(session, saveAutomationSettings(session.id, next, { revision: current.revision }));
        } else {
          saveAutomation(session.id, { tasks });
          session.loop.tasks = tasks;
        }
        if (session.client && payload.enabled) rewardSchedule(session.client).clearTask(task.key);
        if (!Object.values(session.loop.tasks).some(Boolean) && !hasExtraWork(session.preferences) && !(session.preferences?.radar?.runEnabled !== false && session.preferences?.radar?.enabled) && !session.preferences?.worldBoss?.enabled && !treasureAutomationEnabled(session.preferences) && !antiqueEnabled(session.preferences)) stopLoop(session, '全部自动项目已暂停');
        emit(session, 'info', task.label + (payload.enabled ? nativePreferenceEnabled(session.preferences, task.key) ? '已启用' : '已保存为开启，当前分组总开关仍暂停此动作' : '已暂停'));
        json(loopView(session));
        return;
      }

      json({ error: 'not found' }, 404);
    } catch (error) {
      const entry = emit(scoped, 'error', (operationLabels[parsed.pathname] ?? '控制台操作') + '失败：' + error.message, { diagnostic: route });
      json({ error: error.message, ...(error.fields ? { fields: error.fields } : {}), log: entry }, 400);
    } finally {
      releaseWrite?.();
      if (scoped && scoped.busy === route) scoped.busy = null;
    }
  }

  function saveAutomation(id, change) {
    const store = loadStore();
    const account = store.accounts.find(item => item.id === id);
    if (!account) return;
    account.automation = { ...account.automation, ...change };
    saveStore(store);
    if (Object.hasOwn(change, 'autoStart') && sessions.has(id)) sessions.get(id).loop.autoStart = change.autoStart;
  }

  function autoStartEnabled(account) {
    return account.automation?.autoStart ?? account.automation?.enabled ?? false;
  }

  async function startAutomaticLoop(session) {
    try {
      const generation = session.generation;
      if (session.loop.controller?.signal.aborted) await session.loop.job;
      if (closing || sessions.get(session.id) !== session || generation !== session.generation
        || session.paused || session.loop.running || session.loginBlocked && !loginRecoveryActive(session)) return;
      const account = loadStore().accounts.find(row => row.id === session.id);
      if (!account || !autoStartEnabled(account)) return;
      startLoop(session, account, { rounds: 0 });
    } catch (error) {
      session.loop.error = error.message;
      emit(session, 'error', `无法自动开始挂机：${error.message}`);
    }
  }

  function stopLoop(session, reason, { cancelRecovery = true, preserveAutoStart = false, stopManualTasks = true } = {}) {
    if (cancelRecovery) cancelLoginRecovery(session);
    if (stopManualTasks) session.pirateAdvance?.stop(reason);
    const loop = session.loop;
    if (!session.paused || !preserveAutoStart) saveAutomation(session.id, { enabled: false, ...(!preserveAutoStart ? { autoStart: false } : {}) });
    if (!loop.running || loop.controller?.signal.aborted) return;
    loop.controller.abort();
    emit(session, 'info', reason);
  }

  function startLoop(session, account, options = {}) {
    if (session.paused) throw new Error('账号已暂停，请先恢复托管');
    if (session.loginBlocked && !options.explicitLogin && !loginRecoveryActive(session)) throw new Error('账号在别处登录，请先恢复托管或重新开始挂机');
    const loop = session.loop;
    if (loop.running) throw new Error('这个账号的挂机已在运行');
    const current = settingsView(session);
    // 网页开始/恢复挂机一律持续循环；兼容旧配置时不再继承有限轮数。
    // 显式 API 调用仍可指定轮数，供命令行和离线验收使用。
    const rounds = options.rounds ?? 0;
    const everySeconds = options.everySeconds ?? current.settings.loop.everySeconds;
    if (!Number.isSafeInteger(rounds) || rounds < 0 || rounds > 100000) throw new Error('轮数必须是 0–100000 的整数');
    if (!Number.isSafeInteger(everySeconds) || everySeconds < 1 || everySeconds > 86400) throw new Error('间隔秒数需要为 1–86400 的整数');
    if (!Object.values(loop.tasks).some(Boolean) && !hasExtraWork(session.preferences) && !(session.preferences?.radar?.runEnabled !== false && session.preferences?.radar?.enabled) && !session.preferences?.worldBoss?.enabled && !treasureAutomationEnabled(session.preferences) && !cityWarEnabled(session.preferences) && !forgeEnabled(session.preferences) && !antiqueEnabled(session.preferences)) throw new Error('请至少启用一个自动项目');
    // Persist only continuous runs for restart. Reserve this account before login awaits.
    if (current.revision && (current.settings.loop.rounds !== rounds || current.settings.loop.everySeconds !== everySeconds)) {
      const next = structuredClone(current.settings);
      next.loop.rounds = rounds;
      next.loop.everySeconds = everySeconds;
      adoptPreferences(session, saveAutomationSettings(session.id, next, { revision: current.revision }));
    }
    if (!loginRecoveryActive(session)) {
      if (options.explicitLogin || session.loginRecovery?.status !== 'connected') saveLoginRecovery(session, null);
      session.loginBlocked = false;
    }
    saveAutomation(account.id, { enabled: rounds === 0, autoStart: rounds === 0, rounds, everySeconds, loginBlocked: session.loginBlocked });
    Object.assign(loop, { running: true, rounds, completed: 0, everyMs: everySeconds * 1000,
      history: [], error: null, recovery: null, connectionFailure: null, challengeRun: createChallengeRun(), controller: new AbortController() });
    const { signal } = loop.controller;
    emit(session, 'info', `自动挂机开始，${rounds === 0 ? '持续运行' : '共 ' + rounds + ' 轮'}，每 ${everySeconds} 秒检查一次；关闭网页后继续运行，请保留启动窗口`);
    trace(session, 'automation-run', { startedAt: RUN_VERSION, settingsRevision: session.preferencesRevision,
      rounds, everySeconds, tasks: loop.tasks, reconnect: reconnectPolicy(session), settings: settingsView(session).settings });
    let credentialFailed = false, recoveryAttempts = 0;
    loop.job = (async () => {
      try {
        while (!signal.aborted && (rounds === 0 || loop.completed < rounds)) {
        const attemptController = new AbortController();
        loop.attemptController = attemptController;
        loop.connectionFailure = null;
        let attemptClient;
        const cancelAttempt = () => {
          attemptController.abort();
          if (attemptClient && session.client === attemptClient && (loop.recovery || !session.player)) attemptClient.stop();
        };
        signal.addEventListener('abort', cancelAttempt, { once: true });
        try {
        // 旧轮次及已取消的排队操作必须全部退出，不能跨连接并发重放消费。
        await session.queueTail?.catch(() => {});
        while (!signal.aborted && session.loginRecoveryJob) await session.loginRecoveryJob;
        if (signal.aborted) break;
        if (session.loginBlocked) throw Object.assign(new Error('账号在别处登录，自动重连已停止，请检查登录设置和日志'), { recoverable: false });
        const currentAccount = loadStore().accounts.find(row => row.id === account.id);
        if (!currentAccount || session.paused) break;
        const connecting = ensureConnected(session, currentAccount, { backgroundRecovery: true });
        attemptClient = session.client;
        const client = await connecting;
        if (signal.aborted) return;
        if (attemptController.signal.aborted || !client.connected) throw Object.assign(new Error('连接尚未恢复'), { recoverable: true });
        if (loop.recovery) emit(session, 'info', '游戏连接已恢复，继续挂机；未确认操作仍按原记录核对');
        loop.recovery = null;
        const completedBefore = loop.completed;
        const { appId, channelId, originVersion } = currentAccount.login?.eworldClientInfo ?? {};
        await runLoop(client, protocol, { config: loadConfigSafe(), refreshConfig: loadConfigSafe, player: session.player,
          adChannel: { clientInfo: { appId, channelId, originVersion }, language: currentAccount.login?.language },
          rounds: rounds === 0 ? 0 : rounds - completedBefore, everyMs: loop.everyMs, allowMutate: true, stop: attemptController.signal,
          schedule: work => enqueue(session, work),
          isEnabled: key => loop.tasks[key] === true,
          getFishingGoldReserve: () => loop.fishingGoldReserve,
          getCompassSpinCount: () => loop.compassSpinCount,
          isStageBusy: () => session.stages.view().running,
          isTrialBusy: id => session.trials.get(id)?.view().running === true,
          isPirateBusy: () => session.pirateAdvance.view().running,
          challengeRun: loop.challengeRun,
          executeBattle: sessionLineupExecutor(session, client),
          getSettings: () => session.preferences,
          onFishBookComplete: () => {
            const saved=loadAutomationSettings(session.id);
            if(!saved.settings.gather.fishBook || session.client!==client)return;
            saved.settings.gather.fishBook=false;
            adoptPreferences(session,saveAutomationSettings(session.id,saved.settings,{revision:saved.revision}));
            emit(session,'info','大鱼图鉴已集齐，已关闭满仓开拓');
          },
          usageLedger: usageFor(session),
          getEveryMs: () => loop.everyMs,
          onMaintenance:view=>{loop.fleetMaintenance=view;},
          onRound(summary) {
            summary = { ...summary, round: completedBefore + summary.round };
            recoveryAttempts = 0;
            if (session.loginRecovery?.status === 'connected') saveLoginRecovery(session, null);
            if (summary.world.factories?.length) {
              try {
                fs.writeFileSync(factoryReportFile(session.id), JSON.stringify({ time: new Date().toLocaleString('zh-CN'), lines: summary.world.factories }));
              } catch (error) { emit(session, 'warn', '保存工厂核对记录失败：' + error.message); }
            }
            loop.completed = summary.round;
            loop.history.push(summary);
            if (loop.history.length > 50) loop.history.shift();
            emit(session, 'info', formatLoopRound(summary), summary.world.population ? { worldUpdated: true } : undefined);
          },
          onStep(entry) {
            entry = { ...entry, round: completedBefore + entry.round };
            const statusKey = (entry.step?.request==='SetFactoryAutoProduceRequest'?'nativeProduce':null) || entry.taskKey || (['万吨巨轮','城战接续','装备锻造','藏品养成','联盟情报'].includes(entry.category)?entry.category:null) || (entry.step?.kind ? worldTaskKey(entry.step.kind) : null) || entry.category || entry.title || entry.label;
            loop.controlStatus ??= new Map();
            const previous=loop.controlStatus.get(statusKey);
            const text=entry.reason||entry.error||entry.note||(entry.ok?'最近执行成功':'等待检查');
            loop.controlStatus.set(statusKey,{text,state:entry.status==='unknown'||entry.status==='pending'?'pending':entry.skipped?'waiting':entry.ok?'ok':'error',checkedAt:Math.floor(Date.now()/1000)});
            if(previous?.state==='error'&&(entry.ok||entry.skipped)&&!['pending','unknown'].includes(entry.status)) emit(session,'info',(entry.title||entry.label||entry.step?.label||'任务')+'已恢复');
            const production = entry.ok && !entry.skipped && entry.step?.request === 'StartFactoryProduceRequest';
            const batch = production ? JSON.stringify([entry.round, entry.step.body.buildingId, entry.step.body.productId]) : undefined;
            emit(session, entry.skipped || entry.ok || ['pending','unknown'].includes(entry.status) ? 'info' : 'error', formatLoopStep(entry),
              entry.skipped&&!['pending','unknown'].includes(entry.status) ? { waitKey: String(statusKey)+':'+text } : batch ? { batch, factory: entry.step.displayFactory, product: entry.step.displayProduct }
                : entry.request && entry.ok === false ? { request: entry.request, way: entry.way } : undefined);
          },
        });
        if (loop.connectionFailure) throw new Error(loop.connectionFailure.reason);
        break;
        } catch (error) {
          if (signal.aborted) break;
          const failedClient = attemptClient ?? session.client;
          const failure = loop.connectionFailure;
          const kicked = failedClient?.fatalReason === 'SCChannelExpired' || failure?.reason === '账号在别处登录，连接被顶掉';
          if (kicked || session.loginBlocked && session.loginRecovery) {
            while (!signal.aborted && session.loginRecoveryJob) await session.loginRecoveryJob;
            if (signal.aborted) break;
            if (session.loginBlocked) throw Object.assign(new Error('账号在别处登录，自动重连已停止，请检查登录设置和日志'), { recoverable: false });
            continue;
          }
          const recoverable = !error.loginResponse && error.recoverable !== false
            && !['protocol', 'kicked', 'login-rejected'].includes(failedClient?.closeReason)
            && (failure ? failure.recoverable : !failedClient?.connected &&
              (error.recoverable === true || ['network', 'heartbeat-timeout', 'sequence-gap'].includes(failedClient?.closeReason)
                || /login timeout|socket error during login|socket closed during login|^not connected$/i.test(error.message)));
          if (!recoverable) throw error;
          failedClient?.stop();
          if (session.loginRecovery?.status === 'connected') {
            blockImplicitLogin(session, true);
            scheduleLoginRecovery(session);
            startLoginRecovery(session);
            continue;
          }
          const attempt = ++recoveryAttempts;
          const delay = reconnectDelayMs(session, attempt);
          loop.recovery = { attempt: recoveryAttempts, nextAttemptAt: Date.now() + delay, reason: failure?.reason ?? error.message };
          emit(session, 'warn', `${loop.recovery.reason}；${Math.ceil(delay / 1000)} 秒后自动重连（第 ${recoveryAttempts} 次），保留挂机进度`,
            { reconnect: { attempt, delayMs: delay } });
          await recoveryWait(delay, undefined, { signal });
        } finally {
          signal.removeEventListener('abort', cancelAttempt);
          if (loop.attemptController === attemptController) loop.attemptController = null;
        }
        }
      } catch (error) {
        if (!signal.aborted) {
          loop.error = error.message;
          if (error.loginResponse) credentialFailed = true;
          else saveAutomation(account.id, { enabled: false });
          emit(session, 'error', `自动挂机中止：${error.message}`);
        }
      } finally {
        loop.running = false;
        loop.controller = null;
        loop.attemptController = null;
        loop.recovery = null;
        loop.job = null;
        emit(session, 'info', '自动挂机结束', session.loginBlocked ? { pauseChanged: true } : undefined);
        if (credentialFailed) {
          saveAutomation(account.id, { enabled: false });
          emit(session, 'error', '服务器拒绝登录，凭证可能已失效。请在账号页重新采集后再开始挂机');
        }
      }
    })();
  }

  function mutualView(session) {
    const ledger=usageFor(session),usage=ledger.snapshot();
    return { ...session.mutualAid.view(), preset:loadMutualPreset(session.id), day:usage.day, dailyUsed:usage.counters.guildAidGifts ?? 0,
      pendingGifts:ledger.pendingCounters().guildAidGifts ?? 0 };
  }

  // 活动统计与自动参与的真实回包也会刷新此连接的当日领奖数。
  const treasureRewards = new WeakMap();
  const rewardClock = client => Date.now() + (client.serverClockOffsetMs || 0);
  function recordTreasureRewards(client, stats) {
    const limit = loadConfigSafe()?.tables?.TreasureLootParamCfg?.data?.find(row => row.paramName === '每日宝藏奖励次数')?.paramValue;
    const total = stats?.todayRewardTimes;
    const at = rewardClock(client);
    const text = Number.isSafeInteger(total) && total >= 0 && Number.isSafeInteger(limit) && limit > 0
      ? '今日奖励 ' + total + '/' + limit : '今日奖励未同步';
    treasureRewards.set(client, { at, day: beijingDay(at), text });
  }
  async function refreshTreasureRewards(session) {
    const client = session.client;
    if (!client?.connected || !session.player) return;
    const at = rewardClock(client);
    const cached = treasureRewards.get(client);
    if (cached?.day === beijingDay(at) && at >= cached.at && at - cached.at < 60000) return;
    const level = loadConfigSafe()?.tables?.ModuleOpenCfg?.data?.find(row => row.moduleId === '世界宝藏')?.playerLevel;
    if (!Number.isSafeInteger(level) || !(session.player.level >= level)) return;
    treasureRewards.set(client, { at, day: beijingDay(at), text: '今日奖励未同步' });
    try {
      await readJob(session, async () => {
        if (session.client !== client || !client.connected) return;
        const stats = await client.request('TreasureLootStatsRequest', {}, 'TreasureLootStatsResponse', 8000);
        recordTreasureRewards(client, stats);
      });
    } catch { /* 保留未同步状态，下一分钟重试。 */ }
  }
  function pirateRunState(session) {
    const manual=session.pirateAdvance.view();
    return manual.running?manual:session.loop.running?(session.loop.challengeRun?.pirate?.state??{}):{};
  }
  function loopView(session) {
    syncLineupRecoveryState(session);
    const loop = session.loop;
    const rewards = session.client ? rewardSchedule(session.client) : null;
    const displayUsage=usageFor(session).snapshot();
    const observedReward = session.client?.connected ? treasureRewards.get(session.client) : null;
    const treasureReward = observedReward && observedReward.day === displayUsage.day ? observedReward.text : '今日奖励未同步';
    return {
      runVersion: RUN_VERSION,
      fleetMaintenance:{...(loop.fleetMaintenance??{rows:[],reason:'等待首次检查'}),enabled:loop.running&&!!session.client?.connected&&fleetMaintenanceEnabled(settingsView(session).settings)},
      singleTasks: {pirate:session.pirateAdvance.view(), stages:session.stages?.view?.(), mutual:session.mutualAid?.view?.()},
      challenges: { mainline: loop.challengeRun?.mainline ?? {}, trials: loop.challengeRun?.trials ?? {}, pirate: loop.challengeRun?.pirate?.state ?? {} },
      pirateAdvance: session.pirateAdvance.view(),
      controls: automationControlView(settingsView(session).settings).filter(control => !control.taskKey || isActivityTaskAvailable(control.taskKey, session.client)).map(control=>{
        const aliases={'factory.produce':'startProduce','factory.cooperateNative':'nativeProduce','factory.gain':'collect','factory.speedUp':'speedUp','building.build':'build','building.upgrade':'upgrade','building.finish':'finishUpgrade','resident.enabled':'finishOrder','resident.reroll':'denyOrder','farm.enabled':'farm','radar.enabled':'联盟情报','treasure.enabled':'万吨巨轮','cityWar.enabled':'城战接续','forge.enabled':'装备锻造','antique.enabled':'藏品养成','dailies.claimTasks':'dailyRewards','dailies.claimDailyChest':'chests','dailies.claimWeeklyChest':'chests','dailies.claimGift':'gift','resident.rewards':'orderDaily','trials.paid':'trialPaidSweep','trials.ads':'trialAdSweep'};
        const key=control.taskKey||aliases[control.key]||({'worldBoss.enabled':'worldBoss','gather.fishing':'autoFish','gather.upgradeFishing':'fishEnhance','gather.diving':'autoDive','gather.salvage':'autoSalvage','gather.upgradeDiving':'diveEnhance','gather.upgradeSalvage':'salvageEnhance','gather.floaters':'floaters','gather.antiqueFloaters':'antiqueFloaters','cargo.enabled':'cargo','building.collect':'collect','building.supply':'buildSupply','building.speedUp':'speedUp','gold.enabled':'paidGold'})[control.key]||control.key;
        const challengeKeys=control.key==='progression.mainline'?['stageAuto']:control.key==='pirateHunt.enabled'?['pirateAuto']:control.key==='progression.trials'?settingsView(session).settings.progression.raidIds.map(id=>'trialAuto:'+id):[key];
        const recorded=challengeKeys.map(k=>loop.controlStatus?.get(k)).filter(Boolean).sort((a,b)=>(b.checkedAt??0)-(a.checkedAt??0))[0],observed=rewards?.status(key);
        let state=(observed?.checkedAt??0)>(recorded?.checkedAt??0)?observed:recorded||observed;
        if(state?.checkedAt && beijingDay(state.checkedAt*1000)!==displayUsage.day)state=null;
        let nextCheck = rewards?.nextCheck(key) ?? null;
        if (control.key === 'museum.runEnabled') {
          const museum = museumRuntimeStatus(settingsView(session).settings, {
            status(taskKey) {
              const saved = loop.controlStatus?.get(taskKey), current = rewards?.status(taskKey);
              const observation = (current?.checkedAt ?? 0) > (saved?.checkedAt ?? 0) ? current : saved || current;
              return observation?.checkedAt && beijingDay(observation.checkedAt * 1000) !== displayUsage.day ? null : observation;
            },
            nextCheck: taskKey => rewards?.nextCheck(taskKey),
          });
          state = museum.observation;
          nextCheck = museum.nextCheck;
        }
        state??={text:control.group==='总控制'?'控制项，不单独执行':control.key.endsWith('.enabled')&&['building','factory','heroes','pet','gather','progression'].includes(control.key.split('.')[0])?'分组控制，具体动作状态见下方子项':'本次连接尚无检查结果',state:'unseen',checkedAt:null};
        if(control.key==='events.enabled'&&session.client){const events=watchBasePushes(session.client);state={text:events.choiceObserved?'已同步 '+events.choices.size+' 条事件（等待匹配可处理选项）':'未同步：本次连接尚未收到随机事件状态',state:events.choiceObserved?'waiting':'pending'};}
        return {...control,observation:state,...runtimeProgress(control,state,displayUsage,{running:loop.running,connected:!!session.client?.connected,treasureReward,freeTimes:session.client?.freeRecruitTimes,now:Date.now()+(session.client?.serverClockOffsetMs||0)}),nextCheck:loop.running&&session.client?.connected&&control.enabled&&!control.blockedBy.length?nextCheck:null,stale:!loop.running||!session.client?.connected};
      }),
      running: loop.running,
      autoStart: loop.autoStart,
      recovery: loop.recovery,
      stopping: !!loop.controller?.signal.aborted,
      tasks: automationTasks.filter(task => isActivityTaskAvailable(task.key, session.client)).map(({ key, label, group }) => ({
        key, label, group, enabled: loop.tasks[key], blockedBySettings: loop.tasks[key] && !nativePreferenceEnabled(session.preferences, key),
        nextCheck: loop.tasks[key] && nativePreferenceEnabled(session.preferences, key) ? rewards?.nextCheck(key) : null,
      })),
      fishingGoldReserve: loop.fishingGoldReserve,
      compassSpinCount: session.preferences?.eventActions.compassDrawCount ?? loop.compassSpinCount,
      settingsRevision: session.preferencesRevision,
      rounds: loop.rounds,
      completed: loop.completed,
      everyMs: loop.everyMs,
      history: loop.history.map((summary) => ({ ...summary, text: formatLoopRound(summary) })),
      error: loop.error,
    };
  }

  const server = http.createServer((req, res) => {
    req.on('error', () => res.destroy());
    if (authorize && !authorize(req, res)) return;
    res.on('error', () => { streams.delete(res); res.destroy(); });
    req.setEncoding('utf8');
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      void handle(req, res, body).catch(error => {
        emit(null, 'error', '控制台请求处理失败：' + error.message);
        res.destroy();
      });
    });
  });

  return {
    server,
    listen: async () => {
      const recovery = captureController.inspectCaptureRecovery();
      if (recovery.pending) emit(null, 'warn', recovery.error || recovery.message || '检测到上次采集残留，请在账号页恢复', { category: 'system' });
      await resources?.start();
      return new Promise((resolve) => {
        server.listen(port, host, () => {
          const address = `http://${host}:${server.address().port}`;
          emit(null, 'info', `控制台已启动 ${address}`);
          for (const account of loadStore().accounts) {
            if (account.automation?.autoStart === undefined) saveAutomation(account.id, { autoStart: autoStartEnabled(account) });
            if (account.automation?.paused) continue;
            if (!autoStartEnabled(account) && !account.automation?.loginBlocked) continue;
            const session = sessionFor(account.id);
            if (session.loginBlocked) {
              // 旧版本仅保存 loginBlocked；迁移时按当前配置安排完整等待。
              if (!session.loginRecovery || session.loginRecovery.status === 'connecting') scheduleLoginRecovery(session);
              else if (loginRecoveryActive(session) && !reconnectPolicy(session).autoReconnect) cancelLoginRecovery(session, 'disabled');
              startLoginRecovery(session);
            }
            void startAutomaticLoop(session);
          }
          resolve(address);
        });
      });
    },
    close: async () => {
      closing = true;
      clearAlipayRoles();
      await alipayLogin.close();
      for (const client of phonePreviewClients) client.stop();
      phonePreviewClients.clear();
      pendingPhoneLogins.clear();
      await resources?.stop();
      for (const stream of streams) stream.destroy();
      streams.clear();
      const drains = [];
      for (const session of sessions.values()) {
        session.generation++;
        session.loginRecoveryController?.abort();
        session.loginRecoveryWait?.abort();
        session.loop.controller?.abort();
        session.pirateAdvance.stop('控制台已关闭'); session.stages.stop('控制台已关闭'); session.mutualAid.stop('控制台已关闭'); for (const task of session.trials.values()) task.stop('控制台已关闭');
        drains.push(closeSessionConnection(session, { includeWorld: true }));
      }
      await Promise.all(drains);
      return new Promise((resolve) => server.close(() => { traceLog.close().then(resolve); }));
    },
    emit,
    sessions,
    captureState: captureController.captureState,
  };
}

// Edge、Chrome 通常不在 PATH 里，按安装位置找；找不到就交给系统默认浏览器。
export { findAppBrowser, openBrowser } from './platform/browser.mjs';
