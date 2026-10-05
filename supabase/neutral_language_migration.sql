-- ============================================================================
-- تحويل نصوص المنصة المخزّنة في قاعدة البيانات إلى صيغة تناسب الطالب والطالبة معًا
-- (العب، اختر، أحسنت …). شغّليه مرة واحدة في Supabase ← SQL Editor. آمن للتكرار.
-- لا يغيّر أي بيانات للطلاب ولا نتائجهم؛ نصوص فقط.
-- ============================================================================

-- (1) أسئلة بنك الألعاب: «قرّبي العدد …» ← «قرّب العدد …» و«رتّبي الأعداد …» ← «رتّب الأعداد …»
update public.game_questions
   set question_text = replace(replace(question_text, 'قرّبي', 'قرّب'), 'رتّبي', 'رتّب')
 where question_text like '%قرّبي%' or question_text like '%رتّبي%';

-- (2) أسماء شارتين
update public.badges set name = 'بطل الألعاب الثمان' where code = 'game_master'      and name = 'بطلة الألعاب الثمان';
update public.badges set name = 'بطل التدريبات'       where code = 'practice_master'  and name = 'بطلة التدريبات';

-- (3) رسائل الأخطاء داخل دوال قاعدة البيانات (تظهر أحيانًا للمستخدم عند حدوث خطأ)
do $$
declare
  r record;
  def text;
begin
  for r in
    select p.oid
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prokind = 'f'
       and (   pg_get_functiondef(p.oid) like '%للطالبات فقط%'
            or pg_get_functiondef(p.oid) like '%أكملي كل الأسئلة%'
            or pg_get_functiondef(p.oid) like '%أكملي درس الجمع%')
  loop
    def := pg_get_functiondef(r.oid);
    def := replace(def, 'هذه الميزة للطالبات فقط', 'هذه الميزة للطلاب فقط');
    def := replace(def, 'أكملي كل الأسئلة أولًا', 'أكمل كل الأسئلة أولًا');
    def := replace(def, 'أكملي درس الجمع', 'أكمل درس الجمع');
    def := replace(def, 'ادخلي إلى «تعلّم» وأكملي درس الجمع', 'ادخل إلى «تعلّم» وأكمل درس الجمع');
    execute def;
  end loop;
end $$;
