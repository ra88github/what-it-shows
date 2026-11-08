// The problems a merged ticket really holds, counted the desk's way. Pages explain it; this file is
// what runs.
//
// The causes come from causes.ts, unchanged: tenant and channel decide them, and every report is
// counted under the cause it is filed by. The desk also lists reports that read as a one-day move
// (desk-notes.json). A month/day swap cannot move a date by one day, so those reports are a problem
// of their own as well. The desk counts them where they are filed and footnotes them there; so does
// this file.
import { groupByCause, readAs, uniqueById, type Cause, type Report, type Tenant } from '#lib/kb/causes';

export type Problem = Cause | 'unplaced' | 'one-day';

export const PROBLEM_TITLE: Record<Problem, string> = {
  parser: 'The shared parser reads day-first dates month first',
  hint: 'booking-v3 asks for MM/DD/YYYY, then reads the date day first',
  unplaced: 'No tenant on file, or a tenant that writes the month first',
  'one-day': 'Dates move by one day',
};

export type ProblemRow = {
  problem: Problem;
  reports: Report[];
  tenants: number;
  // channel → count, intake tag → count
  channels: Record<string, number>;
  taggedAs: Record<string, number>;
  firstSeen: string;
  lastSeen: string;
  // for a cause: how many of its reports are on the one-day-move list
  readAsOneDay: number;
};

const tally = (rs: Report[], key: (r: Report) => string) =>
  rs.reduce<Record<string, number>>((n, r) => ({ ...n, [key(r)]: (n[key(r)] ?? 0) + 1 }), {});

function row(problem: Problem, rs: Report[], readAsOneDay: number): ProblemRow {
  const days = rs.map((r) => r.receivedAt.slice(0, 10)).sort();
  return {
    problem,
    reports: rs,
    tenants: new Set(rs.map((r) => r.tenant)).size,
    channels: tally(rs, (r) => r.channel),
    taggedAs: tally(rs, (r) => r.meta.intakeTag),
    firstSeen: days[0],
    lastSeen: days[days.length - 1],
    readAsOneDay,
  };
}

export type TicketSplit = {
  // rows in the export for this ticket, before repeats are dropped
  rows: number;
  reports: Report[];
  // one row per cause (every report in exactly one), then the one-day row
  causes: ProblemRow[];
  oneDay: ProblemRow | null;
  // reports whose intake tag disagrees with the cause they are filed by
  mistagged: number;
};

export function splitTicket(
  all: Report[],
  ticket: number,
  tenantOf: (r: Report) => Tenant | undefined,
  oneDayMove: readonly string[],
): TicketSplit {
  const rows = all.filter((r) => r.mergedInto === ticket);
  const reports = uniqueById(rows);
  const groups = groupByCause(reports, tenantOf);
  const oneDay = reports.filter((r) => oneDayMove.includes(r.id));
  return {
    rows: rows.length,
    reports,
    causes: groups.map((g) => row(g.cause, g.reports, readAs(g, oneDayMove))),
    oneDay: oneDay.length ? row('one-day', oneDay, oneDay.length) : null,
    mistagged: groups.reduce((n, g) => n + g.reports.filter((r) => r.meta.intakeTag !== g.cause).length, 0),
  };
}
