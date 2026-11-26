-- قاعدة بيانات طلبات Jockey
-- انسخ هذا الملف كامل في Supabase: SQL Editor > New query > Run

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

alter table public.orders enable row level security;

-- الكاشير (مستخدم مسجّل دخول) يشوف ويعدّل الطلبات
drop policy if exists staff_read on public.orders;
create policy staff_read on public.orders for select to authenticated using (true);
drop policy if exists staff_update on public.orders;
create policy staff_update on public.orders for update to authenticated using (true) with check (true);

-- العميل يرسل طلب عن طريق دالة فقط
create or replace function public.place_order(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.orders;
begin
  if jsonb_array_length(coalesce(p->'items','[]'::jsonb)) = 0 then raise exception 'empty order'; end if;
  if length(coalesce(p->>'customer_name','')) < 2 then raise exception 'name required'; end if;
  insert into public.orders(order_type, customer_name, phone, car, table_no, notes, items, total)
  values (p->>'order_type', left(p->>'customer_name',60), left(p->>'phone',20), left(p->>'car',80),
          left(p->>'table_no',10), left(p->>'notes',300), p->'items', (p->>'total')::numeric)
  returning * into r;
  return jsonb_build_object('no', r.no, 'token', r.token);
end $$;

-- العميل يتابع حالة طلبه برقم سري (token) فقط
create or replace function public.get_order(p_token uuid)
returns jsonb language sql security definer set search_path = public as $$
  select to_jsonb(o) - 'phone' from public.orders o where o.token = p_token;
$$;

grant execute on function public.place_order(jsonb) to anon, authenticated;
grant execute on function public.get_order(uuid) to anon, authenticated;

-- تحديث مباشر لشاشة الكاشير
do $$ begin
  alter publication supabase_realtime add table public.orders;
exception when duplicate_object then null; end $$;
