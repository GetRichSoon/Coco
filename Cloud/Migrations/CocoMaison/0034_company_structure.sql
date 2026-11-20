-- 0034 company structure (DEVELOPMENT ONLY: written and tested against a throwaway Postgres; NOT applied to Coco Cloud).
--
-- The company registry: GetRichSoon > COCO > Core House and the seven Team Houses > subteams > categories,
-- with the products, channels, agents, repositories, workflows, access grants, metrics and reference links
-- that hang off any of them. Everything is ADDITIVE and ISOLATED:
--   * eight new tables, all prefixed org_; no existing table, column, policy or trigger is altered;
--   * the seven rows of public.houses stay as they are (a House unit points at its row with house_id);
--   * nothing is written to public.structure, whose rows the cloud cycle provisions from;
--   * no pulse trigger is attached, so no device is woken by these tables.
-- The hierarchy is one self-referencing table (org_units), so a new House, subteam, category or any new
-- level is a row, never a schema change. Ids are House-qualified (lulu.pearl, tilly.pearl) because display
-- names repeat across Houses; the trigger below enforces that a child id starts with its parent id.
-- Rollback: 0034_company_structure.down.sql drops everything this file creates.

create table if not exists public.org_units (
  id           text primary key check (id ~ '^[a-z0-9][a-z0-9_.]*$' and length(id) <= 120),
  kind         text not null check (kind ~ '^[a-z_]+$'),            -- organisation | company | group | house | subteam | category | ...
  parent_id    text references public.org_units(id),
  house_id     text references public.houses(id),                    -- only the seven Team Houses
  display_name text not null,                                         -- exactly as approved, e.g. 'Pearl — Android'
  short_name   text not null,
  focus        text,
  purpose      text,                                                  -- null = not written yet, never invented
  state        text not null default 'planned' check (state in ('planned','active','paused','retired')),
  github_team  text,                                                  -- PROPOSED GitHub team slug; no team exists yet
  sort         int  not null default 0,
  meta         jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (parent_id is null or parent_id <> id)
);
create index if not exists org_units_parent_idx on public.org_units (parent_id, sort);
create index if not exists org_units_house_idx  on public.org_units (house_id);

create or replace function public.org_units_guard() returns trigger language plpgsql as $$
begin
  if new.parent_id is not null then
    -- no cycles: the new parent's ancestry must not contain this unit
    if exists (with recursive up(id, parent_id) as (
                 select id, parent_id from public.org_units where id = new.parent_id
                 union all select u.id, u.parent_id from public.org_units u join up on u.id = up.parent_id)
               select 1 from up where id = new.id) then
      raise exception 'org_units: % under % would make a cycle', new.id, new.parent_id;
    end if;
    -- House-qualified ids for the levels where names repeat
    if new.kind in ('subteam','category') and left(new.id, length(new.parent_id) + 1) <> new.parent_id || '.' then
      raise exception 'org_units: % must start with its parent id % + "."', new.id, new.parent_id;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists org_units_guard on public.org_units;
create trigger org_units_guard before insert or update of id, parent_id, kind on public.org_units
  for each row execute function public.org_units_guard();

create table if not exists public.org_products (
  id          text primary key,
  unit_id     text not null references public.org_units(id),
  kind        text not null check (kind in ('product','channel','project')),
  name        text not null,
  platform_id text references public.platforms(id) on delete set null,
  offering_id uuid references public.offerings(id) on delete set null,   -- the existing offerings row, when there is one
  external_ref text,                                                     -- channel id, store item id...
  repo        text,
  status      text not null default 'planned',
  source      text not null check (source in ('existing','placeholder')),
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (unit_id, kind, name)
);
create index if not exists org_products_unit_idx on public.org_products (unit_id);

create table if not exists public.org_agents (
  id             text primary key,
  unit_id        text not null references public.org_units(id),
  role           text not null check (role in ('head','member','shared')),
  name           text not null,
  registry_agent text,                                                   -- file id in .claude/agents; null for a placeholder
  status         text not null check (status in ('confirmed','proposed','placeholder')),
  meta           jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  check (status = 'placeholder' or registry_agent is not null)
);
create unique index if not exists org_agents_one_head on public.org_agents (unit_id) where role = 'head';

create table if not exists public.org_repos (
  repo           text primary key,                                       -- account/name
  unit_id        text not null references public.org_units(id),
  kind           text not null,
  visibility     text,
  state          text not null,
  mapping_status text not null default 'proposed' check (mapping_status in ('proposed','confirmed')),
  notes          text,
  updated_at     timestamptz not null default now()
);

create table if not exists public.org_workflows (
  repo     text not null,
  file     text not null,
  branch   text not null,
  schedule text,                                                         -- cron text as observed; null = manual or push only
  unit_id  text not null references public.org_units(id),
  state    text not null default 'observed' check (state in ('observed','approved','retired')),
  updated_at timestamptz not null default now(),
  primary key (repo, file, branch)
);

create table if not exists public.org_access (
  id             bigint generated always as identity primary key,
  unit_id        text not null references public.org_units(id),
  principal_kind text not null check (principal_kind in ('founder','agent','github_team')),
  principal      text not null,
  permission     text not null check (permission in ('view','manage','approve','owner')),
  created_at     timestamptz not null default now(),
  unique (unit_id, principal_kind, principal)
);

create table if not exists public.org_metrics (                        -- empty until real data exists; nothing is estimated
  id         bigint generated always as identity primary key,
  unit_id    text not null references public.org_units(id),
  product_id text references public.org_products(id),
  metric     text not null,                                              -- revenue | expense | views | sales | ...
  period     date not null,
  value      numeric not null,
  unit       text not null,                                              -- INR | views | count ...
  source     text not null,
  recorded_at timestamptz not null default now()
);
create index if not exists org_metrics_unit_idx on public.org_metrics (unit_id, metric, period desc);

