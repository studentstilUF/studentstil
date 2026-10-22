-- =====================================================================
-- Studentstil – databasschema för Supabase (Postgres)
--
-- Så här kör du filen:
--   Supabase → ditt projekt → SQL Editor → New query → klistra in hela
--   filen → Run. Filen går att köra flera gånger: tabeller skapas bara om
--   de saknas och funktionerna ersätts med den senaste versionen.
--
-- Säkerhet: Row Level Security (RLS) är påslaget på alla tabeller utan
-- några policyer. Det betyder att ingen kan läsa eller skriva via den
-- publika "anon"-nyckeln. Bara våra Netlify Functions, som använder den
-- hemliga nyckeln (service role), kommer åt datan.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Typer
-- ---------------------------------------------------------------------
do $$ begin
  create type order_status as enum (
    'vantar_betalning', -- Väntar på betalning
    'betald',           -- Betald
    'packad',           -- Packad
    'skickad',          -- Skickad
    'levererad',        -- Levererad
    'avbruten'          -- Avbruten
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------
-- Tabeller
-- ---------------------------------------------------------------------

-- Produkter. Ändra namn, pris och beskrivning direkt i Supabase Table Editor.
create table if not exists products (
  id          text primary key check (id ~ '^[a-z0-9-]{1,60}$'), -- t.ex. 'studentoverall'
  name        text not null,
  description text not null default '',
  price_sek   integer not null check (price_sek > 0),            -- pris inkl. moms, hela kronor
  image       text not null default '/bilder/placeholder.svg',
  featured    boolean not null default false,                    -- visas på startsidan
  active      boolean not null default true,                     -- false = dold i butiken
  sort_order  integer not null default 0
);

-- Vad varianterna kallas i butiken: 'Storlek' för kläder, 'Färg' för sprayfärg och pennor.
-- (Läggs till så här så att filen går att köra igen på en befintlig databas.)
alter table products add column if not exists variant_label text not null default 'Storlek';

-- Fler bilder (t.ex. baksida och sidor) som visas efter huvudbilden i "image".
alter table products add column if not exists gallery text[] not null default '{}';

-- Klasspris: gäller i klassbeställningar med minst 25 overaller (se create_order).
-- Tomt (null) = ingen rabatt på produkten.
alter table products add column if not exists bulk_price_sek integer check (bulk_price_sek > 0);

-- Varianter (storlekar eller färger) och lagersaldo per produkt.
create table if not exists product_sizes (
  product_id text not null references products (id) on delete cascade,
  size       text not null,
  stock      integer not null default 0 check (stock >= 0),
  sort_order integer not null default 0,
  primary key (product_id, size)
);

-- Räknare för ordernummer per år (SS-2026-0001, SS-2026-0002 …).
create table if not exists order_counters (
  year        integer primary key,
  last_number integer not null
);

create table if not exists orders (
  id               uuid primary key default gen_random_uuid(),
  order_number     text not null unique,
  public_token     text not null unique,   -- hemlig nyckel i länken till orderbekräftelsen
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  status           order_status not null default 'vantar_betalning',

  -- Kunduppgifter (raderas/anonymiseras enligt integritetspolicyn)
  name             text not null,
  email            text not null,
  school_class     text not null,
  street           text not null,
  postal_code      text not null,
  city             text not null,
  phone            text,
  comment          text,

  -- Ordertotal i hela kronor. Vad som köptes ligger i tabellen order_items.
  total_sek        integer not null,

  source           text not null default 'webb', -- 'webb', 'qr', 'qr-skolan' …
  swish_payment_id text unique,                  -- används bara i läge B (Swish Handel)
  paid_at          timestamptz,
  shipped_at       timestamptz,
  anonymized_at    timestamptz
);
create index if not exists orders_created_at_idx on orders (created_at desc);

-- Orderrader: en rad per produkt och variant i varukorgen. Namn och pris sparas
-- så att gamla ordrar inte ändras om produkten ändras senare.
create table if not exists order_items (
  id             bigint generated always as identity primary key,
  order_id       uuid not null references orders (id) on delete cascade,
  product_id     text not null references products (id),
  product_name   text not null,
  size           text not null,      -- storlek eller färg
  quantity       integer not null check (quantity between 1 and 500),
  unit_price_sek integer not null,
  line_total_sek integer not null
);
create index if not exists order_items_order_idx on order_items (order_id);

-- Uppgradering från första versionen (en produkt per order, kolumnerna låg i orders).
-- Görs bara om det inte finns några ordrar än, så att ingen data försvinner.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'orders' and column_name = 'product_id') then
    if exists (select 1 from orders) then
      raise exception 'Tabellen orders har redan ordrar i det gamla formatet. Be om hjälp innan du uppgraderar.';
    end if;
    alter table orders
      drop column product_id, drop column product_name, drop column size,
      drop column quantity, drop column unit_price_sek;
  end if;
