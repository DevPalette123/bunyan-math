#!/usr/bin/env node
// يفحص supabase/game_bank.sql صفًّا صفًّا، بمعزل عن المولّد (يقرأ نص SQL نفسه):
//   node scripts/verify-game-bank.mjs
// يخرج بكود 1 عند أي مخالفة.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const file = resolve(dirname(fileURLToPath(import.meta.url)), "../supabase/game_bank.sql");
const text = readFileSync(file, "utf8");

const ROW =
  /^\s+\('([\w-]+)', '(\w+)', '(\w+)', '([^']*)', (\d+), (null|\d+), '([a-z_+-]+)', '([^']*)', '(\[[^']*\])'::jsonb, '(\{.*\})'::jsonb\)[,]?$/;
const rows = [];
for (const raw of text.split("\n")) {
  if (!raw.trim().startsWith("('")) continue;
  const m = raw.match(ROW);
  if (!m) {
    console.log("سطر لا يطابق الصيغة:", raw);
    process.exit(1);
  }
  rows.push({
    game: m[1],
    skill: m[2],
    tier: m[3],
    text: m[4],
    a: +m[5],
    b: m[6] === "null" ? null : +m[6],
    op: m[7],
    ans: m[8],
    options: JSON.parse(m[9]),
    visual: JSON.parse(m[10]),
  });
}

let bad = 0;
const fail = (r, msg) => {
  bad++;
  if (bad <= 25) console.log("✗", msg, "|", r.game, "|", r.text);
};
const digits = (n) => [n % 10, Math.floor(n / 10)]; // [آحاد، عشرات] لأعداد حتى ٩٩
const isOneDigit = (n) => n < 10;

const seen = new Set();
const tally = {};

