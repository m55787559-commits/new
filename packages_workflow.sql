-- ========================================
-- Packages & Subscriptions workflow
-- Assumptions:
-- - Table packages(id, name, price, duration_days, is_active)
-- - Table payments(id, user_id, package_id, status, completed_at, amount)
-- - Column providers.user_id links place owner
-- - Column providers.package_id optional; not required for quota logic
-- ========================================

-- Helper: get latest successful payment for a user
drop function if exists get_latest_active_payment(uuid);
create or replace function get_latest_active_payment(p_user_id uuid)
returns table (
  payment_id bigint,
  package_id bigint,
  completed_at timestamptz,
  expires_at timestamptz
) as $$
begin
  return query
  select 
    pay.id as payment_id,
    pay.package_id,
    pay.completed_at,
    (pay.completed_at + make_interval(days => coalesce(pkg.duration_days, 0))) as expires_at
  from payments pay
  join packages pkg on pkg.id = pay.package_id and coalesce(pkg.is_active, true) = true
  where pay.user_id = p_user_id
    and pay.status = 'completed'
    and pay.completed_at is not null
  order by pay.completed_at desc
  limit 1;
end;
$$ language plpgsql security definer;

-- Returns user's active package info (if within duration)
drop function if exists get_user_package(uuid);
create or replace function get_user_package(p_user_id uuid)
returns table (
  package_id bigint,
  package_name text,
  duration_days integer,
  started_at timestamptz,
  expires_at timestamptz,
  is_active boolean
) as $$
declare
  v_latest record;
  v_pkg record;
begin
  select * into v_latest from get_latest_active_payment(p_user_id) limit 1;
  if not found then
    return query select null::bigint, null::text, null::int, null::timestamptz, null::timestamptz, false::boolean;
    return;
  end if;

  select * into v_pkg from packages where id = v_latest.package_id;

  return query
  select 
    v_pkg.id::bigint,
    v_pkg.name::text,
    v_pkg.duration_days::integer,
    v_latest.completed_at::timestamptz as started_at,
    v_latest.expires_at::timestamptz as expires_at,
    (now() <= v_latest.expires_at) as is_active;
end;
$$ language plpgsql security definer;

-- Define per-package quotas using packages table columns
drop function if exists get_user_place_quota(uuid);
create or replace function get_user_place_quota(p_user_id uuid)
returns table (
  max_places integer,
  tier text
) as $$
declare
  v_pkg record;
  v_row record;
begin
  select * into v_pkg from get_user_package(p_user_id) limit 1;
  if not found or v_pkg.is_active = false then
    return query select 1::integer as max_places, 'free'::text as tier;
    return;
  end if;

  select max_places, name into v_row from packages where id = v_pkg.package_id;
  if not found then
    return query select 1::integer, 'free'::text;
  end if;
  return query select coalesce(v_row.max_places, 1)::integer, coalesce(v_row.name, 'custom')::text;
end;
$$ language plpgsql security definer;

-- Check if user can add a new provider given quota
drop function if exists can_add_provider(uuid);
create or replace function can_add_provider(p_user_id uuid)
returns table (
  allowed boolean,
  current_count integer,
  max_places integer,
  tier text
) as $$
declare
  v_quota record;
  v_count int;
begin
  select * into v_quota from get_user_place_quota(p_user_id) limit 1;
  select count(*) into v_count from providers where user_id = p_user_id;
  return query select (v_count < v_quota.max_places) as allowed, v_count, v_quota.max_places, v_quota.tier;
end;
$$ language plpgsql security definer;

-- Compute provider priority for listing (higher first)
drop function if exists provider_priority(bigint);
create or replace function provider_priority(p_provider_id bigint)
returns numeric as $$
declare
  v_user uuid;
  v_created timestamptz;
  v_latest record;
  v_pkg record;
  v_weight int := 0;
  v_recency numeric := 0;
begin
  select user_id, created_at into v_user, v_created from providers where id = p_provider_id;
  if v_user is null then return 0; end if;

  select * into v_latest from get_latest_active_payment(v_user) limit 1;
  if found then
    select * into v_pkg from packages where id = v_latest.package_id;
    if found then v_weight := coalesce(v_pkg.priority_weight, 0); end if;
  end if;

  if v_created is not null then
    v_recency := greatest(0, 30 - extract(day from now() - v_created));
  end if;
  return v_weight + v_recency;
end;
$$ language plpgsql security definer;


