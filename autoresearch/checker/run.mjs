/* AutoResearch 驅動器
   用 Playwright 開「真實的 index.html」產生課表，不另外複製一份產生邏輯
   （複製邏輯會與實際 app 失真，量到的就不是使用者拿到的東西）。

   用法： node autoresearch/checker/run.mjs [--tag baseline]
*/
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { checkCase, personalization, autoScore } from './rules.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '../..');
const PORT = 5199;
const BASE = `http://127.0.0.1:${PORT}`;
const TAG = (process.argv.find(a => a.startsWith('--tag=')) || '--tag=baseline').split('=')[1];

/* 固定測試日：與示範資料的課程日期錯開，且每輪都一樣，確保可重現 */
const FIXED_DATE = '2026-09-14';

const bench = JSON.parse(readFileSync(resolve(ROOT, 'autoresearch/benchmark/cases.json'), 'utf8'));

function serve() {
  const p = spawn('npx', ['http-server', '.', '-p', String(PORT), '-c-1', '--silent'],
    { cwd: ROOT, shell: true, stdio: 'ignore' });
  return p;
}
async function waitServer() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(BASE + '/index.html'); if (r.ok) return; } catch { }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('http-server 未啟動');
}

async function runCase(page, c) {
  await page.goto(`${BASE}/index.html?bench=${c.id}`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.waitForFunction(() => typeof seedDemo === 'function' && typeof DB !== 'undefined');
  await page.evaluate(async () => { await ensureDbReady(); await reloadAll(); });
  await page.evaluate(async () => { await seedDemo(); });

  const t0 = Date.now();
  const plan = await page.evaluate(async ({ c, date }) => {
    // 1) 清掉示範學員，換成本案例固定名單
    for (const s of C('students').slice()) await remove('students', s.id);
    // 2) 建立本案例專用班別（時長依案例，星期全開避免日期造成差異）
    const cls = {
      id: 'cls_bench', name: 'BENCH_' + c.id, class_type: '一般',
      weekdays: [...WEEKDAYS], start_time: '19:00', end_time: '21:00',
      duration_minutes: c.minutes, active: true,
    };
    await save('classes', cls);
    for (const st of c.roster) {
      await save('students', {
        id: 'stu_' + c.id + '_' + st.name, name: st.name, age_group: st.age_group,
        belt_rank: st.belt_rank, specialty: st.specialty, class_id: cls.id,
        weekdays: [...WEEKDAYS], active: true,
      });
    }
    // 3) 固定可用教練數
    const coaches = C('profiles').filter(p => ['head', 'assistant'].includes(p.role));
    for (let i = 0; i < coaches.length; i++) await save('profiles', { ...coaches[i], active: i < c.coaches_available });
    await reloadAll();

    // 4) 以管理者身分進入，走真實的快速備課流程
    const admin = C('profiles').find(p => p.role === 'admin');
    App.enter(admin);
    State.ctx.date = date; State.ctx.classId = cls.id;
    App.go('quickplan', 'plan');
    const g = document.getElementById('qGoal');
    if (g && [...g.options].some(o => o.value === c.goal)) g.value = c.goal;
    const d = document.getElementById('qDate'); if (d) d.value = date;
    const k = document.getElementById('qClass'); if (k) k.value = cls.id;
    // 分組方式與強度維持 UI 預設值（教練直接按下去會拿到的結果）
    const t = performance.now();
    await Views.generateQuickPlan();
    const genMs = Math.round(performance.now() - t);

    // 5) 取出結果
    const dp = findDaily(date, cls.id);
    if (!dp) return { error: '未產生 daily_plan', genMs };
    const groups = C('training_groups').filter(x => x.daily_plan_id === dp.id);
    const blocks = C('lesson_blocks').filter(x => x.daily_plan_id === dp.id);
    const list = Stats.attendingFor(date, cls.id);
    const val = Grouping.validate(groups.map(x => ({ ...x, students: [...(x.students || [])] })), list, dp);
    return {
      genMs, status: dp.status,
      groups: groups.map(x => ({ name: x.name, group_type: x.group_type, students: x.students, coach_id: x.coach_id })),
      blocks: blocks.map(b => ({
        block_type: b.block_type, training_group_id: b.training_group_id || null,
        start_minute: b.start_minute, end_minute: b.end_minute,
        content: b.content || '', goal: b.goal || '', equipment: b.equipment || '',
        praise: b.praise || '', remind: b.remind || '', homework: b.homework || '', preview: b.preview || '',
        intensity: b.intensity || null, rest_seconds: b.rest_seconds ?? null,
      })),
      groupIssues: val.issues,
      publishIssues: publishIssues(dp),
      attending: list.map(s => s.id),
    };
  }, { c, date: FIXED_DATE });
  plan.wallMs = Date.now() - t0;
  return plan;
}

(async () => {
  const srv = serve();
  try {
    await waitServer();
    const browser = await chromium.launch();
    // 擋掉 service worker：它會在導覽時重建執行環境，讓 page.evaluate 失敗
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));

    const results = [];
    for (const c of bench.cases) {
      const plan = await runCase(page, c);
      const check = plan.error ? { violations: [{ rule: 'R0_generate_failed', severity: 'block', msg: plan.error }], facts: {} } : checkCase(c, plan);
      results.push({ id: c.id, label: c.label, minutes: c.minutes, plan, check });
      const nb = check.violations.filter(v => v.severity === 'block').length;
      const nw = check.violations.filter(v => v.severity === 'warn').length;
      console.log(`${c.id} ${c.label.padEnd(16)} 阻擋:${nb} 警告:${nw}  ${check.facts.maxEnd ?? '-'}/${c.minutes}分  ${check.facts.groupCount ?? '-'}組  ${plan.genMs ?? '-'}ms`);
    }
    await browser.close();

    const pers = personalization(results);
    const score = autoScore(results, pers);
    const out = { tag: TAG, date: FIXED_DATE, generated_at: new Date().toISOString(), pageErrors: errs, score, personalization: pers, results };
    mkdirSync(resolve(ROOT, 'autoresearch/baseline'), { recursive: true });
    const file = resolve(ROOT, `autoresearch/baseline/${TAG}.json`);
    writeFileSync(file, JSON.stringify(out, null, 1));

    console.log('\n===== AUTO SCORE =====');
    console.log('score:', score.score);
    console.log(JSON.stringify(score.breakdown, null, 1));
    console.log('個人化(各階段不同寫法比例):', JSON.stringify(
      Object.fromEntries(Object.entries(pers).filter(([k]) => k !== '_overall').map(([k, v]) => [k, `${v.distinct}/${v.total}`]))));
    console.log('page errors:', errs.length);
    console.log('written:', file);
  } catch (e) {
    console.error('RUN FAILED:', e && e.stack || e);
    srv.kill();
    process.exit(1);
  }
  srv.kill();
  process.exit(0);
})();
