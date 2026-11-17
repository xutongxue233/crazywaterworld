import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { DATA_DIR } from './accounts.mjs';

const cookieName = 'cw_console_session';
const digest = value => createHash('sha256').update(value).digest('hex');
const page = error => `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>登录控制台</title><style>body{font:16px system-ui;background:#f5f5f5;margin:0;min-height:100dvh;display:grid;place-items:center}main{box-sizing:border-box;width:min(400px,calc(100% - 32px));background:white;padding:24px;border-radius:16px}form{display:grid;gap:16px}input,button{box-sizing:border-box;width:100%;min-height:48px;font:inherit;padding:12px;border:1px solid #ccc;border-radius:8px}button{background:#171717;color:white}p{color:#666;line-height:1.5}</style><main><h1>登录控制台</h1><p>登录后管理游戏账号与挂机任务</p>${error ? '<p role="alert">账号或密码错误，或尝试过于频繁，请稍后重试。</p>' : ''}<form method="post" action="/auth/login"><label>管理员账号<input name="username" autocomplete="username" required maxlength="100"></label><label>密码<input id="login-password" name="password" type="password" autocomplete="current-password" required maxlength="256"></label><button type="button" id="password-visibility" aria-controls="login-password" aria-pressed="false" style="background:white;color:#171717">输入中文 / 显示密码</button><button>登录</button></form></main><script>document.getElementById('password-visibility').onclick=function(){const input=document.getElementById('login-password');const visible=input.type==='password';input.type=visible?'text':'password';this.textContent=visible?'隐藏密码':'输入中文 / 显示密码';this.setAttribute('aria-pressed',String(visible));input.focus();};</script></html>`;

export function createConsoleAuth({ directory = DATA_DIR, env = process.env, now = Date.now } = {}) {
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, 'console-admin.json');
  let admin;
  if (fs.existsSync(file)) admin = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (env.CW_ADMIN_PASSWORD || !admin) {
    const password = env.CW_ADMIN_PASSWORD || randomBytes(15).toString('base64url');
    if (password.length < 4 || password.length > 256) throw new Error('控制台密码需为 4 至 256 个字符');
    const salt = randomBytes(16).toString('hex');
    admin = { username: env.CW_ADMIN_USERNAME || 'admin', salt, hash: scryptSync(password, salt, 64).toString('hex') };
    fs.writeFileSync(file, JSON.stringify(admin), { mode: 0o600 });
    fs.chmodSync(file, 0o600);
    if (!env.CW_ADMIN_PASSWORD) fs.writeFileSync(path.join(directory, 'console-initial-password.txt'), password, { mode: 0o600 });
  }
  if (!admin.username || !/^[a-f0-9]{32}$/.test(admin.salt) || !/^[a-f0-9]{128}$/.test(admin.hash)) throw new Error('控制台管理员配置无效');
  const sessions = new Map(), failures = new Map();
  function remove(key) {
    const session = sessions.get(key);
    for (const response of session?.streams || []) response.destroy();
    sessions.delete(key);
  }
  return function authorize(req, res) {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    const json = (code, error) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ error })); };
    const redirect = location => { res.writeHead(303, { Location: location }); res.end(); };
    if (!['GET', 'HEAD'].includes(req.method)) {
      if ((req.headers.origin && req.headers.origin !== 'http://' + req.headers.host && req.headers.origin !== 'https://' + req.headers.host) || req.headers['sec-fetch-site'] === 'cross-site') { json(403, '拒绝跨站请求'); return false; }
    }
    const cookies = String(req.headers.cookie || '').split(';').map(item => item.trim());
    const token = cookies.find(item => item.startsWith(cookieName + '='))?.slice(cookieName.length + 1) || '';
    const key = digest(token);
    const session = sessions.get(key);
    if (session && session.expires <= now()) remove(key);
    const authenticated = sessions.has(key);
    const setCookie = (value, age) => res.setHeader('Set-Cookie', `${cookieName}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${req.socket.encrypted ? '; Secure' : ''}`);
    if (pathname === '/auth/logout' && req.method === 'POST') {
      remove(key); setCookie('', 0); redirect('/login'); return false;
    }
    if (pathname === '/login' && req.method === 'GET') {
      if (authenticated) redirect('/');
      else { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(page(false)); }
      return false;
    }
    if (pathname === '/auth/login' && req.method === 'POST') {
      let body = '', size = 0;
      req.on('data', chunk => { size += chunk.length; if (size <= 4096) body += chunk; });
      req.on('end', () => {
        const peer = req.socket.remoteAddress;
        const ip = env.CW_TRUST_PROXY === '1' && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(peer)
          ? String(req.headers['x-real-ip'] || peer) : peer;
        for (const [address, entry] of failures) if (entry.until <= now()) failures.delete(address);
        const failure = failures.get(ip);
        if (size > 4096) { json(413, '请求过大'); return; }
        if (failure?.count >= 5 || failures.size >= 1000) { json(429, '登录尝试过于频繁，请 15 分钟后重试'); return; }
        const values = new URLSearchParams(body);
        const password = values.get('password') || '';
        const valid = password.length <= 256 && timingSafeEqual(scryptSync(password, admin.salt, 64), Buffer.from(admin.hash, 'hex')) && values.get('username') === admin.username;
        if (!valid) {
          failures.set(ip, { count: (failure?.count || 0) + 1, until: failure?.until || now() + 900000 });
          res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(page(true)); return;
        }
        failures.delete(ip);
        remove(key);
        for (const [id, entry] of sessions) if (entry.expires <= now()) remove(id);
        if (sessions.size >= 100) remove(sessions.keys().next().value);
        const value = randomBytes(32).toString('hex');
        sessions.set(digest(value), { expires: now() + 12 * 3600000, streams: new Set() });
        setCookie(value, 43200); redirect('/');
      });
      return false;
    }
    if (!authenticated) {
      if (pathname.startsWith('/api/')) json(401, '请先登录控制台');
      else redirect('/login');
      return false;
    }
    if (req.headers.accept?.includes('text/event-stream') || pathname.includes('events')) {
      const entry = sessions.get(key);
      entry.streams.add(res);
      const timer = setTimeout(() => remove(key), Math.max(1, entry.expires - now()));
      timer.unref();
      res.on('close', () => { clearTimeout(timer); entry.streams.delete(res); });
    }
    return true;
  };
}
