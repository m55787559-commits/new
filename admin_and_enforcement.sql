-- ========================================
-- Admin utilities + Quota enforcement (Supabase ready)
-- ========================================

-- 1) Extend packages with quota and priority if missing
alter table if exists packages add column if not exists max_places integer default 1;
alter table if exists packages add column if not exists priority_weight integer default 0;

-- 2) Admin check helper (inline in functions using auth.uid())
-- We'll check admin role by querying user_profiles(id=auth.uid(), role='admin')

-- 3) Admin: set provider status (activate/suspend)
drop function if exists admin_set_provider_status(bigint, text);
create or replace function admin_set_provider_status(p_provider_id bigint, p_status text)
returns void as $$
declare
  v_is_admin boolean;
begin
  select exists(select 1 from user_profiles where id = auth.uid() and role in ('admin','owner')) into v_is_admin;
  if not coalesce(v_is_admin, false) then
    raise exception 'forbidden: admin only';
  end if;

  update providers set status = p_status, updated_at = now() where id = p_provider_id;
end;
$$ language plpgsql security definer;

-- 4) Admin: upsert package (insert or update)
drop function if exists admin_upsert_package(bigint, text, numeric, integer, boolean, text, integer, integer);
create or replace function admin_upsert_package(
  p_id bigint,
  p_name text,
  p_price numeric,
  p_duration_days integer,
  p_is_active boolean,
  p_description text,
  p_max_places integer,
  p_priority_weight integer
)
returns bigint as $$
declare
  v_is_admin boolean;
  v_id bigint;
begin
  select exists(select 1 from user_profiles where id = auth.uid() and role in ('admin','owner')) into v_is_admin;
  if not coalesce(v_is_admin, false) then
    raise exception 'forbidden: admin only';
  end if;

  if p_id is null then
    insert into packages(name, price, duration_days, is_active, description, max_places, priority_weight, created_at)
    values(p_name, p_price, p_duration_days, coalesce(p_is_active, true), p_description, coalesce(p_max_places,1), coalesce(p_priority_weight,0), now())
    returning id into v_id;
  else
    update packages
    set name = p_name,
        price = p_price,
        duration_days = p_duration_days,
        is_active = coalesce(p_is_active, is_active),
        description = p_description,
        max_places = coalesce(p_max_places, max_places),
        priority_weight = coalesce(p_priority_weight, priority_weight)
    where id = p_id
    returning id into v_id;
  end if;
  return v_id;
end;
$$ language plpgsql security definer;

-- Drop trigger first (if exists) to allow dropping function safely
drop trigger if exists trg_enforce_provider_quota on providers;

-- Now (re)create the function
drop function if exists enforce_provider_quota();
create or replace function enforce_provider_quota()
returns trigger as $$
declare
  v_allowed boolean;
  v_current int;
  v_max int;
  v_tier text;
begin
  -- if no user_id, allow (system insert)
  if new.user_id is null then
    return new;
  end if;

  select allowed, current_count, max_places, tier into v_allowed, v_current, v_max, v_tier
  from can_add_provider(new.user_id) limit 1;

  if not coalesce(v_allowed, true) then
    raise exception 'quota exceeded (%/% places) for tier %', v_current, v_max, v_tier;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_enforce_provider_quota
before insert on providers
for each row execute function enforce_provider_quota();

-- 6) Paginated providers RPC (status + ordering by priority)
drop function if exists get_providers_paginated(text, integer, integer);
create or replace function get_providers_paginated(
  p_status text default 'active',
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id bigint,
  name text,
  category text,
  city text,
  address text,
  phone text,
  website text,
  image_url text,
  description text,
  status text,
  priority numeric
) as $$
begin
  return query
  select
    p.id,
    p.name,
    p.category,
    p.city,
    p.address,
    p.phone,
    p.website,
    p.image_url,
    p.description,
    p.status,
    provider_priority(p.id) as priority
  from providers p
  where (p_status is null or coalesce(p.status,'pending') = p_status)
  order by provider_priority(p.id) desc, p.created_at desc
  limit greatest(1, p_limit) offset greatest(0, p_offset);
end;
$$ language plpgsql security definer;

-- 7) Admin: set user role
drop function if exists admin_set_user_role(uuid, text);
create or replace function admin_set_user_role(p_user_id uuid, p_role text)
returns void as $$
declare v_is_admin boolean; begin
  select exists(select 1 from user_profiles where id = auth.uid() and role = 'admin') into v_is_admin;
  if not coalesce(v_is_admin, false) then raise exception 'forbidden: admin only'; end if;
  update user_profiles set role = p_role where id = p_user_id;
end; $$ language plpgsql security definer;

-- 8) RLS policy to allow users to read their own profile (needed for admin checks in functions)
alter table if exists user_profiles enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'user_profiles' and policyname = 'user_can_select_own_profile'
  ) then
    create policy user_can_select_own_profile on public.user_profiles
      for select
      using (id = auth.uid());
  end if;
end $$;

-- 9) Admin: delete package
drop function if exists admin_delete_package(bigint);
create or replace function admin_delete_package(p_id bigint)
returns void as $$
declare v_is_admin boolean; begin
  select exists(select 1 from user_profiles where id = auth.uid() and role in ('admin','owner')) into v_is_admin;
  if not coalesce(v_is_admin, false) then raise exception 'forbidden: admin only'; end if;
  delete from packages where id = p_id;
end; $$ language plpgsql security definer;

-- 10) RLS for packages: allow admin/owner to SELECT all packages
alter table if exists packages enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'packages' and policyname = 'admin_can_select_packages'
  ) then
    create policy admin_can_select_packages on public.packages
      for select
      using (exists (
        select 1 from public.user_profiles up
        where up.id = auth.uid() and up.role in ('admin','owner')
      ));
  end if;
end $$;


