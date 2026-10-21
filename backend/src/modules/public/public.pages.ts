/*
 * Server-rendered share pages (ProjectX-UI: PublicMatch, PublicTournament). The HTML is a shell;
 * page.js fetches the public JSON and polls while anything is live. Everything is drawn from the
 * generic ScoreSummary and fixture views, so there is no per-sport code here either.
 */

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Opens the installed app (expo-router path) — the stores aren't live yet. */
const APP_LINK = 'projectx://';

export function publicPage(title: string, kind: 'match' | 'tournament' | 'missing', key: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · ProjectX</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800;900&family=Instrument+Sans:wght@400;500;600;700&display=swap">
<style>
  :root { --bg:#0A0A0A; --fg:#F6F2EE; --muted:#ABA39B; --primary:#E85D04; --onPrimary:#0A0A0A; --accent:#FF8A3D;
          --page:#F2F4F8; --ink:#0A0A0A; --card:#FFFFFF; --line:#DDE2EC; --hair:#EEF1F6; --sub:#4B5570; --dim:#8A93A8; --live:#FF5468; --good:#15803D; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--page); color:var(--ink); font:15px/1.45 'Instrument Sans', system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
  a { color: inherit; text-decoration: none; }
  .d { font-family: 'Big Shoulders Display', 'Arial Narrow', Impact, sans-serif; }
  header { display:flex; align-items:center; gap:12px; padding:18px 20px 14px; background:var(--bg); color:var(--fg); }
  header .brand { font-size:22px; font-weight:900; letter-spacing:.04em; } header .brand span { color:var(--accent); }
  header .url { flex:1; font-size:12px; color:var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .btn { display:inline-flex; align-items:center; justify-content:center; gap:8px; border:0; cursor:pointer; font:inherit; font-weight:700; }
  header .btn { height:36px; padding:0 14px; border-radius:10px; background:var(--primary); color:var(--onPrimary); font-size:13px; }
  main { max-width: 560px; margin: 0 auto; padding: 22px 20px 28px; display:flex; flex-direction:column; gap:16px; min-height: calc(100vh - 68px); }
  .kicker { display:flex; align-items:center; gap:8px; font-size:13px; font-weight:700; letter-spacing:.04em; }
  .dot { width:8px; height:8px; border-radius:4px; display:inline-block; }
  h1 { margin:0; font-size:40px; line-height:40px; font-weight:900; text-transform:uppercase; }
  .sub { font-size:14px; color:var(--sub); }
  .card { border-radius:20px; background:var(--card); border:1px solid var(--line); overflow:hidden; }
  .grid { display:grid; align-items:center; padding:12px 16px; }
  .grid .h { font-size:11px; font-weight:700; letter-spacing:.08em; color:var(--sub); text-align:center; }
  .grid .n { text-align:center; font-size:26px; font-weight:900; } .grid .n.lose { font-weight:800; color:var(--dim); }
  .side { display:flex; align-items:center; gap:8px; font-size:16px; } .side .bar { width:4px; height:24px; border-radius:2px; }
  .hair { height:1px; background:var(--hair); margin:0 16px; }
  .row2 { display:flex; gap:8px; } .row2 .btn { flex:1; height:48px; border-radius:14px; background:var(--card); border:1px solid var(--line); font-size:14px; color:var(--ink); }
  .cta { margin-top:auto; display:flex; flex-direction:column; gap:12px; padding:20px; border-radius:22px; background:var(--bg); color:var(--fg); }
  .cta .t { font-size:30px; line-height:30px; font-weight:900; text-transform:uppercase; } .cta .s { font-size:14px; line-height:20px; color:var(--muted); }
  .cta .two { display:grid; grid-template-columns:1fr 1fr; gap:8px; } .cta .btn { height:48px; border-radius:12px; background:var(--primary); color:var(--onPrimary); font-size:14px; }
  .badge { align-self:flex-start; padding:3px 8px; border-radius:6px; font-size:11px; font-weight:800; letter-spacing:.06em; }
  .live { background:var(--live); color:var(--ink); }
  .label { display:flex; justify-content:space-between; font-size:12px; font-weight:700; letter-spacing:.08em; color:var(--sub); }
  .label span:last-child { font-weight:600; letter-spacing:0; }
  .fx { display:flex; flex-direction:column; gap:6px; padding:12px 14px; border-radius:14px; background:var(--card); border:1px solid var(--line); }
  .fx .m { font-size:12px; color:var(--sub); } .fx .r { display:flex; justify-content:space-between; } .fx .r.b { font-weight:700; } .fx .r.l { color:var(--sub); }
  .fx .r .d { font-size:20px; }
  .list a, .list div.item { display:flex; align-items:center; gap:10px; padding:12px 14px; border-bottom:1px solid var(--hair); cursor:pointer; }
  .list > :last-child { border-bottom:0; } .list .nm { flex:1; font-weight:600; } .list .st { font-size:13px; color:var(--sub); }
  .tabs { display:flex; gap:8px; overflow-x:auto; } .tabs button { height:34px; padding:0 14px; border-radius:17px; border:1px solid var(--line); background:var(--card); font:inherit; font-size:13px; font-weight:600; cursor:pointer; white-space:nowrap; }
  .tabs button[aria-pressed="true"] { background:var(--primary); color:var(--onPrimary); border-color:var(--primary); font-weight:700; }
  table { width:100%; border-collapse:collapse; font-variant-numeric:tabular-nums; font-size:14px; }
  th { font-size:11px; letter-spacing:.06em; color:var(--sub); font-weight:700; padding:10px 6px; text-align:center; }
  td { padding:10px 6px; border-top:1px solid var(--hair); text-align:center; } td.l, th.l { text-align:left; }
  .q { margin-left:4px; padding:1px 5px; border-radius:4px; background:#4ADE80; color:var(--ink); font-size:10px; font-weight:800; }
  .bracket { display:flex; gap:12px; overflow-x:auto; padding-bottom:6px; } .round { min-width:190px; display:flex; flex-direction:column; gap:8px; }
  .round h3 { margin:0; font-size:12px; color:var(--sub); letter-spacing:.06em; text-transform:uppercase; }
  .ph { color:var(--dim); font-style:italic; } .win { font-weight:800; }
  .muted { color:var(--sub); }
  .toast { position:fixed; left:50%; bottom:24px; transform:translateX(-50%); padding:10px 16px; border-radius:12px; background:var(--bg); color:var(--fg); font-size:14px; display:none; }
</style>
</head>
<body>
<header>
  <span class="d brand">PROJECT<span>X</span></span>
  <span class="url" id="url"></span>
  <a class="btn" id="open" href="${APP_LINK}">Open app</a>
</header>
<main id="app" data-kind="${kind}" data-key="${escapeHtml(key)}"><p class="muted">Loading…</p></main>
<div class="toast" id="toast"></div>
<script src="/public-assets/page.js" defer></script>
</body>
</html>`;
}

export const PUBLIC_PAGE_SCRIPT = String.raw`(() => {
  const app = document.getElementById('app');
  const kind = app.dataset.kind;
  const key = app.dataset.key;
  const APP = 'projectx://';
  document.getElementById('url').textContent = location.host + location.pathname;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const get = async (path) => {
    const res = await fetch('/api/v1/public' + path, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(res.status === 404 ? 'Not found' : 'Could not load');
    return (await res.json()).data;
  };
  const toast = (text) => { const t = document.getElementById('toast'); t.textContent = text; t.style.display = 'block'; setTimeout(() => (t.style.display = 'none'), 1800); };
  let timer = null;
  const poll = (fn, ms) => { clearTimeout(timer); timer = setTimeout(fn, ms); };
  const day = (iso) => iso ? new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : '';
  const range = (a, b) => {
    if (!a) return '';
    const x = new Date(a), y = b ? new Date(b) : null;
    const m = (d) => d.toLocaleDateString(undefined, { month: 'short' });
    if (!y || a === b) return x.getDate() + ' ' + m(x);
    return x.getMonth() === y.getMonth() ? x.getDate() + '–' + y.getDate() + ' ' + m(y) : x.getDate() + ' ' + m(x) + ' – ' + y.getDate() + ' ' + m(y);
  };
  const cta = (title, sub) => '<div class="cta"><span class="d t">' + title + '</span><span class="s">' + sub + '</span>' +
    '<div class="two"><a class="btn" href="' + APP + '">App Store</a><a class="btn" href="' + APP + '">Google Play</a></div></div>';

  function copyLink() {
    const url = location.href;
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => toast('Link copied'), () => { prompt('Copy this link', url); });
  }
  function whatsapp(text) { window.open('https://wa.me/?text=' + encodeURIComponent(text + ' ' + location.href), '_blank'); }

  // -------------------------------------------------------------------------- match
  async function showMatch() {
    try {
      const { match: m } = await get('/matches/' + key);
      const s = m.score;
      const names = m.sides.map((x) => x.name);
      const w = s.winnerSideIndex;
      const live = m.status === 'live';
      const title = live ? names.join(' v ') : w !== null && w !== undefined ? names[w] + ' beat ' + names[1 - w] : names.join(' v ');
      document.title = title + ' · ProjectX';
      document.getElementById('open').href = APP + 'match/' + m.id;
      const round = m.tournament && m.tournament.roundName ? ' · ' + m.tournament.roundName : live ? '' : ' · FINAL';
      const mins = m.startedAt && m.completedAt ? Math.max(1, Math.round((new Date(m.completedAt) - new Date(m.startedAt)) / 60000)) : null;
      const meta = [day(m.completedAt || m.startedAt), m.venue && m.venue.name, mins && mins < 600 ? mins + ' min' : null].filter(Boolean).map(esc).join(' · ');
      const segs = s.segments.filter((g) => g.complete || g.scores.some((n) => n > 0));
      const cols = segs.length;
      const label = s.totals.majorLabel === 'Sets' ? 'S' : 'G';
      const tpl = 'minmax(0,1fr) ' + (cols ? 'repeat(' + cols + ', 44px)' : '') + (live ? ' 64px' : '');
      const head = '<div class="grid" style="grid-template-columns:' + tpl + ';padding-bottom:4px"><span></span>' +
        segs.map((g, i) => '<span class="h">' + label + (i + 1) + '</span>').join('') + (live ? '<span class="h">NOW</span>' : '') + '</div>';
      const row = (i) => '<div class="grid" style="grid-template-columns:' + tpl + '"><span class="side" style="' + (w === i ? 'font-weight:700' : 'color:var(--sub)') + '">' +
        '<span class="bar" style="background:' + (w === i || (live && i === 0) ? m.sport.accentColor : 'transparent') + '"></span>' + esc(names[i]) + '</span>' +
        segs.map((g) => '<span class="d n' + (g.winnerSideIndex === i ? '' : ' lose') + '">' + esc(g.display ? g.display[i] : g.scores[i]) + '</span>').join('') +
        (live ? '<span class="d n" style="color:' + m.sport.accentColor + '">' + esc(s.sides[i].current ?? '') + '</span>' : '') + '</div>';
      app.innerHTML =
        '<div style="display:flex;flex-direction:column;gap:4px">' +
          '<span class="kicker" style="color:' + m.sport.accentColor + '"><span class="dot" style="background:' + m.sport.accentColor + '"></span>' +
            esc((m.sport.name + ' · ' + m.format.name + round).toUpperCase()) + '</span>' +
          (live ? '<span class="badge live">LIVE</span>' : '') +
          '<h1 class="d">' + esc(title) + '</h1>' +
          '<span class="sub">' + meta + '</span>' +
        '</div>' +
        '<div class="card">' + head + row(0) + '<div class="hair"></div>' + row(1) +
          (live && s.callout ? '<div style="padding:12px 16px;font-weight:800" class="d">' + esc(s.callout.toUpperCase()) + '</div>' : '') + '</div>' +
        '<div class="row2"><button class="btn" id="copy">Copy link</button><button class="btn" id="wa">WhatsApp</button></div>' +
        cta('Score your own matches', 'One tap per point. Rules for five racket sports built in. Free.');
      document.getElementById('copy').onclick = copyLink;
      document.getElementById('wa').onclick = () => whatsapp(title + ' ' + s.headline);
      if (live) poll(showMatch, 3000);
    } catch (e) { app.innerHTML = '<p class="muted">' + esc(e.message) + '</p>'; }
  }

  // ---------------------------------------------------------------------- tournament
  const entryName = (f, i) => f.entries[i] ? esc(f.entries[i].name) : '<span class="ph">' + esc(f.placeholders[i] || 'TBD') + '</span>';
  const liveCard = (f) => {
    const sides = (f.match && f.match.sides) || [];
    const done = (f.match && f.match.segments) || [];
    const score = (i) => {
      const prev = done.slice(0, -1).map((g) => g[i]).join(' ');
      const cur = sides[i] ? sides[i].current : '';
      return (prev ? prev + ' · ' : '') + (cur ?? '');
    };
    return '<a class="fx" href="/s/' + esc(f.match ? f.match.shareToken : '') + '">' +
      '<span class="m">' + esc([f.court && f.court.name, f.event.name, f.groupName || f.roundName].filter(Boolean).join(' · ')) + '</span>' +
      '<span class="r b"><span>' + entryName(f, 0) + '</span><span class="d">' + esc(score(0)) + '</span></span>' +
      '<span class="r l"><span>' + entryName(f, 1) + '</span><span class="d">' + esc(score(1)) + '</span></span></a>';
  };
  const fixtureCard = (f) => '<div class="fx"><span class="m">' + esc([f.roundName || f.groupName, f.court && f.court.name].filter(Boolean).join(' · ')) +
    (f.status === 'live' ? ' <span class="badge live">LIVE</span>' : '') + '</span>' +
    '<span class="r ' + (f.winnerEntryId && f.entries[0] && f.winnerEntryId === f.entries[0].id ? 'b' : '') + '"><span>' + entryName(f, 0) + '</span></span>' +
    '<span class="r ' + (f.winnerEntryId && f.entries[1] && f.winnerEntryId === f.entries[1].id ? 'b' : 'l') + '"><span>' + entryName(f, 1) + '</span></span>' +
    (f.match && f.match.headline ? '<span class="m d" style="font-size:16px;color:var(--ink)">' + esc(f.match.headline) + '</span>' : '') + '</div>';

  function eventHtml(ev) {
    let html = '';
    for (const stage of ev.stages) {
      const fixtures = ev.fixtures.filter((f) => f.stageId === stage.id);
      html += '<div class="label"><span>' + esc(stage.name.toUpperCase()) + '</span></div>';
      if (stage.type === 'knockout') {
        const rounds = [...new Set(fixtures.map((f) => f.round))].sort((a, b) => a - b);
        html += '<div class="bracket">' + rounds.map((r) => {
          const fs = fixtures.filter((f) => f.round === r);
          return '<div class="round"><h3>' + esc(fs[0].roundName || 'Round ' + r) + '</h3>' + fs.map(fixtureCard).join('') + '</div>';
        }).join('') + '</div>';
      } else {
        for (const g of stage.groups) {
          html += '<div class="card"><div style="padding:12px 14px;font-weight:800" class="d">' + esc(g.name.toUpperCase()) + '</div>';
          if (g.standings) {
            const q = (ev.drawConfig && ev.drawConfig.qualifiersPerGroup) || 0;
            html += '<table><thead><tr><th>#</th><th class="l">' + (ev.format.playersPerSide > 1 ? 'PAIR' : 'PLAYER') + '</th><th>P</th><th>W</th><th>L</th><th>G±</th><th>PTS±</th></tr></thead><tbody>' +
              g.standings.map((r) => '<tr><td>' + r.rank + '</td><td class="l">' + esc(r.name) + (stage.sequence === 1 && ev.stages.length > 1 && r.rank <= q ? '<span class="q">Q</span>' : '') + '</td><td>' + r.played + '</td><td>' + r.won + '</td><td>' + r.lost + '</td><td>' + (r.majorWon - r.majorLost) + '</td><td>' + (r.minorWon - r.minorLost) + '</td></tr>').join('') + '</tbody></table>';
          }
          html += '</div>';
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
      document.title = t.name + ' · ProjectX';
      document.getElementById('open').href = APP + 'tournaments/' + t.id;
      const events = await Promise.all(t.events.map((e) => get('/tournament-events/' + e.id).then((r) => r.event)));
      const liveNow = events.flatMap((ev) => ev.fixtures.filter((f) => f.status === 'live'));
      const dayNo = t.startsOn ? Math.floor((Date.now() - new Date(t.startsOn).getTime()) / 86400000) + 1 : null;
      const badge = t.status === 'in_progress' ? '<span class="badge live">LIVE' + (dayNo && dayNo > 0 ? ' · DAY ' + dayNo : '') + '</span>'
        : t.status === 'registration_open' ? '<span class="badge" style="background:#4ADE80">REGISTRATION OPEN</span>'
        : t.status === 'completed' ? '<span class="badge" style="background:var(--hair)">COMPLETE</span>' : '';
      const stageLabel = (ev) => {
        const live = ev.fixtures.find((f) => f.status === 'live' || f.status === 'ready');
        if (live) return live.stageType === 'round_robin' ? (ev.stages.length > 1 ? 'Groups' : 'Round robin') : (live.roundName || 'Knockout') + (live.roundName && !/s$/.test(live.roundName) && live.roundName !== 'Final' ? 's' : '');
        return ev.drawFormat === 'knockout' ? 'Knockout' : ev.drawFormat === 'round_robin' ? 'Round robin' : 'Groups + knockout';
      };
      let html =
        '<div style="display:flex;flex-direction:column;gap:6px">' + badge +
          '<h1 class="d" style="font-size:42px">' + esc(t.name) + '</h1>' +
          '<span class="sub">' + esc([range(t.startsOn, t.endsOn), t.venue && t.venue.name].filter(Boolean).join(' · ')) + '</span></div>';
      if (liveNow.length) {
        html += '<div style="display:flex;flex-direction:column;gap:8px"><div class="label"><span>ON COURT NOW</span><span>Refreshes by itself</span></div>' + liveNow.map(liveCard).join('') + '</div>';
      }
      html += '<div style="display:flex;flex-direction:column;gap:8px"><div class="label"><span>EVENTS</span></div><div class="card list">' +
        events.map((ev) => '<div class="item" data-ev="' + ev.id + '"><span class="bar" style="width:4px;height:24px;border-radius:2px;background:' + ev.sport.accentColor + '"></span>' +
          '<span class="nm">' + esc(ev.name) + '</span><span class="st">' + esc(stageLabel(ev)) + '</span></div>').join('') + '</div></div>';
      const ev = events.find((e) => e.id === selected);
      if (ev) html += '<div style="display:flex;flex-direction:column;gap:10px">' + eventHtml(ev) + '</div>';
      html += '<a class="btn" href="' + APP + '" style="margin-top:auto;height:54px;border-radius:16px;background:var(--bg);color:var(--fg);font-weight:800;font-size:15px">Get the app to follow every point</a>';
      app.innerHTML = html;
      app.querySelectorAll('[data-ev]').forEach((b) => b.addEventListener('click', () => { selected = selected === b.dataset.ev ? null : b.dataset.ev; showTournament(); }));
      poll(showTournament, liveNow.length ? 5000 : 30000);
    } catch (e) { app.innerHTML = '<p class="muted">' + esc(e.message) + '</p>'; }
  }

  if (kind === 'match') showMatch();
  else if (kind === 'tournament') showTournament();
  else app.innerHTML = '<p class="muted">Not found</p>';
})();`;
