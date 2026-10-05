#!/usr/bin/env node
// يولّد بنك أسئلة «ألعب» (الجمع، الطرح، التقريب، الضعف) إلى supabase/game_bank.sql.
//
//   node scripts/generate-game-bank.mjs            ← يكتب supabase/game_bank.sql
//   node scripts/generate-game-bank.mjs --json f   ← ويكتب أيضًا نسخة JSON (للاختبارات)
//
// المخرجات حتمية (نفس البذرة = نفس الملف)، والقاعدة الرياضية تُضمن بالبناء نفسه:
//   • الجمع بدون حمل  : آحاد + آحاد ≤ ٩ ، عشرات + عشرات ≤ ٩.
//   • الطرح بدون استلاف: كل خانة في المطروح منه ≥ نظيرتها في المطروح.
// ثم يعيد scripts/verify-game-bank.mjs فحص كل صف بمعزل عن هذا المولّد.
//
// المستويات (تتصاعد داخل الجولة: ٣ سهلة ثم ٤ متوسطة ثم ٣ صعبة):
//   الجمع/الطرح:
//     easy   : عددان من خانة واحدة            (7 + 2 ، 9 - 3)
//     medium : عدد من خانتين مع عدد من خانة   (12 + 3 ، 27 - 5)
//     hard   : عددان من خانتين                 (23 + 45 ، 36 - 12)
//   التقريب:
//     easy   : عدد من خانتين لأقرب عشرة        (٤٥ ← ٥٠)
//     medium : عدد من ثلاث خانات لأقرب عشرة    (٤٥٣ ← ٤٥٠)
//     hard   : عدد من ثلاث خانات لأقرب مئة      (٤٥٣ ← ٥٠٠)
//   الضعف («سهلة للأطفال» بعدم تجاوز الناتج نفس عدد خانات المُدخل):
//     easy   : رقم واحد   (١–٩)      → الضعف ≤ ١٨
//     medium : رقمان       (١٠–٤٩)   → الضعف ≤ ٩٨
//     hard   : ثلاث أرقام  (١٠٠–٤٩٩) → الضعف ≤ ٩٩٨
//   الترتيب التصاعدي/التنازلي، المقارنة، والزوجي والفردي:
//     easy   : من خانة واحدة   (١–٩)
//     medium : من خانتين        (١٠–٩٩)
//     hard   : من ثلاث خانات    (١٠٠–٩٩٩)

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const OUT_SQL = resolve(here, "../supabase/game_bank.sql");
const jsonFlag = process.argv.indexOf("--json");
const OUT_JSON = jsonFlag > -1 ? process.argv[jsonFlag + 1] : null;

// ---- عشوائية حتمية ----------------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260921);
const shuffle = (arr) => {
  const c = [...arr];
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c;
};
const sample = (arr, n) => shuffle(arr).slice(0, n);
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;

// ---- كل الأزواج الصالحة لكل مستوى ------------------------------------------
const add = { easy: [], medium: [], hard: [] };
const sub = { easy: [], medium: [], hard: [] };

for (let a = 1; a <= 8; a++) for (let b = 1; a + b <= 9; b++) add.easy.push([a, b]);
for (let t = 1; t <= 8; t++)
  for (let u = 1; u <= 8; u++)
    for (let b = 1; u + b <= 9; b++) add.medium.push([10 * t + u, b]);
for (let t1 = 1; t1 <= 8; t1++)
  for (let t2 = 1; t1 + t2 <= 9; t2++)
    for (let u1 = 1; u1 <= 8; u1++)
      for (let u2 = 1; u1 + u2 <= 9; u2++) add.hard.push([10 * t1 + u1, 10 * t2 + u2]);

for (let a = 2; a <= 9; a++) for (let b = 1; b < a; b++) sub.easy.push([a, b]);
for (let t = 1; t <= 9; t++)
  for (let u = 2; u <= 9; u++)
    for (let b = 1; b < u; b++) sub.medium.push([10 * t + u, b]);
for (let t1 = 2; t1 <= 9; t1++)
  for (let t2 = 1; t2 < t1; t2++)
    for (let u1 = 2; u1 <= 9; u1++)
      for (let u2 = 1; u2 < u1; u2++) sub.hard.push([10 * t1 + u1, 10 * t2 + u2]);

