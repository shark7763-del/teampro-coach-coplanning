#!/usr/bin/env node
/* 把「雄麒道館課程計畫 / SOP_2.0_正式版」的 markdown 轉成 index.html 內嵌的 SOP 資料集。
   來源資料夾預設 D:\雄麒道館課程計畫\SOP_2.0_正式版（不在 repo 內，只有要重新產生時才需要）。
   用法：node tools/build-sop-data.cjs [來源資料夾]
   產出：直接改寫 index.html 中 SOP-DATA-BEGIN / SOP-DATA-END 之間的內容。

   壓縮方式：所有教案欄位在同一級內大量重複，抽成字串池 S[]，每堂只存索引。 */
const fs = require('fs');
const path = require('path');

const SRC = process.argv[2] || 'D:\\雄麒道館課程計畫\\SOP_2.0_正式版';
const OUT = path.join(__dirname, '..', 'index.html');

const BELT_FILES = [
  ['white', '白帶', '0級', '03_白帶_16堂.md'],
  ['yellow', '黃帶', '8級', '04_黃帶_16堂.md'],
  ['yellowblue', '黃藍帶', '7級', '05_黃藍帶_16堂.md'],
  ['blue', '藍帶', '6級', '06_藍帶_16堂.md'],
  ['bluered', '藍紅帶', '5級', '07_藍紅帶_16堂.md'],
  ['red', '紅帶', '4級', '08_紅帶_16堂.md'],
  ['rb1', '紅黑一線', '3級', '09_紅黑一線_16堂.md'],
  ['rb2', '紅黑二線', '2級', '10_紅黑二線_16堂.md'],
  ['rb3', '紅黑黑頭', '1級', '11_紅黑黑頭_16堂.md'],
];

const read = f => fs.readFileSync(path.join(SRC, f), 'utf8').replace(/\r\n?/g, '\n');
const cells = line => line.split('|').slice(1, -1).map(s => s.trim());

/* ---- 字串池 ---- */
const pool = [];
const poolIdx = new Map();
const S = str => {
  const v = (str || '').trim();
  if (!v) return -1;
  if (poolIdx.has(v)) return poolIdx.get(v);
  poolIdx.set(v, pool.length);
  pool.push(v);
  return pool.length - 1;
};

