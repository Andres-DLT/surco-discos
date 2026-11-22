create table if not exists public.products (
 id text primary key, title text not null, artist text not null, genre text not null,
 year integer not null, price integer not null check(price > 0), position integer not null, active boolean not null default true
);
create table if not exists public.orders (
 session_id text primary key, total integer not null, currency text not null, email text, shipping jsonb, items jsonb not null, created_at timestamptz not null default now()
);
alter table public.products enable row level security;
alter table public.orders enable row level security;
revoke all on public.products, public.orders from anon, authenticated;
grant select on public.products to service_role;
grant select, insert on public.orders to service_role;

insert into public.products(id,title,artist,genre,year,price,position) values
('head-hunters','Head Hunters','Herbie Hancock','Jazz',1973,89000,0),
('blue-train','Blue Train','John Coltrane','Jazz',1957,76000,1),
('rumours','Rumours','Fleetwood Mac','Rock',1977,82000,2),
('whats-going-on','What’s Going On','Marvin Gaye','Soul',1971,78000,3),
('abbey-road','Abbey Road','The Beatles','Rock',1969,94000,4),
('discovery','Discovery','Daft Punk','Electrónica',2001,99000,5),
('kind-of-blue','Kind of Blue','Miles Davis','Jazz',1959,85000,6),
('songs-in-the-key','Songs in the Key of Life','Stevie Wonder','Soul',1976,96000,7)
on conflict(id) do nothing;
