-- Seeded rows carry an offset from "now". Rows created in-app carry a real timestamp.
alter table matters add column if not exists offset_minutes int;
alter table matters add column if not exists is_seeded boolean not null default false;

alter table activity add column if not exists offset_minutes int;
alter table activity add column if not exists is_seeded boolean not null default false;

-- Rebuild the view so submitted_at is reconstructed for seeded rows.
drop view if exists matter_status cascade;

create view matter_status as
with resolved as (
  select
    m.*,
    case
      when m.is_seeded and m.offset_minutes is not null
        then now() - (m.offset_minutes * interval '1 minute')
      else m.submitted_at
    end as effective_submitted_at
  from matters m
)
select
  r.id, r.reference, r.client_id, r.service_line, r.type, r.stage, r.lawyer_id,
  r.effective_submitted_at as submitted_at,
  r.delivered_at, r.fee, r.payout, r.channel,
  r.draft_confidence, r.flagged_clauses, r.draft_minutes, r.review_minutes, r.updated_at,
  c.company as client_name,
  l.name as lawyer_name,
  l.initials as lawyer_initials,
  l.on_time_rate,
  r.effective_submitted_at
    + ((select value from app_config where key = 'sla_minutes') * interval '1 minute') as due_at,
  round(extract(epoch from (
    r.effective_submitted_at
      + ((select value from app_config where key = 'sla_minutes') * interval '1 minute')
      - now()
  )) / 60)::int as minutes_remaining,
  case
    when r.stage = 'delivered' then 'done'
    when r.effective_submitted_at
         + ((select value from app_config where key = 'sla_minutes') * interval '1 minute')
         < now() then 'breach'
    when r.effective_submitted_at
         + ((select value from app_config where key = 'sla_minutes') * interval '1 minute')
         - now()
         < ((select value from app_config where key = 'sla_watch_minutes') * interval '1 minute')
      then 'watch'
    else 'ok'
  end as risk,
  case when r.fee > 0 then round(((r.fee - r.payout) / r.fee) * 100) else null end as margin_pct
from resolved r
join clients c on c.id = r.client_id
left join lawyers l on l.id = r.lawyer_id;

-- Same treatment for the feed, so "22:04" stays a plausible recent time.
create or replace view activity_feed as
select
  a.id,
  case
    when a.is_seeded and a.offset_minutes is not null
      then now() - (a.offset_minutes * interval '1 minute')
    else a.at
  end as at,
  a.actor_id, a.verb, a.matter_id, a.client_id, a.note
from activity a;
