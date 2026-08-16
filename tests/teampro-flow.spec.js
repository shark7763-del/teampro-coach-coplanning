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

/* 管理者同時帶課時，必須能被列入教練排班。
   舊版 Stats.coachesAvailable 只取 role==head/assistant，
   身為 admin 的道館長永遠不會出現在可出席教練與分組指派裡。 */
test('管理者開啟「列入教練排班」後會進入可出席教練名單', async ({ page }) => {
  await seedAndLogin(page);
  const admin = await page.evaluate(() => C('profiles').find(p => p.role === 'admin').name);

  const before = await page.evaluate(() =>
    [0, 1, 2, 3, 4, 5].some(d => Stats.coachesAvailable(d).some(p => p.role === 'admin')));
  expect(before).toBe(false);                    // 預設不列入

  await page.evaluate(async () => {
    const a = C('profiles').find(p => p.role === 'admin');
    await save('profiles', { ...a, coach_enabled: true, available_weekdays: [...WEEKDAYS] });
  });
  const after = await page.evaluate(nm =>
    [0, 1, 2, 3, 4, 5].every(d => Stats.coachesAvailable(d).some(p => p.name === nm)), admin);
  expect(after).toBe(true);                      // 開啟後每天都在名單裡

  // 主教練/助教不受影響，維持預設列入
  const heads = await page.evaluate(() => Stats.coachesAvailable(0).filter(p => p.role === 'head').length);
  expect(heads).toBeGreaterThan(0);
});

test('10–30′ 熱身可設定隊形，「其他」可自行輸入且會印進 PDF', async ({ page }) => {
  await seedAndLogin(page);
  await page.evaluate(() => App.go('quickplan', 'plan'));
  await page.getByRole('button', { name: '產生五階段初稿' }).click();
  await expect(page.locator('#quickPreview')).toContainText('五階段初稿');

  await page.evaluate(() => App.go('plan', 'plan'));
  // 隊形下拉存在，且 SOP 六種隊形＋其他都在
  const sel = page.locator('select').filter({ hasText: '棋盤式' }).first();
  await expect(sel).toBeVisible();
  for (const o of ['棋盤式', '流水線（三排）', '三人一組', '兩人一組', '循環站（多站輪轉）', '分站／測驗站', '其他（自行輸入）']) {
    await expect(sel.locator('option', { hasText: o }).first()).toHaveCount(1);
  }

  // 選一般隊形 → 存進 fitness block
  await page.evaluate(() => Views.wSetFormation(planStatus(State.ctx.date, State.ctx.classId).dp.id, '兩人一組'));
  expect(await page.evaluate(() => getFitBlock(planStatus(State.ctx.date, State.ctx.classId).dp.id).formation)).toBe('兩人一組');

  // 選「其他」→ 出現自訂輸入框，內容存得住
  await page.evaluate(() => Views.wSetFormation(planStatus(State.ctx.date, State.ctx.classId).dp.id, '其他'));
  await expect(page.locator('input[aria-label="自訂隊形"]')).toBeVisible();
  await page.evaluate(() => Views.wSetFormationText(planStatus(State.ctx.date, State.ctx.classId).dp.id, '四角落定點'));
  expect(await page.evaluate(() => formationText(getFitBlock(planStatus(State.ctx.date, State.ctx.classId).dp.id)))).toBe('四角落定點');

  // 教練現場執行版 PDF 要印得出隊形
  const html = await page.evaluate(() => Views.buildPDFHtml('coach'));
  expect(html).toContain('隊形:四角落定點');

  // 切回一般隊形時要清掉舊的自訂文字，避免殘留
  await page.evaluate(() => Views.wSetFormation(planStatus(State.ctx.date, State.ctx.classId).dp.id, '棋盤式'));
  expect(await page.evaluate(() => formationText(getFitBlock(planStatus(State.ctx.date, State.ctx.classId).dp.id)))).toBe('棋盤式');
});