for (const r of rows) {
  const key = `${r.game}|${r.text}`;
  if (seen.has(key)) fail(r, "سؤال مكرر");
  seen.add(key);
  (tally[`${r.game}/${r.tier}`] ??= 0);
  tally[`${r.game}/${r.tier}`]++;

  // فحوصات عامة لكل الألعاب: أربعة خيارات مختلفة، كلها نصوص (لا أعداد JS خام —
  // JSON.stringify(79) و JSON.stringify("79") يبدوان متشابهين لعين الإنسان لكن
  // الواجهة تقارن بالمساواة الصارمة ("79" !== 79)، فأي رقم غير مُحوَّل إلى نص
  // يعطّل حفظ الإجابة في المتصفح فعليًا) وكلها أعداد موجبة، وتحوي الإجابة.
  const opts = r.options;
  const isOrderGame = r.op === "order_asc" || r.op === "order_desc";
  const isCompareGame = r.op === "compare";
  const isEvenOddGame = r.op === "even_odd";
  const expectedOptionCount = isEvenOddGame ? 2 : 4;
  if (opts.some((o) => typeof o !== "string")) fail(r, "خيار ليس نصًّا (رقم JS خام سيكسر المقارنة في الواجهة)");
  if (opts.length !== expectedOptionCount || new Set(opts).size !== expectedOptionCount)
    fail(r, `الخيارات ليست ${expectedOptionCount === 2 ? "اثنين" : "أربعة"} مختلفة`);
  if (!opts.includes(r.ans)) fail(r, "الإجابة الصحيحة ليست ضمن الخيارات");
  if (!isOrderGame && !isCompareGame && !isEvenOddGame && opts.some((o) => !/^[1-9]\d*$/.test(o)))
    fail(r, "خيار غير عددي أو غير موجب");
  if (isOrderGame && opts.some((o) => !/^\d+(, \d+){3}$/.test(o))) fail(r, "خيار ترتيب ليس أربعة أعداد مفصولة بفاصلة");
  if (isCompareGame) {
    const expected = ["<", ">", "=", "لا يمكن المقارنة"];
    if (expected.some((o) => !opts.includes(o)) || opts.some((o) => !expected.includes(o)))
      fail(r, "خيارات المقارنة ليست < > = ولا يمكن المقارنة بالضبط");
  }
  if (isEvenOddGame) {
    const expected = ["زوجي", "فردي"];
    if (expected.some((o) => !opts.includes(o)) || opts.some((o) => !expected.includes(o)))
      fail(r, "خيارات الزوجي/الفردي ليست زوجي وفردي بالضبط");
  }

  if (r.game === "addition" || r.game === "subtraction") {
    if (r.b === null) {
      fail(r, "operand_b فارغ لعملية ثنائية");
      continue;
    }
    const [ua, ta] = digits(r.a);
    const [ub, tb] = digits(r.b);
    const expectSkill = r.game === "addition" ? "addition_no_carry" : "subtraction_no_borrow";
    if (r.skill !== expectSkill) fail(r, "skill خاطئة");
    if (r.game === "addition" && r.op !== "+") fail(r, "عملية خاطئة");
    if (r.game === "subtraction" && r.op !== "-") fail(r, "عملية خاطئة");
    if (r.text !== `${r.a} ${r.op} ${r.b} = ؟`) fail(r, "نص السؤال لا يطابق العددين");
    if (r.a > 99 || r.b > 99 || r.a < 1 || r.b < 1) fail(r, "عدد خارج ١–٩٩");

    let truth;
    if (r.game === "addition") {
      if (ua + ub > 9) fail(r, "حمل في الآحاد");
      if (ta + tb > 9) fail(r, "حمل في العشرات");
      truth = r.a + r.b;
    } else {
      if (ua < ub) fail(r, "استلاف في الآحاد");
      if (ta < tb) fail(r, "استلاف في العشرات");
      truth = r.a - r.b;
      if (truth <= 0) fail(r, "ناتج الطرح غير موجب");
    }
    if (String(truth) !== r.ans) fail(r, `الإجابة خاطئة (الصحيحة ${truth})`);

    if (r.tier === "easy" && !(isOneDigit(r.a) && isOneDigit(r.b))) fail(r, "easy يجب أن يكون من خانة واحدة");
    if (r.tier === "medium" && !(r.a >= 10 && isOneDigit(r.b))) fail(r, "medium: خانتان + خانة");
    if (r.tier === "hard" && !(r.a >= 10 && r.b >= 10)) fail(r, "hard: خانتان + خانتان");

    const t = r.visual.tokens;
    if (r.visual.kind !== "expression" || t?.[0]?.value !== r.a || t?.[2]?.value !== r.b)
      fail(r, "visual لا يطابق السؤال");
  } else if (r.game === "rounding") {
    if (r.skill !== "rounding") fail(r, "skill خاطئة");
    if (r.op !== "round") fail(r, "عملية خاطئة");
    if (r.b !== 10 && r.b !== 100) fail(r, "وحدة التقريب يجب أن تكون ١٠ أو ١٠٠");
    if (r.a % r.b === 0) fail(r, "العدد أصلًا مضاعف لوحدة التقريب — سؤال بلا معنى");

    const lower = Math.floor(r.a / r.b) * r.b;
    const upper = lower + r.b;
    const truth = r.a - lower >= r.b / 2 ? upper : lower;
    if (String(truth) !== r.ans) fail(r, `الإجابة خاطئة (الصحيحة ${truth})`);

    const expectedText = `قرّبي العدد ${r.a} لأقرب ${r.b === 10 ? "عشرة" : "مئة"}`;
    if (r.text !== expectedText) fail(r, "نص السؤال لا يطابق العدد/الوحدة");

    if (r.tier === "easy" && !(r.a >= 10 && r.a <= 99 && r.b === 10)) fail(r, "easy: عدد من خانتين لأقرب عشرة");
    if (r.tier === "medium" && !(r.a >= 100 && r.a <= 999 && r.b === 10))
      fail(r, "medium: عدد من ثلاث خانات لأقرب عشرة");
    if (r.tier === "hard" && !(r.a >= 100 && r.a <= 999 && r.b === 100))
      fail(r, "hard: عدد من ثلاث خانات لأقرب مئة");

    const v = r.visual;
    if (v.kind !== "numberLine" || v.value !== r.a || v.unit !== r.b || v.lower !== lower || v.upper !== upper)
      fail(r, "visual (numberLine) لا يطابق السؤال");
  } else if (r.game === "doubling") {
    if (r.skill !== "doubling") fail(r, "skill خاطئة");
    if (r.op !== "double") fail(r, "عملية خاطئة");
    if (r.b !== null) fail(r, "operand_b يجب أن يكون فارغًا في الضعف");

    const truth = r.a * 2;
    if (String(truth) !== r.ans) fail(r, `الإجابة خاطئة (الصحيحة ${truth})`);

    const expectedText = `ضعف العدد ${r.a} = ؟`;
    if (r.text !== expectedText) fail(r, "نص السؤال لا يطابق العدد");

    if (r.tier === "easy" && !(r.a >= 1 && r.a <= 9)) fail(r, "easy: رقم واحد (١–٩)");
    if (r.tier === "medium" && !(r.a >= 10 && r.a <= 49)) fail(r, "medium: رقمان (١٠–٤٩)");
    if (r.tier === "hard" && !(r.a >= 100 && r.a <= 499)) fail(r, "hard: ثلاث أرقام (١٠٠–٤٩٩)");
    // «سهلة للأطفال»: الضعف لا يتجاوز عدد خانات المدخل (لا مفاجأة بخانة جديدة).
    if (String(truth).length > String(r.a).length + (r.a < 10 ? 1 : 0))
      fail(r, "الضعف تجاوز عدد الخانات المتوقّع لهذا المستوى");

    const v = r.visual;
    if (v.kind !== "doublingPods" || v.value !== r.a) fail(r, "visual (doublingPods) لا يطابق السؤال");
  } else if (r.game === "ascending-order" || r.game === "descending-order") {
    const descending = r.game === "descending-order";
    const expectSkill = descending ? "descending_order" : "ascending_order";
    const expectOp = descending ? "order_desc" : "order_asc";
    if (r.skill !== expectSkill) fail(r, "skill خاطئة");
    if (r.op !== expectOp) fail(r, "عملية خاطئة");
    if (r.b !== null) fail(r, "operand_b يجب أن يكون فارغًا في الترتيب");

    const v = r.visual;
    if (v.kind !== "chips" || !Array.isArray(v.numbers) || v.numbers.length !== 4) {
      fail(r, "visual (chips) لا يطابق السؤال");
    } else {
      const nums = v.numbers;
      if (new Set(nums).size !== 4) fail(r, "الأعداد الأربعة ليست مختلفة");
      if (nums[0] !== r.a) fail(r, "operand_a لا يطابق أول عدد معروض");

      const ascSorted = [...nums].sort((x, y) => x - y);
      const descSorted = [...ascSorted].reverse();
      const truth = (descending ? descSorted : ascSorted).join(", ");
      if (truth !== r.ans) fail(r, `الإجابة خاطئة (الصحيحة ${truth})`);

      const expectedText =
        `رتّبي الأعداد التالية ${descending ? "تنازليًا" : "تصاعديًا"}: ` + nums.join(", ");
      if (r.text !== expectedText) fail(r, "نص السؤال لا يطابق الأعداد المعروضة");

      const eq = (x, y) => x.every((val, i) => val === y[i]);
      if (eq(nums, ascSorted) || eq(nums, descSorted)) fail(r, "الأعداد المعروضة مرتّبة أصلًا (لا يصح كسؤال ترتيب)");

      for (const o of opts) {
        const parts = o.split(", ").map(Number);
        if (parts.length !== 4 || new Set(parts).size !== 4 || parts.some((p) => !nums.includes(p))) {
          fail(r, "خيار لا يحوي نفس الأعداد الأربعة المعروضة");
        }
      }

      if (r.tier === "easy" && !nums.every((n) => n >= 1 && n <= 9)) fail(r, "easy: أعداد من خانة واحدة (١–٩)");
      if (r.tier === "medium" && !nums.every((n) => n >= 10 && n <= 99)) fail(r, "medium: أعداد من خانتين (١٠–٩٩)");
      if (r.tier === "hard" && !nums.every((n) => n >= 100 && n <= 999)) fail(r, "hard: أعداد من ثلاث خانات (١٠٠–٩٩٩)");
    }
  } else if (r.game === "comparison") {
    if (r.skill !== "comparison") fail(r, "skill خاطئة");
    if (r.op !== "compare") fail(r, "عملية خاطئة");
    if (r.b === null) fail(r, "operand_b يجب ألّا يكون فارغًا في المقارنة");

    const v = r.visual;
    if (v.kind !== "compare" || v.first !== r.a || v.second !== r.b) fail(r, "visual (compare) لا يطابق السؤال");

    const truth = r.a < r.b ? "<" : r.a > r.b ? ">" : "=";
    if (truth !== r.ans) fail(r, `الإجابة خاطئة (الصحيحة ${truth})`);

    const expectedText = `أي العلامات تجعل المقارنة صحيحة؟ ${r.a} ⬜ ${r.b}`;
    if (r.text !== expectedText) fail(r, "نص السؤال لا يطابق العددين");

    const bound = r.tier === "easy" ? [1, 9] : r.tier === "medium" ? [10, 99] : [100, 999];
    if (r.a < bound[0] || r.a > bound[1] || r.b < bound[0] || r.b > bound[1]) {
      fail(r, `${r.tier}: العددان يجب أن يكونا ضمن ${bound[0]}–${bound[1]}`);
    }
  } else if (r.game === "even-odd") {
    if (r.skill !== "even_odd") fail(r, "skill خاطئة");
    if (r.op !== "even_odd") fail(r, "عملية خاطئة");
    if (r.b !== null) fail(r, "operand_b يجب أن يكون فارغًا في الزوجي والفردي");

    const v = r.visual;
    if (v.kind !== "number" || v.value !== r.a) fail(r, "visual (number) لا يطابق السؤال");

    const truth = r.a % 2 === 0 ? "زوجي" : "فردي";
    if (truth !== r.ans) fail(r, `الإجابة خاطئة (الصحيحة ${truth})`);

    const expectedText = `العدد ${r.a} هو عدد؟`;
    if (r.text !== expectedText) fail(r, "نص السؤال لا يطابق العدد");

    const bound = r.tier === "easy" ? [1, 9] : r.tier === "medium" ? [10, 99] : [100, 999];
    if (r.a < bound[0] || r.a > bound[1]) fail(r, `${r.tier}: العدد يجب أن يكون ضمن ${bound[0]}–${bound[1]}`);
  } else {
    fail(r, "معرّف لعبة غير معروف");
  }
}

