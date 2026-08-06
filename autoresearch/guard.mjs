/* 防作弊守門員：唯讀目錄雜湊校驗
   AutoResearch 官方只用「指令層禁令」保護 prepare.py，在本專案不夠——
   因為評分含主觀 Rubric，Agent 有大量空間改 Benchmark／Rubric 讓自己通過。
   因此改為技術強制：每輪開始與結束各跑一次，不一致即該輪作廢並回滾。

   用法： node autoresearch/guard.mjs [--write]   (--write 只在教練明確指示變更後使用)
*/
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const READONLY = ['autoresearch/benchmark', 'autoresearch/rubric'];
const LOCK = resolve(ROOT, 'autoresearch/READONLY.lock.json');

function walk(dir, acc = []) {
  for (const f of readdirSync(dir)) {
    const p = resolve(dir, f);
    if (statSync(p).isDirectory()) walk(p, acc); else acc.push(p);
  }
  return acc;
}
const digest = {};
for (const d of READONLY) {
  const abs = resolve(ROOT, d);
  if (!existsSync(abs)) continue;
  for (const f of walk(abs)) {
    digest[relative(ROOT, f).replace(/\\/g, '/')] =
      createHash('sha256').update(readFileSync(f)).digest('hex').slice(0, 16);
  }
}

if (process.argv.includes('--write')) {
  writeFileSync(LOCK, JSON.stringify({ written_at: new Date().toISOString(), digest }, null, 1) + '\n');
  console.log('LOCK 已寫入：' + Object.keys(digest).length + ' 個檔案');
  process.exit(0);
}
if (!existsSync(LOCK)) { console.error('尚未建立 LOCK，請先執行： node autoresearch/guard.mjs --write'); process.exit(2); }

const prev = JSON.parse(readFileSync(LOCK, 'utf8')).digest;
const bad = [];
for (const k of new Set([...Object.keys(prev), ...Object.keys(digest)])) {
  if (prev[k] !== digest[k]) bad.push(`${k}: ${prev[k] || '(新增)'} → ${digest[k] || '(刪除)'}`);
}
if (bad.length) {
  console.error('❌ 唯讀檔案被更動，本輪實驗作廢，必須回滾：');
  bad.forEach(b => console.error('   ' + b));
  process.exit(1);
}
console.log('✅ Benchmark / Rubric 未被更動（' + Object.keys(digest).length + ' 個檔案）');
