import type { EventStatus, FixtureStatus, TournamentStatus } from './types';

type BadgeTone = 'live' | 'ready' | 'readySolid' | 'pending' | 'neutral' | 'bad' | 'primary' | 'good' | 'progress';

/** "Registration open" for list meta lines. */
export function tournamentStatusLabel(status: TournamentStatus | EventStatus): string {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'registration_open':
      return 'Registration open';
    case 'registration_closed':
      return 'Registration closed';
    case 'drawn':
      return 'Draw out';
    case 'in_progress':
      return 'In progress';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
  }
}

/** The handoff's badge table: REGISTRATION OPEN (green), IN PROGRESS (red tint), EVENT COMPLETE. */
export function statusBadge(status: TournamentStatus | EventStatus, scope: 'tournament' | 'event' = 'tournament'): { label: string; tone: BadgeTone } | null {
  switch (status) {
    case 'registration_open':
      return { label: 'REGISTRATION OPEN', tone: 'ready' };
    case 'in_progress':
      return { label: 'IN PROGRESS', tone: 'progress' };
    case 'completed':
      return { label: scope === 'event' ? 'EVENT COMPLETE' : 'COMPLETE', tone: 'neutral' };
    case 'registration_closed':
      return { label: 'REGISTRATION CLOSED', tone: 'neutral' };
    case 'drawn':
      return { label: 'DRAW OUT', tone: 'neutral' };
    case 'draft':
      return { label: 'DRAFT', tone: 'pending' };
    case 'cancelled':
      return { label: 'CANCELLED', tone: 'bad' };
  }
}

/** LIVE (red) · READY (green) · WAITING (grey) · BYE, for fixtures (match live wins over the fixture status). */
export function fixtureBadge(status: FixtureStatus, matchStatus?: string | null): { label: string; tone: BadgeTone } | null {
  if (matchStatus === 'live' || status === 'live') return { label: 'LIVE', tone: 'live' };
  switch (status) {
    case 'ready':
      return { label: 'READY', tone: 'ready' };
    case 'pending':
      return { label: 'WAITING', tone: 'neutral' };
    case 'bye':
      return { label: 'BYE', tone: 'neutral' };
    case 'completed':
      return { label: 'FT', tone: 'neutral' };
    case 'cancelled':
      return { label: 'CANCELLED', tone: 'bad' };
    default:
      return null;
  }
}
