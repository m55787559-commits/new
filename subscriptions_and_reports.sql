-- ========================================
-- Manual subscriptions + Admin reports (Supabase friendly)
-- Requires prior functions from packages_workflow.sql
-- ========================================

-- View: map each user to latest active package (can be null -> free)
drop view if exists v_user_active_package cascade;
create or replace view v_user_active_package as
with users as (
  select distinct user_id from providers where user_id is not null
  union
  select distinct user_id from payments where user_id is not null
)
select 
  u.user_id,
  pkg.id as package_id,
  pkg.name as package_name,
  pay.completed_at as started_at,
  (pay.completed_at + make_interval(days => coalesce(pkg.duration_days, 0))) as expires_at,
  (now() <= (pay.completed_at + make_interval(days => coalesce(pkg.duration_days, 0)))) as is_active
from users u
left join lateral get_latest_active_payment(u.user_id) pay on true
left join packages pkg on pkg.id = pay.package_id;

-- Admin: create manual subscription (insert a completed payment)
drop function if exists admin_create_manual_subscription(uuid, bigint, numeric);
create or replace function admin_create_manual_subscription(
  p_user_id uuid,
  p_package_id bigint,
  p_amount numeric
)
returns bigint as $$
declare
  v_is_admin boolean;
  v_price numeric;
  v_id bigint;
begin
  select exists(select 1 from user_profiles where id = auth.uid() and role in ('admin','owner')) into v_is_admin;
  if not coalesce(v_is_admin, false) then
    raise exception 'forbidden: admin only';
  end if;

  select price into v_price from packages where id = p_package_id;
  if v_price is null then
    raise exception 'unknown package id %', p_package_id;
  end if;

  insert into payments(user_id, package_id, status, completed_at, amount)
  values (p_user_id, p_package_id, 'completed', now(), coalesce(p_amount, v_price))
  returning id into v_id;

  return v_id;
end;
$$ language plpgsql security definer;

-- Admin report: counts by provider status
drop function if exists get_provider_status_counts();
create or replace function get_provider_status_counts()
returns table (
  pending_count bigint,
  active_count bigint
) as $$
begin
  return query
  select
    (select count(*) from providers where coalesce(status, 'pending') = 'pending') as pending_count,
    (select count(*) from providers where status = 'active') as active_count;
end;
$$ language plpgsql security definer;

-- Admin report: providers per active package (null -> free)
drop function if exists get_providers_per_package();
create or replace function get_providers_per_package()
returns table (
  package_name text,
  providers_count bigint
) as $$
begin
  return query
  select
    coalesce(v.package_name, 'free') as package_name,
    count(*) as providers_count
  from providers p
  left join v_user_active_package v on v.user_id = p.user_id and v.is_active = true
  group by coalesce(v.package_name, 'free')
  order by providers_count desc;
end;
$$ language plpgsql security definer;

-- Optional combined quick stats
drop function if exists get_admin_site_stats();
create or replace function get_admin_site_stats()
returns table (
  total_providers bigint,
  pending_providers bigint,
  active_providers bigint,
  total_users bigint,
  total_payments_completed bigint
) as $$
begin
  return query
  select
    (select count(*) from providers) as total_providers,
    (select count(*) from providers where coalesce(status,'pending')='pending') as pending_providers,
    (select count(*) from providers where status='active') as active_providers,
    (select count(distinct user_id) from providers where user_id is not null) as total_users,
    (select count(*) from payments where status='completed') as total_payments_completed;
end;
$$ language plpgsql security definer;

-- View تلخيص المستخدمين مع باقتهم وعدد الأماكن والخدمات + البريد
DROP VIEW IF EXISTS v_user_summary CASCADE;
CREATE OR REPLACE VIEW v_user_summary AS
SELECT
  up.id AS user_id,
  up.full_name,
  up.role,
  up.email,         -- عرض البريد الإلكتروني
  v.package_id,
  v.package_name,
  v.started_at,
  v.expires_at,
  COALESCE((SELECT count(*) FROM providers p WHERE p.user_id = up.id),0) AS places_count,
  COALESCE((SELECT count(*) FROM services s JOIN providers p2 ON s.provider_id = p2.id WHERE p2.user_id = up.id),0) AS services_count
FROM user_profiles up
LEFT JOIN v_user_active_package v ON v.user_id = up.id;

-- وظيفة تعيد نفس بيانات الـ View مع البريد الإلكتروني
DROP FUNCTION IF EXISTS get_users_with_stats();
CREATE OR REPLACE FUNCTION get_users_with_stats()
RETURNS TABLE(
  user_id uuid,
  full_name text,
  role text,
  email text,
  package_name text,
  started_at timestamptz,
  expires_at timestamptz,
  places_count bigint,
  services_count bigint
)
AS $$
BEGIN
  RETURN QUERY
  SELECT
    up.id,
    up.full_name,
    up.role,
    up.email,
    v.package_name,
    v.started_at,
    v.expires_at,
    COALESCE((SELECT count(*) FROM providers p WHERE p.user_id = up.id),0),
    COALESCE((SELECT count(*) FROM services s JOIN providers p2 ON s.provider_id = p2.id WHERE p2.user_id = up.id),0)
  FROM user_profiles up
  LEFT JOIN v_user_active_package v ON v.user_id = up.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