// عدد الأسئلة المختارة من كل مستوى، لكل لعبة على حدة (بعض المجالات صغيرة
// طبيعيًا — كضعف رقم واحد الذي له ٩ قيم ممكنة فقط — فلا يصح تعميم رقم واحد).
const PICK = {
  addition: { easy: 36, medium: 48, hard: 48 },
  subtraction: { easy: 36, medium: 48, hard: 48 },
  rounding: { easy: 36, medium: 48, hard: 48 },
  doubling: { easy: 9, medium: 40, hard: 48 },
};

// ---- إجابات خاطئة مقنعة -----------------------------------------------------
function distractors(kind, tier, a, b, correct) {
  const cand = [];
  const push = (v) => { if (v > 0 && v !== correct && !cand.includes(v)) cand.push(v); };
  if (tier === "easy") {
    // أخطاء عدّ بسيطة (±١ ، ±٢) + عملية معكوسة
    shuffle([1, -1, 2, -2, 3]).forEach((d) => push(correct + d));
    push(kind === "addition" ? Math.abs(a - b) : a + b);
  } else {
    // خطأ في الآحاد (±١) وخطأ في العشرات (±١٠) وعملية معكوسة
    push(correct + (rand() < 0.5 ? 1 : -1));
    push(correct + (rand() < 0.5 ? 10 : -10));
    push(kind === "addition" ? Math.abs(a - b) : a + b);
    shuffle([2, -2, 20, -20, 11, -11]).forEach((d) => push(correct + d));
  }
  const picked = cand.slice(0, 3);
  for (let d = 1; picked.length < 3; d++) {
    if (correct + d > 0 && !picked.includes(correct + d)) picked.push(correct + d);
  }
  return picked;
}

const games = {
  addition: { skill: "addition_no_carry", op: "+", symbol: "+", pairs: add, compute: (a, b) => a + b },
  subtraction: { skill: "subtraction_no_borrow", op: "-", symbol: "−", pairs: sub, compute: (a, b) => a - b },
};

const MUST = {
  addition: [[7, 2], [4, 5], [12, 3], [21, 6], [13, 4]],
  subtraction: [[9, 3], [8, 2], [15, 4], [27, 5], [36, 12]],
};

const rows = [];
for (const [gameId, g] of Object.entries(games)) {
  for (const tier of ["easy", "medium", "hard"]) {
    // الأمثلة التي طلبتها المعلم تدخل البنك دائمًا، ثم يُكمَّل المستوى بعيّنة عشوائية.
    const must = MUST[gameId].filter(([a, b]) => g.pairs[tier].some(([x, y]) => x === a && y === b));
    const rest = g.pairs[tier].filter(([x, y]) => !must.some(([a, b]) => a === x && b === y));
    const chosen = [...must, ...sample(rest, PICK[gameId][tier] - must.length)];
    for (const [a, b] of chosen.sort((x, y) => x[0] - y[0] || x[1] - y[1])) {
      const correct = g.compute(a, b);
      const wrong = distractors(gameId, tier, a, b, correct);
      const options = [String(correct), ...wrong.map(String)];
      const visual = {
        kind: "expression",
        tokens: [
          { kind: "num", value: a },
          { kind: "op", symbol: g.symbol },
          { kind: "num", value: b },
          { kind: "op", symbol: "=" },
          { kind: "blank" },
        ],
      };
      rows.push({
        game_id: gameId, skill: g.skill, difficulty: tier,
        question_text: `${a} ${g.op} ${b} = ؟`,
        operand_a: a, operand_b: b, operator: g.op,
        correct_answer: String(correct), options, visual,
      });
    }
  }
}


// -----------------------------------------------------------------------------
// التقريب — بلا مضاعفات الوحدة نفسها (السؤال يصبح بلا معنى إن كان العدد أصلًا
// مضاعفًا لوحدة التقريب)، والإجابة الصحيحة والحدّان محسوبان بقاعدة «نصفها فأكثر
// للأعلى» نفسها التي تتحقق منها القيد في قاعدة البيانات.
// -----------------------------------------------------------------------------
function roundToUnit(n, unit) {
  const lower = Math.floor(n / unit) * unit;
  const upper = lower + unit;
  return n - lower >= unit / 2 ? upper : lower;
}

const roundingDomains = {
  easy: { min: 10, max: 99, unit: 10 },
  medium: { min: 100, max: 999, unit: 10 },
  hard: { min: 100, max: 999, unit: 100 },
};

