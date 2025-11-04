-- ===============================
-- Online workflow: providers/services
-- ===============================

-- Update add_provider: add p_online flag -> providers.online_service
drop function if exists add_provider(
  text, text, text, text, text, text, text, text, text, text, numeric, numeric, text, boolean, text, uuid, bigint, bigint
);

create or replace function add_provider(
  p_name text,
  p_category text default null,
  p_city text default null,
  p_address text default null,
  p_phone text default null,
  p_website text default null,
  p_whatsapp text default null,
  p_map_url text default null,
  p_description text default null,
  p_image_url text default null,
  p_lat numeric default null,
  p_lng numeric default null,
  p_type text default null,
  p_delivery boolean default false,
  p_area text default null,
  p_user_id uuid default null,
  p_activity_id bigint default null,
  p_package_id bigint default null,
  p_online boolean default false
)
returns bigint as $$
declare
  v_id bigint;
begin
  insert into providers (
    name, category, city, address, phone, website, whatsapp, map_url, description,
    image_url, lat, lng, type, delivery, area, user_id, activity_id, package_id,
    status, created_at, online_service
  ) values (
    p_name, p_category, p_city, p_address, p_phone, p_website, p_whatsapp, p_map_url, p_description,
    p_image_url, p_lat, p_lng, p_type, p_delivery, p_area, p_user_id, p_activity_id, p_package_id,
    'pending', now(), p_online
  ) returning id into v_id;

  return v_id;
end;
$$ language plpgsql security definer;

-- Standalone service: create minimal provider then service
drop function if exists add_service_standalone(
  text, text, text, text, numeric, text, text, boolean, boolean, uuid
);

create or replace function add_service_standalone(
  p_provider_name text,
  p_city text default null,
  p_category text default null,
  p_service_name text,
  p_price numeric default null,
  p_description text default null,
  p_image_url text default null,
  p_delivery boolean default false,
  p_online boolean default false,
  p_user_id uuid default null
)
returns table(provider_id bigint, service_id bigint)
language plpgsql
security definer
as $$
declare
  v_provider_id bigint;
  v_service_id bigint;
begin
  insert into providers (
    name, city, category, status, user_id, created_at, online_service
  ) values (
    coalesce(p_provider_name, p_service_name), p_city, p_category, 'pending', p_user_id, now(), true
  ) returning id into v_provider_id;

  insert into services (
    provider_id, name, description, price, image_url, delivery, online, created_at
  ) values (
    v_provider_id, p_service_name, p_description, p_price, p_image_url, p_delivery, p_online, now()
  ) returning id into v_service_id;

  return query select v_provider_id, v_service_id;
end;
$$;

grant execute on function add_provider(
  text, text, text, text, text, text, text, text, text, text, numeric, numeric, text, boolean, text, uuid, bigint, bigint, boolean
) to anon, authenticated;

grant execute on function add_service_standalone(
  text, text, text, text, numeric, text, text, boolean, boolean, uuid
) to anon, authenticated;