end $$;

-- Klassbeställningar: ordertyp och skola. Kan köras på en befintlig databas.
alter table orders add column if not exists kind text not null default 'privat'
  check (kind in ('privat', 'klass'));
alter table orders add column if not exists school text;

-- Leverans: 'skola' = hämtas på en gymnasieskola i Kungsbacka (gratis, skolan står i
-- kolumnen school), 'hem' = skickas till kundens adress (frakt i shipping_sek).
alter table orders add column if not exists delivery text not null default 'hem'
  check (delivery in ('skola', 'hem'));
alter table orders add column if not exists shipping_sek integer not null default 0
  check (shipping_sek >= 0);

-- Kampanj: de 5 första vanliga beställningarna får en overall gratis
-- ('gratis-overall': alla betalar fullt pris, och discount_sek är beloppet
-- som ni swishar tillbaka i efterhand) och de 5 första
-- klassbeställningarna får ett flak Celsius ('flak-celsius'). Se create_order.
alter table orders add column if not exists discount_sek integer not null default 0
  check (discount_sek >= 0);
alter table orders add column if not exists campaign text
  check (campaign in ('gratis-overall', 'flak-celsius'));

-- Kunden väljer inte postombud längre. Ta bort den gamla kolumnen om den finns.
alter table orders drop column if exists pickup_point;

-- Klassbeställningar kan ha många av samma vara (t.ex. 30 overaller i M).
-- Privata beställningar begränsas till 10 st per rad i create_order.
alter table order_items drop constraint if exists order_items_quantity_check;
alter table order_items add constraint order_items_quantity_check check (quantity between 1 and 500);

-- Logg över alla statusändringar (bra för felsökning: vem ändrade vad och när).
create table if not exists order_events (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references orders (id) on delete cascade,
  created_at  timestamptz not null default now(),
  from_status order_status,
  to_status   order_status not null,
  actor       text not null -- 'kund', 'admin', 'swish'
);

-- Begränsning av antal försök (rate limiting). Nyckeln innehåller en hash av
-- IP-adressen, aldrig själva adressen, och raderas efter ett dygn.
create table if not exists rate_limits (
  key          text not null,
  window_start timestamptz not null,
  hits         integer not null default 0,
  primary key (key, window_start)
);

alter table products       enable row level security;
alter table product_sizes  enable row level security;
alter table order_counters enable row level security;
alter table orders         enable row level security;
alter table order_items    enable row level security;
alter table order_events   enable row level security;
alter table rate_limits    enable row level security;

revoke all on table products, product_sizes, order_counters, orders, order_items, order_events, rate_limits
  from anon, authenticated;

-- ---------------------------------------------------------------------
-- Hjälpfunktion: gör om en orderrad till JSON med camelCase-namn
-- ---------------------------------------------------------------------
create or replace function order_json(o orders) returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'orderNumber',  o.order_number,
    'createdAt',    o.created_at,
    'status',       o.status,
    'name',         o.name,
    'email',        o.email,
    'schoolClass',  o.school_class,
    'street',       o.street,
    'postalCode',   o.postal_code,
    'city',         o.city,
    'phone',        o.phone,
    'comment',      o.comment,
    'kind',         o.kind,
    'school',       o.school,
    'delivery',     o.delivery,
    'shippingSek',  o.shipping_sek,
    'discountSek',  o.discount_sek,
    'campaign',     o.campaign,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'productId',    i.product_id,
        'productName',  i.product_name,
        'size',         i.size,
        'quantity',     i.quantity,
        'unitPriceSek', i.unit_price_sek,
        'lineTotalSek', i.line_total_sek
      ) order by i.id)
      from order_items i
      where i.order_id = o.id
    ), '[]'::jsonb),
    'totalSek',     o.total_sek,
    'source',       o.source,
    'paidAt',       o.paid_at,
    'shippedAt',    o.shipped_at
  );
