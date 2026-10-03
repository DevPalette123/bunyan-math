-- ============================================================================
-- اختبار سريع لقسم «اختبر» — شغّليه في Supabase → SQL Editor بعد تشغيل
-- phase2-quiz-and-stars.sql (أو schema.sql). لا يكتب أي بيانات في جداولك.
--
-- الجزء ١: يولّد ٤٠٠٠ سؤال (٥٠٠ من كل مهارة) ويتحقق من: عدم وجود رفع/استلاف، صحة
--          الإجابة، أن الخيارات مختلفة وتحوي الإجابة، وأن الأرقام في نطاق «اكتشف».
--          عند أي خلل يتوقف برسالة واضحة؛ وعند النجاح يطبع NOTICE بعدد الأسئلة.
-- الجزء ٢: يتأكد أن المتصفح (دور authenticated) لا يستطيع قراءة answer_key ولا
--          استدعاء دوال التوليد الداخلية. النتيجة المتوقعة: false و false و false.
-- ============================================================================

do $$
declare
  v_skills text[] := array[
    'addition_no_carry', 'subtraction_no_borrow', 'rounding', 'doubling',
    'ascending_order', 'descending_order', 'comparison', 'even_odd'
  ];
  v_skill text;
  v_i integer;
  v_q record;
  v_nums integer[];
  v_opts text[];
  v_sorted text;
  v_a integer;
  v_b integer;
  v_checked integer := 0;
begin
  for v_i in 1..500 loop
    foreach v_skill in array v_skills loop
      select * into v_q from public.quiz_make_question(v_skill);

      select array_agg(x) into v_opts from jsonb_array_elements_text(v_q.o_options) as x;

      if array_length(v_opts, 1) <> (case when v_skill = 'even_odd' then 2 else 4 end) then
        raise exception '[%] عدد الخيارات خاطئ: %', v_skill, v_q.o_options;
      end if;
      if (select count(distinct o) from unnest(v_opts) as o) <> array_length(v_opts, 1) then
        raise exception '[%] خيارات مكررة: %', v_skill, v_q.o_options;
      end if;
      if not (v_q.o_answer = any(v_opts)) then
        raise exception '[%] الإجابة الصحيحة ليست ضمن الخيارات: % / %', v_skill, v_q.o_text, v_q.o_options;
      end if;
      if v_q.o_visual ->> 'kind' is null or coalesce(v_q.o_prompt, '') = '' then
        raise exception '[%] visual أو prompt فارغ', v_skill;
      end if;

      select array_agg((t.m)[1]::integer) into v_nums
      from regexp_matches(v_q.o_text, '\d+', 'g') as t(m);
      v_a := v_nums[1];
      v_b := v_nums[2];

      if v_skill = 'addition_no_carry' then
        if v_a % 10 + v_b % 10 > 9 or v_a / 10 + v_b / 10 > 9 then
          raise exception 'رفع في الجمع: % + %', v_a, v_b;
        end if;
        if v_a < 10 or v_b < 10 or v_q.o_answer::integer <> v_a + v_b then
          raise exception 'جمع خاطئ: %', v_q.o_text;
        end if;
      elsif v_skill = 'subtraction_no_borrow' then
        if v_a % 10 < v_b % 10 or v_a / 10 < v_b / 10 then
          raise exception 'استلاف في الطرح: % - %', v_a, v_b;
        end if;
        if v_a - v_b <= 0 or v_q.o_answer::integer <> v_a - v_b then
          raise exception 'طرح خاطئ: %', v_q.o_text;
        end if;
      elsif v_skill = 'rounding' then
        if v_a % 10 = 0
           or v_q.o_answer::integer % 10 <> 0
           or abs(v_a - v_q.o_answer::integer) > 5
           or (v_a % 10 >= 5 and v_q.o_answer::integer <> v_a - v_a % 10 + 10)
           or (v_a % 10 < 5 and v_q.o_answer::integer <> v_a - v_a % 10) then
          raise exception 'تقريب خاطئ: % -> %', v_q.o_text, v_q.o_answer;
        end if;
      elsif v_skill = 'doubling' then
        if v_a not between 6 and 15 or v_q.o_answer::integer <> v_a * 2 then
          raise exception 'ضعف خاطئ: % -> %', v_q.o_text, v_q.o_answer;
        end if;
      elsif v_skill in ('ascending_order', 'descending_order') then
        if array_length(v_nums, 1) <> 4 or (select count(distinct n) from unnest(v_nums) as n) <> 4 then
          raise exception 'ترتيب: ليست أربعة أعداد مختلفة: %', v_q.o_text;
        end if;
        select string_agg(n::text, ', ' order by case when v_skill = 'ascending_order' then n else -n end)
          into v_sorted from unnest(v_nums) as n;
        if v_sorted <> v_q.o_answer then
          raise exception 'ترتيب خاطئ: % -> %', v_q.o_text, v_q.o_answer;
        end if;
      elsif v_skill = 'comparison' then
        if v_q.o_answer <> case when v_a < v_b then '<' when v_a > v_b then '>' else '=' end then
          raise exception 'مقارنة خاطئة: % -> %', v_q.o_text, v_q.o_answer;
        end if;
      elsif v_skill = 'even_odd' then
        if v_q.o_answer <> case when v_a % 2 = 0 then 'زوجي' else 'فردي' end then
          raise exception 'زوجي/فردي خاطئ: % -> %', v_q.o_text, v_q.o_answer;
        end if;
      end if;

      v_checked := v_checked + 1;
    end loop;
  end loop;

  raise notice 'نجح الاختبار: تم فحص % سؤالًا بلا أي خطأ', v_checked;
end;
$$;

-- الجزء ٢ — الحماية (المتوقع: false / false / false)
select
  has_column_privilege('authenticated', 'public.quiz_attempt_questions', 'answer_key', 'select') as can_read_answer_key,
  has_function_privilege('authenticated', 'public.quiz_make_question(text)', 'execute')           as can_run_generator,
  has_function_privilege('anon', 'public.start_quiz_attempt()', 'execute')                         as anon_can_start;