test('組內分流 Level A/B/C：標記存得住、印得出、下一堂自動沿用', async ({ page }) => {
  await seedAndLogin(page);
  await page.evaluate(() => App.go('quickplan', 'plan'));
  await page.getByRole('button', { name: '產生五階段初稿' }).click();
  await expect(page.locator('#quickPreview')).toContainText('五階段初稿');

  await page.evaluate(() => App.go('groups', 'plan'));
  const g0 = page.locator('.gcard').first();
  const before = await g0.locator('.stu').count();
  expect(before).toBeGreaterThan(1);

  await g0.getByRole('button', { name: /組內分流/ }).click();
  await g0.locator('.stu').nth(0).click();               // 未標 → A 退階
  await g0.locator('.stu').nth(1).click();               // 未標 → A
  await g0.locator('.stu').nth(1).click();               // A → B 標準
  await g0.locator('.stu').nth(1).click();               // B → C 進階
  // 分流模式下點學員是切換標記，不是把人搬走
  expect(await g0.locator('.stu').count()).toBe(before);
  await expect(g0).toContainText('🔧');
  await expect(g0).toContainText('🔥');

  const gid = await page.evaluate(() => Views._groupState.groups[0].id);
  await page.getByRole('button', { name: /儲存分組到今日備課/ }).click();
  await page.waitForFunction(id => {
    const g = C('training_groups').find(x => x.id === id);
    return !!(g && Object.keys(g.skill || {}).length === 2);
  }, gid);
  const saved = await page.evaluate(id => {
    const g = C('training_groups').find(x => x.id === id);
    return { n: (g.students || []).length, A: skillRoster(g, 'A').length, B: skillRoster(g, 'B').length, C: skillRoster(g, 'C').length };
  }, gid);
  expect(saved.n).toBe(before);   // 人沒有變少
  expect(saved.A).toBe(1);
  expect(saved.B).toBe(0);
  expect(saved.C).toBe(1);

  // 備課頁出現三級的內容欄位，填得進去
  await page.evaluate(() => App.go('plan', 'plan'));
  await expect(page.locator('#view')).toContainText('組內分流');
  await page.evaluate(id => {
    const dp = planStatus(State.ctx.date, State.ctx.classId).dp;
    return Views.saveBlockField(dp.id, 'group', id, 'skillA', '扶牆分解低速')
      .then(() => Views.saveBlockField(dp.id, 'group', id, 'skillC', '移動後隨機靶'));
  }, gid);

  // 教練現場版 PDF 各級都要印出來
  const html = await page.evaluate(() => Views.buildPDFHtml('coach'));
  expect(html).toContain('扶牆分解低速');
  expect(html).toContain('移動後隨機靶');

  // 下一週同一天：重新產生分組時自動沿用上一堂的標記
  await page.evaluate(() => { State.ctx.date = addDays(State.ctx.date, 7); App.go('groups', 'plan'); });
  const carried = await page.evaluate(() => {
    const gs = Views._groupState.groups;
    return gs.reduce((a, g) => a + Object.keys(g.skill || {}).length, 0);
  });
  expect(carried).toBe(2);
});

