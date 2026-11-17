import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-mobile-login-'));
process.env.CW_DATA_DIR = directory;
process.env.CW_CONFIG_PACK = path.join(directory, 'config.json');
fs.writeFileSync(process.env.CW_CONFIG_PACK, '[]');
const { createConsole } = await import('../src/server.mjs');
const { ensureHeadlessBrowser } = await import('../src/platform/browser.mjs');
const app = createConsole({ port: 0, protocol: {} });
let browser;
try {
  const url = await app.listen();
  browser = await chromium.launch({ executablePath: await ensureHeadlessBrowser(), headless: true });
  for (const width of [320, 375, 430]) {
    const context = await browser.newContext({ viewport: { width, height: 667 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await page.goto(url);
    await page.locator('#tabs [data-tab="account"]').click();
    assert(await page.locator('#account-add-phone-shortcut').isVisible());
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.locator('#account-add-phone-shortcut').click();
    await page.locator('#phone-number').waitFor({ state: 'attached' });
    await page.locator('#phone-sms-tab').click();
    await page.locator('#phone-number').fill('13800138000');
    assert(await page.locator('#phone-number').evaluate(el => parseFloat(getComputedStyle(el).fontSize) >= 16));
    assert(await page.locator('.account-add-body').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
    // A short viewport models the available space while a mobile keyboard is open.
    await page.setViewportSize({ width, height: 360 });
    await page.locator('#phone-sms-login').scrollIntoViewIfNeeded();
    assert(await page.locator('#account-add-close').isVisible());
    const close = await page.locator('#account-add-close').boundingBox();
    assert(close.y >= 0 && close.y + close.height <= 360);
    await page.locator('#account-add-close').click();
    console.log(`通过：${width}px 手机入口、短信表单、输入字号、短屏滚动与关闭`);
    await context.close();
  }
} finally {
  await browser?.close();
  await app.close();
  fs.rmSync(directory, { recursive: true, force: true });
}