create table if not exists public.org_refs (                           -- Reference Intelligence: brain_items shown for a unit
  unit_id       text not null references public.org_units(id),
  brain_item_id text not null,                                           -- soft reference to public.brain_items(id)
  note          text,
  primary key (unit_id, brain_item_id)
);

create or replace view public.org_unit_tree with (security_invoker = true) as
  with recursive t(id, parent_id, depth, path) as (
    select id, parent_id, 0, id from public.org_units where parent_id is null
    union all select u.id, u.parent_id, t.depth + 1, t.path || ' > ' || u.id
      from public.org_units u join t on u.parent_id = t.id)
  select * from t;

-- Does a principal hold at least `need` on a unit, directly or through any ancestor? view < manage < approve < owner.
create or replace function public.org_has_access(p_kind text, p_principal text, p_unit text, p_need text)
returns boolean language sql stable as $$
  with recursive up(id, parent_id) as (
    select id, parent_id from public.org_units where id = p_unit
    union all select u.id, u.parent_id from public.org_units u join up on u.id = up.parent_id),
  rank(p, r) as (values ('view',1),('manage',2),('approve',3),('owner',4))
  select exists (
    select 1 from public.org_access a join up on up.id = a.unit_id
      join rank have on have.p = a.permission join rank want on want.p = p_need
     where a.principal_kind = p_kind and a.principal = p_principal and have.r >= want.r)
$$;