for (const [tier, { min, max, unit }] of Object.entries(roundingDomains)) {
  const pool = [];
  for (let n = min; n <= max; n++) if (n % unit !== 0) pool.push(n);

  for (const n of sample(pool, PICK.rounding[tier]).sort((a, b) => a - b)) {
    const correct = roundToUnit(n, unit);
    const lower = Math.floor(n / unit) * unit;
    const upper = lower + unit;
    const other = correct === upper ? lower : upper; // الحدّ الآخر (خطأ اتجاه شائع)
    // كل مرشّح يُحوَّل إلى نص فورًا — الجدول والواجهة يتوقعان خيارات نصّية دائمًا.
    const wrong = distractors("rounding", tier, n, unit, correct).map(String).slice(0, 2);
    const otherStr = String(other);
    // نضمن أن الحدّ الآخر ضمن الخيارات لأنه أكثر تشتيت منطقي من فروق عشوائية.
    const options = [String(correct), otherStr, ...wrong.filter((w) => w !== otherStr)].slice(0, 4);
    while (options.length < 4) {
      const extra = correct + unit * (options.length % 2 === 0 ? 2 : -2);
      if (extra > 0 && !options.includes(String(extra))) options.push(String(extra));
    }
    rows.push({
      game_id: "rounding",
      skill: "rounding",
      difficulty: tier,
      question_text: `قرّب العدد ${n} لأقرب ${unit === 10 ? "عشرة" : "مئة"}`,
      operand_a: n,
      operand_b: unit,
      operator: "round",
      correct_answer: String(correct),
      options: shuffle(options),
      visual: { kind: "numberLine", value: n, lower, upper, unit },
    });
  }
}

// -----------------------------------------------------------------------------
// الضعف — «سهلة للأطفال»: نطاق كل مستوى لا يتجاوز الضعف عدد خانات المدخل نفسه
// (رقم واحد يبقى ضعفه من خانة أو خانتين كالمعتاد، رقمان يبقى ضعفهما رقمين،
// ثلاثة أرقام يبقى ضعفها ثلاثة أرقام) — فلا تُفاجئ الطالب بخانة جديدة كليًا.
// -----------------------------------------------------------------------------
const doublingDomains = { easy: [1, 9], medium: [10, 49], hard: [100, 499] };

for (const [tier, [min, max]] of Object.entries(doublingDomains)) {
  const pool = [];
  for (let n = min; n <= max; n++) pool.push(n);

  for (const n of sample(pool, PICK.doubling[tier]).sort((a, b) => a - b)) {
    const correct = n * 2;
    const wrong = [];
    const pushWrong = (v) => { if (v > 0 && v !== correct && !wrong.includes(v)) wrong.push(v); };
    pushWrong(correct + 2);
    pushWrong(correct - 2);
    pushWrong(n); // فخ شائع: كتابة العدد نفسه بدل ضعفه
    pushWrong(n * 3); // فخ شائع: التثليث بدل التضعيف
    pushWrong(correct + 10);
    const options = [String(correct), ...wrong.slice(0, 3).map(String)];

    rows.push({
      game_id: "doubling",
      skill: "doubling",
      difficulty: tier,
      question_text: `ضعف العدد ${n} = ؟`,
      operand_a: n,
      operand_b: null,
      operator: "double",
      correct_answer: String(correct),
      options: shuffle(options),
      visual: { kind: "doublingPods", value: n },
    });
  }
}

// -----------------------------------------------------------------------------
// الترتيب التصاعدي/التنازلي — أربعة أعداد مختلفة، كلها من نفس عدد الخانات (لا
// خلط بين خانة وخانتين في نفس السؤال): سهل = خانة واحدة (١–٩)، متوسط = خانتان
// (١٠–٩٩)، صعب = ثلاث خانات (١٠٠–٩٩٩) — نفس مستويات بقية الألعاب، ونفس نطاقات
// «اختبر»/«اكتشف» بالضبط لكل مستوى خانات. الأعداد المعروضة لا تأتي مرتّبة أصلًا
// (لا تصاعديًا ولا تنازليًا) — نفس قاعدة بنك «اختبر». المشتتات الثلاثة بنفس
// أسلوب quiz_make_question في قاعدة البيانات: الترتيب الصحيح، معكوسه، تبديل أول
// عنصرين، وتبديل الأوسطين — أربعة اختلافات مضمونة رياضيًا ما دامت الأعداد
// الأربعة مختلفة (مضمون بالبناء هنا).
// -----------------------------------------------------------------------------
const orderingDomains = { easy: [1, 9], medium: [10, 99], hard: [100, 999] };
const ORDER_PICK = { easy: 36, medium: 48, hard: 48 };

function pickFourDistinct(min, max) {
  const pool = [];
  for (let n = min; n <= max; n++) pool.push(n);
  return sample(pool, 4);
}

