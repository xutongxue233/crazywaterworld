import fs from 'node:fs';
import path from 'node:path';

const secretKey = /(?:password|passwd|pwd|token|secret|sign|signature|sessionkey|authorization|cookie|openid|unionid|phone|mobile|credentials|login)$/i;

function redactText(value) {
  return value
    .replace(/\b(Bearer\s+)[^\s"'<>]+/gi, '$1[已脱敏]')
    .replace(/\b((?:access[_-]?|refresh[_-]?)?token|password|passwd|pwd|secret|sign|signature|session[_-]?key|authorization|cookie|open[_-]?id|union[_-]?id|phone|mobile)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s&,;]+)/gi, '$1=[已脱敏]')
    .replace(/(https?:\/\/|wss?:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[已脱敏]@');
}

// 保留可重放的协议字段，登录凭据和错误文本中的凭据统一在落盘前脱敏。
export function traceJson(value) {
  const ancestors = [];
  return JSON.stringify(value, function (key, item) {
    if (secretKey.test(key.replace(/[_-]/g, ''))) return '[已脱敏]';
    if (typeof item === 'string') return redactText(item);
    if (typeof item === 'bigint') return item.toString();
    if (item instanceof Error) return { name: item.name, message: redactText(item.message), stack: redactText(item.stack ?? '') };
    if (item && typeof item === 'object') {
      while (ancestors.length && ancestors.at(-1) !== this) ancestors.pop();
      if (ancestors.includes(item)) return '[循环引用]';
      ancestors.push(item);
    }
    return item;
  });
}

export function emitDiagnostic(client, event, data) {
  try { client.emit?.('diagnostic', { ...data, event }); } catch { /* 日志观察者不能中断玩法。 */ }
}

// Two files alternate so a long-running console never has to rename an open
// stream on Windows. Each file is capped independently.
export function createTraceLog(file, { maxBytes = 5 * 1024 * 1024 } = {}) {
  const limit = Number.isSafeInteger(maxBytes) && maxBytes > 0 ? maxBytes : 5 * 1024 * 1024;
  const files = [file, file + '.1'];
  let index = 0, fd = null, bytes = 0, initialized = false, closed = false;

  function trim(target) {
    try { if (fs.statSync(target).size > limit) fs.truncateSync(target, 0); } catch { /* 文件不存在 */ }
  }
  function open(truncate = false) {
    const target = files[index];
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (truncate) { try { fs.truncateSync(target, 0); } catch { /* 文件不存在 */ } }
    fd = fs.openSync(target, 'a');
    bytes = (() => { try { return fs.statSync(target).size; } catch { return 0; } })();
  }
  function initialize() {
    if (initialized) return;
    initialized = true;
    for (const target of files) trim(target);
    const modified = files.map(target => { try { return fs.statSync(target).mtimeMs; } catch { return -1; } });
    if (modified[1] > modified[0]) index = 1;
  }
  function rotate() {
    if (fd !== null) { try { fs.closeSync(fd); } catch { /* 忽略关闭错误 */ } fd = null; }
    index = 1 - index;
    try { fs.rmSync(files[index], { force: true }); } catch { /* 下一次打开会截断 */ }
    try { open(true); } catch { fd = null; bytes = 0; }
  }

  return {
    write(text) {
      if (closed) return;
      initialize();
      let data = Buffer.from(String(text));
      if (data.length > limit) {
        // 大回包保留完整 UTF-8 前缀并标明截断，单条写入也遵守文件上限。
        const marker = Buffer.from(' [日志过长，已截断]\n');
        let end = Math.max(0, limit - marker.length);
        while (end > 0 && (data[end] & 0xc0) === 0x80) end--;
        data = marker.length <= limit ? Buffer.concat([data.subarray(0, end), marker]) : Buffer.alloc(0);
      }
      const size = data.length;
      if (fd === null) {
        try { open(); } catch { return; }
      }
      if (bytes > 0 && bytes + size > limit) rotate();
      if (fd === null) return;
      try { fs.writeSync(fd, data); bytes += size; } catch {
        try { fs.closeSync(fd); } catch { /* 下一次日志写入重试打开 */ }
        fd = null;
      }
    },
    close() {
      closed = true;
      if (fd !== null) { try { fs.closeSync(fd); } catch { /* 忽略关闭错误 */ } }
      fd = null;
      return Promise.resolve();
    },
    get files() { return [...files]; },
    get current() { return files[index]; },
  };
}
