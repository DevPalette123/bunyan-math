-- ============================================================================
-- المرحلة الرابعة — إضافة «مغامرة الترتيب التصاعدي» و«مغامرة الترتيب التنازلي»
-- إلى قسم «ألعب»، بنفس محرّك الجمع/الطرح/التقريب/الضعف (GamePage.tsx عام، لا
-- يعرف شيئًا عن أي مهارة بعينها) وبنفس مستويات الخانات المستخدمة في «اختبر»
-- و«اكتشف»: سهل = رقم واحد (١–٩)، متوسط = رقمان (١٠–٩٩)، صعب = ثلاث أرقام
-- (١٠٠–٩٩٩).
--
-- شغّلي هذا الملف مرة واحدة على قاعدتك، ثم supabase/game_bank.sql (المُولَّد من
-- node scripts/generate-game-bank.mjs، ويتضمن الآن أسئلة الترتيب أيضًا).
-- آمن للتشغيل أكثر من مرة (create or replace / on conflict do nothing) ولا
-- يحذف ولا يعدّل أي بيانات موجودة.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- (1) صفّا الكتالوج الجديدان — نفس فلسفة المكافأة (مرة واحدة طوال العمر، عدد
--     النجوم = عدد الإجابات الصحيحة في أول محاولة مكتملة).
-- ----------------------------------------------------------------------------
insert into public.play_games (id, title, skill) values
  ('ascending-order', 'مغامرة الترتيب التصاعدي', 'ascending_order'),
  ('descending-order', 'مغامرة الترتيب التنازلي', 'descending_order')
on conflict (id) do nothing;


-- ----------------------------------------------------------------------------
-- (2) دالة تحسب الترتيب الصحيح (تصاعديًا أو تنازليًا) لأربعة أعداد داخل visual،
--     ليُستخدَم قيد game_questions_math_ok أدناه في التحقق من صحة الإجابة —
--     فلا يمكن لسؤال ترتيب خاطئ الإجابة أن يدخل البنك حتى لو أُضيف يدويًا لاحقًا،
--     تمامًا كما تفعل بقية القيود للجمع/الطرح/التقريب/الضعف.
-- ----------------------------------------------------------------------------
create or replace function public.game_order_correct_answer(p_numbers jsonb, p_descending boolean)
returns text
language sql
immutable
as $$
  select string_agg(x, ', ' order by (x::numeric) * case when p_descending then -1 else 1 end)
  from jsonb_array_elements_text(p_numbers) as x;
$$;

revoke all on function public.game_order_correct_answer(jsonb, boolean) from public, anon, authenticated;

-- عدد العناصر المختلفة في مصفوفة jsonb نصية — دالة منفصلة لأن قيود CHECK في
-- PostgreSQL لا تقبل استعلامات فرعية (subquery) مباشرة داخلها، فقط استدعاء دالة.
create or replace function public.jsonb_text_array_distinct_count(p_arr jsonb)
returns integer
language sql
immutable
as $$
  select count(distinct x) from jsonb_array_elements_text(p_arr) as x;
$$;

revoke all on function public.jsonb_text_array_distinct_count(jsonb) from public, anon, authenticated;


-- ----------------------------------------------------------------------------
-- (3) توسيع بنك الأسئلة: عمليتان جديدتان order_asc/order_desc، وتوسيع قيد
--     الصحة الرياضية ليشملهما — الإجابة الصحيحة يجب أن تطابق الترتيب الفعلي
--     للأعداد الأربعة المخزَّنة في visual->'numbers'، وإلا رفضت القاعدة الإدراج.
--     operand_b يبقى فارغًا هنا (كما في الضعف — لا مُعامل ثانيًا)، وoperand_a هو
--     أول عدد معروض فقط (بلا معنى حسابي، فقط لتحقيق NOT NULL على العمود).
-- ----------------------------------------------------------------------------
alter table public.game_questions drop constraint if exists game_questions_operator_check;
alter table public.game_questions add constraint game_questions_operator_check
  check (operator in ('+', '-', 'round', 'double', 'order_asc', 'order_desc'));

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
    -- الترتيب: أربعة أعداد مختلفة في visual->'numbers'، والإجابة الصحيحة هي
    -- ترتيبها الفعلي (تصاعديًا أو تنازليًا حسب العملية) — محسوبة هنا لا مُدخَلة يدويًا.
    (operator in ('order_asc', 'order_desc')
       and operand_b is null
       and jsonb_typeof(visual -> 'numbers') = 'array'
       and jsonb_array_length(visual -> 'numbers') = 4
       and public.jsonb_text_array_distinct_count(visual -> 'numbers') = 4
       and correct_answer = public.game_order_correct_answer(visual -> 'numbers', operator = 'order_desc'))
  );


-- ----------------------------------------------------------------------------
-- (4) لا شيء آخر يحتاج تعديلًا: start_game_attempt / record_game_answer /
--     complete_game_attempt عامّة بالفعل (لا تعرف شيئًا عن عملية بعينها)، وترتيب
--     الخيارات عشوائي لكل محاولة تلقائيًا (shuffle_jsonb_array) — فلا تكون
--     الإجابة الصحيحة دائمًا في نفس المكان، هنا كما في كل لعبة أخرى.
--     game_attempt_questions لا يفرض قائمة عمليات مسموحة (عمود operator نص حر)،
--     فلا حاجة لتعديله.
-- ----------------------------------------------------------------------------