function isMonotonic(arr) {
  const asc = [...arr].sort((a, b) => a - b);
  const desc = [...asc].reverse();
  const eq = (x, y) => x.every((v, i) => v === y[i]);
  return eq(arr, asc) || eq(arr, desc);
}

for (const orderGameId of ["ascending-order", "descending-order"]) {
  const descending = orderGameId === "descending-order";
  const skill = descending ? "descending_order" : "ascending_order";
  const seenSets = new Set();

  for (const [tier, [min, max]] of Object.entries(orderingDomains)) {
    let made = 0;
    let guard = 0;
    while (made < ORDER_PICK[tier] && guard < 20000) {
      guard++;
      const four = pickFourDistinct(min, max);
      const key = [...four].sort((a, b) => a - b).join(",");
      if (seenSets.has(key)) continue;

      let shown = shuffle(four);
      let attempts = 0;
      while (isMonotonic(shown) && attempts < 10) {
        shown = shuffle(four);
        attempts++;
      }
      if (isMonotonic(shown)) continue; // نادر جدًا (٢ من ٢٤ احتمالًا) — تُهمَل هذه الجولة

      seenSets.add(key);
      made++;

      const target = [...four].sort((a, b) => (descending ? b - a : a - b));
      const reversed = [...target].reverse();
      const swapFirstTwo = [target[1], target[0], target[2], target[3]];
      const swapMiddleTwo = [target[0], target[2], target[1], target[3]];
      const variants = shuffle([target, reversed, swapFirstTwo, swapMiddleTwo]).map((v) => v.join(", "));

      rows.push({
        game_id: orderGameId,
        skill,
        difficulty: tier,
        question_text: `رتّب الأعداد التالية ${descending ? "تنازليًا" : "تصاعديًا"}: ${shown.join(", ")}`,
        operand_a: shown[0],
        operand_b: null,
        operator: descending ? "order_desc" : "order_asc",
        correct_answer: target.join(", "),
        options: variants,
        visual: { kind: "chips", numbers: shown },
      });
    }
  }
}

// -----------------------------------------------------------------------------
// المقارنة — عددان من نفس عدد الخانات (لا خلط بين خانة وخانتين): سهل = خانة
// واحدة، متوسط = خانتان، صعب = ثلاث خانات — نفس مستويات بقية الألعاب. المزيج
// نفسه المستخدم في «اختبر» (دالة quiz_make_question): ٣٥٪ نفس الأرقام بترتيب
// مختلف (٤٥ و٥٤) لعددين فأكثر من الخانات، ٢٠٪ عددان متساويان، والباقي عشوائي
// مختلف. الخيارات الأربعة ثابتة دائمًا: < > = ولا يمكن المقارنة (وهذا الأخير
// خاطئ دومًا — عددان حقيقيان قابلان للمقارنة دائمًا).
// -----------------------------------------------------------------------------
const comparisonDomains = { easy: [1, 9], medium: [10, 99], hard: [100, 999] };
const COMPARE_PICK = { easy: 36, medium: 48, hard: 48 };
const COMPARE_OPTIONS = ["<", ">", "=", "لا يمكن المقارنة"];

for (const [tier, [min, max]] of Object.entries(comparisonDomains)) {
  const seen = new Set();
  let made = 0;
  let guard = 0;
  while (made < COMPARE_PICK[tier] && guard < 20000) {
    guard++;
    const a = randInt(min, max);
    const roll = rand();
    let b;
    if (tier !== "easy" && roll < 0.35) {
      // نفس الأرقام بترتيب مختلف (خانتان مبدَّلتان) — يختبر انتباهًا للمنزلة لا للأرقام نفسها.
      const digs = String(a).split("").map(Number);
      let i = randInt(0, digs.length - 1);
      let j = randInt(0, digs.length - 1);
      let tries = 0;
      while (i === j && tries < 10) {
        j = randInt(0, digs.length - 1);
        tries++;
      }
      const swapped = [...digs];
      [swapped[i], swapped[j]] = [swapped[j], swapped[i]];
      if (swapped[0] === 0) continue; // صفر بادئ غير صالح
      b = Number(swapped.join(""));
      if (b === a) continue; // الخانتان المُبدَّلتان متطابقتان أصلًا
    } else if (roll < 0.55) {
      b = a;
    } else {
      b = randInt(min, max);
      if (b === a) continue;
    }

    const key = `${a}|${b}`;
    if (seen.has(key)) continue;
    seen.add(key);
    made++;

    const sign = a < b ? "<" : a > b ? ">" : "=";
    rows.push({
      game_id: "comparison",
      skill: "comparison",
      difficulty: tier,
      question_text: `أي العلامات تجعل المقارنة صحيحة؟ ${a} ⬜ ${b}`,
      operand_a: a,
      operand_b: b,
      operator: "compare",
      correct_answer: sign,
      options: COMPARE_OPTIONS,
      visual: { kind: "compare", first: a, second: b },
    });
  }
}