-- Same access rule as public.houses: founders on a paired device may do everything; the engine key may read.
-- The engine may also write the two tables automation fills (workflows, metrics) and the reference links.
-- No role list on these policies: who reaches the table is decided by GRANTs (0043_nova_roles: Nova's coco_member), which rows by the predicate. No Supabase role is needed.
do $$ declare t text; begin
  foreach t in array array['org_units','org_products','org_agents','org_repos','org_workflows','org_access','org_metrics','org_refs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "founders only" on public.%I', t);
    execute format('create policy "founders only" on public.%I for all using (private.is_founder() and private.device_ok()) with check (private.is_founder() and private.device_ok())', t);
    execute format('drop policy if exists "coco engine read" on public.%I', t);
    execute format('create policy "coco engine read" on public.%I for select using (private.engine_ok())', t);
  end loop;
  foreach t in array array['org_workflows','org_metrics','org_refs'] loop
    execute format('drop policy if exists "coco engine write" on public.%I', t);
    execute format('create policy "coco engine write" on public.%I for all using (private.engine_ok()) with check (private.engine_ok())', t);
  end loop;
end $$;

-- ===== seed (generated by build.mjs from spec.mjs; do not edit by hand) =====
insert into public.org_units (id, kind, parent_id, house_id, display_name, short_name, focus, purpose, state, github_team, sort) values
  ('getrichsoon', 'organisation', null, null, 'GetRichSoon', 'GetRichSoon', null, null, 'active', null, 0),
  ('coco', 'company', 'getrichsoon', null, 'COCO — The Crown', 'COCO', 'Central Management & Coordination', null, 'active', 'coco', 0),
  ('core', 'house', 'coco', null, 'Core House — Central Operations', 'Core House', 'Central Operations', 'Owns shared infrastructure, the company registry, the Coco platform, the cloud engine, security, automation and central engineering.', 'active', 'core-house', 1),
  ('team_houses', 'group', 'coco', null, 'Team Houses — Business Operations', 'Team Houses', 'Business Operations', null, 'active', null, 2),
  ('core.coco_platform', 'subteam', 'core', null, 'Coco Platform', 'Coco Platform', null, 'The Coco apps and the Nova control API.', 'planned', 'core-coco-platform', 1),
  ('core.cloud_engine', 'subteam', 'core', null, 'Cloud Engine', 'Cloud Engine', null, 'The pipelines, job queue and scheduled automation that run the company in the cloud.', 'planned', 'core-cloud-engine', 2),
  ('core.infrastructure', 'subteam', 'core', null, 'Infrastructure', 'Infrastructure', null, 'Hosting, storage, domains and the services everything runs on.', 'planned', 'core-infrastructure', 3),
  ('core.security', 'subteam', 'core', null, 'Security', 'Security', null, 'Keys, access, exposure checks and incident handling.', 'planned', 'core-security', 4),
  ('core.automation', 'subteam', 'core', null, 'Automation', 'Automation', null, 'Workflows, schedules and the rules that keep them from running twice.', 'planned', 'core-automation', 5),
  ('core.data_and_company_registry', 'subteam', 'core', null, 'Data and Company Registry', 'Data and Company Registry', null, 'Coco Cloud tables and this company registry.', 'planned', 'core-data-and-company-registry', 6),
  ('core.shared_engineering', 'subteam', 'core', null, 'Shared Engineering', 'Shared Engineering', null, 'Code and tooling shared by more than one House.', 'planned', 'core-shared-engineering', 7),
  ('core.central_administration', 'subteam', 'core', null, 'Central Administration', 'Central Administration', null, 'Founder accounts, approvals, policies, budgets and reporting.', 'planned', 'core-central-administration', 8),
  ('lulu', 'house', 'team_houses', 'lulu', 'Lulu — App & Tech House', 'Lulu', 'App & Tech House', null, 'active', 'lulu', 1),
  ('lulu.pearl', 'subteam', 'lulu', 'lulu', 'Pearl — Android', 'Pearl', 'Android', null, 'planned', 'lulu-pearl', 1),
  ('lulu.pearl.ai_tools', 'category', 'lulu.pearl', 'lulu', 'AI Tools', 'AI Tools', null, null, 'planned', null, 1),
  ('lulu.pearl.productivity', 'category', 'lulu.pearl', 'lulu', 'Productivity', 'Productivity', null, null, 'planned', null, 2),
  ('lulu.pearl.utilities', 'category', 'lulu.pearl', 'lulu', 'Utilities', 'Utilities', null, null, 'planned', null, 3),
  ('lulu.velvet', 'subteam', 'lulu', 'lulu', 'Velvet — Windows', 'Velvet', 'Windows', null, 'planned', 'lulu-velvet', 2),
  ('lulu.velvet.desktop_apps', 'category', 'lulu.velvet', 'lulu', 'Desktop Apps', 'Desktop Apps', null, null, 'planned', null, 1),
  ('lulu.velvet.windows_utilities', 'category', 'lulu.velvet', 'lulu', 'Windows Utilities', 'Windows Utilities', null, null, 'planned', null, 2),
  ('lulu.diamond', 'subteam', 'lulu', 'lulu', 'Diamond — Extensions', 'Diamond', 'Extensions', null, 'planned', 'lulu-diamond', 3),
  ('lulu.diamond.ai_extensions', 'category', 'lulu.diamond', 'lulu', 'AI Extensions', 'AI Extensions', null, null, 'planned', null, 1),
  ('lulu.diamond.productivity_extensions', 'category', 'lulu.diamond', 'lulu', 'Productivity Extensions', 'Productivity Extensions', null, null, 'planned', null, 2),
  ('lulu.diamond.browser_utilities', 'category', 'lulu.diamond', 'lulu', 'Browser Utilities', 'Browser Utilities', null, null, 'planned', null, 3),
  ('lulu.bella', 'subteam', 'lulu', 'lulu', 'Bella — Web & SaaS', 'Bella', 'Web & SaaS', null, 'planned', 'lulu-bella', 4),
  ('lulu.bella.ai_platforms', 'category', 'lulu.bella', 'lulu', 'AI Platforms', 'AI Platforms', null, null, 'planned', null, 1),
  ('lulu.bella.saas_products', 'category', 'lulu.bella', 'lulu', 'SaaS Products', 'SaaS Products', null, null, 'planned', null, 2),
  ('lulu.bella.websites', 'category', 'lulu.bella', 'lulu', 'Websites', 'Websites', null, null, 'planned', null, 3),
  ('lulu.royale', 'subteam', 'lulu', 'lulu', 'Royale — Samsung', 'Royale', 'Samsung', null, 'planned', 'lulu-royale', 5),
  ('lulu.royale.samsung_apps', 'category', 'lulu.royale', 'lulu', 'Samsung Apps', 'Samsung Apps', null, null, 'planned', null, 1),
  ('lulu.royale.one_ui_tools', 'category', 'lulu.royale', 'lulu', 'One UI Tools', 'One UI Tools', null, null, 'planned', null, 2),
  ('lulu.opal', 'subteam', 'lulu', 'lulu', 'Opal — iPhone & Mac', 'Opal', 'iPhone & Mac', null, 'planned', 'lulu-opal', 6),
  ('lulu.opal.ios_apps', 'category', 'lulu.opal', 'lulu', 'iOS Apps', 'iOS Apps', null, null, 'planned', null, 1),
  ('lulu.opal.mac_applications', 'category', 'lulu.opal', 'lulu', 'Mac Applications', 'Mac Applications', null, null, 'planned', null, 2),
  ('gigi', 'house', 'team_houses', 'gigi', 'Gigi — Social & Media House', 'Gigi', 'Social & Media House', null, 'active', 'gigi', 2),
  ('gigi.goldie', 'subteam', 'gigi', 'gigi', 'Goldie — YouTube', 'Goldie', 'YouTube', null, 'planned', 'gigi-goldie', 1),
  ('gigi.goldie.education', 'category', 'gigi.goldie', 'gigi', 'Education', 'Education', null, null, 'planned', null, 1),
  ('gigi.goldie.technology', 'category', 'gigi.goldie', 'gigi', 'Technology', 'Technology', null, null, 'planned', null, 2),
  ('gigi.goldie.entertainment', 'category', 'gigi.goldie', 'gigi', 'Entertainment', 'Entertainment', null, null, 'planned', null, 3),
  ('gigi.goldie.motivation', 'category', 'gigi.goldie', 'gigi', 'Motivation', 'Motivation', null, null, 'planned', null, 4),
  ('gigi.goldie.history_and_stories', 'category', 'gigi.goldie', 'gigi', 'History & Stories', 'History & Stories', null, null, 'planned', null, 5),
  ('gigi.goldie.health_and_lifestyle', 'category', 'gigi.goldie', 'gigi', 'Health & Lifestyle', 'Health & Lifestyle', null, null, 'planned', null, 6),
  ('gigi.honey', 'subteam', 'gigi', 'gigi', 'Honey — Facebook', 'Honey', 'Facebook', null, 'planned', 'gigi-honey', 2),
  ('gigi.honey.pages', 'category', 'gigi.honey', 'gigi', 'Pages', 'Pages', null, null, 'planned', null, 1),
  ('gigi.honey.communities', 'category', 'gigi.honey', 'gigi', 'Communities', 'Communities', null, null, 'planned', null, 2),
  ('gigi.cherry', 'subteam', 'gigi', 'gigi', 'Cherry — Instagram', 'Cherry', 'Instagram', null, 'planned', 'gigi-cherry', 3),
  ('gigi.cherry.reels', 'category', 'gigi.cherry', 'gigi', 'Reels', 'Reels', null, null, 'planned', null, 1),
  ('gigi.cherry.theme_pages', 'category', 'gigi.cherry', 'gigi', 'Theme Pages', 'Theme Pages', null, null, 'planned', null, 2),
  ('gigi.bunny', 'subteam', 'gigi', 'gigi', 'Bunny — Pinterest', 'Bunny', 'Pinterest', null, 'planned', 'gigi-bunny', 4),
  ('gigi.bunny.idea_pins', 'category', 'gigi.bunny', 'gigi', 'Idea Pins', 'Idea Pins', null, null, 'planned', null, 1),
  ('gigi.bunny.collections', 'category', 'gigi.bunny', 'gigi', 'Collections', 'Collections', null, null, 'planned', null, 2),
  ('gigi.daisy', 'subteam', 'gigi', 'gigi', 'Daisy — X', 'Daisy', 'X', null, 'planned', 'gigi-daisy', 5),
  ('gigi.daisy.brand_accounts', 'category', 'gigi.daisy', 'gigi', 'Brand Accounts', 'Brand Accounts', null, null, 'planned', null, 1),
  ('gigi.daisy.content_channels', 'category', 'gigi.daisy', 'gigi', 'Content Channels', 'Content Channels', null, null, 'planned', null, 2),
  ('poppy', 'house', 'team_houses', 'poppy', 'Poppy — Book & Publishing House', 'Poppy', 'Book & Publishing House', null, 'active', 'poppy', 3),
  ('poppy.duchess', 'subteam', 'poppy', 'poppy', 'Duchess — Amazon KDP', 'Duchess', 'Amazon KDP', null, 'planned', 'poppy-duchess', 1),
  ('poppy.duchess.business_books', 'category', 'poppy.duchess', 'poppy', 'Business Books', 'Business Books', null, null, 'planned', null, 1),
  ('poppy.duchess.self_improvement', 'category', 'poppy.duchess', 'poppy', 'Self-Improvement', 'Self-Improvement', null, null, 'planned', null, 2),
  ('poppy.duchess.study_guides', 'category', 'poppy.duchess', 'poppy', 'Study Guides', 'Study Guides', null, null, 'planned', null, 3),
  ('poppy.duchess.workbooks', 'category', 'poppy.duchess', 'poppy', 'Workbooks', 'Workbooks', null, null, 'planned', null, 4),
  ('poppy.jewel', 'subteam', 'poppy', 'poppy', 'Jewel — Google Books', 'Jewel', 'Google Books', null, 'planned', 'poppy-jewel', 2),
  ('poppy.jewel.published_books', 'category', 'poppy.jewel', 'poppy', 'Published Books', 'Published Books', null, null, 'planned', null, 1),
  ('poppy.tiara', 'subteam', 'poppy', 'poppy', 'Tiara — Apple Books', 'Tiara', 'Apple Books', null, 'planned', 'poppy-tiara', 3),
  ('poppy.tiara.published_books', 'category', 'poppy.tiara', 'poppy', 'Published Books', 'Published Books', null, null, 'planned', null, 1),
  ('poppy.royale', 'subteam', 'poppy', 'poppy', 'Royale — Direct Sales', 'Royale', 'Direct Sales', null, 'planned', 'poppy-royale', 4),
  ('poppy.royale.gumroad_products', 'category', 'poppy.royale', 'poppy', 'Gumroad Products', 'Gumroad Products', null, null, 'planned', null, 1),
  ('mochi', 'house', 'team_houses', 'mochi', 'Mochi — Comics & Animation House', 'Mochi', 'Comics & Animation House', null, 'active', 'mochi', 4),
  ('mochi.moonbeam', 'subteam', 'mochi', 'mochi', 'Moonbeam — Webcomics', 'Moonbeam', 'Webcomics', null, 'planned', 'mochi-moonbeam', 1),
  ('mochi.moonbeam.original_comics', 'category', 'mochi.moonbeam', 'mochi', 'Original Comics', 'Original Comics', null, null, 'planned', null, 1),
  ('mochi.moonbeam.comic_series', 'category', 'mochi.moonbeam', 'mochi', 'Comic Series', 'Comic Series', null, null, 'planned', null, 2),
  ('mochi.starlight', 'subteam', 'mochi', 'mochi', 'Starlight — Manga & Volumes', 'Starlight', 'Manga & Volumes', null, 'planned', 'mochi-starlight', 2),
  ('mochi.starlight.manga_series', 'category', 'mochi.starlight', 'mochi', 'Manga Series', 'Manga Series', null, null, 'planned', null, 1),
  ('mochi.starlight.digital_volumes', 'category', 'mochi.starlight', 'mochi', 'Digital Volumes', 'Digital Volumes', null, null, 'planned', null, 2),
  ('mochi.pixie', 'subteam', 'mochi', 'mochi', 'Pixie — Animated Shorts', 'Pixie', 'Animated Shorts', null, 'planned', 'mochi-pixie', 3),
  ('mochi.pixie.animated_stories', 'category', 'mochi.pixie', 'mochi', 'Animated Stories', 'Animated Stories', null, null, 'planned', null, 1),
  ('mochi.pixie.short_films', 'category', 'mochi.pixie', 'mochi', 'Short Films', 'Short Films', null, null, 'planned', null, 2),
  ('mochi.blossom', 'subteam', 'mochi', 'mochi', 'Blossom — Memberships', 'Blossom', 'Memberships', null, 'planned', 'mochi-blossom', 4),
  ('mochi.blossom.fan_memberships', 'category', 'mochi.blossom', 'mochi', 'Fan Memberships', 'Fan Memberships', null, null, 'planned', null, 1),
  ('mochi.blossom.exclusive_content', 'category', 'mochi.blossom', 'mochi', 'Exclusive Content', 'Exclusive Content', null, null, 'planned', null, 2),
  ('fifi', 'house', 'team_houses', 'fifi', 'Fifi — Courses & Learning House', 'Fifi', 'Courses & Learning House', null, 'active', 'fifi', 5),
  ('fifi.princess', 'subteam', 'fifi', 'fifi', 'Princess — Udemy', 'Princess', 'Udemy', null, 'planned', 'fifi-princess', 1),
  ('fifi.princess.published_courses', 'category', 'fifi.princess', 'fifi', 'Published Courses', 'Published Courses', null, null, 'planned', null, 1),
  ('fifi.belle', 'subteam', 'fifi', 'fifi', 'Belle — Skillshare', 'Belle', 'Skillshare', null, 'planned', 'fifi-belle', 2),
  ('fifi.belle.classes', 'category', 'fifi.belle', 'fifi', 'Classes', 'Classes', null, null, 'planned', null, 1),
  ('fifi.angel', 'subteam', 'fifi', 'fifi', 'Angel — Coursera', 'Angel', 'Coursera', null, 'planned', 'fifi-angel', 3),
  ('fifi.angel.courses', 'category', 'fifi.angel', 'fifi', 'Courses', 'Courses', null, null, 'planned', null, 1),
  ('fifi.crown', 'subteam', 'fifi', 'fifi', 'Crown — YouTube Courses', 'Crown', 'YouTube Courses', null, 'planned', 'fifi-crown', 4),
  ('fifi.crown.video_learning_series', 'category', 'fifi.crown', 'fifi', 'Video Learning Series', 'Video Learning Series', null, null, 'planned', null, 1),
  ('fifi.darling', 'subteam', 'fifi', 'fifi', 'Darling — Own Website', 'Darling', 'Own Website', null, 'planned', 'fifi-darling', 5),
  ('fifi.darling.premium_courses', 'category', 'fifi.darling', 'fifi', 'Premium Courses', 'Premium Courses', null, null, 'planned', null, 1),
  ('fifi.darling.learning_products', 'category', 'fifi.darling', 'fifi', 'Learning Products', 'Learning Products', null, null, 'planned', null, 2),
  ('zaza', 'house', 'team_houses', 'zaza', 'Zaza — Games & Play House', 'Zaza', 'Games & Play House', null, 'active', 'zaza', 6),
  ('zaza.turbo', 'subteam', 'zaza', 'zaza', 'Turbo — Roblox', 'Turbo', 'Roblox', null, 'planned', 'zaza-turbo', 1),
  ('zaza.turbo.roblox_games', 'category', 'zaza.turbo', 'zaza', 'Roblox Games', 'Roblox Games', null, null, 'planned', null, 1),
  ('zaza.turbo.experiences', 'category', 'zaza.turbo', 'zaza', 'Experiences', 'Experiences', null, null, 'planned', null, 2),
  ('zaza.pixel', 'subteam', 'zaza', 'zaza', 'Pixel — Android Games', 'Pixel', 'Android Games', null, 'planned', 'zaza-pixel', 2),
  ('zaza.pixel.casual_games', 'category', 'zaza.pixel', 'zaza', 'Casual Games', 'Casual Games', null, null, 'planned', null, 1),
  ('zaza.pixel.puzzle_games', 'category', 'zaza.pixel', 'zaza', 'Puzzle Games', 'Puzzle Games', null, null, 'planned', null, 2),
  ('zaza.spark', 'subteam', 'zaza', 'zaza', 'Spark — Web Games', 'Spark', 'Web Games', null, 'planned', 'zaza-spark', 3),
  ('zaza.spark.browser_games', 'category', 'zaza.spark', 'zaza', 'Browser Games', 'Browser Games', null, null, 'planned', null, 1),
  ('zaza.spark.multiplayer_games', 'category', 'zaza.spark', 'zaza', 'Multiplayer Games', 'Multiplayer Games', null, null, 'planned', null, 2),
  ('zaza.rocket', 'subteam', 'zaza', 'zaza', 'Rocket — PC Games', 'Rocket', 'PC Games', null, 'planned', 'zaza-rocket', 4),
  ('zaza.rocket.indie_games', 'category', 'zaza.rocket', 'zaza', 'Indie Games', 'Indie Games', null, null, 'planned', null, 1),
  ('zaza.rocket.desktop_games', 'category', 'zaza.rocket', 'zaza', 'Desktop Games', 'Desktop Games', null, null, 'planned', null, 2),
  ('zaza.nitro', 'subteam', 'zaza', 'zaza', 'Nitro — Other Creators', 'Nitro', 'Other Creators', null, 'planned', 'zaza-nitro', 5),
  ('zaza.nitro.creator_collaborations', 'category', 'zaza.nitro', 'zaza', 'Creator Collaborations', 'Creator Collaborations', null, null, 'planned', null, 1),
  ('zaza.nitro.partner_games', 'category', 'zaza.nitro', 'zaza', 'Partner Games', 'Partner Games', null, null, 'planned', null, 2),
  ('tilly', 'house', 'team_houses', 'tilly', 'Tilly — Shopping & Business House', 'Tilly', 'Shopping & Business House', null, 'active', 'tilly', 7),
  ('tilly.luxe', 'subteam', 'tilly', 'tilly', 'Luxe — Suppliers', 'Luxe', 'Suppliers', null, 'planned', 'tilly-luxe', 1),
  ('tilly.luxe.supplier_network', 'category', 'tilly.luxe', 'tilly', 'Supplier Network', 'Supplier Network', null, null, 'planned', null, 1),
  ('tilly.luxe.product_sourcing', 'category', 'tilly.luxe', 'tilly', 'Product Sourcing', 'Product Sourcing', null, null, 'planned', null, 2),
  ('tilly.opal', 'subteam', 'tilly', 'tilly', 'Opal — Shop Operations', 'Opal', 'Shop Operations', null, 'planned', 'tilly-opal', 2),
  ('tilly.opal.online_stores', 'category', 'tilly.opal', 'tilly', 'Online Stores', 'Online Stores', null, null, 'planned', null, 1),
  ('tilly.opal.order_management', 'category', 'tilly.opal', 'tilly', 'Order Management', 'Order Management', null, null, 'planned', null, 2),
  ('tilly.sterling', 'subteam', 'tilly', 'tilly', 'Sterling — Print on Demand', 'Sterling', 'Print on Demand', null, 'planned', 'tilly-sterling', 3),
  ('tilly.sterling.apparel', 'category', 'tilly.sterling', 'tilly', 'Apparel', 'Apparel', null, null, 'planned', null, 1),
  ('tilly.sterling.custom_products', 'category', 'tilly.sterling', 'tilly', 'Custom Products', 'Custom Products', null, null, 'planned', null, 2),
  ('tilly.cashmere', 'subteam', 'tilly', 'tilly', 'Cashmere — Traffic', 'Cashmere', 'Traffic', null, 'planned', 'tilly-cashmere', 4),
  ('tilly.cashmere.paid_marketing', 'category', 'tilly.cashmere', 'tilly', 'Paid Marketing', 'Paid Marketing', null, null, 'planned', null, 1),
  ('tilly.cashmere.organic_marketing', 'category', 'tilly.cashmere', 'tilly', 'Organic Marketing', 'Organic Marketing', null, null, 'planned', null, 2),
  ('tilly.goldie', 'subteam', 'tilly', 'tilly', 'Goldie — Support Bot', 'Goldie', 'Support Bot', null, 'planned', 'tilly-goldie', 5),
  ('tilly.goldie.customer_support', 'category', 'tilly.goldie', 'tilly', 'Customer Support', 'Customer Support', null, null, 'planned', null, 1),
  ('tilly.goldie.automation', 'category', 'tilly.goldie', 'tilly', 'Automation', 'Automation', null, null, 'planned', null, 2),
  ('tilly.pearl', 'subteam', 'tilly', 'tilly', 'Pearl — Legal, Tax & Payments', 'Pearl', 'Legal, Tax & Payments', null, 'planned', 'tilly-pearl', 6),
  ('tilly.pearl.legal', 'category', 'tilly.pearl', 'tilly', 'Legal', 'Legal', null, null, 'planned', null, 1),
  ('tilly.pearl.tax_and_compliance', 'category', 'tilly.pearl', 'tilly', 'Tax & Compliance', 'Tax & Compliance', null, null, 'planned', null, 2),
  ('tilly.pearl.payments', 'category', 'tilly.pearl', 'tilly', 'Payments', 'Payments', null, null, 'planned', null, 3)
on conflict (id) do nothing;

insert into public.org_agents (id, unit_id, role, name, registry_agent, status, meta) values
  ('agent.core.head', 'core', 'head', 'Head of Core House (not assigned)', null, 'placeholder', '{}'::jsonb),
  ('agent.core.coco_platform.head', 'core.coco_platform', 'head', 'Head of Coco Platform (not assigned)', null, 'placeholder', '{}'::jsonb),
  ('agent.core.cloud_engine.head', 'core.cloud_engine', 'head', 'Head of Cloud Engine (not assigned)', null, 'placeholder', '{}'::jsonb),
  ('agent.core.infrastructure.head', 'core.infrastructure', 'head', 'Head of Infrastructure (not assigned)', null, 'placeholder', '{}'::jsonb),
  ('agent.core.security.head', 'core.security', 'head', 'Head of Security (not assigned)', null, 'placeholder', '{}'::jsonb),
  ('agent.core.automation.head', 'core.automation', 'head', 'Head of Automation (not assigned)', null, 'placeholder', '{}'::jsonb),
  ('agent.core.data_and_company_registry.head', 'core.data_and_company_registry', 'head', 'Head of Data and Company Registry (not assigned)', null, 'placeholder', '{}'::jsonb),
  ('agent.core.shared_engineering.head', 'core.shared_engineering', 'head', 'Head of Shared Engineering (not assigned)', null, 'placeholder', '{}'::jsonb),
  ('agent.core.central_administration.head', 'core.central_administration', 'head', 'Head of Central Administration (not assigned)', null, 'placeholder', '{}'::jsonb),
  ('agent.lulu.head', 'lulu', 'head', 'Lulu House head', 'software-head', 'proposed', '{}'::jsonb),
  ('agent.lulu.pearl.head', 'lulu.pearl', 'head', 'Pearl head', 'software-android', 'proposed', '{}'::jsonb),
  ('agent.lulu.velvet.head', 'lulu.velvet', 'head', 'Velvet head', 'software-windows', 'proposed', '{}'::jsonb),
  ('agent.lulu.diamond.head', 'lulu.diamond', 'head', 'Diamond head', 'software-extensions', 'proposed', '{}'::jsonb),
  ('agent.lulu.bella.head', 'lulu.bella', 'head', 'Bella head', 'software-web', 'proposed', '{}'::jsonb),
  ('agent.lulu.royale.head', 'lulu.royale', 'head', 'Royale head', 'software-samsung', 'proposed', '{}'::jsonb),
  ('agent.lulu.opal.head', 'lulu.opal', 'head', 'Opal head', 'software-apple', 'proposed', '{}'::jsonb),
  ('agent.gigi.head', 'gigi', 'head', 'Gigi House head', 'social-head', 'proposed', '{}'::jsonb),
  ('agent.gigi.goldie.head', 'gigi.goldie', 'head', 'Goldie head (not assigned)', null, 'placeholder', '{}'::jsonb),
  ('agent.gigi.honey.head', 'gigi.honey', 'head', 'Honey head', 'social-facebook', 'proposed', '{}'::jsonb),
  ('agent.gigi.cherry.head', 'gigi.cherry', 'head', 'Cherry head', 'social-instagram', 'proposed', '{}'::jsonb),
  ('agent.gigi.bunny.head', 'gigi.bunny', 'head', 'Bunny head', 'social-pinterest', 'proposed', '{}'::jsonb),
  ('agent.gigi.daisy.head', 'gigi.daisy', 'head', 'Daisy head', 'social-x', 'proposed', '{}'::jsonb),
  ('agent.poppy.head', 'poppy', 'head', 'Poppy House head', 'ebooks-head', 'proposed', '{}'::jsonb),
  ('agent.poppy.duchess.head', 'poppy.duchess', 'head', 'Duchess head', 'ebooks-kdp', 'proposed', '{}'::jsonb),
  ('agent.poppy.jewel.head', 'poppy.jewel', 'head', 'Jewel head', 'ebooks-googlebooks', 'proposed', '{}'::jsonb),
  ('agent.poppy.tiara.head', 'poppy.tiara', 'head', 'Tiara head', 'ebooks-applebooks', 'proposed', '{}'::jsonb),
  ('agent.poppy.royale.head', 'poppy.royale', 'head', 'Royale head', 'ebooks-direct', 'proposed', '{}'::jsonb),
  ('agent.mochi.head', 'mochi', 'head', 'Mochi House head', 'comics-head', 'proposed', '{}'::jsonb),
  ('agent.mochi.moonbeam.head', 'mochi.moonbeam', 'head', 'Moonbeam head', 'comics-webcomics', 'proposed', '{}'::jsonb),
  ('agent.mochi.starlight.head', 'mochi.starlight', 'head', 'Starlight head', 'comics-volumes', 'proposed', '{}'::jsonb),
  ('agent.mochi.pixie.head', 'mochi.pixie', 'head', 'Pixie head', 'comics-animation', 'proposed', '{}'::jsonb),
  ('agent.mochi.blossom.head', 'mochi.blossom', 'head', 'Blossom head', 'comics-membership', 'proposed', '{}'::jsonb),
  ('agent.fifi.head', 'fifi', 'head', 'Fifi House head', 'courses-head', 'proposed', '{}'::jsonb),
  ('agent.fifi.princess.head', 'fifi.princess', 'head', 'Princess head', 'courses-udemy', 'proposed', '{}'::jsonb),
  ('agent.fifi.belle.head', 'fifi.belle', 'head', 'Belle head', 'courses-skillshare', 'proposed', '{}'::jsonb),
  ('agent.fifi.angel.head', 'fifi.angel', 'head', 'Angel head', 'courses-coursera', 'proposed', '{}'::jsonb),
  ('agent.fifi.crown.head', 'fifi.crown', 'head', 'Crown head', 'courses-ytcourses', 'proposed', '{}'::jsonb),
  ('agent.fifi.darling.head', 'fifi.darling', 'head', 'Darling head', 'courses-ownsite', 'proposed', '{}'::jsonb),
  ('agent.zaza.head', 'zaza', 'head', 'Zaza House head', 'games-head', 'proposed', '{}'::jsonb),
  ('agent.zaza.turbo.head', 'zaza.turbo', 'head', 'Turbo head', 'games-roblox', 'proposed', '{}'::jsonb),
  ('agent.zaza.pixel.head', 'zaza.pixel', 'head', 'Pixel head', 'games-android', 'proposed', '{}'::jsonb),
  ('agent.zaza.spark.head', 'zaza.spark', 'head', 'Spark head', 'games-webgames', 'proposed', '{}'::jsonb),
  ('agent.zaza.rocket.head', 'zaza.rocket', 'head', 'Rocket head', 'games-pc', 'proposed', '{}'::jsonb),
  ('agent.zaza.nitro.head', 'zaza.nitro', 'head', 'Nitro head', 'games-creator', 'proposed', '{}'::jsonb),
  ('agent.tilly.head', 'tilly', 'head', 'Tilly House head', 'commerce-head', 'proposed', '{}'::jsonb),
  ('agent.tilly.luxe.head', 'tilly.luxe', 'head', 'Luxe head', 'commerce-suppliers', 'proposed', '{}'::jsonb),
  ('agent.tilly.opal.head', 'tilly.opal', 'head', 'Opal head', 'commerce-shopops', 'proposed', '{}'::jsonb),
  ('agent.tilly.sterling.head', 'tilly.sterling', 'head', 'Sterling head', 'commerce-pod', 'proposed', '{}'::jsonb),
  ('agent.tilly.cashmere.head', 'tilly.cashmere', 'head', 'Cashmere head', 'commerce-traffic', 'proposed', '{}'::jsonb),
  ('agent.tilly.goldie.head', 'tilly.goldie', 'head', 'Goldie head', 'commerce-support', 'proposed', '{}'::jsonb),
  ('agent.tilly.pearl.head', 'tilly.pearl', 'head', 'Pearl head', 'commerce-compliance', 'proposed', '{}'::jsonb),
  ('agent.shared.scout', 'coco', 'shared', 'scout', 'scout', 'confirmed', '{"what":"Finds and scores ideas"}'::jsonb),
  ('agent.shared.builder', 'coco', 'shared', 'builder', 'builder', 'confirmed', '{"what":"Builds extensions, apps and sites"}'::jsonb),
  ('agent.shared.release-qa', 'coco', 'shared', 'release-qa', 'release-qa', 'confirmed', '{"what":"Tests and prepares releases, never publishes"}'::jsonb),
  ('agent.shared.content-writer', 'coco', 'shared', 'content-writer', 'content-writer', 'confirmed', '{"what":"Scripts, captions and calendars"}'::jsonb),
  ('agent.shared.video-producer', 'coco', 'shared', 'video-producer', 'video-producer', 'confirmed', '{"what":"Turns scripts into renderable videos"}'::jsonb),
  ('agent.shared.growth', 'coco', 'shared', 'growth', 'growth', 'confirmed', '{"what":"Marketing, support replies and outreach drafts"}'::jsonb),
  ('agent.shared.lili-research', 'coco', 'shared', 'lili-research', 'lili-research', 'confirmed', '{"what":"Shared deep research"}'::jsonb),
  ('agent.shared.vivi-design', 'coco', 'shared', 'vivi-design', 'vivi-design', 'confirmed', '{"what":"Themes and UI/UX"}'::jsonb),
  ('agent.shared.pixie-keeper', 'coco', 'shared', 'pixie-keeper', 'pixie-keeper', 'confirmed', '{"what":"Task keeper and token watchdog"}'::jsonb),
  ('agent.shared.nono-appcare', 'coco', 'shared', 'nono-appcare', 'nono-appcare', 'confirmed', '{"what":"Keeps the Coco apps healthy"}'::jsonb)
on conflict (id) do nothing;

insert into public.org_products (id, unit_id, kind, name, platform_id, external_ref, status, source, meta) values
  ('yt.the-flow', 'gigi.goldie', 'channel', 'The Flow – Daily Science', 'youtube', 'the-flow', 'connected', 'existing', '{"needs_category":true}'::jsonb),
  ('yt.biology-health', 'gigi.goldie', 'channel', 'BodyDecode', 'youtube', 'biology-health', 'connected', 'existing', '{"needs_category":true}'::jsonb),
  ('yt.history-geography', 'gigi.goldie', 'channel', 'PastWoven', 'youtube', 'history-geography', 'connected', 'existing', '{"needs_category":true}'::jsonb),
  ('yt.stories', 'gigi.goldie', 'channel', 'DreamFrame', 'youtube', 'stories', 'connected', 'existing', '{"needs_category":true}'::jsonb),
  ('yt.human-behaviour', 'gigi.goldie', 'channel', 'QuiteMindFiles', 'youtube', 'human-behaviour', 'connected', 'existing', '{"needs_category":true}'::jsonb),
  ('yt.study', 'gigi.goldie', 'channel', 'MindSpark', 'youtube', 'study', 'connected', 'existing', '{"needs_category":true}'::jsonb),
  ('yt.human-info', 'gigi.goldie', 'channel', 'Human Information (no channel yet)', 'youtube', 'human-info', 'waiting-founder', 'existing', '{"needs_category":true}'::jsonb),
  ('yt.money', 'gigi.goldie', 'channel', 'SuccessHasal', 'youtube', 'money', 'connected', 'existing', '{"needs_category":true}'::jsonb),
  ('yt.mixed', 'gigi.goldie', 'channel', 'UntoldUniverse', 'youtube', 'mixed', 'connected', 'existing', '{"needs_category":true}'::jsonb),
  ('yt.ai-software', 'gigi.goldie', 'channel', 'UnveilAI', 'youtube', 'ai-software', 'connected', 'existing', '{"needs_category":true}'::jsonb),
  ('yt.app-web', 'gigi.goldie', 'channel', 'App / Web / Product (no channel yet)', 'youtube', 'app-web', 'waiting-founder', 'existing', '{"needs_category":true}'::jsonb),
  ('yt.food', 'gigi.goldie', 'channel', 'TasteOdessey', 'youtube', 'food', 'connected', 'existing', '{"needs_category":true}'::jsonb),
  ('yt.devotional', 'gigi.goldie', 'channel', 'SanatanEchoes', 'youtube', 'devotional', 'connected', 'existing', '{"needs_category":true}'::jsonb),
  ('yt.feminism', 'gigi.goldie', 'channel', 'Streebellion', 'youtube', 'feminism', 'connected', 'existing', '{"needs_category":true}'::jsonb),
  ('yt.kahani-ghar', 'gigi.goldie', 'channel', 'Kahani Ghar TV', 'youtube', 'kahani-ghar', 'connected', 'existing', '{"needs_category":true}'::jsonb),
  ('yt.moonveil-audio', 'gigi.goldie', 'channel', 'Moonveil Audio', 'youtube', 'moonveil-audio', 'connected', 'existing', '{"needs_category":true}'::jsonb)
on conflict (id) do nothing;

insert into public.org_repos (repo, unit_id, kind, visibility, state, mapping_status, notes) values
  ('GetRichSoon/Coco', 'core.coco_platform', 'platform', 'public', 'active', 'proposed', 'Apps and the Nova API; Vercel project cocolounge is linked to it'),
  ('GetRichSoon/CocoMaison', 'core.cloud_engine', 'engine', 'private', 'active', 'proposed', 'Company engine: workflows, pipelines, company files (was nova-hq)'),
  ('GetRichSoon/BossSuite', 'core.central_administration', 'workspace', 'private', 'empty', 'proposed', 'Empty shell'),
  ('GetRichSoon/BigBossSuite', 'core.central_administration', 'workspace', 'private', 'empty', 'proposed', 'README only (was shreya-nova-hq)'),
  ('GetRichSoon/.github-private', 'core.central_administration', 'org_page', 'private', 'active', 'proposed', 'Members-only organisation front page'),
  ('GetRichSoon/Analaysis-', 'core.shared_engineering', 'legacy', 'private', 'archived', 'proposed', 'Old Pip app; archived')
on conflict (repo) do nothing;

insert into public.org_workflows (repo, file, branch, schedule, unit_id, state) values
  ('GetRichSoon/CocoMaison', 'cloud-cycle.yml', 'main', '15 2 * * *; 15 13 * * *', 'core.cloud_engine', 'observed'),
  ('GetRichSoon/CocoMaison', 'youtube-daily.yml', 'main', '10 4 * * *', 'gigi.goldie', 'observed'),
  ('GetRichSoon/CocoMaison', 'youtube-competitors.yml', 'main', '30 4 * * 1', 'gigi.goldie', 'observed'),
  ('GetRichSoon/CocoMaison', 'youtube-publish.yml', 'main', '30 3 * * 1', 'gigi.goldie', 'observed'),
  ('GetRichSoon/CocoMaison', 'gumroad-daily.yml', 'main', '30 4 * * *', 'poppy.royale', 'observed'),
  ('GetRichSoon/CocoMaison', 'gumroad-publish.yml', 'main', null, 'poppy.royale', 'observed'),
  ('GetRichSoon/CocoMaison', 'extension-intel.yml', 'main', '40 3 * * *', 'lulu.diamond', 'observed'),
  ('GetRichSoon/CocoMaison', 'extension-publish.yml', 'main', '0 3 * * 1', 'lulu.diamond', 'observed'),
  ('GetRichSoon/CocoMaison', 'tests.yml', 'main', null, 'core.shared_engineering', 'observed'),
  ('GetRichSoon/CocoMaison', 'workflow-proof.yml', 'main', null, 'core.automation', 'observed'),
  ('GetRichSoon/Coco', 'android.yml', 'main', null, 'core.coco_platform', 'observed'),
  ('GetRichSoon/Coco', 'android-ota.yml', 'main', null, 'core.coco_platform', 'observed'),
  ('GetRichSoon/Coco', 'key-rotation.yml', 'main', null, 'core.security', 'observed')
on conflict (repo, file, branch) do nothing;

insert into public.org_access (unit_id, principal_kind, principal, permission) values
  ('coco', 'founder', 'mangesh', 'owner'),
  ('coco', 'founder', 'shreya', 'owner')
on conflict (unit_id, principal_kind, principal) do nothing;
