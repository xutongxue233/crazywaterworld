import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import vm from 'node:vm';
import { createAlipayLogin } from '../src/alipay-login.mjs';
import { createCodec } from '../src/codec.mjs';

const authUrl = 'https://webgwmobiler.alipay.com/gameauth/com.alipay.gameauth.common.facade.service.GameCenterPcAuthFacade/';
const fixedNow = 1_794_830_400_000;
const protocol = Object.fromEntries(['LoginRequest', 'HeartbeatRequest'].map(name => [name, {
  encode(value, writer) { return writer.string(JSON.stringify(value)); },
  decode(reader) { return JSON.parse(reader.string()); },
}]));
const codec = createCodec(protocol);
const login = {
  eworldParams: { openId: 'alipay-game-id', token: 'game-token-secret', sign: 'game-sign-secret', timestamp: { low: 123, high: 418, unsigned: false } },
  eworldClientInfo: { appId: 'fixture-app', channelId: 'fixture-alipay-channel' },
  worldId: 0,
};
const managers = new Set();
let passed = 0;

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

async function settle() {
  for (let index = 0; index < 30; index++) await Promise.resolve();
}

function fixture(options = {}) {
  let time = fixedNow;
  let sequence = 0;
  const timers = new Map();
  const env = { launches: 0, browsers: [], screenshotCalls: 0, deviceConfirmations: 0 };
  env.qr = () => ({ success: true, data: { qrCode: {
    token: 'header.' + Buffer.from(JSON.stringify({ exp: Math.floor((time + 300_000) / 1000), hidden: 'qr-secret' })).toString('base64url') + '.signature',
    url: 'https://render.alipay.com/p/s/ulink?fixture=qr-secret',
  } } });
  env.response = (context, page, action, payload, json = async () => payload) => context.emit('response', {
    url: () => authUrl + action + '?ctoken=private-cookie',
    json,
    frame: () => ({ page: () => page }),
  });
  env.newPage = context => {
    const page = new EventEmitter();
    page.devicePrompts = new Map();
    page.deviceLimit = false;
    const promptWait = kind => {
      const wait = deferred();
      page.devicePrompts.set(kind, wait);
      context.promptWaits.add(wait);
      return wait.promise.finally(() => context.promptWaits.delete(wait));
    };
    page.getByText = (text, settings) => {
      assert.equal(text, '登录设备数量已达上限');
      assert.deepEqual(settings, { exact: true });
      return { waitFor: () => promptWait('limit'), isVisible: async () => page.deviceLimit };
    };
    page.getByRole = (role, settings) => {
      assert.equal(role, 'button');
      assert.deepEqual(settings, { name: '确认登录', exact: true });
      return {
        waitFor: () => promptWait('confirm'),
        click: async () => { env.deviceConfirmations++; },
      };
    };
    page.goto = async (url, settings) => {
      assert.equal(url, 'https://www.wanyiwan.top/game/fkssj');
      assert.equal(settings.waitUntil, 'domcontentloaded');
      if (options.gotoError) throw new Error(options.gotoError);
      if (!options.noQr) env.response(context, page, 'getLoginToken', env.qr());
    };
    const canvas = {
      waitFor: async settings => {
        assert.equal(settings.state, 'visible');
        if (options.canvasError) throw new Error('private canvas URL');
      },
    };
    page.locator = selector => {
      assert.equal(selector, 'canvas');
      return { first: () => canvas };
    };
    page.waitForFunction = async (predicate, previous, settings) => {
      assert.equal(settings.polling, 'raf');
      env.screenshotCalls++;
      await options.screenshotGate?.promise;
      const pixels = new Uint8Array(800 * 4).fill(255);
      for (let index = 0; index < 400 * 4; index += 4) pixels[index] = pixels[index + 1] = pixels[index + 2] = 0;
      const image = 'data:image/png;base64,' + Buffer.from('fixture-png').toString('base64');
      const node = {
        width: 208, height: 208,
        getContext: () => ({ getImageData: () => ({ data: pixels }) }),
        toDataURL(type) { assert.equal(type, 'image/png'); return image; },
      };
      const context = { document: { querySelector: () => node }, previous };
      const run = () => vm.runInNewContext('(' + predicate.toString() + ')(previous)', context);
      assert.equal(run(), previous === image ? false : image);
      pixels.fill(255);
      assert.equal(run(), false, '等待空白画布完成绘制');
      context.previous = image;
      for (let index = 0; index < 400 * 4; index += 4) pixels[index] = pixels[index + 1] = pixels[index + 2] = 0;
      assert.equal(run(), false, '刷新时拒绝沿用旧图');
      return { jsonValue: async () => image, dispose: async () => {} };
    };
    context.emit('page', page);
    return page;
  };
  const launch = async () => {
    env.launches++;
    await options.launchGate?.promise;
    if (options.launchError) throw new Error(options.launchError);
    const browser = new EventEmitter();
    browser.closed = 0;
    browser.newContext = async settings => {
      assert.deepEqual(settings, { viewport: { width: 1280, height: 900 } });
      const context = new EventEmitter();
      browser.context = context;
      context.closed = 0;
      context.promptWaits = new Set();
      context.close = async () => {
        context.closed++;
        for (const wait of context.promptWaits) wait.reject(new Error('context closed'));
      };
      context.newPage = async () => {
        context.page = env.newPage(context);
        return context.page;
      };
      return context;
    };
    browser.close = async () => { browser.closed++; browser.emit('disconnected'); };
    env.browsers.push(browser);
    return browser;
  };
  env.manager = createAlipayLogin({
    protocol: options.protocol ?? protocol,
    launch,
    ...(options.startTimeoutMs ? { startTimeoutMs: options.startTimeoutMs } : {}),
    now: () => time,
    setTimeout(callback, delay) {
      const id = ++sequence;
      timers.set(id, { callback, at: time + delay });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
  });
  managers.add(env.manager);
  env.advance = async milliseconds => {
    time += milliseconds;
    for (const [id, timer] of [...timers]) {
      if (timer.at > time) continue;
      timers.delete(id);
      timer.callback();
    }
    await settle();
  };
  env.send = (body = login, { page = env.browsers.at(-1).context.page, name = 'LoginRequest', url = 'wss://fixture.example/ws', payload } = {}) => {
    const socket = new EventEmitter();
    socket.url = () => url;
    page.emit('websocket', socket);
    socket.emit('framesent', { payload: payload ?? Buffer.from(codec.encode(name, 1, body)) });
    return socket;
  };
  env.respond = (action, payload, json) => {
    const context = env.browsers.at(-1).context;
    env.response(context, context.page, action, payload, json);
  };
  return env;
}

async function test(name, run) {
  try {
    await run();
    passed++;
    console.log('通过：' + name);
  } finally {
    for (const manager of managers) await manager.close();
    managers.clear();
  }
}

await test('并发开始只创建一个临时浏览器，状态仅返回二维码和有效期', async () => {
  const env = fixture();
  assert.equal(env.manager.status().phase, 'cancelled');
  const [first, second] = await Promise.all([env.manager.start(), env.manager.start()]);
  assert.equal(env.launches, 1);
  assert.equal(first.id, second.id);
  assert.equal(first.phase, 'waiting');
  assert.equal(first.expiresAt, fixedNow + 300_000);
  assert.equal(first.qrImage, 'data:image/png;base64,' + Buffer.from('fixture-png').toString('base64'));
  assert.equal(first.launchUrl, env.qr().data.qrCode.url);
  assert.deepEqual(Object.keys(first).sort(), ['error', 'expiresAt', 'id', 'launchUrl', 'phase', 'qrImage']);
  assert.doesNotMatch(JSON.stringify({...first,launchUrl:null}), /qr-secret|private-cookie|game-token|openId/);
  assert.throws(() => env.manager.takeCredential(first.id), /尚未取得/);
});

await test('等待扫码、授权成功、抓到登录凭证后关闭浏览器，凭证可重复读取并隔离修改', async () => {
  const env = fixture();
  const state = await env.manager.start();
  env.respond('loginForPc', { success: false, errorCode: 'USER_NOT_LOGIN' });
  await settle();
  assert.equal(env.manager.status().phase, 'waiting');
  env.respond('loginForPc', { success: true, data: { token: 'auth-secret', userId: 'user-id-secret' } });
  await settle();
  assert.equal(env.manager.status().phase, 'authorizing');
  assert.equal(env.manager.status().qrImage, null);
  env.send();
  await settle();
  const captured = env.manager.status(state.id);
  assert.equal(captured.phase, 'captured');
  assert.equal(captured.expiresAt, fixedNow + 600_000);
  assert.equal(env.browsers[0].closed, 1);
  assert.equal(env.browsers[0].context.closed, 1);
  const credential = env.manager.takeCredential(state.id);
  assert.equal(credential.source, 'alipay');
  assert.deepEqual(credential.login, login);
  assert.equal(credential.loginFrameHex, Buffer.from(codec.encode('LoginRequest', 1, login)).toString('hex'));
  credential.login.eworldParams.token = 'mutated';
  assert.equal(env.manager.takeCredential(state.id).login.eworldParams.token, login.eworldParams.token);
  assert.doesNotMatch(JSON.stringify(captured), /auth-secret|user-id-secret|game-token|game-sign|openId|loginFrameHex/);
  assert.equal((await env.manager.start()).id, state.id);
  assert.equal(env.launches, 1);
  await env.manager.cancel(state.id);
  assert.throws(() => env.manager.takeCredential(state.id), /尚未取得/);
});

await test('官网普通设备提示仅确认登录，重复授权响应不会重复点击', async () => {
  const env = fixture();
  await env.manager.start();
  const authorized = { success: true, data: { token: 'auth', userId: 'user' } };
  env.respond('loginForPc', authorized);
  env.respond('loginForPc', authorized);
  await settle();
  const page = env.browsers[0].context.page;
  page.devicePrompts.get('confirm').resolve();
  await settle();
  assert.equal(env.deviceConfirmations, 1);
  assert.equal(env.manager.status().phase, 'authorizing');
  env.send();
  await settle();
  assert.equal(env.manager.status().phase, 'captured');
  assert.equal(env.browsers[0].context.promptWaits.size, 0);
});

await test('官网设备满额时提示人工管理，取消后迟到提示不点击', async () => {
  for (const simultaneous of [false, true]) {
    const env = fixture();
    await env.manager.start();
    env.respond('loginForPc', { success: true, data: { token: 'auth', userId: 'user' } });
    await settle();
    const page = env.browsers[0].context.page;
    page.deviceLimit = true;
    page.devicePrompts.get(simultaneous ? 'confirm' : 'limit').resolve();
    await settle();
    assert.equal(env.manager.status().phase, 'error');
    assert.match(env.manager.status().error, /官方网页管理登录设备/);
    assert.equal(env.deviceConfirmations, 0);
    assert.equal(env.browsers[0].closed, 1);
  }
  const cancelled = fixture();
  await cancelled.manager.start();
  cancelled.respond('loginForPc', { success: true, data: { token: 'auth', userId: 'user' } });
  await settle();
  const wait = cancelled.browsers[0].context.page.devicePrompts.get('confirm');
  await cancelled.manager.cancel();
  wait.resolve();
  await settle();
  assert.equal(cancelled.deviceConfirmations, 0);
  assert.equal(cancelled.manager.status().phase, 'cancelled');
});

await test('启动尚未完成时取消，迟到浏览器被关闭且刷新串行创建', async () => {
  const gate = deferred();
  const env = fixture({ launchGate: gate });
  const initial = env.manager.start();
  await settle();
  const oldId = env.manager.status().id;
  await env.manager.cancel(oldId);
  const refreshed = env.manager.start();
  await settle();
  assert.equal(env.launches, 1);
  gate.resolve();
  assert.equal((await initial).phase, 'cancelled');
  const next = await refreshed;
  assert.equal(next.phase, 'waiting');
  assert.notEqual(next.id, oldId);
  assert.equal(env.launches, 2);
  assert.equal(env.browsers[0].closed, 1);
  assert.throws(() => env.manager.status(oldId), /已失效/);
});

await test('取消后迟到二维码和登录帧不能复活已取消会话', async () => {
  const gate = deferred();
  const env = fixture({ screenshotGate: gate });
  const starting = env.manager.start();
  await settle();
  const oldPage = env.browsers[0].context.page;
  await env.manager.cancel();
  gate.resolve();
  assert.equal((await starting).phase, 'cancelled');
  await settle();
  env.send(login, { page: oldPage });
  assert.equal(env.manager.status().phase, 'cancelled');
  const next = await env.manager.start();
  env.send(login, { page: oldPage });
  assert.equal(env.manager.status().id, next.id);
  assert.equal(env.manager.status().phase, 'waiting');
});

await test('二维码到期及服务端失效释放浏览器，凭证保存期限到期清理', async () => {
  const env = fixture();
  await env.manager.start();
  await env.advance(300_000);
  assert.equal(env.manager.status().phase, 'expired');
  assert.equal(env.manager.status().qrImage, null);
  assert.equal(env.browsers[0].closed, 1);
  await env.manager.start();
  env.respond('loginForPc', { success: false, errorCode: 'TOKEN_INVALID' });
  await settle();
  assert.equal(env.manager.status().phase, 'expired');
  await env.manager.start();
  env.send();
  await env.advance(600_000);
  assert.equal(env.manager.status().phase, 'expired');
  assert.throws(() => env.manager.takeCredential(), /尚未取得/);
});

await test('启动与授权阶段超时均结束临时浏览器', async () => {
  const env = fixture({ noQr: true, startTimeoutMs: 45_000 });
  const starting = env.manager.start();
  await settle();
  await env.advance(45_000);
  assert.equal((await starting).phase, 'error');
  assert.match(env.manager.status().error, /浏览器准备或二维码生成超时/);
  assert.equal(env.browsers[0].closed, 1);
  const second = fixture();
  await second.manager.start();
  second.respond('loginForPc', { success: true, data: { token: 'auth', userId: 'user' } });
  await settle();
  await second.advance(120_000);
  assert.equal(second.manager.status().phase, 'error');
  assert.match(second.manager.status().error, /游戏登录超时/);
  assert.equal(second.browsers[0].closed, 1);
});

await test('启动和页面异常返回中文错误且不暴露浏览器中的秘密', async () => {
  for (const options of [{ launchError: 'token=launch-secret' }, { gotoError: 'cookie=goto-secret' }, { canvasError: true }]) {
    const env = fixture(options);
    const state = await env.manager.start();
    assert.equal(state.phase, 'error');
    assert.match(state.error, /二维码|网络/);
    assert.doesNotMatch(state.error, /secret|cookie|private/);
    assert.ok(env.browsers.every(browser => browser.closed === 1));
  }
  const missing = fixture({ protocol: {} });
  assert.match((await missing.manager.start()).error, /协议缺少/);
  assert.equal(missing.launches, 0);
});

await test('异常认证响应、无效二维码和浏览器断连都释放资源', async () => {
  for (const scenario of ['json', 'qr', 'auth', 'disconnect', 'crash']) {
    const env = fixture();
    await env.manager.start();
    if (scenario === 'json') env.respond('loginForPc', null, async () => { throw new Error('token=json-secret'); });
    if (scenario === 'qr') env.respond('getLoginToken', { success: true, data: {} });
    if (scenario === 'auth') env.respond('loginForPc', { success: false, errorCode: 'LOGIN_FAIL', errorMsg: 'token=auth-secret' });
    if (scenario === 'disconnect') env.browsers[0].emit('disconnected');
    if (scenario === 'crash') env.browsers[0].context.page.emit('crash');
    await settle();
    assert.equal(env.manager.status().phase, 'error', scenario);
    assert.doesNotMatch(env.manager.status().error, /secret/);
    assert.equal(env.browsers[0].closed, 1);
  }
});

await test('只捕获完整二进制登录请求，支持新页面和带偏移的 Buffer', async () => {
  const env = fixture();
  await env.manager.start();
  env.send(login, { name: 'HeartbeatRequest' });
  env.send(login, { payload: 'unrelated-text-frame' });
  env.send(login, { payload: Buffer.alloc(12) });
  assert.equal(env.manager.status().phase, 'waiting');
  const page = env.newPage(env.browsers[0].context);
  const encoded = Buffer.from(codec.encode('LoginRequest', 1, login));
  const padded = Buffer.concat([Buffer.alloc(9), encoded, Buffer.alloc(3)]);
  env.send(login, { page, payload: padded.subarray(9, 9 + encoded.length) });
  assert.equal(env.manager.status().phase, 'captured');
  assert.equal(env.manager.takeCredential().loginFrameHex, encoded.toString('hex'));
});

await test('不完整凭证或协议解码失败终止登录且不保留秘密', async () => {
  for (const params of [{ ...login.eworldParams, sign: '' }, { ...login.eworldParams, timestamp: 0 }]) {
    const env = fixture();
    await env.manager.start();
    env.send({ ...login, eworldParams: params });
    await settle();
    assert.equal(env.manager.status().phase, 'error');
    assert.match(env.manager.status().error, /缺少完整凭证/);
    assert.throws(() => env.manager.takeCredential(), /尚未取得/);
    assert.equal(env.browsers[0].closed, 1);
  }
  const env = fixture({ protocol: { LoginRequest: { ...protocol.LoginRequest, decode() { throw new Error('token=decode-secret'); } } } });
  await env.manager.start();
  env.send();
  assert.match(env.manager.status().error, /无法解析/);
  assert.doesNotMatch(env.manager.status().error, /decode-secret/);
});

await test('关闭期间迟到启动得到释放，关闭后拒绝重新登录', async () => {
  const gate = deferred();
  const env = fixture({ launchGate: gate });
  const starting = env.manager.start();
  await settle();
  const closing = env.manager.close();
  gate.resolve();
  await closing;
  assert.equal((await starting).phase, 'cancelled');
  assert.equal(env.browsers[0].closed, 1);
  await assert.rejects(env.manager.start(), /控制台已关闭/);
});

console.log(`支付宝扫码登录自检通过 ${passed} 项`);
