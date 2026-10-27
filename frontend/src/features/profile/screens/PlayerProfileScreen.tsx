import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Share, View } from 'react-native';
import { chatApi } from '@/features/chat/api/chat.api';
import { useResource } from '@/shared/hooks/useResource';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { useTheme } from '@/shared/theme';
import { Button, D, ExpandableAvatar, Header, IconButton, Label, Loading, Notice, Row, Screen, Sheet, T } from '@/shared/ui';
import { firstName } from '@/shared/utils/format';
import { usersApi } from '../api/profile.api';
import { FollowCounts, FormTile, MatchHistoryRow, SportRatingCard } from '../components/ProfileBits';

/** Another player: follow, message, start a match with them, ratings, head-to-head and recent matches. */
export default function PlayerProfileScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, setData, error, loading } = useResource(() => usersApi.get(id), [id]);
  const [more, setMore] = useState(false);
  const [copied, setCopied] = useState(false);
  const message = useSubmit();
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

  return (
    <Screen gap={16}>
      <Header right={<IconButton icon="dots" label="More" onPress={() => setMore(true)} />} />

      <View style={{ alignItems: 'center', gap: 8 }}>
        <ExpandableAvatar name={u.fullName} id={u.id} photoUrl={u.photoUrl} size={88} display caption={`@${u.username}`} />
        <D size={34} lh={34} upper center>
          {u.fullName}
        </D>
        <T size={14} color={colors.muted} center>
          {[`@${u.username}`, u.city].filter(Boolean).join(' · ')}
        </T>
        <FollowCounts userId={u.id} username={u.username} followers={u.followers} following={u.following} center />
        {u.bio ? (
          <T size={14} color={colors.soft} center>
            {u.bio}
          </T>
        ) : null}
      </View>

      <Row gap={8}>
        {u.isFollowing ? (
          <Button label="Following" variant="outline" height={50} radius={14} size={15} style={{ flex: 1.3 }} onPress={toggleFollow} />
        ) : (
          <Button label="Follow" height={50} radius={14} size={15} weight={800} style={{ flex: 1.3 }} onPress={toggleFollow} />
        )}
        <Button
          label="Message"
          variant="outline"
          height={50}
          radius={14}
          size={15}
          style={{ flex: 1 }}
          loading={message.submitting}
          onPress={() =>
            void message.submit(async () => {
              const { conversation } = await chatApi.create([u.id]);
              router.push({ pathname: '/chat/[id]', params: { id: conversation.id } });
            })
          }
        />
        <IconButton
          icon="plus"
          label={`Start a match with ${first}`}
          tone="plain"
          size={50}
          style={{ width: 52, borderWidth: 1, borderColor: colors.line2 }}
          onPress={() => router.push({ pathname: '/match/new', params: { with: u.id, withName: u.fullName } })}
        />
      </Row>
      {message.formError || follow.formError ? <Notice tone="error" icon="alert" text={(message.formError ?? follow.formError)!} /> : null}

      {u.sports.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {u.sports.map((s) => (
            <SportRatingCard key={s.id} sport={s} />
          ))}
        </View>
      ) : null}

      {h2h && (h2h.wins + h2h.losses + h2h.partnerWins + h2h.partnerLosses > 0) ? (
        <View style={{ padding: 16, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, gap: 12 }}>
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
