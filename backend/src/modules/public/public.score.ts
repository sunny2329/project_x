/*
 * Live scoreboard helpers for the share page (design v2 "Live scoreboard"). They are inlined into
 * the browser script with Function.prototype.toString, so each must be self-contained: no imports,
 * no references to other module-level names, plain data in and out.
 */

interface Rally {
  type: string;
  sideIndex?: unknown;
}

/** Running lead of side 0 after each of the last `limit` rallies (positive = side 0 ahead), starting at 0. */
export function momentum(events: Rally[], limit: number): number[] {
  const rallies = events.filter((e) => e.type === 'rally_won' && (e.sideIndex === 0 || e.sideIndex === 1)).slice(-limit);
  const out = [0];
  for (const e of rallies) out.push(out[out.length - 1]! + (e.sideIndex === 0 ? 1 : -1));
  return out;
}

/** Longest run of rallies in a row for each side: [side 0, side 1]. */
export function bestRuns(events: Rally[]): [number, number] {
  const best: [number, number] = [0, 0];
  let side = -1;
  let run = 0;
  for (const e of events) {
    if (e.type !== 'rally_won' || (e.sideIndex !== 0 && e.sideIndex !== 1)) continue;
    run = e.sideIndex === side ? run + 1 : 1;
    side = e.sideIndex;
    if (run > best[side]!) best[side] = run;
  }
  return best;
}

/**
 * The last `n` rallies, newest first, each with who won it and, in rally scoring, the game score
 * after it ("14-11"). The score is rebuilt backwards from the game in play, so it stops at the
 * start of that game; side-out and tennis rallies carry no score.
 */
export function latestPoints(
  events: Rally[],
  scoringModel: string,
  current: number[] | null,
  n: number,
): { side: number; score: string | null }[] {
  const rallies = events.filter((e) => e.type === 'rally_won' && (e.sideIndex === 0 || e.sideIndex === 1));
  const out: { side: number; score: string | null }[] = [];
  const s = scoringModel === 'rally' && current && current.length === 2 ? [current[0]!, current[1]!] : null;
  for (let i = rallies.length - 1; i >= 0 && out.length < n; i -= 1) {
    const side = rallies[i]!.sideIndex as number;
    const valid = s !== null && s[0]! + s[1]! > 0 && s[side]! > 0;
    out.push({ side, score: valid ? `${s![0]}-${s![1]}` : null });
    if (valid) s![side] = s![side]! - 1;
    else if (s) s[0] = s[1] = 0; // crossed into the previous game: stop scoring the rest
  }
  return out;
}

/** SVG polyline points for a momentum series in a w×h box (0 lead on the middle line). */
export function sparkPoints(series: number[], w: number, h: number): string {
  if (series.length < 2) return '';
  const peak = Math.max(3, ...series.map((v) => Math.abs(v)));
  const step = w / (series.length - 1);
  return series.map((v, i) => `${(i * step).toFixed(1)},${(h / 2 - (v / peak) * (h / 2 - 4)).toFixed(1)}`).join(' ');
}

/** The helpers' source for the browser script. */
export const SCORE_HELPERS_JS = [momentum, bestRuns, latestPoints, sparkPoints].map((f) => f.toString()).join('\n');
