/* 備課主流程回歸測試
   對應 2026-08 修掉的四個問題：
   1. 全新裝置的「載入示範資料」因 hasFormalData() 誤判而沒反應
   2. 備課完成率永遠卡在 80%（分母含未列入步驟條的「教練確認」）
   3. 教練確認頁的步驟條沒有任何一格高亮、手機版誤顯示「步驟 1/7」
   4. 「內容」的下一步跳過第 5 步「教練」
   以及「快速備課」要一鍵到底：自動帶出席確認與今日教練團。 */
const { test, expect } = require('@playwright/test');

function mockSync(page) {
  return page.route('https://script.google.com/**', async route => {
    const req = route.request();
    if (req.method() === 'POST') {
      const body = req.postDataJSON();
      if (body.action === 'pull') return route.fulfill({ json: { ok: true, records: [], srv: Date.now(), maxSrv: 0 } });
      if (body.action === 'push') return route.fulfill({ json: { ok: true, results: (body.records || []).map(r => ({ ok: true, request_id: r.request_id, srv: Date.now() })) } });
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ json: { ok: true, msg: 'mock' } });
  });
}

async function freshApp(page) {
  await mockSync(page);
  await page.goto('/index.html?fresh=' + Date.now(), { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.waitForTimeout(1200);
}

async function seedAndLogin(page, name = '楊復傑教練') {
  await freshApp(page);
  await page.getByRole('button', { name: /載入示範資料/ }).click();
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 15000 });
  await page.getByText(name).first().click();
  await page.locator('#pinInput').fill('1234');
  await page.getByRole('button', { name: '登入', exact: true }).click();
  await expect(page.locator('#shell')).toBeVisible();
}

const status = page => page.evaluate(() => {
  const ps = planStatus(State.ctx.date, State.ctx.classId);
  return {
    pct: ps.pct, done: ps.done,
    lead: !!(ps.dp && ps.dp.lead_coach_id),
    team: ps.dp ? teamCoaches(ps.dp).length : 0,
    attConfirmed: Stats.attendanceConfirmed(State.ctx.date, State.ctx.classId),
    issues: ps.dp ? publishIssues(ps.dp) : ['no plan'],
  };
});

test('全新裝置可以載入示範資料（種子按鈕不是死鈕）', async ({ page }) => {
  await freshApp(page);
  // 空白 DB 只有系統自動預設的熱身庫，不能被當成「已有正式資料」
  expect(await page.evaluate(() => App.hasFormalData())).toBe(false);
  await page.getByRole('button', { name: /載入示範資料/ }).click();
  await expect(page.getByText('楊復傑教練').first()).toBeVisible({ timeout: 15000 });
  expect(await page.evaluate(() => C('profiles').length)).toBeGreaterThan(0);
});

test('快速備課一鍵到底：出席、教練團、完成率', async ({ page }) => {
  await seedAndLogin(page);
  await page.evaluate(() => App.go('quickplan', 'plan'));
  await page.getByRole('button', { name: '產生五階段初稿' }).click();
  await expect(page.locator('#quickPreview')).toContainText('五階段初稿');

  const after = await status(page);
  expect(after.attConfirmed).toBe(true);          // 出席已自動確認
  expect(after.lead).toBe(true);                  // 已指定主責教練
  expect(after.team).toBeGreaterThan(0);          // 今日教練團已帶入
  expect(after.issues).toEqual([]);               // 發布前檢查無問題
  expect(after.done.stats).toBe(true);
  expect(after.done.coachtasks).toBe(true);

  await page.evaluate(async () => { await Views.publish(planStatus(State.ctx.date, State.ctx.classId).dp.id); });
  const pub = await status(page);
  expect(pub.pct).toBe(100);                      // 發布後備課完成率滿百，不再卡 80%
});

