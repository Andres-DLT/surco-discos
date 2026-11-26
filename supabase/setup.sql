begin;

create table if not exists public.apparel_products (
  id text primary key,
  title text not null,
  category text not null,
  color text not null,
  price integer not null check (price > 0),
  sizes text[] not null check (cardinality(sizes) > 0),
  description text not null,
  position integer not null,
  active boolean not null default true
);

create table if not exists public.orders (
  session_id text primary key,
  total integer not null,
  currency text not null,
  email text,
  shipping jsonb,
  items jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.apparel_products enable row level security;
alter table public.orders enable row level security;
revoke all on public.apparel_products, public.orders from public, anon, authenticated;
grant select on public.apparel_products to service_role;
grant select, insert on public.orders to service_role;

insert into public.apparel_products(id, title, category, color, price, sizes, description, position)
values
  ('hoodie', 'Hoodie Sombra', 'Sudaderas', 'Negro lavado', 119000, array['S', 'M', 'L', 'XL'], 'Sudadera de corte amplio con hombros caídos, capucha y bolsillo frontal. El acabado lavado suaviza el negro.', 0),
  ('tee', 'Tee Static', 'Playeras', 'Blanco', 59000, array['S', 'M', 'L', 'XL'], 'Playera de cuello redondo y silueta holgada. El gráfico en azul cobalto contrasta con el fondo blanco.', 1),
  ('cargo', 'Cargo Distrito', 'Pantalones', 'Oliva', 99000, array['S', 'M', 'L', 'XL'], 'Pantalón de pierna amplia con bolsillos cargo laterales y acabado mate en verde oliva.', 2),
  ('cap', 'Gorra Core', 'Accesorios', 'Negro', 39000, array['Única'], 'Gorra negra con visera curva, logotipo bordado al frente y ajuste en la parte posterior.', 3)
on conflict (id) do nothing;

commit;
