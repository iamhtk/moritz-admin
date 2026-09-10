/**
 * Moritz admin dashboard · seed import
 *
 * Reads lib/seed.ts and pushes rows into Supabase. Seeded matters and activity
 * store an offset from the seed file's NOW so Postgres can reconstruct
 * submitted_at / at as now() - offset. The demo clock stays a busy Friday
 * afternoon whenever the link is opened, without re-seeding.
 *
 * Run with:  bun run seed
 *
 * Prerequisite: apply supabase/01-schema.sql, then relative-time.sql,
 * then realtime.sql.
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import {
  NOW,
  SLA_MINUTES,
  SLA_WATCH_MINUTES,
  CAPACITY_WATCH,
  CAPACITY_OVER,
  MONTHLY_TARGET,
  DAILY_DELIVERY_PLAN,
  lawyers,
  clients,
  matters,
  deliveredMatters,
  activity,
} from "../lib/seed";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

if (!url || !secret) {
  console.error(
    "Missing env. Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local"
  );
  process.exit(1);
}

/** Secret key bypasses row level security. Server side only, never the browser. */
const db = createClient(url, secret, {
  auth: { persistSession: false },
});

/** Whole minutes between the seed NOW and an event timestamp. */
function offsetMinutes(iso: string): number {
  return Math.round((NOW.getTime() - new Date(iso).getTime()) / 60_000);
}

/** Deterministic pseudo-random. Same sequence every run, no Math.random. */
function lcg(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/**
 * Trailing 15 calendar days ending on the day this import runs.
 * Same LCG seed as the original September window so values stay stable.
 */
function buildFinanceDays(end = new Date()) {
  const rand = lcg(905);
  const endUtc = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate())
  );
  const days: {
    date: string;
    revenue: number;
    delivered: number;
    planned_delivered: number;
  }[] = [];

  for (let i = 14; i >= 0; i--) {
    const date = new Date(endUtc.getTime() - i * 86_400_000);
    const weekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
    const delivered = weekend ? 0 : 5 + Math.floor(rand() * 5);
    const avgFee = 1100 + rand() * 300;
    days.push({
      date: date.toISOString().slice(0, 10),
      revenue: Math.round(delivered * avgFee),
      delivered,
      planned_delivered: weekend ? 0 : DAILY_DELIVERY_PLAN,
    });
  }
  return days;
}

/* ---------- run ----------------------------------------------------------- */

async function main() {
  console.log("Seeding with relative offsets from NOW", NOW.toISOString());

  // Order matters. Children reference parents, so parents go first.
  // Activity is cleared first because it points at matters.
  console.log("Clearing existing rows");
  await db.from("activity").delete().neq("id", 0);
  await db.from("matters").delete().neq("id", "");
  await db.from("finance_days").delete().neq("date", "1900-01-01");
  await db.from("clients").delete().neq("id", "");
  await db.from("lawyers").delete().neq("id", "");

  // Seed is the source of truth for every threshold. Upsert so a re-run
  // overwrites dashboard edits and never fails on the surviving config rows.
  const configRows = [
    { key: "sla_minutes", value: SLA_MINUTES },
    { key: "sla_watch_minutes", value: SLA_WATCH_MINUTES },
    { key: "capacity_watch_pct", value: CAPACITY_WATCH },
    { key: "capacity_over_pct", value: CAPACITY_OVER },
    { key: "monthly_target", value: MONTHLY_TARGET },
    { key: "daily_delivery_plan", value: DAILY_DELIVERY_PLAN },
  ];
  const { error: cfgErr } = await db
    .from("app_config")
    .upsert(configRows, { onConflict: "key" });
  if (cfgErr) throw cfgErr;
  console.log("app_config", configRows.length);

  // ---- lawyers ----
  const lawyerRows = lawyers.map((l) => ({
    id: l.id,
    name: l.name,
    initials: l.initials,
    practice_areas: l.practiceAreas,
    weekly_capacity: l.weeklyCapacity,
    weekly_target: l.weeklyTarget,
    delivered_this_week: l.deliveredThisWeek,
    on_time_rate: l.onTimeRate,
  }));
  const { error: le } = await db.from("lawyers").insert(lawyerRows);
  if (le) throw le;
  console.log("lawyers", lawyerRows.length);

  // ---- clients ----
  const clientRows = clients.map((c) => ({
    id: c.id,
    company: c.company,
    plan: c.plan,
    onboarded_at: c.onboardedAt,
  }));
  const { error: ce } = await db.from("clients").insert(clientRows);
  if (ce) throw ce;
  console.log("clients", clientRows.length);

  // ---- matters, active and delivered ----
  const allMatters = [...matters, ...deliveredMatters];
  const matterRows = allMatters.map((m) => ({
    id: m.id,
    reference: m.reference,
    client_id: m.clientId,
    service_line: m.serviceLine,
    type: m.type,
    stage: m.stage,
    lawyer_id: m.lawyerId,
    submitted_at: m.submittedAt,
    offset_minutes: offsetMinutes(m.submittedAt),
    is_seeded: true,
    // History stays absolute; only arrivals are reconstructed from offsets.
    delivered_at: m.deliveredAt,
    fee: m.fee,
    payout: m.payout,
    channel: m.channel,
    draft_confidence: m.draftConfidence,
    flagged_clauses: m.flaggedClauses,
    draft_minutes: m.draftMinutes,
    review_minutes: m.reviewMinutes,
  }));

  // Insert in chunks so a single large payload never trips a limit.
  for (let i = 0; i < matterRows.length; i += 50) {
    const chunk = matterRows.slice(i, i + 50);
    const { error } = await db.from("matters").insert(chunk);
    if (error) throw error;
  }
  console.log("matters", matterRows.length);

  // ---- activity ----
  // The trigger writes activity on future updates. These are the historical rows.
  const activityRows = activity.map((e) => ({
    at: e.at,
    offset_minutes: offsetMinutes(e.at),
    is_seeded: true,
    actor_id: e.actorId,
    verb: e.verb,
    matter_id: e.matterId,
    client_id: e.clientId,
    note: e.note ?? null,
  }));
  const { error: ae } = await db.from("activity").insert(activityRows);
  if (ae) throw ae;
  console.log("activity", activityRows.length);

  // ---- finance ----
  const financeRows = buildFinanceDays();
  const { error: fe } = await db.from("finance_days").insert(financeRows);
  if (fe) throw fe;
  console.log("finance_days", financeRows.length);

  // ---- verify the clock landed where we wanted it ----
  const { data: check } = await db
    .from("matter_status")
    .select("reference, risk, minutes_remaining")
    .in("risk", ["breach", "watch"])
    .order("minutes_remaining", { ascending: true })
    .limit(5);

  console.log("\nClock check, these should be past due or close to it:");
  console.table(check);
  console.log("\nDone.");
}

main().catch((e) => {
  console.error("\nImport failed:", e.message ?? e);
  process.exit(1);
});