$$;

-- ---------------------------------------------------------------------
-- Produkter med storlekar och lager
-- ---------------------------------------------------------------------
create or replace function list_products() returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',          p.id,
    'name',        p.name,
    'description', p.description,
    'priceSek',    p.price_sek,
    'bulkPriceSek', p.bulk_price_sek,
    'image',       p.image,
    'images',      to_jsonb(array[p.image] || p.gallery),
    'featured',    p.featured,
    'variantLabel', p.variant_label,
    'sizes', coalesce((
      select jsonb_agg(jsonb_build_object('size', s.size, 'stock', s.stock) order by s.sort_order, s.size)
      from product_sizes s
      where s.product_id = p.id
    ), '[]'::jsonb)
  ) order by p.sort_order, p.name), '[]'::jsonb)
  from products p
  where p.active;
$$;

-- ---------------------------------------------------------------------
-- Skapa order från en varukorg: kontrollerar lager, minskar lagret för
-- varje rad, räknar ut totalen och ger ordernummer. Allt sker i en
-- transaktion: tar en enda vara slut blir det ingen order alls, och två
-- kunder kan inte köpa samma sista vara.
--
-- p.items = [{ "productId": "...", "size": "...", "quantity": 1 }, ...]
-- p.kind  = 'privat' (vanlig varukorg) eller 'klass' (klassbeställning)
--
-- KLASSPRIS: en klassbeställning med minst 25 studentoveraller får
-- klasspris (products.bulk_price_sek) på alla varor som har ett sådant.
-- Gränsen 25 finns även i src/shared/classOrder.ts – ändra på båda ställena.
--
-- FRAKT: p.delivery = 'skola' (gratis, hämtas på skolan i p.school) eller 'hem'
-- (49 kr, klassbeställningar 25 kr per overall men minst 49 kr).
-- Fraktpriset finns även i src/shared/delivery.ts – ändra på båda ställena.
-- ---------------------------------------------------------------------
create or replace function create_order(p jsonb) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_year     integer := extract(year from (now() at time zone 'Europe/Stockholm'))::integer;
  v_seq      integer;
  v_order    orders%rowtype;
  v_item     jsonb;
  v_product  products%rowtype;
  v_qty      integer;
  v_price    integer;
  v_total    integer := 0;
  v_kind     text := coalesce(nullif(p ->> 'kind', ''), 'privat');
  v_overalls integer;
  v_bulk     boolean;
  v_delivery text := coalesce(nullif(p ->> 'delivery', ''), 'hem');
  v_shipping integer;
  v_campaign_used integer;
  v_discount integer := 0;
  v_campaign text;