test('步驟條在每一步都正確高亮，含教練確認頁', async ({ page }) => {
  await seedAndLogin(page);
  await page.evaluate(() => App.go('quickplan', 'plan'));
  await page.getByRole('button', { name: '產生五階段初稿' }).click();
  await expect(page.locator('#quickPreview')).toContainText('五階段初稿');

  const expected = {
    classinfo: '課程', stats: '人數', groups: '分組', plan: '內容',
    coachtasks: '教練', confirm: '教練', publish: '發布', report: '課後',
  };
  for (const [view, label] of Object.entries(expected)) {
    await page.evaluate(v => App.go(v, 'plan'), view);
    const on = page.locator('.stepper .stp.on');
    await expect(on, `${view} 應高亮「${label}」`).toHaveCount(1);
    await expect(on).toContainText(label);
    await expect(page.locator('.stepper-m .now b')).toHaveText(label);
  }
});

test('內容的下一步進到第5步教練，且教練頁含確認卡', async ({ page }) => {
  await seedAndLogin(page);
  await page.evaluate(() => App.go('quickplan', 'plan'));
  await page.getByRole('button', { name: '產生五階段初稿' }).click();
  await expect(page.locator('#quickPreview')).toContainText('五階段初稿');

  await page.evaluate(() => App.go('plan', 'plan'));
  await page.getByRole('button', { name: /下一步：教練分工/ }).click();
  expect(await page.evaluate(() => App.view)).toBe('coachtasks');

  await expect(page.locator('#view')).toContainText('教練確認');
  await page.getByRole('button', { name: /我已確認/ }).click();
  await expect(page.locator('#view')).toContainText('你已確認');
  expect(await page.evaluate(() => App.view)).toBe('coachtasks'); // 確認後停在原頁，不跳走
});

test('首頁大按鈕帶到下一個未完成步驟', async ({ page }) => {
  await seedAndLogin(page);
  await page.evaluate(async () => { await ensureDaily(State.ctx.date, State.ctx.classId); App.go('home', 'today'); });
  // 已建立課程但尚未確認出席 → 大按鈕應指向第 2 步「人數」
  await expect(page.locator('#view')).toContainText('繼續備課：人數（第 2 步）');
});

/* 「立即同步」必須把佇列推完再 pull。
   _flush() 一次只送 25 筆，舊版 immediate() 只呼叫一次就 pull，
   超過 25 筆離線變更時未送出的部分會被雲端資料蓋回去，
   教練會看到「按了同步卻沒生效」。 */
test('立即同步：超過25筆離線變更全部推出且不被雲端蓋掉', async ({ page }) => {
  const pushed = new Set();
  await page.route('https://script.google.com/**', async route => {
    const req = route.request();
    if (req.method() === 'POST') {
      const body = req.postDataJSON();
      if (body.action === 'pull') return route.fulfill({ json: { ok: true, records: [], srv: Date.now(), maxSrv: 0 } });
      if (body.action === 'push') {
        (body.records || []).forEach(r => pushed.add(r.id));
        return route.fulfill({ json: { ok: true, results: (body.records || []).map(r => ({ ok: true, request_id: r.request_id, srv: Date.now() })) } });
      }
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ json: { ok: true, msg: 'mock' } });
  });
  await page.goto('/index.html?fresh=' + Date.now(), { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /載入示範資料/ }).click();
  await expect(page.getByText('楊復傑教練').first()).toBeVisible({ timeout: 15000 });
  await page.getByText('楊復傑教練').first().click();
  await page.locator('#pinInput').fill('1234');
  await page.getByRole('button', { name: '登入', exact: true }).click();
  await expect(page.locator('#shell')).toBeVisible();

  // 先清空既有佇列，再製造 40 筆變更（超過單次 25 筆上限）
  await page.evaluate(async () => {
    await SYNC._drain();
    for (const s of C('students').slice(0, 40)) await save('students', { ...s, notes: 'drain-test' });
  });
  const before = await page.evaluate(() => SYNC.pendingCount());
  expect(before).toBeGreaterThan(25);

  await page.evaluate(async () => { await SYNC.immediate(); });

  const after = await page.evaluate(() => SYNC.pendingCount());
  expect(after).toBe(0);                       // 佇列必須清空
  const kept = await page.evaluate(() => C('students').filter(s => s.notes === 'drain-test').length);
  expect(kept).toBe(40);                       // 本機變更不得被 pull 蓋掉
});
