-- ========================================
-- زيارات: دوال التسجيل والإحصائيات + الصلاحيات
-- تعتمد على جدول visits الموجود في السكيمة
-- ========================================

-- 1) تسجيل زيارة وإرجاع إجمالي/يومي للصفحة
drop function if exists record_visit(text, text, text, text, text);

create or replace function record_visit(
  p_page text,
  p_ip text default null,
  p_device text default null,
  p_source text default null,
  p_country text default null
)
returns table(total_visits bigint, today_visits bigint)
language plpgsql
security definer
as $$
begin
  insert into visits(page, ip_address, device, source, country, created_at)
  values (p_page, p_ip, p_device, p_source, p_country, now());

  return query
  select
    count(*)::bigint as total_visits,
    count(*) filter (where created_at::date = now()::date)::bigint as today_visits
  from visits
  where page = p_page;
end;
$$;

-- 2) إحصائيات صفحة واحدة
drop function if exists get_page_visit_stats(text);

create or replace function get_page_visit_stats(p_page text)
returns table(total_visits bigint, today_visits bigint)
language sql
security definer
as $$
  with base as (
    select
      count(*)::bigint as total_visits,
      count(*) filter (where created_at::date = now()::date)::bigint as today_visits
    from visits
    where page = p_page
  )
  select total_visits, today_visits from base;
$$;

-- 3) إحصائيات لعدة صفحات (ترجع صفًا لكل صفحة حتى لو 0)
drop function if exists get_pages_visit_stats(text[]);

create or replace function get_pages_visit_stats(p_pages text[])
returns table(page text, total_visits bigint, today_visits bigint)
language sql
security definer
as $$
  select
    up.page,
    coalesce(count(v.id), 0)::bigint as total_visits,
    coalesce(count(v.id) filter (where v.created_at::date = now()::date), 0)::bigint as today_visits
  from unnest(p_pages) up(page)
  left join visits v
    on v.page = up.page
  group by up.page
  order by array_position(p_pages, up.page);
$$;

-- 4) إحصائيات عامة للموقع
drop function if exists get_site_visit_stats();

create or replace function get_site_visit_stats()
returns table(total_visits bigint, today_visits bigint)
language sql
security definer
as $$
  select
    count(*)::bigint as total_visits,
    count(*) filter (where created_at::date = now()::date)::bigint as today_visits
  from visits;
$$;

-- 5) الصلاحيات (حسب أدوارك في Supabase)
-- ملاحظة: فعّل RLS على visits وفق سياساتك، وهذه الدوال تعمل كـ SECURITY DEFINER
grant execute on function record_visit(text, text, text, text, text) to anon, authenticated;
grant execute on function get_page_visit_stats(text) to anon, authenticated;
grant execute on function get_pages_visit_stats(text[]) to anon, authenticated;
grant execute on function get_site_visit_stats() to anon, authenticated;


