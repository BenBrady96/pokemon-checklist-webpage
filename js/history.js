import * as storage from './storage.js';

const KEY = 'bt:v1:history';
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAILY_DAYS = 7;
const WEEKLY_DAYS = 31;

const pad = (n) => String(n).padStart(2, '0');
export const dayOf = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const today = () => dayOf(new Date());
export const parseDay = (day) => new Date(`${day}T00:00:00`);
export const daysBetween = (from, to) => Math.round((parseDay(to) - parseDay(from)) / 86400000);

export function addDays(day, n) {
  const date = parseDay(day);
  date.setDate(date.getDate() + n);
  return dayOf(date);
}

const weekOf = (day) => addDays(day, -((parseDay(day).getDay() + 6) % 7));

function bucket(day, now) {
  const age = daysBetween(day, now);
  if (age < DAILY_DAYS) return day;
  if (age < WEEKLY_DAYS) return `w${weekOf(day)}`;
  return `m${day.slice(0, 7)}`;
}

const byDay = (a, b) => a.d.localeCompare(b.d);

export function compact(points, now = today()) {
  const kept = new Map();
  for (const p of [...points].sort(byDay)) kept.set(bucket(p.d, now), p);
  return [...kept.values()].sort(byDay);
}

const count = (n) => Number.isInteger(n) && n >= 0;

function clean(p) {
  if (!p || typeof p.d !== 'string' || !DAY.test(p.d) || !Number.isFinite(p.v) || !(p.r >= 0) || !count(p.u) || !count(p.c)) return null;
  const e = p.e > 0 ? p.e : 0;
  const s = {};
  for (const [id, row] of Object.entries(p.s && typeof p.s === 'object' ? p.s : {})) {
    if (Array.isArray(row) && Number.isFinite(row[0]) && count(row[1]) && count(row[2])) s[id] = [row[0], row[1], row[2]];
  }
  return { d: p.d, v: p.v, r: p.r, e, u: p.u, c: p.c, s };
}

export function readHistory() {
  const list = storage.read(KEY);
  return Array.isArray(list) ? list.map(clean).filter(Boolean).sort(byDay) : [];
}

const cents = (n) => Math.round(n * 100) / 100;
const rate = (n) => Math.round((n || 0) * 1e5) / 1e5;

export function recordSnapshot(worth) {
  const points = readHistory();
  if (!worth.unique && !points.length) return points;
  const d = today();
  const sets = {};
  for (const s of worth.sets) if (s.unique) sets[s.id] = [cents(s.usd), s.unique, s.copies];
  const point = { d, v: cents(worth.usd), r: rate(worth.rates.gbp), e: rate(worth.rates.eur), u: worth.unique, c: worth.copies, s: sets };
  const next = compact([...points.filter((p) => p.d !== d), point], d);
  storage.write(KEY, next);
  return next;
}

export function mergeHistory(incoming) {
  if (!Array.isArray(incoming)) return false;
  const local = readHistory();
  const days = new Set(local.map((p) => p.d));
  const added = incoming.map(clean).filter((p) => p && !days.has(p.d));
  if (!added.length) return false;
  return storage.write(KEY, compact([...local, ...added]));
}

export function mergeBackupHistory(text) {
  try {
    return mergeHistory(JSON.parse(text)?.history);
  } catch {
    return false;
  }
}
