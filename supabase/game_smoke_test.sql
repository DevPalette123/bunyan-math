-- ============================================================================
-- اختبار سريع لألعاب «ألعب» — شغّليه في Supabase → SQL Editor بعد تشغيل
-- phase3-play-games.sql ثم phase4-ordering-games.sql ثم
-- phase5-compare-evenodd-games.sql ثم game_bank.sql (أو schema.sql كاملًا).
-- لا يكتب أي بيانات.
--
-- كل استعلام يعرض عدد المخالفات؛ المتوقع أن تكون كلها 0. الأخير فحص حماية،
-- والمتوقع فيه false في كل خانة.
-- ============================================================================

-- ١) حجم البنك حسب اللعبة والمستوى
-- المتوقع: كل الألعاب ٣٦/٤٨/٤٨، ما عدا doubling (٩/٤٠/٤٨) وeven-odd (٩/٤٨/٤٨).
select game_id, difficulty, count(*) as questions
from public.game_questions
group by game_id, difficulty
order by game_id, difficulty;

-- ٢) الجمع بدون حمل: أي صف فيه حمل أو إجابة خاطئة  (المتوقع 0)
select count(*) as addition_violations
from public.game_questions
where game_id = 'addition'
  and (   operator <> '+'
       or skill <> 'addition_no_carry'
       or operand_b is null
       or (operand_a % 10) + (operand_b % 10) > 9
       or (operand_a / 10) + (operand_b / 10) > 9
       or correct_answer <> (operand_a + operand_b)::text
       or question_text <> operand_a || ' + ' || operand_b || ' = ؟');

-- ٣) الطرح بدون استلاف: أي صف فيه استلاف أو ناتج غير موجب أو إجابة خاطئة  (المتوقع 0)
select count(*) as subtraction_violations
from public.game_questions
where game_id = 'subtraction'
  and (   operator <> '-'
       or skill <> 'subtraction_no_borrow'
       or operand_b is null
       or (operand_a % 10) < (operand_b % 10)
       or (operand_a / 10) < (operand_b / 10)
       or operand_a <= operand_b
       or correct_answer <> (operand_a - operand_b)::text
       or question_text <> operand_a || ' - ' || operand_b || ' = ؟');

-- ٤) التقريب: عدد أصلًا مضاعف لوحدته، أو إجابة خاطئة، أو وحدة خارج {١٠،١٠٠}  (المتوقع 0)
select count(*) as rounding_violations
from public.game_questions
where game_id = 'rounding'
  and (   operator <> 'round'
       or skill <> 'rounding'
       or operand_b not in (10, 100)
       or operand_a % operand_b = 0
       or correct_answer <> (
            case when operand_a % operand_b >= operand_b / 2
                 then (operand_a / operand_b + 1) * operand_b
                 else (operand_a / operand_b) * operand_b
            end
          )::text);

-- ٥) الضعف: operand_b غير فارغ، أو إجابة خاطئة  (المتوقع 0)
select count(*) as doubling_violations
from public.game_questions
where game_id = 'doubling'
  and (   operator <> 'double'
       or skill <> 'doubling'
       or operand_b is not null
       or correct_answer <> (operand_a * 2)::text);

-- ٦) الخيارات: أربعة مختلفة (اثنان فقط للزوجي/الفردي) تحوي الإجابة الصحيحة،
-- لكل الألعاب  (المتوقع 0)
select count(*) as options_violations
from public.game_questions q
where jsonb_array_length(q.options) <> (case when q.operator = 'even_odd' then 2 else 4 end)
   or (select count(distinct o) from jsonb_array_elements_text(q.options) as o)
       <> (case when q.operator = 'even_odd' then 2 else 4 end)
   or not (q.options ? q.correct_answer);

-- ٦ب) الترتيب التصاعدي/التنازلي: أربعة أعداد مختلفة، وإجابة تطابق ترتيبها الفعلي  (المتوقع 0)
select count(*) as ordering_violations
from public.game_questions q
where q.operator in ('order_asc', 'order_desc')
  and (   q.operand_b is not null
       or q.skill <> (case when q.operator = 'order_desc' then 'descending_order' else 'ascending_order' end)
       or jsonb_typeof(q.visual -> 'numbers') <> 'array'
       or jsonb_array_length(q.visual -> 'numbers') <> 4
       or public.jsonb_text_array_distinct_count(q.visual -> 'numbers') <> 4
       or q.correct_answer <> public.game_order_correct_answer(q.visual -> 'numbers', q.operator = 'order_desc'));

-- ٦ج) المقارنة: علامة المقارنة تطابق العددين فعليًا  (المتوقع 0)
select count(*) as comparison_violations
from public.game_questions q
where q.operator = 'compare'
  and (   q.skill <> 'comparison'
       or q.operand_b is null
       or q.correct_answer <> (case when q.operand_a < q.operand_b then '<'
                                     when q.operand_a > q.operand_b then '>'
                                     else '=' end));

-- ٦د) الزوجي والفردي: الإجابة تطابق زوجية العدد فعليًا  (المتوقع 0)
select count(*) as even_odd_violations
from public.game_questions q
where q.operator = 'even_odd'
  and (   q.skill <> 'even_odd'
       or q.operand_b is not null
       or q.correct_answer <> (case when q.operand_a % 2 = 0 then 'زوجي' else 'فردي' end));

-- ٧) كتالوج الألعاب: ثماني ألعاب مفعّلة، والمكافأة مفعّلة للجميع بلا حد أدنى
-- (المتوقع: ٨ صفوف، reward_enabled = true، reward_min_percentage = ٠)
select id, title, skill, reward_enabled, reward_min_percentage, enabled
from public.play_games
order by id;

-- ٨) الحماية — المتوقع: false / false / false / false
select
  has_table_privilege('authenticated', 'public.game_questions', 'select')                           as student_can_read_bank,
  has_column_privilege('authenticated', 'public.game_attempt_questions', 'answer_key', 'select')    as student_can_read_answer_key,
  has_table_privilege('authenticated', 'public.game_attempts', 'insert')                            as student_can_insert_attempt,
  has_function_privilege('anon', 'public.start_game_attempt(text)', 'execute')                      as anon_can_start;
