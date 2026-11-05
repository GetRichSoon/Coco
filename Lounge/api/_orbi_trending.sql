-- Orbi wallpaper "Trending" tag on Nova: anonymous daily pick counts. Safe to re-run. Needs a founder YES to apply.
--
-- What is stored: the day and the name of a built-in wallpaper design, and how many times it was picked
-- that day. Nothing about who picked it: no account, no device id, no IP address.
-- Only Nova's own connection role can touch it: RLS on, no policies, functions revoked from everyone else.

create table if not exists public.orbi_wall_picks (
  day    date not null default current_date,
  design text not null check (design ~ '^[a-z0-9-]{2,40}$'),
  picks  integer not null default 0,
  primary key (day, design)
);
alter table public.orbi_wall_picks enable row level security;
revoke all on public.orbi_wall_picks from public, anon, authenticated;

-- One pick. Rows older than 60 days are cleared on the side, so the table stays tiny.
create or replace function public.orbi_wall_pick(p_design text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_design is null or p_design !~ '^[a-z0-9-]{2,40}$' then return; end if;
  insert into orbi_wall_picks (day, design, picks) values (current_date, p_design, 1)
  on conflict (day, design) do update set picks = orbi_wall_picks.picks + 1;
  if random() < 0.01 then delete from orbi_wall_picks where day < current_date - 60; end if;
end;
$$;

-- The designs picked most over the last p_days, at least p_min picks each (so a handful of picks can't make
-- something "trending"). Reads one week of a two-column table: a few hundred rows at most.
create or replace function public.orbi_wall_trending(p_days int default 7, p_limit int default 3, p_min int default 20) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('design', design, 'picks', total) order by total desc), '[]'::jsonb)
  from (
    select design, sum(picks)::int as total
    from orbi_wall_picks
    where day > current_date - least(greatest(p_days, 1), 30)
    group by design
    having sum(picks) >= greatest(p_min, 1)
    order by total desc
    limit least(greatest(p_limit, 1), 10)
  ) t;
$$;

do $$
declare fn text;
begin
  for fn in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname in ('orbi_wall_pick', 'orbi_wall_trending') loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
  end loop;
end $$;