// -----------------------------------------------------------------------------
// العدد الزوجي والفردي — عدد واحد: سهل = خانة واحدة (١–٩، والمجال كلّه ٩ أعداد
// فقط فهو أصغر من ٣٦ بالضرورة — كما في سهل «الضعف» تمامًا)، متوسط = خانتان،
// صعب = ثلاث خانات. خياران فقط (زوجي/فردي) — طبيعة السؤال نفسها في «اختبر».
// -----------------------------------------------------------------------------
const evenOddDomains = { easy: [1, 9], medium: [10, 99], hard: [100, 999] };
const EVEN_ODD_PICK = { easy: 9, medium: 48, hard: 48 };
const EVEN_ODD_OPTIONS = ["زوجي", "فردي"];

for (const [tier, [min, max]] of Object.entries(evenOddDomains)) {
  const seen = new Set();
  let made = 0;
  let guard = 0;
  while (made < EVEN_ODD_PICK[tier] && guard < 20000) {
    guard++;
    const n = randInt(min, max);
    if (seen.has(n)) continue;
    seen.add(n);
    made++;

    const isEven = n % 2 === 0;
    rows.push({
      game_id: "even-odd",
      skill: "even_odd",
      difficulty: tier,
      question_text: `العدد ${n} هو عدد؟`,
      operand_a: n,
      operand_b: null,
      operator: "even_odd",
      correct_answer: isEven ? "زوجي" : "فردي",
      options: EVEN_ODD_OPTIONS,
      visual: { kind: "number", value: n },
    });
  }
}

// ---- SQL --------------------------------------------------------------------
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const line = (r) =>
  `  (${q(r.game_id)}, ${q(r.skill)}, ${q(r.difficulty)}, ${q(r.question_text)}, ${r.operand_a}, ${r.operand_b === null ? "null" : r.operand_b}, ${q(r.operator)}, ` +
  `${q(r.correct_answer)}, ${q(JSON.stringify(r.options))}::jsonb, ${q(JSON.stringify(r.visual))}::jsonb)`;

const sql = `-- ============================================================================
-- بنك أسئلة «ألعب» — الجمع، الطرح، التقريب، الضعف، الترتيب التصاعدي والتنازلي،
-- المقارنة، والزوجي والفردي (الثماني مهارات كاملة، نفس مهارات «اختبر»/«اكتشف»)
-- ملف مُولَّد آليًا: node scripts/generate-game-bank.mjs  (لا تعدّليه يدويًا)
-- ${rows.length} سؤالًا؛ كل الأسئلة مضمونة رياضيًا بالبناء (بلا حمل/بلا استلاف،
-- تقريب وضعف وترتيب ومقارنة وزوجي/فردي محسوبة بنفس القاعدة التي يتحقق منها قيد
-- قاعدة البيانات) ومفحوصة بـ scripts/verify-game-bank.mjs ثم بـ
-- supabase/game_smoke_test.sql. يتطلّب تشغيل supabase/phase4-ordering-games.sql
-- وsupabase/phase5-compare-evenodd-games.sql قبل هذا الملف على أي قاعدة لم
-- تتضمّن هذه الألعاب بعد (يضيفان القيم والقيود اللازمة لها).
-- آمن للتشغيل أكثر من مرة (on conflict do nothing).
-- ============================================================================
insert into public.game_questions
  (game_id, skill, difficulty, question_text, operand_a, operand_b, operator, correct_answer, options, visual)
values
${rows.map(line).join(",\n")}
on conflict (game_id, question_text) do nothing;
`;

writeFileSync(OUT_SQL, sql, "utf8");
if (OUT_JSON) writeFileSync(OUT_JSON, JSON.stringify(rows), "utf8");
const count = (id, t) => rows.filter((r) => r.game_id === id && r.difficulty === t).length;
console.log(`تم: ${rows.length} سؤالًا → ${OUT_SQL}`);
for (const id of [...Object.keys(PICK), "ascending-order", "descending-order", "comparison", "even-odd"])
  console.log(`  ${id}: easy=${count(id, "easy")} medium=${count(id, "medium")} hard=${count(id, "hard")}`);
