-- ============================================================================
-- اختبارات أمان وضع التدشين — شغّليها في SQL Editor بعد phase10 ووجود Slot واحد جاهز على الأقل
-- (يكفي أن تضغطي «تجربة المعلمة» مرة، أو تستدعي demo-sweep لتجهيز المخزون).
--
-- كل شيء داخل معاملة تُلغى (ROLLBACK) في النهاية: لا يبقى أي أثر. تُرجع الجدول
-- النهائي: اسم الاختبار + PASS/FAIL. أي FAIL فأرسليه لي قبل التدشين.
-- تحاكي الهويات بإعداد request.jwt.claims وrole = authenticated/anon كما يفعل PostgREST.
-- ============================================================================
begin;

create temp table t_results (n serial, test text, ok boolean, detail text) on commit drop;
grant all on t_results to public;
grant usage, select on sequence t_results_n_seq to public;

create or replace function pg_temp.as_user(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  execute 'set local role authenticated';
end $$;

do $$
declare
  v_dteacher uuid; v_dstudent uuid; v_dclass uuid;
  v_dteacher2 uuid; v_dclass2 uuid;
  v_rstudent uuid; v_rteacher uuid;
  n integer; n2 integer; v_before bigint; v_after bigint;
begin
  select a.user_id, s.class_id into v_dteacher, v_dclass
    from demo_accounts a join demo_slots s on s.id = a.slot_id where a.role = 'teacher' order by s.created_at limit 1;
  select a.user_id into v_dstudent from demo_accounts a join demo_slots s on s.id = a.slot_id
    where a.role = 'student' and s.class_id = v_dclass limit 1;
  select a.user_id, s.class_id into v_dteacher2, v_dclass2
    from demo_accounts a join demo_slots s on s.id = a.slot_id
    where a.role = 'teacher' and a.user_id <> v_dteacher limit 1;
  select st.id into v_rstudent from students st where st.id not in (select user_id from demo_accounts) limit 1;
  select p.id into v_rteacher from profiles p where p.role = 'teacher' and p.id not in (select user_id from demo_accounts) limit 1;

  if v_dteacher is null then
    insert into t_results (test, ok, detail) values ('تجهيز: يوجد Slot تجريبي', false, 'لا Slot — شغّلي التجربة مرة أولًا');
    return;
  end if;

  -- 1) معلمة تجريبية تحاول الوصول لطالب حقيقي
  if v_rstudent is not null then
    perform pg_temp.as_user(v_dteacher);
    select count(*) into n from students where id = v_rstudent;
    select count(*) into n2 from profiles where id = v_rstudent;
    execute 'reset role';
    insert into t_results (test, ok, detail) values ('1) المعلمة التجريبية لا ترى طالبًا حقيقيًا', n = 0 and n2 = 0, format('students=%s profiles=%s', n, n2));
  else
    insert into t_results (test, ok, detail) values ('1) (تخطّي) لا يوجد طالب حقيقي في القاعدة للاختبار', true, 'تخطٍّ');
  end if;

  -- 1b) ولا ترى معلمة حقيقية
  if v_rteacher is not null then
    perform pg_temp.as_user(v_dteacher);
    select count(*) into n from profiles where id = v_rteacher;
    execute 'reset role';
    insert into t_results (test, ok, detail) values ('1b) المعلمة التجريبية لا ترى ملف معلمة حقيقية', n = 0, 'count=' || n);
  end if;

  -- 2) طالبة تجريبية تحاول قراءة بيانات المعلمة والزميلات
  perform pg_temp.as_user(v_dstudent);
  select count(*) into n from students where id <> v_dstudent;
  select count(*) into n2 from tasks where teacher_id = v_dteacher and false;
  execute 'reset role';
  insert into t_results (test, ok, detail) values ('2) الطالبة التجريبية لا ترى طالبات أخريات', n = 0, 'count=' || n);

  -- 2b) ولا تستطيع تنفيذ إدراج مباشر في tasks
  begin
    perform pg_temp.as_user(v_dstudent);
    insert into tasks (class_id, teacher_id, title) values (v_dclass, v_dteacher, 'x');
    execute 'reset role';
    insert into t_results (test, ok, detail) values ('2b) الطالبة لا تُنشئ مهام', false, 'نجح الإدراج!');
  exception when others then
    execute 'reset role';
    insert into t_results (test, ok, detail) values ('2b) الطالبة لا تُنشئ مهام', true, 'رُفض كما يجب');
  end;

  -- 5/6) لعب/نجوم الطالبة التجريبية لا تمس مجموع نجوم أي طالب حقيقي
  select coalesce(sum(stars), 0) into v_before from students where id not in (select user_id from demo_accounts);
  perform pg_temp.as_user(v_dstudent);
  perform public.complete_lesson('zz-test-lesson');
  execute 'reset role';
  select coalesce(sum(stars), 0) into v_after from students where id not in (select user_id from demo_accounts);
  insert into t_results (test, ok, detail) values ('5/6) نجمة الطالبة التجريبية لا تصل لأي طالب حقيقي', v_before = v_after, format('قبل=%s بعد=%s', v_before, v_after));

  -- 7) المعلمة التجريبية ترى نتائج صفها التجريبي فقط
  perform pg_temp.as_user(v_dteacher);
  select count(*) into n from quiz_attempts;
  execute 'reset role';
  select count(*) into n2 from quiz_attempts where student_id in (select id from students where class_id = v_dclass);
  insert into t_results (test, ok, detail) values ('7) المعلمة التجريبية ترى نتائج صفها فقط', n = n2, format('ترى=%s صفها=%s', n, n2));

  -- 8) عزل المسابقات بين معلمتين تجريبيتين
  if v_dteacher2 is not null then
    insert into competitions (id, teacher_id, title) values ('00000000-0000-0000-0000-00000000c0de', v_dteacher2, 'اختبار عزل');
    perform pg_temp.as_user(v_dteacher);
    select count(*) into n from competitions where id = '00000000-0000-0000-0000-00000000c0de';
    execute 'reset role';
    insert into t_results (test, ok, detail) values ('8) معلمة تجريبية لا ترى مسابقة معلمة تجريبية أخرى', n = 0, 'count=' || n);
  else
    insert into t_results (test, ok, detail) values ('8) (تخطّي) يلزم Slotان لاختبار العزل بين المعلمات', true, 'تخطٍّ — شغّلي التجربة من متصفحين ثم أعيدي');
  end if;

  -- 9) المتصفح لا يصل لجداول التجربة ولا لدوال الخادم
  begin
    perform pg_temp.as_user(v_dteacher);
    perform count(*) from demo_accounts;
    execute 'reset role';
    insert into t_results (test, ok, detail) values ('9a) المصادَق لا يقرأ demo_accounts', false, 'قرأها!');
  exception when others then
    execute 'reset role';
    insert into t_results (test, ok, detail) values ('9a) المصادَق لا يقرأ demo_accounts', true, 'رُفض');
  end;
  begin
    perform pg_temp.as_user(v_dteacher);
    perform public.demo_seed_slot(v_dteacher, v_dclass, '[]'::jsonb);
    execute 'reset role';
    insert into t_results (test, ok, detail) values ('9b) المصادَق لا ينفذ demo_seed_slot', false, 'نُفّذت!');
  exception when others then
    execute 'reset role';
    insert into t_results (test, ok, detail) values ('9b) المصادَق لا ينفذ demo_seed_slot', true, 'رُفض');
  end;
  begin
    execute 'set local role anon';
    perform count(*) from demo_slots;
    execute 'reset role';
    insert into t_results (test, ok, detail) values ('9c) الزائر (anon) لا يقرأ demo_slots', false, 'قرأها!');
  exception when others then
    execute 'reset role';
    insert into t_results (test, ok, detail) values ('9c) الزائر (anon) لا يقرأ demo_slots', true, 'رُفض');
  end;

  -- 10) مسابقة منشورة لمعلمة تجريبية: الزائر يقرأ العامة فقط ولا يرى الإجابات الصحيحة
  -- (يُختبر في الواجهة: افتحي رابطًا عامًا وتأكدي أن get_public_competition لا تُرجع is_correct)
end $$;

select n, test, case when ok then 'PASS' else 'FAIL' end as result, detail from t_results order by n;
rollback;