/* ---- 單一級別 ---- */
function parseBelt([key, name, grade, file]) {
  const md = read(file);
  const meta = {};
  for (const [label, prop] of [['核心', 'core'], ['新品勢', 'newPoomsae'], ['測驗/複習品勢', 'reviewPoomsae'],
    ['足技/應用', 'kicks'], ['測驗需求來源', 'testFrom'], ['銜接下一級', 'nextBelt']]) {
    const m = md.match(new RegExp('^- ' + label.replace(/[/]/g, '\\/') + '：(.*)$', 'm'));
    meta[prop] = m ? m[1].trim() : '';
  }

  // 總覽表：| 堂次 | 階段 | 核心主題 | 品勢 | 足技/應用 | 器材 | 驗收 |
  const overview = {};
  md.split('\n').forEach(l => {
    if (!/^\|\s*\d{2}\s*\|/.test(l)) return;
    const c = cells(l);
    overview[String(+c[0])] = { phase: c[1], title: c[2], poomsae: c[3], kicks: c[4], equip: c[5], pass: c[6] };
  });

  // 逐堂詳細教案
  const lessons = [];
  const blocks = md.split(/^### Lesson /m).slice(1);
  blocks.forEach(b => {
    const no = +b.slice(0, 2);
    const f = {};
    b.split('\n').forEach(l => {
      if (!/^\| .+ \| .+ \|$/.test(l)) return;
      const c = cells(l);
      if (c.length === 2 && c[0] !== '欄位') f[c[0]] = c[1];
    });
    const qc = {};
    const qcBlock = (b.split('#### Coach Quick Card')[1] || '').split('#### After Class Review')[0] || '';
    qcBlock.split('\n').forEach(l => {
      const m = l.match(/^- (.+?)：(.*)$/);
      if (m) qc[m[1]] = m[2].trim();
    });
    const ov = overview[String(no)] || {};
    lessons.push({
      n: no,
      ph: S(ov.phase),
      t: S(ov.title),
      pm: S(ov.poomsae),
      kk: S(ov.kicks),
      eq: S(ov.equip),
      // 教案欄位（索引）
      goal: S(f['今日目標']),
      entry: S(f['Entry Gate']),
      s1: S(f['0-5 集合與目標']),
      s2: S(f['5-15 主題式暖身']),
      s3: S(f['15-25 上堂檢核']),
      s4: S(f['25-45 核心技術拆解']),
      how: S(f['教練怎麼教']),
      prac: S(f['學生怎麼練']),
      s5: S(f['45-60 分級練習']),
      s6: S(f['60-75 應用整合']),
      s7: S(f['75-85 當堂驗收']),
      s8: S(f['85-90 回饋收操']),
      la: S(f['Level A']),
      lb: S(f['Level B']),
      lc: S(f['Level C']),
      err: S(f['常見錯誤']),
      fix: S(f['修正練習']),
      next: S(f['下一堂銜接']),
      // Coach Quick Card
      q3: S(qc['三個重點']),
      qa: S(qc['先做什麼']),
      qb: S(qc['再做什麼']),
      qt: S(qc['最後怎麼測']),
    });
  });
  lessons.sort((a, b) => a.n - b.n);
  return { key, name, grade, ...meta, lessons };
}

/* ---- 器材資料庫 ---- */
function parseEquipment() {
  const md = read('15_Equipment_Drill_Database.md');
  const sec = md.split('## 器材用途資料庫')[1].split('## 器材 × 能力矩陣')[0];
  return sec.split('\n').filter(l => /^\| .+ \|$/.test(l) && !/^\| 器材 \|/.test(l) && !/^\| -- \|/.test(l))
    .map(l => {
      const c = cells(l);
      return { n: c[0], use: c[1], age: c[2], lv: c[3], tech: c[4], ab: c[5], mode: c[6], per: c[7], pos: c[8], safe: c[9], prog: c[10] };
    });
}

/* ---- 錯誤診斷與修正 ---- */
function parseFixes() {
  const md = read('16_Corrective_Drill_Database.md');
  return md.split('\n').filter(l => /^\| .+ \|$/.test(l) && !/^\| 學生問題 \|/.test(l) && !/^\| -- \|/.test(l))
    .map(l => {
      const c = cells(l);
      return { p: c[0], cause: c[1], eq: c[2], drill: c[3], chk: c[4] };
    });
}

/* ---- 品勢計分節點 ---- */
function parseScoring() {
  const md = read('17_Poomsae_Scoring_Protocol.md');
  return md.split('\n').filter(l => /^\| T\d+ \|/.test(l))
    .map(l => { const c = cells(l); return { t: c[0], name: c[1], purpose: c[2], use: c[3], result: c[4] }; });
}

/* ---- 16堂週期與90分鐘八段 ---- */
function parseCycle() {
  const md = read('02_16_Cycle_Framework.md');
  const phases = md.split('\n').filter(l => /^\| \d+-\d+ \| PHASE/.test(l))
    .map(l => { const c = cells(l); return { n: c[0], ph: c[1], goal: c[2], main: c[3], pass: c[4] }; });
  const tl = md.split('## 90分鐘共同模板')[1].split('\n')
    .filter(l => /^\| \d+-\d+ \|/.test(l))
    .map(l => { const c = cells(l); return { t: c[0], name: c[1], purpose: c[2], req: c[3] }; });
  const gates = [];
  md.split('### 足技 Gate')[1].split('### 品勢 Gate')[0].split('\n')
    .filter(l => l.startsWith('- ')).forEach(l => gates.push({ k: 'kick', v: l.slice(2).trim() }));
  md.split('### 品勢 Gate')[1].split('\n')
    .filter(l => l.startsWith('- ')).forEach(l => gates.push({ k: 'poomsae', v: l.slice(2).trim() }));
  return { phases, tl, gates };
}

/* ---- 主流程 ---- */
const belts = BELT_FILES.map(parseBelt);
const cycle = parseCycle();
const data = {
  ver: 'SOP 2.0｜2026-08-15',
  S: pool,
  belts,
  cycle: cycle.phases,
  timeline: cycle.tl,
  gates: cycle.gates,
  equip: parseEquipment(),
  fixes: parseFixes(),
  scoring: parseScoring(),
};

const json = JSON.stringify(data);
const banner = `/* 雄麒道館 SOP 2.0 課程系統資料｜由 tools/build-sop-data.cjs 自動產生，請勿手改 */`;
const payload = `${banner}\nconst SOP=${json};\nfunction sopS(i){return (i==null||i<0)?'':SOP.S[i];}`;

let html = fs.readFileSync(OUT, 'utf8');
const B = '/* SOP-DATA-BEGIN */', E = '/* SOP-DATA-END */';
if (!html.includes(B)) { console.error('index.html 找不到 SOP-DATA-BEGIN 標記'); process.exit(1); }
const head = html.slice(0, html.indexOf(B) + B.length);
const tail = html.slice(html.indexOf(E));
fs.writeFileSync(OUT, head + '\n' + payload + '\n' + tail, 'utf8');

console.log(`級別 ${belts.length}｜總堂數 ${belts.reduce((a, b) => a + b.lessons.length, 0)}｜字串池 ${pool.length}`);
console.log(`器材 ${data.equip.length}｜錯誤修正 ${data.fixes.length}｜計分節點 ${data.scoring.length}｜八段 ${data.timeline.length}｜Gate ${data.gates.length}`);
console.log(`資料大小 ${(json.length / 1024).toFixed(1)} KB`);
