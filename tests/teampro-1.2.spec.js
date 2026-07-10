const { test, expect } = require('@playwright/test');

async function resetDb(page) {
  await page.route('https://script.google.com/**', async route => {
    const req = route.request();
    if (req.method() === 'POST') {
      const body = req.postDataJSON();
      if (body.action === 'pull') return route.fulfill({ json: { ok: true, records: [], srv: Date.now(), maxSrv: 0 } });
      if (body.action === 'push') return route.fulfill({ json: { ok: true, results: (body.records || []).map(r => ({ ok: true, request_id: r.request_id, srv: Date.now() })) } });
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ json: { ok: true, msg: 'mock' } });
  });
  await page.goto('/index.html?fresh=' + Date.now(), { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
}

async function seedAndLogin(page, name = '楊復傑教練') {
  await resetDb(page);
  await page.getByRole('button', { name: /開始：建立示範資料|載入示範資料/ }).click();
  await expect(page.getByText(name)).toBeVisible();
  await page.getByText(name).click();
  await page.locator('#pinInput').fill('1234');
  await page.getByRole('button', { name: '登入', exact: true }).click();
  await expect(page.locator('#shell')).toBeVisible();
}

test('admin/head/assistant login and refresh returns to PIN page', async ({ page }) => {
  await seedAndLogin(page, '楊復傑教練');
  await page.reload();
  await expect(page.locator('#login')).toBeVisible();
  await expect(page.getByText('最近登入')).toBeVisible();
  await page.locator('#pinInput').fill('0000');
  await page.getByRole('button', { name: '登入', exact: true }).click();
  await expect(page.getByText(/PIN 錯誤|請重新輸入/)).toBeVisible();
});

test('persistent outbox survives reload after offline edit', async ({ page }) => {
  await seedAndLogin(page);
  await page.route('**/exec', route => route.abort());
  await page.evaluate(async () => {
    const st = State.cache.students[0];
    await save('students', { ...st, note: 'offline-edit' });
  });
  const before = await page.evaluate(() => C('sync_outbox').length);
  expect(before).toBeGreaterThan(0);
  await page.reload();
  const after = await page.evaluate(async () => {
    await DB.open();
    await reloadAll();
    return C('sync_outbox').length;
  });
  expect(after).toBeGreaterThan(0);
});

test('assistant cannot call dangerous wipeAll from console', async ({ page }) => {
  await seedAndLogin(page, '助教一');
  const countBefore = await page.evaluate(() => C('students').length);
  await page.evaluate(async () => App.wipeAll());
  const countAfter = await page.evaluate(() => C('students').length);
  expect(countAfter).toBe(countBefore);
});

test('quick planning creates five stage draft', async ({ page }) => {
  await seedAndLogin(page);
  await page.getByRole('button', { name: '快速備課' }).click();
  await page.getByRole('button', { name: '產生五階段初稿' }).click();
  await expect(page.locator('#quickPreview')).toContainText('五階段初稿');
  const stages = await page.evaluate(() => {
    const dp = C('daily_plans').find(d => d.date === State.ctx.date && d.class_id === State.ctx.classId);
    return C('lesson_blocks').filter(b => b.daily_plan_id === dp.id).length;
  });
  expect(stages).toBeGreaterThanOrEqual(5);
});

test('conflict resolution modal shows local and cloud content', async ({ page }) => {
  await seedAndLogin(page);
  await page.evaluate(async () => {
    await DB.put('sync_conflicts', {
      id: 'cf_test',
      store: 'daily_plans',
      record_id: 'dp_test',
      local_payload: { id: 'dp_test', title: 'mine' },
      remote_payload: { id: 'dp_test', title: 'cloud', updated_by: { name: '另一位教練' } },
      updated_by: { name: '另一位教練' },
      created_at: Date.now(),
      status: 'open'
    });
    await reload('sync_conflicts');
  });
  await page.evaluate(() => SYNC.showConflict('cf_test'));
  await expect(page.getByText('同步衝突處理')).toBeVisible();
  await expect(page.getByText('我的內容')).toBeVisible();
  await expect(page.getByText('雲端內容')).toBeVisible();
});

test('360px mobile viewport has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await seedAndLogin(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);
});