begin
  if v_delivery not in ('skola', 'hem') then
    raise exception 'INVALID_DELIVERY';
  end if;

  if jsonb_array_length(coalesce(p -> 'items', '[]'::jsonb)) = 0 then
    raise exception 'EMPTY_CART';
  end if;

  select coalesce(sum((e ->> 'quantity')::integer), 0) into v_overalls
    from jsonb_array_elements(p -> 'items') e
   where e ->> 'productId' = 'studentoverall';
  v_bulk := v_kind = 'klass' and v_overalls >= 25;
  -- Frakt: skolhämtning gratis. Hemleverans 49 kr, för klassbeställningar
  -- 25 kr per overall (minst 49 kr).
  v_shipping := case
    when v_delivery = 'skola' then 0
    when v_kind = 'klass' then greatest(49, 25 * v_overalls)
    else 49
  end;

  insert into order_counters as c (year, last_number) values (v_year, 1)
  on conflict (year) do update set last_number = c.last_number + 1
  returning last_number into v_seq;

  insert into orders (
    order_number, public_token, name, email, school_class, street, postal_code, city,
    phone, comment, total_sek, source, kind, school, delivery, shipping_sek
  ) values (
    format('SS-%s-%s', v_year, lpad(v_seq::text, greatest(4, length(v_seq::text)), '0')),
    p ->> 'publicToken',
    p ->> 'name',
    p ->> 'email',
    p ->> 'schoolClass',
    p ->> 'street',
    p ->> 'postalCode',
    p ->> 'city',
    nullif(p ->> 'phone', ''),
    nullif(p ->> 'comment', ''),
    0,
    coalesce(nullif(p ->> 'source', ''), 'webb'),
    v_kind,
    nullif(p ->> 'school', ''),
    v_delivery,
    v_shipping
  )
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p -> 'items') loop
    v_qty := (v_item ->> 'quantity')::integer;
    if v_kind <> 'klass' and v_qty > 10 then
      raise exception 'TOO_MANY';
    end if;

    select * into v_product from products where id = v_item ->> 'productId' and active;
    if not found then
      raise exception 'PRODUCT_NOT_FOUND' using detail = coalesce(v_item ->> 'productId', '');
    end if;

    update product_sizes
       set stock = stock - v_qty
     where product_id = v_product.id and size = v_item ->> 'size' and stock >= v_qty;
    if not found then
      raise exception 'OUT_OF_STOCK' using detail = format('%s (%s)', v_product.name, v_item ->> 'size');
    end if;

    v_price := case when v_bulk then coalesce(v_product.bulk_price_sek, v_product.price_sek)
                    else v_product.price_sek end;

    insert into order_items (order_id, product_id, product_name, size, quantity, unit_price_sek, line_total_sek)
    values (v_order.id, v_product.id, v_product.name, v_item ->> 'size', v_qty,
            v_price, v_price * v_qty);
    v_total := v_total + v_price * v_qty;
  end loop;

  -- KAMPANJ: de 5 första beställningarna av varje sort. Avbrutna ordrar
  -- räknas inte, så platsen går vidare till nästa kund. Låset gör att två
  -- samtidiga beställningar inte kan ta samma plats.
  perform pg_advisory_xact_lock(hashtext('studentstil-kampanj'));
  select count(*) into v_campaign_used
    from orders
   where kind = v_kind and campaign is not null and status <> 'avbruten';
  if v_campaign_used < 5 then
    if v_kind = 'klass' then
      v_campaign := 'flak-celsius';
    elsif v_overalls > 0 then
      -- En overall gratis (bara en, även om ordern har flera).
      v_campaign := 'gratis-overall';
      select min(unit_price_sek) into v_discount
        from order_items
       where order_id = v_order.id and product_id = 'studentoverall';
    end if;
  end if;

  -- Kunden betalar fullt pris. discount_sek = det ni swishar tillbaka efteråt.
  v_total := v_total + v_shipping;
  update orders set total_sek = v_total, shipping_sek = v_shipping,
                    discount_sek = v_discount, campaign = v_campaign
   where id = v_order.id returning * into v_order;

  insert into order_events (order_id, from_status, to_status, actor)
  values (v_order.id, null, v_order.status, 'kund');

  return order_json(v_order);
end;
$$;

-- ---------------------------------------------------------------------
-- Hämta en order för kundens bekräftelsesida (kräver hemlig token)
-- ---------------------------------------------------------------------
create or replace function get_public_order(p_order_number text, p_token text) returns jsonb
language sql stable
set search_path = public
as $$
  select order_json(o)
  from orders o
  where o.order_number = p_order_number
    and o.public_token = p_token
    and o.anonymized_at is null;
$$;

-- ---------------------------------------------------------------------
-- Alla ordrar till adminpanelen (nyast först)
-- ---------------------------------------------------------------------
create or replace function admin_list_orders() returns jsonb
language sql stable
set search_path = public
as $$
  select coalesce(jsonb_agg(order_json(o) order by o.created_at desc), '[]'::jsonb)
  from orders o;
$$;

-- ---------------------------------------------------------------------
-- Ändra status. Avbruten order lägger tillbaka varan i lager, och om en
-- avbruten order återaktiveras reserveras varan igen.
-- ---------------------------------------------------------------------
create or replace function set_order_status(p_order_number text, p_status order_status, p_actor text)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_prev  order_status;
  v_item  order_items%rowtype;
