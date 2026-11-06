import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './accounts.mjs';

export const notifyEvents = [
  ['kicked', '账号被顶号'],
  ['credential', '登录凭证失效'],
  ['disconnect', '掉线后重连失败'],
  ['recovered', '掉线后已恢复'],
  ['taskFailing', '自动任务连续失败'],
  ['loopError', '挂机异常停止'],
].map(([key, label]) => ({ key, label }));

export const webhookFormats = ['generic', 'wecom', 'feishu'];
const COOLDOWN_MS = 30 * 60 * 1000;

export const notifySettingsPath = () => path.join(DATA_DIR, 'notify.json');

export function defaultNotifySettings() {
  return { webhookUrl: '', webhookFormat: 'generic',
    events: Object.fromEntries(notifyEvents.map(({ key }) => [key, true])) };
}

export function normalizeNotifySettings(saved) {
  const result = defaultNotifySettings();
  if (!saved || typeof saved !== 'object') return result;
  if (typeof saved.webhookUrl === 'string' && validWebhook(saved.webhookUrl)) result.webhookUrl = saved.webhookUrl;
  if (webhookFormats.includes(saved.webhookFormat)) result.webhookFormat = saved.webhookFormat;
  for (const { key } of notifyEvents) if (typeof saved.events?.[key] === 'boolean') result.events[key] = saved.events[key];
  return result;
}

function validWebhook(url) {
  if (url === '') return true;
  try {
    return ['http:', 'https:'].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

export function parseNotifySettings(input) {
  if (!input || typeof input !== 'object') throw new Error('无效的通知设置');
  const webhookUrl = typeof input.webhookUrl === 'string' ? input.webhookUrl.trim() : '';
  if (!validWebhook(webhookUrl)) throw new Error('Webhook 地址必须以 http:// 或 https:// 开头');
  if (!webhookFormats.includes(input.webhookFormat)) throw new Error('无效的 Webhook 格式');
  const events = {};
  for (const { key } of notifyEvents) {
    if (typeof input.events?.[key] !== 'boolean') throw new Error('无效的通知事件设置');
    events[key] = input.events[key];
  }
  return { webhookUrl, webhookFormat: input.webhookFormat, events };
}

export function loadNotifySettings() {
  try {
    return normalizeNotifySettings(JSON.parse(fs.readFileSync(notifySettingsPath(), 'utf8')));
  } catch {
    return defaultNotifySettings();
  }
}

export function saveNotifySettings(settings) {
  const file = notifySettingsPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(settings, null, 2) + '\n');
  fs.renameSync(tmp, file);
}

export function webhookBody(format, { title, message, event, account, time }) {
  const text = title + '\n' + message;
  if (format === 'wecom') return { msgtype: 'text', text: { content: text } };
  if (format === 'feishu') return { msg_type: 'text', content: { text } };
  return { title, message, event, account, time };
}

async function runWebhook(url, body, fetcher) {
  const response = await fetcher(url, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error('Webhook 返回 ' + response.status);
}

export function createNotifier({ getSettings = loadNotifySettings, fetcher = fetch, now = Date.now, onError = () => {} } = {}) {
  const sent = new Map();

  async function deliver(payload, settings) {
    try {
      await runWebhook(settings.webhookUrl, webhookBody(settings.webhookFormat, payload), fetcher);
      return { failures: [] };
    } catch (error) {
      return { failures: ['Webhook：' + error.message] };
    }
  }

  return {
    // 同一账号的同一事件 30 分钟内只发一次，避免反复掉线时刷屏。
    async send(event, account, title, message) {
      const settings = getSettings();
      if (!settings.webhookUrl) return { skipped: 'noWebhook' };
      if (!settings.events[event]) return { skipped: 'disabled' };
      const key = event + '|' + account;
      if (now() - (sent.get(key) ?? -Infinity) < COOLDOWN_MS) return { skipped: 'cooldown' };
      sent.set(key, now());
      const result = await deliver({ title, message, event, account, time: new Date(now()).toISOString() }, settings);
      for (const failure of result.failures) onError(failure);
      return result;
    },
    async test() {
      const settings = getSettings();
      if (!settings.webhookUrl) throw new Error('请先填写 Webhook 地址');
      return deliver({ title: '疯狂水世界控制台', message: '这是一条测试通知。', event: 'test', account: null,
        time: new Date(now()).toISOString() }, settings);
    },
  };
}