test('SOP 教案庫：144 堂載入正確，套用後五階段與 A/B/C 分級內容都帶進備課', async ({ page }) => {
  await seedAndLogin(page);

  // 資料集完整：9 級 × 16 堂、器材庫、錯誤診斷、八段模板
  const meta = await page.evaluate(() => ({
    belts: SOP.belts.length,
    lessons: SOP.belts.reduce((a, b) => a + b.lessons.length, 0),
    equip: SOP.equip.length,
    fixes: SOP.fixes.length,
    timeline: SOP.timeline.length,
    white: SOP.belts[0].name + SOP.belts[0].grade,
    l05: sopS(SOP.belts[1].lessons[4].t),
  }));
  expect(meta.belts).toBe(9);
  expect(meta.lessons).toBe(144);
  expect(meta.equip).toBeGreaterThan(10);
  expect(meta.fixes).toBeGreaterThan(5);
  expect(meta.timeline).toBe(8);
  expect(meta.white).toBe('白帶0級');
  expect(meta.l05).toContain('跑步旋踢');

  // 教案庫頁：切到黃帶看得到 16 堂
  await page.evaluate(() => { Views._sopBelt = 'yellow'; App.go('sop'); });
  await expect(page.locator('#view')).toContainText('太極一章與移動足技入門');
  await expect(page.locator('#view')).toContainText('Baseline');   // T8 節點標記

  // 先做出分組，再套用教案（分級內容要寫進每一組）
  await page.evaluate(() => App.go('quickplan', 'plan'));
  await page.getByRole('button', { name: '產生五階段初稿' }).click();
  await expect(page.locator('#quickPreview')).toContainText('五階段初稿');

  await page.evaluate(() => Views.sopApply('yellow', 5));
  await page.waitForFunction(() => (planStatus(State.ctx.date, State.ctx.classId).dp || {}).sopBelt === 'yellow');

  const applied = await page.evaluate(() => {
    const dp = planStatus(State.ctx.date, State.ctx.classId).dp;
    const bl = t => C('lesson_blocks').find(b => b.daily_plan_id === dp.id && b.block_type === t && !b.training_group_id) || {};
    const g = C('training_groups').find(x => x.daily_plan_id === dp.id);
    const gb = C('lesson_blocks').find(b => b.daily_plan_id === dp.id && b.block_type === 'group' && b.training_group_id === g.id) || {};
    return {
      lesson: dp.sopLesson,
      warmup: bl('warmup').content || '',
      fitnessFormation: bl('fitness').formation,
      applyContent: bl('apply').content || '',
      preview: bl('review').preview || '',
      groupBasic: gb.basic, groupKick: gb.kick, groupPoomsae: gb.poomsae,
      A: gb.skillA || '', B: gb.skillB || '', C: gb.skillC || '',
    };
  });
  expect(applied.lesson).toBe(5);
  expect(applied.warmup).toContain('點名');                 // 0-5 集合與目標
  expect(applied.fitnessFormation).toBe('棋盤式');
  expect(applied.applyContent).toContain('當堂驗收');
  expect(applied.preview).toContain('Lesson 06');           // 下一堂銜接
  expect(applied.groupBasic).toContain('跑步旋踢');
  expect(applied.groupPoomsae).toBe('太極一章');
  expect(applied.A).toContain('只練腳或只練手');              // Level A 退階
  expect(applied.B).toContain('10次中8次');                   // Level B 標準
  expect(applied.C).toContain('移動');                       // Level C 進階

  // 備課頁最上方出現 SOP 教案卡；A/B/C 內容即使還沒分級也看得到並提示去分級
  await page.evaluate(() => App.go('plan', 'plan'));
  await expect(page.locator('#view')).toContainText('黃帶 Lesson 05');
  await expect(page.locator('#view')).toContainText('分級技術練習');
  await expect(page.locator('#view')).toContainText('還沒把學員分到 A/B/C');
  const html = await page.evaluate(() => Views.buildPDFHtml('coach'));
  expect(html).toContain('黃帶 L05');
});

test('SOP 錯誤診斷可把修正練習帶進今日備課的注意事項', async ({ page }) => {
  await seedAndLogin(page);
  await page.evaluate(() => App.go('quickplan', 'plan'));
  await page.getByRole('button', { name: '產生五階段初稿' }).click();
  await expect(page.locator('#quickPreview')).toContainText('五階段初稿');

  await page.evaluate(() => { Views._sopTab = '錯誤診斷'; App.go('sop'); });
  await expect(page.locator('#view')).toContainText('抬膝不穩');
  await page.getByRole('button', { name: '帶進今日備課' }).first().click();
  await page.waitForFunction(() => {
    const dp = planStatus(State.ctx.date, State.ctx.classId).dp;
    const b = C('lesson_blocks').find(x => x.daily_plan_id === dp.id && x.block_type === 'apply' && !x.training_group_id);
    return !!(b && (b.safety_notes || '').includes('抬膝不穩'));
  });

  const notes = await page.evaluate(() => {
    const dp = planStatus(State.ctx.date, State.ctx.classId).dp;
    return (C('lesson_blocks').find(b => b.daily_plan_id === dp.id && b.block_type === 'apply' && !b.training_group_id) || {}).safety_notes || '';
  });
  expect(notes).toContain('抬膝不穩');
  expect(notes).toContain('扶持抬膝停2秒');
});

