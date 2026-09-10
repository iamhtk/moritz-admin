-- Moritz admin · base schema
-- Apply first, then relative-time.sql, then realtime.sql.

create table if not exists app_config (
  key text primary key,
  value numeric not null
);

create table if not exists clients (
  id text primary key,
  company text not null,
  plan text,
  onboarded_at timestamptz
);

create table if not exists lawyers (
  id text primary key,
  name text not null,
  initials text not null,
  practice_areas text[] not null default '{}',
  weekly_capacity integer not null,
  weekly_target integer not null,
  delivered_this_week integer not null default 0,
  on_time_rate numeric not null default 0.9,
  created_at timestamptz not null default now()
);

create table if not exists matters (
  id text primary key,
  reference text not null,
  client_id text not null references clients (id),
  service_line text not null,
  type text not null,
  stage text not null,
  lawyer_id text references lawyers (id),
  submitted_at timestamptz not null,
  delivered_at timestamptz,
  fee numeric not null default 0,
  payout numeric not null default 0,
  channel text not null,
  draft_confidence numeric,
  flagged_clauses integer not null default 0,
  draft_minutes integer,
  review_minutes integer,
  updated_at timestamptz not null default now()
);

create table if not exists activity (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id text,
  verb text not null,
  matter_id text references matters (id),
  client_id text references clients (id),
  note text
);

create table if not exists finance_days (
  date date primary key,
  revenue numeric not null default 0,
  delivered integer not null default 0,
  planned_delivered integer not null default 0
);

-- Risk and minutes_remaining live in Postgres so the clock is one source of truth.
create or replace view matter_status as
select
  m.id, m.reference, m.client_id, m.service_line, m.type, m.stage, m.lawyer_id,
  m.submitted_at, m.delivered_at, m.fee, m.payout, m.channel,
  m.draft_confidence, m.flagged_clauses, m.draft_minutes, m.review_minutes, m.updated_at,
  c.company as client_name,
  l.name as lawyer_name,
  l.initials as lawyer_initials,
  l.on_time_rate,
  m.submitted_at
    + ((select value from app_config where key = 'sla_minutes') * interval '1 minute') as due_at,
  round(extract(epoch from (
    m.submitted_at
      + ((select value from app_config where key = 'sla_minutes') * interval '1 minute')
      - now()
  )) / 60)::int as minutes_remaining,
  case
    when m.stage = 'delivered' then 'done'
    when m.submitted_at
         + ((select value from app_config where key = 'sla_minutes') * interval '1 minute')
         < now() then 'breach'
    when m.submitted_at
         + ((select value from app_config where key = 'sla_minutes') * interval '1 minute')
         - now()
         < ((select value from app_config where key = 'sla_watch_minutes') * interval '1 minute')
      then 'watch'
    else 'ok'
  end as risk,
  case when m.fee > 0 then round(((m.fee - m.payout) / m.fee) * 100) else null end as margin_pct
from matters m
join clients c on c.id = m.client_id
left join lawyers l on l.id = m.lawyer_id;

create or replace view activity_feed as
select a.id, a.at, a.actor_id, a.verb, a.matter_id, a.client_id, a.note
from activity a;

-- Publishable key can read everything and update matters. Inserts/deletes stay on the secret key.
alter table app_config enable row level security;
alter table clients enable row level security;
alter table lawyers enable row level security;
alter table matters enable row level security;
alter table activity enable row level security;
alter table finance_days enable row level security;

create policy "anon read app_config" on app_config for select using (true);
create policy "anon read clients" on clients for select using (true);
create policy "anon read lawyers" on lawyers for select using (true);
create policy "anon read matters" on matters for select using (true);
create policy "anon update matters" on matters for update using (true);
create policy "anon read activity" on activity for select using (true);
create policy "anon read finance_days" on finance_days for select using (true);

insert into app_config (key, value) values
  ('sla_minutes', 240),
  ('sla_watch_minutes', 60),
  ('capacity_watch_pct', 85),
  ('capacity_over_pct', 100),
  ('monthly_target', 180000),
  ('daily_delivery_plan', 7)
on conflict (key) do nothing;
