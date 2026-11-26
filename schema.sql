-- قاعدة بيانات طلبات Jockey: الطلبات، حسابات الزباين، والنقاط
-- انسخ هذا الملف كامل في Supabase: SQL Editor > New query > Run
-- تقدر تشغله أكثر من مرة بدون مشاكل.

-- ========== الكاشير ==========
-- أي حساب كاشير لازم ينضاف هنا (شوف README).
create table if not exists public.staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.staff enable row level security;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where user_id = auth.uid());
$$;

-- ========== إعدادات النقاط ==========
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  points_enabled boolean not null default true,
  earn_per_100 numeric(6,2) not null default 10 check (earn_per_100 >= 0 and earn_per_100 <= 100)
);
insert into public.settings (id) values (1) on conflict do nothing;
alter table public.settings enable row level security;
drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select to anon, authenticated using (true);
drop policy if exists settings_staff on public.settings;
create policy settings_staff on public.settings for update to authenticated using (public.is_staff()) with check (public.is_staff());

-- ========== الزباين والمحفظة ==========
create table if not exists public.customers (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  points int not null default 0 check (points >= 0),
  created_at timestamptz not null default now()
);
alter table public.customers enable row level security;
drop policy if exists customers_staff on public.customers;
create policy customers_staff on public.customers for select to authenticated using (public.is_staff());

create table if not exists public.points_ledger (
  id bigserial primary key,
  customer_id uuid not null references public.customers(id) on delete cascade,
  order_no int,
  delta int not null,
  reason text not null check (reason in ('earn','redeem','refund','adjust')),
  created_at timestamptz not null default now()
);
alter table public.points_ledger enable row level security;
drop policy if exists ledger_staff on public.points_ledger;
create policy ledger_staff on public.points_ledger for select to authenticated using (public.is_staff());

-- ========== الطلبات ==========
create sequence if not exists order_no_seq start 101;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  no int not null default nextval('order_no_seq'),
  token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new','accepted','ready','done','cancelled')),
  order_type text not null check (order_type in ('pickup','car','dinein')),
  customer_name text not null,
  phone text,
  car text,
  table_no text,
  notes text,
  items jsonb not null,
  total numeric(10,2) not null
);
alter table public.orders add column if not exists customer_id uuid references public.customers(id) on delete set null;
alter table public.orders add column if not exists subtotal numeric(10,2);
alter table public.orders add column if not exists points_used int not null default 0;
alter table public.orders add column if not exists points_earned int not null default 0;
alter table public.orders add column if not exists payment text not null default 'cash';

alter table public.orders enable row level security;

-- الكاشير بس يشوف ويعدّل الطلبات (مو أي حساب مسجّل)
drop policy if exists staff_read on public.orders;
create policy staff_read on public.orders for select to authenticated using (public.is_staff());
drop policy if exists staff_update on public.orders;
create policy staff_update on public.orders for update to authenticated using (public.is_staff()) with check (public.is_staff());

-- ========== الدوال ==========
-- العميل يرسل طلب. النقاط تنخصم هنا بعد التأكد من رصيده.
create or replace function public.place_order(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r public.orders; c public.customers; s public.settings;
  v_sub numeric; v_use int := 0;
begin
  if jsonb_array_length(coalesce(p->'items','[]'::jsonb)) = 0 then raise exception 'empty order'; end if;
  if length(coalesce(p->>'customer_name','')) < 2 then raise exception 'name required'; end if;
  v_sub := round(coalesce((p->>'subtotal')::numeric, (p->>'total')::numeric), 2);
  if v_sub is null or v_sub <= 0 then raise exception 'bad total'; end if;

  select * into s from public.settings where id = 1;
  if auth.uid() is not null then
    select * into c from public.customers where id = auth.uid() for update;
  end if;
  if c.id is not null and coalesce(s.points_enabled, false) then
    v_use := greatest(0, least(coalesce((p->>'use_points')::int, 0), c.points, floor(v_sub)::int));
  end if;

  insert into public.orders(order_type, customer_name, phone, car, table_no, notes, items, subtotal, total, customer_id, points_used)
  values (p->>'order_type', left(p->>'customer_name',60), coalesce(c.phone, left(p->>'phone',20)), left(p->>'car',80),
          left(p->>'table_no',10), left(p->>'notes',300), p->'items', v_sub, v_sub - v_use, c.id, v_use)
  returning * into r;

  if v_use > 0 then
    update public.customers set points = points - v_use where id = c.id;
    insert into public.points_ledger(customer_id, order_no, delta, reason) values (c.id, r.no, -v_use, 'redeem');
  end if;
  return jsonb_build_object('no', r.no, 'token', r.token, 'points_used', v_use, 'total', r.total);
end $$;

-- النقاط تنضاف لما الكاشير يضغط "تم التسليم"، وترجع لو الطلب انلغى.
create or replace function public.orders_points()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_rate numeric; v_earn int;
begin
  if new.customer_id is null or new.status = old.status then return new; end if;
  if new.status = 'done' and new.points_earned = 0 then
    select case when points_enabled then earn_per_100 else 0 end into v_rate from public.settings where id = 1;
    v_earn := floor(new.total * coalesce(v_rate, 0) / 100)::int;
    if v_earn > 0 then
      new.points_earned := v_earn;
      update public.customers set points = points + v_earn where id = new.customer_id;
      insert into public.points_ledger(customer_id, order_no, delta, reason) values (new.customer_id, new.no, v_earn, 'earn');
    end if;
  elsif new.status = 'cancelled' and new.points_used > 0 then
    update public.customers set points = points + new.points_used where id = new.customer_id;
    insert into public.points_ledger(customer_id, order_no, delta, reason) values (new.customer_id, new.no, new.points_used, 'refund');
  end if;
  return new;
end $$;
drop trigger if exists orders_points on public.orders;
create trigger orders_points before update of status on public.orders
  for each row execute function public.orders_points();

-- العميل يتابع حالة طلبه برقم سري (token) فقط
create or replace function public.get_order(p_token uuid)
returns jsonb language sql security definer set search_path = public as $$
  select to_jsonb(o) - 'phone' - 'customer_id' from public.orders o where o.token = p_token;
$$;

-- حساب العميل ورصيده وآخر حركاته
create or replace function public.get_me()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare c public.customers; v_led jsonb;
begin
  select * into c from public.customers where id = auth.uid();
  if c.id is null then return null; end if;
  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into v_led from (
    select order_no, delta, reason, created_at from public.points_ledger
    where customer_id = c.id order by created_at desc limit 30) x;
  return jsonb_build_object('name', c.name, 'phone', c.phone, 'points', c.points, 'ledger', v_led);
end $$;

-- أول دخول: نحفظ اسم العميل (الجوال يجي من الحساب المتحقق منه)
create or replace function public.save_me(p_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'login required'; end if;
  if length(trim(coalesce(p_name,''))) < 2 then raise exception 'name required'; end if;
  insert into public.customers(id, name, phone)
  values (auth.uid(), left(trim(p_name),60), (select phone from auth.users where id = auth.uid()))
  on conflict (id) do update set name = excluded.name;
  return public.get_me();
end $$;

revoke execute on function public.orders_points() from public, anon, authenticated;
grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.place_order(jsonb) to anon, authenticated;
grant execute on function public.get_order(uuid) to anon, authenticated;
grant execute on function public.get_me() to authenticated;
grant execute on function public.save_me(text) to authenticated;

-- تحديث مباشر لشاشة الكاشير
do $$ begin
  alter publication supabase_realtime add table public.orders;
exception when duplicate_object then null; end $$;
