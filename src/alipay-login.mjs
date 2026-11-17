import { randomUUID } from 'node:crypto';
import { createCodec } from './codec.mjs';
import { inspectGameFrame } from './frame-header.mjs';
import { ensureHeadlessBrowser } from './platform/browser.mjs';

const GAME_URL = 'https://www.wanyiwan.top/game/fkssj';
const AUTH_PATH = '/gameauth/com.alipay.gameauth.common.facade.service.GameCenterPcAuthFacade/';
const ACTIVE_PHASES = new Set(['starting', 'waiting', 'authorizing']);
const START_TIMEOUT_MS = 12 * 60_000;
const QR_TIMEOUT_MS = 5 * 60_000;
const GAME_TIMEOUT_MS = 2 * 60_000;
const CAPTURED_TIMEOUT_MS = 10 * 60_000;

async function launchBrowser() {
  let executablePath;
  try {
    executablePath = await ensureHeadlessBrowser();
  } catch (error) {
    if (error.message.includes('自动下载 Chromium')) throw error;
    throw new Error('服务器未找到 Chromium、Google Chrome 或 Microsoft Edge，且自动下载未能完成。请检查网络和数据目录权限，或设置 CW_BROWSER_EXECUTABLE。');
  }
  const { chromium } = await import('playwright-core');
  return chromium.launch({ executablePath, headless: true, timeout: 30_000 });
}

function tokenExpiry(token, fallback) {
  try {
    const payload = JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString('utf8'));
    const expiry = Number(payload.exp) * 1000;
    return Number.isSafeInteger(expiry) && expiry > 0 ? Math.min(expiry, fallback) : fallback;
  } catch {
    return fallback;
  }
}

function validTimestamp(value) {
  try {
    if (value && typeof value === 'object' && Number.isInteger(value.low) && Number.isInteger(value.high)) {
      return ((BigInt(value.high) << 32n) + BigInt(value.low >>> 0)) > 0n;
    }
    return BigInt(value) > 0n;
  } catch {
    return false;
  }
}

