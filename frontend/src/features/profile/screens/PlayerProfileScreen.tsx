import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Share, View } from 'react-native';
import { chatApi } from '@/features/chat/api/chat.api';
import { teamsApi } from '@/features/teams/api/teams.api';
import { TeamRow } from '@/features/teams/components/TeamBits';
import { useResource } from '@/shared/hooks/useResource';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { useTheme } from '@/shared/theme';
import { Button, D, goBack, Header, IconButton, Label, Loading, Notice, Row, Screen, Sheet, T } from '@/shared/ui';
import { firstName } from '@/shared/utils/format';
import { usersApi } from '../api/profile.api';
import { FormTile, MatchHistoryRow } from '../components/ProfileBits';
import { ProfileHero, SportInsightsBlock } from '../components/ProfileV2';

/** Another player (design v2 profile): follow, message, start a match, ratings and performance per sport, head-to-head, teams, recent matches. */
export default function PlayerProfileScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, setData, error, loading } = useResource(() => usersApi.get(id), [id]);
  const teams = useResource(() => teamsApi.list({ userId: id }), [id]);
  const [more, setMore] = useState(false);
  const [copied, setCopied] = useState(false);
  const message = useSubmit();
  const [slug, setSlug] = useState<string | null>(null);
  const firstSlug = data?.user.sports[0]?.slug;
  const insightSlug = slug ?? firstSlug;
  const insights = useResource(() => usersApi.insights(id, insightSlug!), [id, insightSlug], { enabled: !!insightSlug && !data?.user.isMe });
  const follow = useSubmit();

  if (loading) return <Loading />;
  const u = data?.user;
  if (!u) {
    return (
      <Screen>
        <Header title="Player" />
        <Notice tone="error" icon="alert" text={error ?? 'Player not found.'} />
      </Screen>
    );
  }
  if (u.isMe) {
    router.replace('/profile');
    return null;
  }

  const first = firstName(u.fullName);
  const picked = u.sports.find((s) => s.slug === slug) ?? u.sports[0] ?? null;
  const record = u.sports.reduce((r, s) => ({ played: r.played + s.matchesPlayed, won: r.won + s.matchesWon, lost: r.lost + s.matchesLost }), { played: 0, won: 0, lost: 0 });
  const h2h = u.headToHead;
  const lead = h2h ? (h2h.wins > h2h.losses ? 'you lead' : h2h.wins < h2h.losses ? `${first} leads` : 'level') : null;

  const toggleFollow = () =>
    void follow.submit(async () => {
      const next = !u.isFollowing;
      setData({ user: { ...u, isFollowing: next, followers: u.followers + (next ? 1 : -1) } });
      try {
        const r = await (next ? usersApi.follow(u.id) : usersApi.unfollow(u.id));
        setData({ user: { ...u, isFollowing: r.isFollowing, followers: r.followers } });
      } catch (e) {
        setData({ user: u });
        throw e;
      }
    });

  const follows = (tab: 'followers' | 'following') =>
    router.push({ pathname: '/follows/[id]', params: { id: u.id, tab, username: u.username, followers: String(u.followers), following: String(u.following) } });

  return (
    <Screen edgeToEdge px={0} gap={0}>
      <ProfileHero
        title="Player"
        onBack={() => goBack('/')}
        actions={[{ icon: 'dots', label: 'More', onPress: () => setMore(true) }]}
        user={{ id: u.id, fullName: u.fullName, username: u.username, photoUrl: u.photoUrl, city: u.city, handedness: u.handedness }}
        followers={u.followers}
        following={u.following}
        onFollowers={() => follows('followers')}
        onFollowing={() => follows('following')}
        record={record}
        streak={u.streak}
        titles={u.titles}
      >
        <Row gap={8}>
          <Button
            label={u.isFollowing ? 'Following' : 'Follow'}
            variant={u.isFollowing ? 'outline' : 'surface'}
            textColor={u.isFollowing ? colors.onHero : colors.primary}
            height={44}
            radius={14}
            size={15}
            weight={700}
            style={{ flex: 1.3, ...(u.isFollowing ? { borderColor: colors.heroMuted, backgroundColor: 'transparent' } : { backgroundColor: colors.onHero }) }}
            onPress={toggleFollow}
          />
          <Button
            label="Message"
            variant="outline"
            textColor={colors.onHero}
            height={44}
            radius={14}
            size={15}
            style={{ flex: 1, borderColor: colors.heroMuted, backgroundColor: 'transparent' }}
            loading={message.submitting}
            onPress={() =>
              void message.submit(async () => {
                const { conversation } = await chatApi.create([u.id]);
                router.push({ pathname: '/chat/[id]', params: { id: conversation.id } });
              })
            }
          />
          <IconButton
            icon="play"
            label={`Start a match with ${first}`}
            tone="plain"
            size={44}
            color={colors.onHero}
            style={{ width: 44, borderWidth: 1, borderColor: colors.heroMuted, borderRadius: 22 }}
            onPress={() => router.push({ pathname: '/match/new', params: { with: u.id, withName: u.fullName } })}
          />
        </Row>
      </ProfileHero>

      <View style={{ paddingHorizontal: 20, paddingTop: 20, gap: 22 }}>
      {message.formError || follow.formError ? <Notice tone="error" icon="alert" text={(message.formError ?? follow.formError)!} /> : null}
      {u.bio ? (
        <T size={14} color={colors.soft}>
          {u.bio}
        </T>
      ) : null}

      {u.sports.length ? (
        <SportInsightsBlock sports={u.sports} picked={picked} onPick={setSlug} insights={insights.data?.insights ?? null} loading={insights.loading} error={insights.error} isMe={false} />
      ) : null}

      {h2h && (h2h.wins + h2h.losses + h2h.partnerWins + h2h.partnerLosses > 0) ? (
        <View style={{ padding: 16, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, gap: 12 }}>
          <Label>You and {first}</Label>
          <Row gap={12}>
            <View style={{ flex: 1, gap: 2 }}>
              <D size={32} lh={32}>
                {h2h.wins}–{h2h.losses}
              </D>
              <T size={13} color={colors.muted}>
                Head to head{lead ? `, ${lead}` : ''}
              </T>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <D size={32} lh={32}>
                {h2h.partnerWins}–{h2h.partnerLosses}
              </D>
              <T size={13} color={colors.muted}>
                As partners
              </T>
            </View>
          </Row>
          {h2h.recent.length ? (
            <Row gap={6}>
              {h2h.recent.map((r, i) => (
                <FormTile key={i} result={r} />
              ))}
              <T size={12} color={colors.muted} style={{ marginLeft: 'auto' }}>
                Latest last
              </T>
            </Row>
          ) : null}
        </View>
      ) : null}

      {teams.data?.teams.length ? (
        <View style={{ gap: 8 }}>
          <Label>Teams</Label>
          {teams.data.teams.map((t) => (
            <TeamRow key={t.id} team={t} />
          ))}
        </View>
      ) : null}

      {u.recentMatches.length ? (
        <View style={{ gap: 8 }}>
          {u.recentMatches.map((m) => (
            <MatchHistoryRow key={m.matchId} match={m} />
          ))}
        </View>
      ) : (
        <T size={14} color={colors.muted} center>
          No matches yet.
        </T>
      )}

      </View>

      <Sheet visible={more} onClose={() => setMore(false)}>
        <T size={17} w={700}>
          {u.fullName}
        </T>
        <Button label="Share profile" variant="raised" icon="share" onPress={() => void Share.share({ message: `${u.fullName} (@${u.username}) on ProjectX` })} />
        <Button
          label={copied ? 'Copied' : `Copy @${u.username}`}
          variant="raised"
          icon="copy"
          onPress={() => {
            void Clipboard.setStringAsync(`@${u.username}`);
            setCopied(true);
          }}
        />
        {u.isFollowing ? (
          <Button
            label={`Unfollow ${first}`}
            variant="outline"
            textColor={colors.bad}
            onPress={() => {
              setMore(false);
              toggleFollow();
            }}
          />
        ) : null}
      </Sheet>
    </Screen>
  );
}