begin
  select * into v_order from orders where order_number = p_order_number for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  v_prev := v_order.status;

  if v_prev = p_status then
    return jsonb_build_object('order', order_json(v_order), 'previousStatus', v_prev);
  end if;

  if p_status = 'avbruten' then
    update product_sizes s set stock = s.stock + i.quantity
      from order_items i
     where i.order_id = v_order.id and s.product_id = i.product_id and s.size = i.size;
  elsif v_prev = 'avbruten' then
    for v_item in select * from order_items where order_id = v_order.id loop
      update product_sizes set stock = stock - v_item.quantity
       where product_id = v_item.product_id and size = v_item.size and stock >= v_item.quantity;
      if not found then
        raise exception 'OUT_OF_STOCK' using detail = format('%s (%s)', v_item.product_name, v_item.size);
      end if;
    end loop;
  end if;

  update orders set
    status     = p_status,
    updated_at = now(),
    paid_at    = case when p_status in ('betald', 'packad', 'skickad', 'levererad')
                      then coalesce(paid_at, now()) else paid_at end,
    shipped_at = case when p_status in ('skickad', 'levererad')
                      then coalesce(shipped_at, now()) else shipped_at end
  where id = v_order.id
  returning * into v_order;

  insert into order_events (order_id, from_status, to_status, actor)
  values (v_order.id, v_prev, p_status, p_actor);

  return jsonb_build_object('order', order_json(v_order), 'previousStatus', v_prev);
end;
$$;

-- ---------------------------------------------------------------------
-- Läge B (Swish Handel): koppla betalförfrågan till ordern …
-- ---------------------------------------------------------------------
create or replace function set_swish_payment_id(p_order_number text, p_payment_id text) returns void
language plpgsql
set search_path = public
as $$
begin
  update orders set swish_payment_id = p_payment_id, updated_at = now()
   where order_number = p_order_number and status = 'vantar_betalning';
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;
end;
$$;

-- … och markera som betald när Swish bekräftat betalningen.
-- Returnerar null om ingen order hör till betalningen.
create or replace function mark_paid_by_swish(p_payment_id text, p_amount numeric, p_reference text)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_order orders%rowtype;
begin
  select * into v_order from orders where swish_payment_id = p_payment_id for update;
  if not found then
    return null;
  end if;
  if v_order.order_number <> p_reference or v_order.total_sek <> p_amount then
    raise exception 'PAYMENT_MISMATCH';
  end if;
  if v_order.status <> 'vantar_betalning' then
    return jsonb_build_object('order', order_json(v_order), 'previousStatus', v_order.status);
  end if;
  return set_order_status(v_order.order_number, 'betald', 'swish');
end;
$$;

-- ---------------------------------------------------------------------
-- Rate limiting: räknar försök per nyckel och tidsfönster.
-- Returnerar true om försöket är tillåtet.
-- ---------------------------------------------------------------------
create or replace function rate_limit_hit(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits   integer;
begin
  insert into rate_limits as r (key, window_start, hits) values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning hits into v_hits;
  return v_hits <= p_max;
end;
$$;

-- ---------------------------------------------------------------------
-- GDPR: anonymisera kunduppgifter på ordrar som levererats/avbrutits för
-- mer än p_months månader sedan. Ordernummer, datum, produkt och belopp
-- sparas (behövs för bokföringen i 7 år). Körs varje natt av
-- Netlify-funktionen dailyMaintenance.
-- ---------------------------------------------------------------------
create or replace function anonymize_old_orders(p_months integer) returns integer
language plpgsql
set search_path = public
as $$
declare
  v_count integer;
begin
  update orders set
    name = 'Raderad kund', email = '', school_class = '', street = '', postal_code = '',
    city = '', phone = null, comment = null,
    anonymized_at = now(), updated_at = now()
  where anonymized_at is null
    and status in ('skickad', 'levererad', 'avbruten')
    and coalesce(shipped_at, updated_at) < now() - make_interval(months => p_months);
  get diagnostics v_count = row_count;

  delete from rate_limits where window_start < now() - interval '1 day';
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------
-- Behörigheter: bara service role (våra Netlify Functions) får anropa funktionerna.
-- ---------------------------------------------------------------------
revoke execute on function
  order_json(orders),
  list_products(),
  create_order(jsonb),
  get_public_order(text, text),
  admin_list_orders(),
  set_order_status(text, order_status, text),
  set_swish_payment_id(text, text),
  mark_paid_by_swish(text, numeric, text),
  rate_limit_hit(text, integer, integer),
  anonymize_old_orders(integer)
from public, anon, authenticated;

grant execute on function
  order_json(orders),
  list_products(),
  create_order(jsonb),
  get_public_order(text, text),
  admin_list_orders(),
  set_order_status(text, order_status, text),
  set_swish_payment_id(text, text),
  mark_paid_by_swish(text, numeric, text),
  rate_limit_hit(text, integer, integer),
  anonymize_old_orders(integer)
to service_role;
