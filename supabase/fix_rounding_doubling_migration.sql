-- ============================================================================
-- إصلاح مستقل: إن كانت لديك جداول game_questions / game_attempt_questions من
-- تشغيل سابق (نسخة الجمع والطرح فقط، قبل التقريب والضعف)، فـ"create table if
-- not exists" في schema.sql لا يلمس جدولًا موجودًا بالفعل، فتبقى قيوده القديمة
-- (الأرقام حتى ٩٩ فقط، operand_b إلزاميًا، العمليات '+'/'-' فقط) تمنع إدخال
-- أسئلة التقريب والضعف — وهذا سبب رسالة «حاولي مرة أخرى» عند فتح هذه اللعبتين.
--
-- شغّلي هذا الملف وحده (أسرع من إعادة تشغيل schema.sql كاملًا)، ثم
-- game_bank.sql. آمن للتكرار ولا يحذف أي بيانات.
-- إن كانت هذه قاعدة جديدة كليًا: تجاهلي هذا الملف وشغّلي schema.sql مباشرة —
-- فهو يحتوي هذا الإصلاح بالفعل.
-- ============================================================================

alter table public.game_questions alter column operand_b drop not null;

alter table public.game_questions drop constraint if exists game_questions_operand_a_check;
alter table public.game_questions add constraint game_questions_operand_a_check
  check (operand_a between 1 and 999);

alter table public.game_questions drop constraint if exists game_questions_operand_b_check;
alter table public.game_questions add constraint game_questions_operand_b_check
  check (operand_b is null or operand_b between 1 and 999);

alter table public.game_questions drop constraint if exists game_questions_operator_check;
alter table public.game_questions add constraint game_questions_operator_check
  check (operator in ('+', '-', 'round', 'double'));

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
  );

alter table public.game_attempt_questions alter column operand_b drop not null;

-- تأكيد فوري: هل نجحت الترقية؟ (المتوقع: كل الخانات false أو 999، لا تُظهر خطأ)
select
  (select count(*) from information_schema.check_constraints
   where constraint_name = 'game_questions_operand_a_check') as has_new_constraint,
  (select is_nullable from information_schema.columns
   where table_name = 'game_questions' and column_name = 'operand_b') as operand_b_nullable;