// 浏览器仅保留在本次扫码期间，登录凭证由调用方明确保存后再清理。
export function createAlipayLogin({
  protocol,
  launch = launchBrowser,
  startTimeoutMs = START_TIMEOUT_MS,
  now = Date.now,
  setTimeout: schedule = globalThis.setTimeout,
  clearTimeout: unschedule = globalThis.clearTimeout,
} = {}) {
  let current = null;
  let closed = false;
  let previousStart = Promise.resolve();
  const codec = createCodec(protocol ?? {});

  function live(session) {
    return current === session && !closed && ACTIVE_PHASES.has(session.phase);
  }

  function snapshot(session) {
    return {
      id: session?.id ?? null,
      phase: session?.phase ?? 'cancelled',
      qrImage: session?.qrImage ?? null,
      launchUrl: session?.phase === 'waiting' ? session.launchUrl ?? null : null,
      expiresAt: session?.expiresAt ?? null,
      error: session?.error ?? null,
    };
  }

  function clearTimer(session) {
    if (session.timer !== null) unschedule(session.timer);
    session.timer = null;
  }

  async function dispose(session) {
    const browser = session.browser;
    if (!browser) return;
    if (session.disposing) return session.disposing;
    session.disposing = (async () => {
      try {
        await session.context?.close();
      } catch { /* 浏览器已断开时仍继续释放进程。 */ }
      try {
        await browser.close();
      } catch { /* 浏览器关闭期间的断连事件不覆盖登录结果。 */ }
      session.browser = null;
      session.context = null;
      session.pages.clear();
    })();
    return session.disposing;
  }

  function finish(session, phase, error = null) {
    clearTimer(session);
    session.phase = phase;
    session.error = error;
    session.qrImage = null;
    if (phase !== 'captured') session.credential = null;
    session.ready();
    void dispose(session);
  }

  function deadline(session, expiresAt, phase = 'expired', message = '二维码已过期，请重新生成后扫码。') {
    clearTimer(session);
    session.expiresAt = expiresAt;
    session.timer = schedule(() => {
      if (current !== session || closed || ![...ACTIVE_PHASES, 'captured'].includes(session.phase)) return;
      finish(session, phase, message);
    }, Math.max(0, expiresAt - now()));
    session.timer?.unref?.();
  }

  function expireIfNeeded(session) {
    if (session && [...ACTIVE_PHASES, 'captured'].includes(session.phase) && session.expiresAt <= now()) {
      const message = session.phase === 'captured' ? '登录结果已过期，请重新扫码。'
        : session.phase === 'authorizing' ? '游戏登录超时，请重新扫码。' : '二维码已过期，请重新生成后扫码。';
      finish(session, session.phase === 'authorizing' ? 'error' : 'expired', message);
    }
  }

  function selected(id) {
    if (id && current?.id !== id) throw new Error('本次扫码登录已失效，请重新生成二维码。');
    expireIfNeeded(current);
    return current;
  }

  function captureFrame(session, socket, payload) {
    expireIfNeeded(session);
    if (!live(session) || typeof payload === 'string') return;
    const frame = inspectGameFrame(payload);
    if (frame?.name !== 'LoginRequest') return;
    try {
      const { body } = codec.decode(payload);
      const params = body?.eworldParams;
      if (!['openId', 'token', 'sign'].every(key => typeof params?.[key] === 'string' && params[key].trim())
        || !validTimestamp(params?.timestamp)) {
        finish(session, 'error', '游戏登录报文缺少完整凭证，请重新扫码。');
        return;
      }
      const url = new URL(socket.url());
      if (!['ws:', 'wss:'].includes(url.protocol)) return;
      session.credential = {
        url: url.href,
        login: JSON.parse(JSON.stringify(body)),
        loginFrameHex: Buffer.from(payload).toString('hex'),
        source: 'alipay',
        capturedAt: new Date(now()).toISOString(),
      };
      finish(session, 'captured');
      deadline(session, now() + CAPTURED_TIMEOUT_MS, 'expired', '登录结果已过期，请重新扫码。');
    } catch {
      finish(session, 'error', '无法解析游戏登录报文，请更新本机游戏协议后重试。');
    }
  }

  function watchPage(session, page) {
    if (session.pages.has(page)) return;
    session.pages.add(page);
    page.on('websocket', socket => {
      socket.on('framesent', event => captureFrame(session, socket, event.payload));
    });
    page.on('crash', () => {
      if (live(session)) finish(session, 'error', '扫码登录页面意外退出，请重新生成二维码。');
    });
  }

  async function continueDevicePrompt(session, page) {
    const limit = page.getByText('登录设备数量已达上限', { exact: true });
    const confirm = page.getByRole('button', { name: '确认登录', exact: true });
    try {
      // 官网有已登录设备时可能先显示管理弹窗，也可能直接进入游戏。
      // 两个等待独立于登录帧监听，浏览器关闭会取消尚未出现的弹窗等待。
      const kind = await Promise.race([
        limit.waitFor({ state: 'visible', timeout: GAME_TIMEOUT_MS }).then(() => 'limit'),
        confirm.waitFor({ state: 'visible', timeout: GAME_TIMEOUT_MS }).then(() => 'confirm'),
      ]);
      if (!live(session) || session.phase !== 'authorizing') return;
      const full = kind === 'limit' || await limit.isVisible();
      if (!live(session) || session.phase !== 'authorizing') return;
      if (full) {
        finish(session, 'error', '支付宝游戏中心的登录设备数量已达上限，请前往官方网页管理登录设备后重新扫码。');
        return;
      }
      await confirm.click({ timeout: 5000 });
    } catch {
      // 无设备弹窗时由游戏登录结果或授权超时结束本次会话。
    }
  }

  async function readResponse(session, response) {
    if (!live(session)) return;
    const url = new URL(response.url());
    if (url.hostname !== 'webgwmobiler.alipay.com' || !url.pathname.startsWith(AUTH_PATH)) return;
    const action = url.pathname.slice(AUTH_PATH.length);
    if (!['getLoginToken', 'loginForPc'].includes(action)) return;
    let result;
    try {
      result = await response.json();
    } catch {
      if (live(session)) finish(session, 'error', '支付宝登录服务响应异常，请重新生成二维码。');
      return;
    }
    if (!live(session)) return;
    if (result?.errorCode === 'TOKEN_INVALID' || result?.errorCode === 'QR_CODE_INVALID') {
      finish(session, 'expired', '二维码已过期，请重新生成后扫码。');
      return;
    }
    if (action === 'loginForPc') {
      if (result?.success === true && result.data?.token && result.data?.userId) {
        session.phase = 'authorizing';
        session.qrImage = null;
        deadline(session, now() + GAME_TIMEOUT_MS, 'error', '游戏登录超时，请重新扫码。');
        session.ready();
        if (!session.devicePromptStarted) {
          session.devicePromptStarted = true;
          void continueDevicePrompt(session, response.frame().page()).catch(() => {
            if (live(session)) finish(session, 'error', '无法检查官网登录设备提示，请重新扫码。');
          });
        }
      } else if (result?.errorCode && result.errorCode !== 'USER_NOT_LOGIN') {
        finish(session, 'error', '支付宝登录未完成，请在游戏中心确认账号状态后重试。');
      }
      return;
    }
    if (session.phase === 'authorizing') return;
    if (result?.success !== true || !result.data?.qrCode?.token || !result.data.qrCode.url) {
      finish(session, 'error', '支付宝登录二维码获取失败，请稍后重试。');
      return;
    }
    const version = ++session.qrVersion;
    deadline(session, tokenExpiry(result.data.qrCode.token, now() + QR_TIMEOUT_MS));
    expireIfNeeded(session);
    if (!live(session)) return;
    try {
      const page = response.frame().page();
      const canvas = page.locator('canvas').first();
      await canvas.waitFor({ state: 'visible', timeout: 30_000 });
      // 直接读取位图，避免加载遮罩的透明度和截图缩放改变二维码。
      // 刷新时等待新图完成绘制，防止把旧二维码标成新的有效期。
      const imageHandle = await page.waitForFunction(previous => {
        const node = document.querySelector('canvas');
        if (!node || node.width < 100 || node.height < 100) return false;
        const context = node.getContext('2d');
        if (!context) return false;
        const pixels = context.getImageData(0, 0, node.width, node.height).data;
        let dark = 0;
        let light = 0;
        for (let index = 0; index < pixels.length; index += 4) {
          if (pixels[index + 3] < 200) continue;
          if (pixels[index] < 80 && pixels[index + 1] < 80 && pixels[index + 2] < 80) dark++;
          if (pixels[index] > 200 && pixels[index + 1] > 200 && pixels[index + 2] > 200) light++;
        }
        if (dark < 100 || light < 100) return false;
        const image = node.toDataURL('image/png');
        return image !== previous ? image : false;
      }, session.qrImage, { timeout: 30_000, polling: 'raf' });
      let image;
      try {
        image = await imageHandle.jsonValue();
      } finally {
        await imageHandle.dispose();
      }
      if (!live(session) || session.phase === 'authorizing' || session.qrVersion !== version) return;
      const target = new URL(result.data.qrCode.url);
      session.launchUrl = target.protocol === 'https:' && !target.username && !target.password
        && /(^|\.)alipay\.com$/i.test(target.hostname) ? target.href : null;
      session.qrImage = image;
      session.phase = 'waiting';
      session.ready();
    } catch {
      if (live(session) && session.phase !== 'authorizing' && session.qrVersion === version) {
        finish(session, 'error', '未能读取登录页二维码，请检查网络后重新生成。');
      }
    }
  }

  async function initialize(session, prior) {
    await prior;
    if (!live(session)) return snapshot(session);
    try {
      if (typeof protocol?.LoginRequest?.decode !== 'function' || typeof protocol?.LoginRequest?.encode !== 'function') {
        finish(session, 'error', '本机游戏协议缺少登录报文，请先更新游戏协议。');
        return snapshot(session);
      }
      session.browser = await launch();
      if (!live(session)) {
        await dispose(session);
        return snapshot(session);
      }
      session.browser.on('disconnected', () => {
        if (live(session)) finish(session, 'error', '临时登录浏览器已断开，请重新生成二维码。');
      });
      session.context = await session.browser.newContext({ viewport: { width: 1280, height: 900 } });
      if (!live(session)) {
        await dispose(session);
        return snapshot(session);
      }
      session.context.on('page', page => watchPage(session, page));
      session.context.on('response', response => {
        void readResponse(session, response).catch(() => {
          if (live(session)) finish(session, 'error', '扫码登录页面处理失败，请重新生成二维码。');
        });
      });
      const page = await session.context.newPage();
      if (!live(session)) {
        await dispose(session);
        return snapshot(session);
      }
      watchPage(session, page);
      await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await session.readyPromise;
    } catch (error) {
      if (live(session)) {
        const message = error.message?.includes('自动下载 Chromium') || error.message?.includes('未找到 Chromium')
          ? error.message
          : '无法打开支付宝扫码登录页面，请检查无头浏览器依赖、浏览器运行权限及服务器网络后重试。';
        finish(session, 'error', message);
      }
    }
    if (!live(session)) await dispose(session);
    return snapshot(session);
  }

  function start() {
    if (closed) return Promise.reject(new Error('控制台已关闭，无法开始扫码登录。'));
    expireIfNeeded(current);
    if (current && (ACTIVE_PHASES.has(current.phase) || current.phase === 'captured')) {
      const session = current;
      return session.startPromise.then(() => snapshot(session));
    }
    const previous = current;
    const prior = previousStart.then(async () => {
      if (previous?.disposing) await previous.disposing;
    });
    const session = {
      id: randomUUID(), phase: 'starting', qrImage: null, error: null,
      expiresAt: now() + startTimeoutMs, credential: null, timer: null,
      browser: null, context: null, disposing: null, pages: new Set(), qrVersion: 0,
    };
    session.readyPromise = new Promise(resolve => { session.ready = resolve; });
    current = session;
    deadline(session, session.expiresAt, 'error', '浏览器准备或二维码生成超时，请检查下载网络和服务器后重试。');
    session.startPromise = initialize(session, prior);
    previousStart = session.startPromise.catch(() => {});
    return session.startPromise;
  }

  async function cancel(id) {
    const session = selected(id);
    if (!session) return snapshot(null);
    finish(session, 'cancelled');
    await dispose(session);
    return snapshot(session);
  }

  async function close() {
    closed = true;
    if (current) {
      finish(current, 'cancelled');
      await dispose(current);
    }
    await previousStart;
  }

  return {
    start,
    status(id) { return snapshot(selected(id)); },
    cancel,
    close,
    takeCredential(id) {
      const session = selected(id);
      if (session?.phase !== 'captured' || !session.credential) throw new Error('尚未取得游戏登录凭证，请完成支付宝扫码。');
      return structuredClone(session.credential);
    },
  };
}
