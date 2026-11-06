// 每个账号一份。被顶号默认不重连，否则会把正在玩的游戏顶下线。
export const reconnectDefaults = Object.freeze({
  enabled: true,
  baseSeconds: 5,
  maxSeconds: 300,
  maxAttempts: 0,
  kicked: 'stop',
  kickedMinutes: 30,
});

const LIMITS = {
  baseSeconds: [1, 3600],
  maxSeconds: [1, 86400],
  maxAttempts: [0, 100000],
  kickedMinutes: [1, 1440],
};

function checked(name, value) {
  const [min, max] = LIMITS[name];
  return Number.isSafeInteger(value) && value >= min && value <= max;
}

// 读取已保存的设置：单项非法时退回默认值，不让旧数据挡住挂机。
export function normalizeReconnect(saved) {
  const result = { ...reconnectDefaults };
  if (!saved || typeof saved !== 'object') return result;
  if (typeof saved.enabled === 'boolean') result.enabled = saved.enabled;
  if (saved.kicked === 'stop' || saved.kicked === 'retry') result.kicked = saved.kicked;
  for (const name of Object.keys(LIMITS)) if (checked(name, saved[name])) result[name] = saved[name];
  if (result.maxSeconds < result.baseSeconds) result.maxSeconds = result.baseSeconds;
  return result;
}

// 处理用户提交的设置：任何一项非法都拒绝，避免静默改成别的值。
export function parseReconnect(input) {
  if (!input || typeof input !== 'object') throw new Error('无效的重连设置');
  if (typeof input.enabled !== 'boolean') throw new Error('请选择是否自动重连');
  if (input.kicked !== 'stop' && input.kicked !== 'retry') throw new Error('请选择被顶号后的处理方式');
  const names = { baseSeconds: '首次重连间隔（秒）', maxSeconds: '最长重连间隔（秒）', maxAttempts: '最多重连次数', kickedMinutes: '被顶号后等待（分钟）' };
  for (const [name, label] of Object.entries(names)) {
    if (!checked(name, input[name])) {
      const [min, max] = LIMITS[name];
      throw new Error(label + '必须是 ' + min + ' 到 ' + max + ' 的整数');
    }
  }
  if (input.maxSeconds < input.baseSeconds) throw new Error('最长重连间隔不能小于首次重连间隔');
  return { enabled: input.enabled, baseSeconds: input.baseSeconds, maxSeconds: input.maxSeconds,
    maxAttempts: input.maxAttempts, kicked: input.kicked, kickedMinutes: input.kickedMinutes };
}

export function reconnectDelaySeconds(settings, attempt, kind, random = Math.random) {
  if (kind === 'kicked') return settings.kickedMinutes * 60;
  const exponent = Math.min(Math.max(attempt, 1) - 1, 20);
  const delay = Math.min(settings.baseSeconds * 2 ** exponent, settings.maxSeconds);
  // 多账号同时掉线时错开重连，抖动不超过上限。
  return Math.min(settings.maxSeconds, Math.max(1, Math.round(delay * (0.9 + random() * 0.2))));
}

export function recoveryDecision(settings, kind, attempt) {
  if (!settings.enabled) return { action: 'stop', reason: 'disabled' };
  if (kind === 'kicked' && settings.kicked === 'stop') return { action: 'stop', reason: 'kicked' };
  if (settings.maxAttempts > 0 && attempt > settings.maxAttempts) return { action: 'stop', reason: 'exhausted' };
  return { action: 'retry' };
}