test('熱身站表：依人數自動排站、5人角色循環、高風險站准入與備援', async ({ page }) => {
  await seedAndLogin(page);

  // 資料集：20 張器材卡 + 決策規則都在
  const meta = await page.evaluate(() => ({
    cards: WSOP.cards.length, layout: WSOP.layout.length, roles: WSOP.roles.length,
    whistle: WSOP.whistle.length, risk: WSOP.risk.length, mixed: WSOP.mixed.length,
    timeline: WSOP.timeline.length, lanes: wLanes().length,
    laneKeys: wLanes().map(l => l.k),
    levelDef: Object.keys(WSOP.levelDef).length,
    preflight: WSOP.preflight.checks.length + WSOP.preflight.fallback.length,
  }));
  expect(meta.cards).toBe(20);
  expect(meta.roles).toBe(5);
  expect(meta.whistle).toBe(4);
  expect(meta.timeline).toBe(5);
  expect(meta.lanes).toBe(4);
  expect(meta.laneKeys).toEqual(['甲', '乙', '丙', '丁']);   // 站別用甲乙丙丁，不跟 Level A/B/C 撞名
  expect(meta.levelDef).toBe(3);
  expect(meta.preflight).toBe(11);

  // 純函式：人數 → 站數（5 人一站，人多加站）
  const calc = await page.evaluate(() => ({
    p10: warmupPlan(10, 1, 0).stations,
    p20: warmupPlan(20, 1, 1).stations,
    p30: warmupPlan(30, 1, 1).stations,
    p40: warmupPlan(40, 1, 1).stations,
    p38: warmupPlan(38, 1, 1).stations,
    // 40 人無助教：准入表寫「取消」的高風險站要被換掉
    noAsst: warmupPlan(40, 1, 0).blocked.length,
    cancelLeft: warmupPlan(40, 1, 0).list.filter(s => /取消/.test((s.riskRule || {}).no || '')).length,
    dupes: (() => { const e = warmupPlan(40, 1, 0).list.map(s => s.eq); return e.length - new Set(e).size; })(),
    warn: warmupPlan(40, 1, 0).coachWarn,
  }));
  expect(calc.p10).toBe(2);
  expect(calc.p20).toBe(4);
  expect(calc.p30).toBe(6);
  expect(calc.p40).toBe(8);
  expect(calc.p38).toBe(8);            // 38 人也是 8 站（無條件進位）
  expect(calc.cancelLeft).toBe(0);     // 不該留下「取消級」高風險站
  expect(calc.dupes).toBeLessThanOrEqual(2); // 不該整排撞同一項器材
  expect(calc.warn).toContain('助教');

  // 准入表語意：翻滾墊/攀爬/高欄是「取消級」，電子設備只是故障備援不取消
  const rules = await page.evaluate(() => ({
    mat: /取消/.test((wRiskRule('翻滾墊') || {}).no || ''),
    climb: /取消/.test((wRiskRule('攀爬／懸吊欄杆') || {}).no || ''),
    hurdle: /取消/.test((wRiskRule('高欄架') || {}).no || ''),
    electric: /取消/.test((wRiskRule('反應燈球') || {}).no || ''),
    plain: wRiskRule('台階'),
    // 40人0助教時，電子設備站保留但要標「需助教守站」並帶故障備援
    kept: warmupPlan(40, 1, 0).list.filter(s => s.needAssist && s.fallback).length,
  }));
  expect(rules.mat).toBe(true);
  expect(rules.climb).toBe(true);
  expect(rules.hurdle).toBe(true);
  expect(rules.electric).toBe(false);
  expect(rules.plain).toBeNull();
  expect(rules.kept).toBeGreaterThan(0);

  // 實際排站：每人都有站、每人都有角色
  await page.evaluate(() => App.go('quickplan', 'plan'));
  await page.getByRole('button', { name: '產生五階段初稿' }).click();
  await expect(page.locator('#quickPreview')).toContainText('五階段初稿');

  await page.evaluate(() => App.go('plan', 'plan'));
  await page.getByRole('button', { name: /依人數排站/ }).click();
  await page.waitForFunction(() => {
    const dp = planStatus(State.ctx.date, State.ctx.classId).dp;
    return !!(getFitBlock(dp.id).stations || {}).list;
  });

  const st = await page.evaluate(() => {
    const dp = planStatus(State.ctx.date, State.ctx.classId).dp;
    const s = getFitBlock(dp.id).stations;
    const all = s.list.flatMap(x => x.members || []);
    return {
      people: s.people, stations: s.stations,
      assigned: all.length,
      noRole: all.filter(m => !m.role).length,
      dupe: all.length - new Set(all.map(m => m.sid)).size,
      hasCard: s.list.filter(x => x.card).length,
    };
  });
  expect(st.stations).toBe(Math.max(2, Math.ceil(st.people / 5)));
  expect(st.assigned).toBe(st.people);   // 每個人都被排到站
  expect(st.noRole).toBe(0);             // 每個人都有角色，沒有人無目的等待
  expect(st.dupe).toBe(0);               // 沒有人被排到兩站
  expect(st.hasCard).toBe(st.stations);  // 每站都對到器材卡

  await expect(page.locator('#view')).toContainText('熱身站表');

  // 站表要印進教練現場版 PDF
  const html = await page.evaluate(() => Views.buildPDFHtml('coach'));
  expect(html).toContain('站表');
});
