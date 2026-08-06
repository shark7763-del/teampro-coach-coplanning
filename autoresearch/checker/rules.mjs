/* 自動規則檢查器（唯讀規則層）
   只檢查「不需要跆拳道專業判斷」就能客觀判定的項目。
   任何需要專業判斷的維度一律不在此評分，改由教練 Rubric 處理。 */

export const STAGE_KEYS = ['warmup', 'fitness', 'apply', 'review']; // group 為分組區塊，另計

/** 對單一案例的產生結果做檢查，回傳 {violations:[], facts:{}} */
export function checkCase(caseDef, plan) {
  const v = [];
  const blocks = plan.blocks || [];
  const stageBlocks = blocks.filter(b => !b.training_group_id);
  const groupBlocks = blocks.filter(b => b.training_group_id);

  // R1 課表總時長必須等於班別實際時長
  const maxEnd = blocks.length ? Math.max(...blocks.map(b => b.end_minute || 0)) : 0;
  if (maxEnd !== caseDef.minutes) {
    v.push({ rule: 'R1_total_time', severity: 'block', msg: `課表時間軸到 ${maxEnd} 分，但班別實際 ${caseDef.minutes} 分` });
  }

  // R2 五階段皆須存在且有內容
  for (const k of STAGE_KEYS) {
    const b = stageBlocks.find(x => x.block_type === k);
    if (!b) { v.push({ rule: 'R2_stage_missing', severity: 'block', msg: `缺少階段 ${k}` }); continue; }
    const filled = k === 'review'
      ? !!(b.praise || b.remind || b.homework || b.preview)
      : !!(b.content && String(b.content).trim());
    if (!filled) v.push({ rule: 'R2_stage_empty', severity: 'block', msg: `階段 ${k} 無內容` });
  }
  if (!groupBlocks.length) v.push({ rule: 'R2_no_group_block', severity: 'block', msg: '沒有任何分組訓練區塊' });

  // R3 階段之間不得重疊或留空窗（分組區塊與 group 時段重疊為正常，排除）
  const tl = stageBlocks.map(b => [b.start_minute, b.end_minute]).sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < tl.length; i++) {
    if (tl[i][0] < tl[i - 1][1]) v.push({ rule: 'R3_overlap', severity: 'block', msg: `階段時間重疊：${tl[i - 1]} 與 ${tl[i]}` });
    else if (tl[i][0] > tl[i - 1][1]) v.push({ rule: 'R3_gap', severity: 'warn', msg: `階段之間有空窗：${tl[i - 1][1]}–${tl[i][0]} 分` });
  }

  // R4 分組完整性（用 app 自己的 validate 結果）
  (plan.groupIssues || []).forEach(i => {
    const blocking = ['toomany', 'dup', 'nocoach', 'sameperson', 'dualrole', 'inactive'].includes(i.t);
    v.push({ rule: 'R4_group_' + i.t, severity: blocking ? 'block' : 'warn', msg: i.msg });
  });

  // R5 發布前檢查
  (plan.publishIssues || []).forEach(m => v.push({ rule: 'R5_publish', severity: 'warn', msg: m }));

  /* R6 記錄粒度（教練 2026-08-06 確認）：
       強度 → 除講評外的四個階段都要有
       組間休息 → 只有「分組訓練」與「應用組合」兩段適用（3~5 分鐘），
                  做操慢跑與熱身體能是連續進行，不適用；講評不需要。
     註：本規則於 exp2a 依教練口述修訂，修訂後已用新規則重新量測既有版本，
        再與新版本比較，避免用「放寬標準」製造假進步。 */
  const REST_STAGES = ['group', 'apply'];
  for (const b of stageBlocks) {
    if (b.block_type === 'review') continue;
    if (!b.intensity) v.push({ rule: 'R6_no_intensity', severity: 'block', msg: `階段 ${b.block_type} 缺強度` });
  }
  for (const k of REST_STAGES) {
    const bs = k === 'group' ? groupBlocks : stageBlocks.filter(x => x.block_type === k);
    if (!bs.length) continue;
    for (const b of bs) {
      if (b.rest_seconds == null || b.rest_seconds === '')
        v.push({ rule: 'R6_no_rest', severity: 'block', msg: `階段 ${k} 缺組間休息` });
      else if (b.rest_seconds < 180 || b.rest_seconds > 300)
        v.push({ rule: 'R6_rest_out_of_range', severity: 'warn', msg: `階段 ${k} 組間休息 ${b.rest_seconds}秒 不在教練指定的 180~300 秒範圍` });
    }
  }

  // R7 到課學員必須全部被分組
  const assigned = new Set((plan.groups || []).flatMap(g => g.students || []));
  const missing = (plan.attending || []).filter(id => !assigned.has(id));
  if (missing.length) v.push({ rule: 'R7_unassigned', severity: 'block', msg: `${missing.length} 位學員未分組` });

  return {
    violations: v,
    facts: {
      maxEnd, expectedMinutes: caseDef.minutes,
      stageCount: stageBlocks.length, groupCount: (plan.groups || []).length,
      groupBlockCount: groupBlocks.length,
      attending: (plan.attending || []).length,
      genMs: plan.genMs,
    },
  };
}

/** 個人化程度：同一階段的內容在 10 個案例間有多少種不同寫法 */
export function personalization(results) {
  const out = {};
  for (const k of STAGE_KEYS) {
    const texts = results.map(r => {
      const b = (r.plan.blocks || []).find(x => !x.training_group_id && x.block_type === k);
      if (!b) return '';
      return k === 'review' ? [b.praise, b.remind, b.homework, b.preview].join('|') : String(b.content || '');
    });
    const distinct = new Set(texts.filter(Boolean)).size;
    out[k] = { distinct, total: texts.length, ratio: texts.length ? distinct / texts.length : 0 };
  }
  const ratios = Object.values(out).map(x => x.ratio);
  out._overall = ratios.reduce((a, b) => a + b, 0) / (ratios.length || 1);
  return out;
}

/** 主 Metric（自動層）。教練 Rubric 分數不在此計算，另行合併。
    滿分 100，全部為「可客觀判定」的扣分。 */
export function autoScore(results, pers) {
  const n = results.length || 1;
  const withBlock = results.filter(r => r.check.violations.some(v => v.severity === 'block')).length;
  const timeBad = results.filter(r => r.check.violations.some(v => v.rule === 'R1_total_time')).length;
  const stageBad = results.filter(r => r.check.violations.some(v => v.rule.startsWith('R2_'))).length;
  const groupBad = results.filter(r => r.check.violations.some(v => v.rule.startsWith('R4_') && v.severity === 'block')).length;
  const gran = results.filter(r => r.check.violations.some(v => v.rule.startsWith('R6_'))).length;

  const score = 100
    - 25 * (timeBad / n)
    - 20 * (stageBad / n)
    - 15 * (groupBad / n)
    - 15 * (gran / n)
    - 10 * (1 - pers._overall)
    - 15 * (withBlock / n);
  return {
    score: Math.round(score * 100) / 100,
    breakdown: {
      time_violation_cases: timeBad, stage_violation_cases: stageBad,
      group_blocking_cases: groupBad, granularity_missing_cases: gran,
      any_blocking_cases: withBlock, personalization: Math.round(pers._overall * 1000) / 1000, n,
    },
  };
}
