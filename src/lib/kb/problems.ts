// The problems a merged ticket really holds. Pages explain it; this file is what runs.
//
// A cause (causes.ts) is decided by tenant and channel. A report whose body tells a different story
// does not belong to it: the desk lists the reports that read as a one-day move (desk-notes.json),
// and a month/day swap cannot move a date by one day. Those reports are a problem of their own.
import { causeOf, uniqueById, type Cause, type Report, type Tenant } from '#lib/kb/causes';

export type Problem = Cause | 'one-day' | 'unplaced';

export const PROBLEM_TITLE: Record<Problem, string> = {
  parser: 'The shared parser reads day-first dates month first',
  hint: 'booking-v3 asks for MM/DD/YYYY, then reads the date day first',
  'one-day': 'Dates move by one day',
  unplaced: 'No tenant on file, or a tenant that writes the month first',
};

export function problemOf(r: Report, t: Tenant | undefined, oneDayMove: readonly string[]): Problem {
  if (oneDayMove.includes(r.id)) return 'one-day';
  return causeOf(r, t) ?? 'unplaced';
}

export type ProblemGroup = {
  problem: Problem;
  reports: Report[];
  tenants: number;
  // channel → count, intake tag → count
  channels: Record<string, number>;
  taggedAs: Record<string, number>;
  firstSeen: string;
  lastSeen: string;
};

const tally = (rs: Report[], key: (r: Report) => string) =>
  rs.reduce<Record<string, number>>((n, r) => ({ ...n, [key(r)]: (n[key(r)] ?? 0) + 1 }), {});

export function groupByProblem(
  reports: Report[],
  tenantOf: (r: Report) => Tenant | undefined,
  oneDayMove: readonly string[],
): ProblemGroup[] {
  const by = new Map<Problem, Report[]>();
  for (const r of reports) {
    const p = problemOf(r, tenantOf(r), oneDayMove);
    by.set(p, [...(by.get(p) ?? []), r]);
  }
  return [...by.entries()]
    .map(([problem, rs]) => {
      const days = rs.map((r) => r.receivedAt.slice(0, 10)).sort();
      return {
        problem,
        reports: rs,
        tenants: new Set(rs.map((r) => r.tenant)).size,
        channels: tally(rs, (r) => r.channel),
        taggedAs: tally(rs, (r) => r.meta.intakeTag),
        firstSeen: days[0],
        lastSeen: days[days.length - 1],
      };
    })
    .sort((a, b) => b.reports.length - a.reports.length);
}

export type TicketSplit = {
  // rows in the export for this ticket, before repeats are dropped
  rows: number;
  reports: Report[];
  groups: ProblemGroup[];
  // reports whose intake tag disagrees with their tenant's cause
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
  return {
    rows: rows.length,
    reports,
    groups: groupByProblem(reports, tenantOf, oneDayMove),
    mistagged: reports.filter((r) => {
      const c = causeOf(r, tenantOf(r));
      return c !== null && r.meta.intakeTag !== c;
    }).length,
  };
}
