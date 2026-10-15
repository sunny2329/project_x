/*
 * Server-rendered share pages. The HTML is a shell; page.js fetches the public JSON and polls
 * every few seconds while anything is live. Everything is drawn from the generic ScoreSummary
 * and fixture views, so there is no per-sport code here either.
 */

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function publicPage(title: string, kind: 'match' | 'tournament' | 'missing', key: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · Project X</title>
<style>
  :root { --bg:#ffffff; --fg:#111111; --muted:#6b7280; --card:#f5f5f5; --line:#e5e7eb; --accent:#ff6b00; --live:#ef4444; }
  @media (prefers-color-scheme: dark) { :root { --bg:#0b0b0b; --fg:#f5f5f5; --muted:#9ca3af; --card:#171717; --line:#262626; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--fg); font:15px/1.45 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
  main { max-width: 760px; margin: 0 auto; padding: 16px; }
  h1 { font-size: 22px; margin: 8px 0 4px; } h2 { font-size: 17px; margin: 24px 0 8px; }
  .muted { color: var(--muted); } .card { background: var(--card); border-radius: 12px; padding: 14px; margin: 10px 0; }
  .live { color: var(--live); font-weight: 700; font-size: 12px; letter-spacing: .06em; }
  .board { display:grid; grid-template-columns: 1fr auto auto; gap: 6px 14px; align-items:center; }
  .board .name { font-weight: 600; } .board .big { font-size: 28px; font-weight: 800; text-align:right; min-width: 36px; }
  .board .cur { font-size: 20px; font-variant-numeric: tabular-nums; color: var(--accent); text-align:right; min-width: 40px; }
  .serve::before { content: "●"; color: var(--accent); margin-right: 6px; font-size: 11px; }
  .winner { font-weight: 800; } .callout { margin-top: 8px; font-weight: 600; color: var(--accent); }
  table { width:100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
  th, td { padding: 6px 4px; border-bottom: 1px solid var(--line); text-align: right; } th:nth-child(2), td:nth-child(2) { text-align:left; }
  .tabs { display:flex; gap:8px; overflow-x:auto; padding-bottom:4px; }
  .tabs button { border:1px solid var(--line); background:var(--card); color:var(--fg); border-radius:999px; padding:6px 12px; font:inherit; cursor:pointer; white-space:nowrap; }
  .tabs button[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: #fff; }
  .bracket { display:flex; gap:12px; overflow-x:auto; padding-bottom: 8px; }
  .round { min-width: 190px; } .round h3 { font-size: 13px; color: var(--muted); margin: 0 0 6px; }
  .fx { background: var(--card); border-radius: 10px; padding: 8px 10px; margin-bottom: 8px; font-size: 14px; }
  .fx .row { display:flex; justify-content:space-between; gap: 8px; } .fx .meta { color: var(--muted); font-size: 12px; margin-top: 4px; }
</style>
</head>
<body>
<main id="app" data-kind="${kind}" data-key="${escapeHtml(key)}"><p class="muted">Loading…</p></main>
<script src="/public-assets/page.js" defer></script>
</body>
</html>`;
}

export const PUBLIC_PAGE_SCRIPT = String.raw`(() => {
  const app = document.getElementById('app');
  const kind = app.dataset.kind;
  const key = app.dataset.key;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const get = async (path) => {
    const res = await fetch('/api/v1/public' + path, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(res.status === 404 ? 'Not found' : 'Could not load');
    return (await res.json()).data;
  };
  let timer = null;
  const poll = (fn, ms) => { clearTimeout(timer); timer = setTimeout(fn, ms); };

  function scoreboard(m) {
    const s = m.score;
    const rows = m.sides.map((side) => {
      const ss = s.sides[side.index] || {};
      const won = s.winnerSideIndex === side.index;
      return '<div class="name ' + (ss.serving ? 'serve ' : '') + (won ? 'winner' : '') + '">' + esc(side.name) + '</div>' +
        '<div class="big">' + esc(ss.primary) + '</div><div class="cur">' + esc(ss.current ?? '') + '</div>';
    }).join('');
    const segs = s.segments.filter((g) => g.complete || g.scores.some((n) => n > 0));
    return '<div class="card"><div class="muted">' + esc(m.sport.name) + ' · ' + esc(m.format.name) + (m.ruleset.name ? ' · ' + esc(m.ruleset.name) : '') + '</div>' +
      (m.status === 'live' ? '<div class="live">● LIVE</div>' : '<div class="muted">' + esc(m.status === 'completed' ? 'Final' : m.status) + '</div>') +
      '<div class="board">' + rows + '</div>' +
      (s.callout ? '<div class="callout">' + esc(s.callout) + '</div>' : '') +
      (segs.length ? '<div class="muted" style="margin-top:8px">' + esc(s.headline) + '</div>' : '') + '</div>';
  }

  async function showMatch() {
    try {
      const { match } = await get('/matches/' + key);
      document.title = match.sides.map((s) => s.name).join(' v ') + ' · Live score';
      const t = match.tournament ? '<div class="muted">' + esc(match.tournament.name) + ' · ' + esc(match.tournament.eventName) + (match.tournament.roundName ? ' · ' + esc(match.tournament.roundName) : '') + '</div>' : '';
      app.innerHTML = '<h1>' + esc(match.sides.map((s) => s.name).join(' v ')) + '</h1>' + t + scoreboard(match);
      if (match.status === 'live') poll(showMatch, 3000);
    } catch (e) { app.innerHTML = '<p class="muted">' + esc(e.message) + '</p>'; }
  }

  const entryLine = (f, i) => {
    const e = f.entries[i];
    const name = e ? esc(e.name) : '<span class="muted">' + esc(f.placeholders[i] || 'TBD') + '</span>';
    const win = e && f.winnerEntryId === e.id;
    return '<div class="row"><span class="' + (win ? 'winner' : '') + '">' + name + '</span></div>';
  };
  const fixtureCard = (f) => '<div class="fx">' + entryLine(f, 0) + entryLine(f, 1) + '<div class="meta">' +
    (f.status === 'live' ? '<span class="live">● LIVE</span> ' : '') +
    (f.match && f.match.headline ? esc(f.match.headline) + (f.match.callout ? ' · ' + esc(f.match.callout) : '') : esc(f.status === 'bye' ? 'Bye' : f.status)) +
    (f.court ? ' · ' + esc(f.court.name) : '') + (f.scheduledAt ? ' · ' + esc(new Date(f.scheduledAt).toLocaleString()) : '') + '</div></div>';

  function eventHtml(ev) {
    let html = '';
    for (const stage of ev.stages) {
      html += '<h2>' + esc(stage.name) + '</h2>';
      const fixtures = ev.fixtures.filter((f) => f.stageId === stage.id);
      if (stage.type === 'knockout') {
        const rounds = [...new Set(fixtures.map((f) => f.round))].sort((a, b) => a - b);
        html += '<div class="bracket">' + rounds.map((r) => {
          const fs = fixtures.filter((f) => f.round === r);
          return '<div class="round"><h3>' + esc(fs[0].roundName || 'Round ' + r) + '</h3>' + fs.map(fixtureCard).join('') + '</div>';
        }).join('') + '</div>';
      } else {
        for (const g of stage.groups) {
          html += '<div class="card"><strong>' + esc(g.name) + '</strong>';
          if (g.standings) {
            html += '<table><thead><tr><th>#</th><th>Entry</th><th>P</th><th>W</th><th>L</th><th>+/−</th></tr></thead><tbody>' +
              g.standings.map((r) => '<tr><td>' + r.rank + '</td><td>' + esc(r.name) + '</td><td>' + r.played + '</td><td>' + r.won + '</td><td>' + r.lost + '</td><td>' + (r.majorWon - r.majorLost) + '</td></tr>').join('') + '</tbody></table>';
          }
          html += fixtures.filter((f) => f.groupId === g.id).map(fixtureCard).join('') + '</div>';
        }
      }
    }
    if (!ev.stages.length) html += '<p class="muted">The draw has not been made yet. ' + ev.entries.filter((e) => e.status === 'approved').length + ' entries so far.</p>';
    return html;
  }

  let selected = null;
  async function showTournament() {
    try {
      const { tournament: t } = await get('/tournaments/' + key);
      document.title = t.name;
      if (!selected && t.events.length) selected = t.events[0].id;
      let html = '<h1>' + esc(t.name) + '</h1><div class="muted">' + [t.venue && t.venue.name, t.startsOn, t.status.replace('_', ' ')].filter(Boolean).map(esc).join(' · ') + '</div>';
      html += '<div class="tabs" style="margin-top:12px">' + t.events.map((e) => '<button data-ev="' + e.id + '" aria-pressed="' + (e.id === selected) + '">' + esc(e.name) + '</button>').join('') + '</div>';
      let live = false;
      if (selected) {
        const { event } = await get('/tournament-events/' + selected);
        live = event.fixtures.some((f) => f.status === 'live');
        html += '<div class="muted" style="margin-top:8px">' + esc(event.sport.name) + ' · ' + esc(event.format.name) + ' · ' + esc(event.ruleset.name) + '</div>' + eventHtml(event);
      }
      app.innerHTML = html;
      app.querySelectorAll('[data-ev]').forEach((b) => b.addEventListener('click', () => { selected = b.dataset.ev; showTournament(); }));
      poll(showTournament, live ? 5000 : 30000);
    } catch (e) { app.innerHTML = '<p class="muted">' + esc(e.message) + '</p>'; }
  }

  if (kind === 'match') showMatch();
  else if (kind === 'tournament') showTournament();
  else app.innerHTML = '<p class="muted">Not found</p>';
})();`;
