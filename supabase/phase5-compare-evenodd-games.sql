-- ============================================================================
-- المرحلة الخامسة — إضافة «مغامرة المقارنة» و«مغامرة الزوجي والفردي» إلى قسم
-- «ألعب»، فتكتمل بذلك الثماني مهارات كلها (نفس مهارات «اختبر» و«اكتشف») داخل
-- محرّك واحد عام (GamePage.tsx لا يعرف شيئًا عن أي مهارة بعينها).
--
-- نفس مستويات بقية الألعاب بالخانات: سهل = رقم واحد (١–٩)، متوسط = رقمان
-- (١٠–٩٩)، صعب = ثلاث أرقام (١٠٠–٩٩٩).
--
-- شغّلي هذا الملف مرة واحدة على قاعدتك (بعد phase4-ordering-games.sql)، ثم
-- supabase/game_bank.sql المُحدَّث (المُولَّد من node scripts/generate-game-bank.mjs،
-- ويتضمن الآن أسئلة المقارنة والزوجي/الفردي أيضًا). آمن للتشغيل أكثر من مرة
-- (create or replace / on conflict do nothing) ولا يحذف أي بيانات موجودة.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- (1) صفّا الكتالوج الجديدان.
-- ----------------------------------------------------------------------------
insert into public.play_games (id, title, skill) values
  ('comparison', 'مغامرة المقارنة', 'comparison'),
  ('even-odd', 'مغامرة الزوجي والفردي', 'even_odd')
on conflict (id) do nothing;


-- ----------------------------------------------------------------------------
-- (2) توسيع بنك الأسئلة: عمليتان جديدتان compare/even_odd، وتوسيع قيد الصحة
--     الرياضية ليشملهما.
--     • المقارنة: عددان (operand_a وoperand_b)، والإجابة الصحيحة > أو < أو =
--       بحسب مقارنتهما فعليًا. الخيارات الأربعة ثابتة: < > = ولا يمكن المقارنة.
--     • الزوجي والفردي: عدد واحد فقط (operand_b فارغ)، والإجابة "زوجي" إن كان
--       operand_a زوجيًا وإلا "فردي". خياران فقط، فلا بد من توسيع قيد "أربعة
--       خيارات دائمًا" ليسمح باثنين لهذه العملية تحديدًا.
-- ----------------------------------------------------------------------------
alter table public.game_questions drop constraint if exists game_questions_operator_check;
alter table public.game_questions add constraint game_questions_operator_check
  check (operator in ('+', '-', 'round', 'double', 'order_asc', 'order_desc', 'compare', 'even_odd'));

alter table public.game_questions drop constraint if exists game_questions_options_ok;
alter table public.game_questions add constraint game_questions_options_ok check (
  jsonb_typeof(options) = 'array'
  and jsonb_array_length(options) = (case when operator = 'even_odd' then 2 else 4 end)
  and options ? correct_answer
);

alter table public.game_questions drop constraint if exists game_questions_math_ok;
alter table public.game_questions add constraint game_questions_math_ok check (
    (operator = '+'
       and operand_b is not null
       and (operand_a % 10) + (operand_b % 10) <= 9
       and (operand_a / 10) + (operand_b / 10) <= 9
       and correct_answer = (operand_a + operand_b)::text)
    or
    (operator = '-'
       and operand_b is not null
       and (operand_a % 10) >= (operand_b % 10)
       and (operand_a / 10) >= (operand_b / 10)
       and operand_a > operand_b
       and correct_answer = (operand_a - operand_b)::text)
    or
    (operator = 'round'
       and operand_b in (10, 100)
       and operand_a % operand_b <> 0
       and correct_answer = (
             case when operand_a % operand_b >= operand_b / 2
                  then (operand_a / operand_b + 1) * operand_b
                  else (operand_a / operand_b) * operand_b
             end
           )::text)
    or
    (operator = 'double'
       and operand_b is null
       and correct_answer = (operand_a * 2)::text)
    or
    (operator in ('order_asc', 'order_desc')
       and operand_b is null
       and jsonb_typeof(visual -> 'numbers') = 'array'
       and jsonb_array_length(visual -> 'numbers') = 4
       and public.jsonb_text_array_distinct_count(visual -> 'numbers') = 4
       and correct_answer = public.game_order_correct_answer(visual -> 'numbers', operator = 'order_desc'))
    or
    -- المقارنة: عددان مختلفان أو متساويان، والإجابة علامة المقارنة الفعلية بينهما.
    (operator = 'compare'
       and operand_b is not null
       and correct_answer = (case when operand_a < operand_b then '<'
                                   when operand_a > operand_b then '>'
                                   else '=' end))
    or
    -- الزوجي والفردي: عدد واحد، والإجابة زوجيته الفعلية.
    (operator = 'even_odd'
       and operand_b is null
       and correct_answer = (case when operand_a % 2 = 0 then 'زوجي' else 'فردي' end))
  );


-- ----------------------------------------------------------------------------
-- (3) لا شيء آخر يحتاج تعديلًا: start_game_attempt / record_game_answer /
--     complete_game_attempt عامّة بالفعل، وترتيب الخيارات عشوائي لكل محاولة
--     تلقائيًا (shuffle_jsonb_array) — حتى مع خياري الزوجي/الفردي فقط.
-- ----------------------------------------------------------------------------