// حجم البنك المتوقَّع لكل (لعبة، مستوى) — يطابق PICK في المولّد بالضبط.
const EXPECTED = {
  "addition/easy": 36, "addition/medium": 48, "addition/hard": 48,
  "subtraction/easy": 36, "subtraction/medium": 48, "subtraction/hard": 48,
  "rounding/easy": 36, "rounding/medium": 48, "rounding/hard": 48,
  "doubling/easy": 9, "doubling/medium": 40, "doubling/hard": 48,
  "ascending-order/easy": 36, "ascending-order/medium": 48, "ascending-order/hard": 48,
  "descending-order/easy": 36, "descending-order/medium": 48, "descending-order/hard": 48,
  "comparison/easy": 36, "comparison/medium": 48, "comparison/hard": 48,
  "even-odd/easy": 9, "even-odd/medium": 48, "even-odd/hard": 48,
};
for (const [key, expected] of Object.entries(EXPECTED)) {
  const n = tally[key] || 0;
  if (n !== expected) {
    bad++;
    console.log(`✗ ${key}: ${n} سؤالًا (المتوقع بالضبط ${expected})`);
  }
}
// وعلى الأقل ٣ أسئلة متاحة لكل مستوى (الحد الأدنى الذي تسحبه جولة لعب واحدة).
for (const [key, n] of Object.entries(tally)) {
  const need = key.endsWith("/medium") ? 4 : 3;
  if (n < need) {
    bad++;
    console.log(`✗ ${key}: ${n} سؤالًا فقط — أقل من احتياج الجولة الواحدة (${need})`);
  }
}

console.log(`فُحص ${rows.length} سؤالًا:`, JSON.stringify(tally));
console.log(bad === 0 ? "✓ كل الأسئلة سليمة رياضيًا (بلا حمل / بلا استلاف / تقريب وضعف صحيحان)" : `✗ ${bad} مخالفة`);
process.exit(bad === 0 ? 0 : 1);
