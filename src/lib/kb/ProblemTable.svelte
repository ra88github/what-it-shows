<script lang="ts">
  import reports from '#lib/data/reports-4471.json';
  import notes from '#lib/data/desk-notes.json';
  import type { Report } from '#lib/kb/causes';
  import { tenantOf } from '#lib/kb/locales';
  import { PROBLEM_TITLE, splitTicket, type Problem } from '#lib/kb/problems';

  // `issues`: the ticket each problem was filed as, in `repo` (owner/name on GitHub).
  let { ticket, repo, issues = {} }: { ticket: number; repo: string; issues?: Partial<Record<Problem, number>> } = $props();

  const split = $derived(splitTicket(reports as Report[], ticket, tenantOf, notes.oneDayMove));
  const rows = $derived(split.oneDay ? [...split.causes, split.oneDay] : split.causes);
  const filed = $derived(split.causes.reduce((n, g) => n + g.reports.length, 0));
  const list = (n: Record<string, number>) =>
    Object.entries(n)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ×${v}`)
      .join(' · ');
</script>

<p class="sum">
  <strong>{split.reports.length}</strong> reports in #{ticket} ·
  <strong>{rows.length}</strong>
  {rows.length === 1 ? 'problem' : 'problems'}
</p>

<table>
  <thead>
    <tr><th>problem</th><th>reports</th><th>channels</th><th>intake tagged as</th><th>tenants</th><th>seen</th><th>ticket</th></tr>
  </thead>
  <tbody>
    {#each rows as g (g.problem)}
      <tr class:extra={g.problem === 'one-day'}>
        <td>
          <code>{g.problem}</code><br /><span class="what">{PROBLEM_TITLE[g.problem]}</span>
          {#if g.problem !== 'one-day' && g.readAsOneDay}
            <br /><span class="what">includes {g.readAsOneDay} read as a one-day move</span>
          {/if}
          {#if g.problem === 'one-day'}
            <br /><span class="what">also counted under the cause they are filed by</span>
          {/if}
        </td>
        <td class="n">{g.reports.length}</td>
        <td class="tags">{list(g.channels)}</td>
        <td class="tags">{list(g.taggedAs)}</td>
        <td class="n">{g.tenants}</td>
        <td class="tags">{g.firstSeen} → {g.lastSeen}</td>
        <td>
          {#if issues[g.problem]}
            <a href="https://github.com/{repo}/issues/{issues[g.problem]}">{repo}#{issues[g.problem]}</a>
          {:else}
            <span class="none">no ticket yet</span>
          {/if}
        </td>
      </tr>
    {/each}
  </tbody>
  <tfoot>
    <tr><td>filed by cause</td><td class="n">{filed}</td><td colspan="5" class:off={filed !== split.reports.length}>
      {filed === split.reports.length ? `every report in #${ticket} is under exactly one cause` : `does not match the ${split.reports.length} reports in #${ticket}`}
    </td></tr>
  </tfoot>
</table>

<p class="note">
  Counted the desk's way: by report id (the export has {split.rows} rows for #{ticket}, and
  {split.rows - split.reports.length} of them repeat a report), and each report under the cause its tenant and channel give it.
  Reports the desk read as a one-day move stay counted there and get a row of their own.
  Intake's tag disagrees with that cause on {split.mistagged} reports.
</p>

<style>
  .sum { font-size: 1.1rem; }
  .what { color: var(--muted); font-size: 0.85em; }
  .tags { color: var(--muted); font-size: 0.85em; }
  .n { font-variant-numeric: tabular-nums; }
  .none { color: var(--warn); }
  .off { color: var(--warn); font-weight: 600; }
  .extra td { border-top: 2px solid var(--line); }
  tfoot td { font-weight: 600; border-bottom: 0; }
  .note { color: var(--muted); font-size: 0.85em; }
</style>
