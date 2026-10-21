import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, TextInput, View } from 'react-native';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useProfileStore } from '@/features/profile/store/profile.store';
import type { MatchHistoryItem } from '@/features/profile/types';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { pickPhoto, uploadPhoto } from '@/shared/media/upload';
import { bodyFont, useTheme } from '@/shared/theme';
import { Avatar, Button, D, Icon, Notice, Row, Screen, Sheet, T, Tap, TextButton } from '@/shared/ui';
import { shortDay, shortName } from '@/shared/utils/format';
import { feedApi } from '../api/feed.api';
import type { PostVisibility } from '../types';

const MAX_PHOTOS = 4;

function outcomeWord(m: Pick<MatchHistoryItem, 'outcome'>): string {
  return m.outcome === 'won' ? 'Won' : m.outcome === 'lost' ? 'Lost' : m.outcome === 'draw' ? 'Drew' : 'Played';
}

/** New post: text, up to 4 photos, an optional attached match, Followers or Public. */
export default function NewPostScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ matchId?: string }>();
  const me = useAuthStore((s) => s.user);
  const profile = useProfileStore((s) => s.profile);
  const matches = useProfileStore((s) => s.matches);
  const [content, setContent] = useState('');
  const [photos, setPhotos] = useState<{ uri: string; width: number; height: number }[]>([]);
  const [matchId, setMatchId] = useState<string | null>(params.matchId ?? null);
  const [visibility, setVisibility] = useState<PostVisibility>('followers');
  const [picking, setPicking] = useState(false);
  const { submit, submitting, formError } = useSubmit();

  useEffect(() => {
    if (!matches.length) void useProfileStore.getState().load().catch(() => undefined);
  }, [matches.length]);

  const attached = matches.find((m) => m.matchId === matchId) ?? null;
  const decided = matches.filter((m) => m.outcome !== 'in_progress');
  const canPost = !!content.trim() || photos.length > 0 || !!matchId;
  const name = profile?.displayName ?? shortName(me?.fullName ?? '');

  const addPhoto = async () => {
    if (photos.length >= MAX_PHOTOS) return;
    const photo = await pickPhoto();
    if (photo) setPhotos((p) => [...p, photo].slice(0, MAX_PHOTOS));
  };

  const post = () =>
    void submit(async () => {
      const media = await Promise.all(photos.map((p) => uploadPhoto(p)));
      await feedApi.createPost({ content: content.trim(), visibility, mediaIds: media.map((m) => m.id), ...(matchId ? { matchId } : {}) });
      router.back();
    });

  return (
    <Screen
      gap={18}
      bottom={20}
      scroll
      footer={
        <Row gap={8} style={{ borderTopWidth: 1, borderTopColor: colors.raised, paddingTop: 14 }}>
          <Button label="Photo" icon="photo" variant="surface" height={44} radius={12} size={14} weight={600} inline px={14} disabled={photos.length >= MAX_PHOTOS} onPress={() => void addPhoto()} />
          <Button label="Match" icon="cup" variant="surface" height={44} radius={12} size={14} weight={600} inline px={14} onPress={() => setPicking(true)} />
          <View style={{ marginLeft: 'auto' }}>
            <TextButton
              label={visibility === 'followers' ? 'Followers' : 'Public'}
              size={13}
              weight={600}
              color={colors.muted}
              onPress={() => setVisibility((v) => (v === 'followers' ? 'public' : 'followers'))}
            />
          </View>
        </Row>
      }
    >
      <Row between>
        <TextButton label="Cancel" size={16} weight={600} color={colors.muted} onPress={() => router.back()} />
        <T size={17} w={700}>
          New post
        </T>
        <Button label="Post" height={40} radius={12} size={15} weight={700} inline px={18} disabled={!canPost} loading={submitting} onPress={post} />
      </Row>

      <Row gap={12} style={{ alignItems: 'flex-start' }}>
        <Avatar name={me?.fullName ?? name} id={me?.id} photoUrl={profile?.photoUrl} size={40} />
        <View style={{ flex: 1, gap: 6 }}>
          <T size={14} w={600}>
            {name}
          </T>
          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder="How did it go?"
            placeholderTextColor={colors.faint}
            multiline
            autoFocus
            maxLength={2000}
            accessibilityLabel="Post text"
            style={{ color: colors.fg, fontFamily: bodyFont(400), fontSize: 17, lineHeight: 25, minHeight: 100, textAlignVertical: 'top', padding: 0 }}
          />
        </View>
      </Row>

      <View style={{ gap: 10, marginLeft: 52 }}>
        {photos.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {photos.map((p, i) => (
              <View key={p.uri} style={{ width: '48.5%', height: 140 }}>
                <Image source={{ uri: p.uri }} style={{ width: '100%', height: 140, borderRadius: 14, backgroundColor: colors.raised }} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remove photo"
                  onPress={() => setPhotos((list) => list.filter((_, j) => j !== i))}
                  style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(10,15,28,0.8)', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Icon name="close" size={14} color="#F6F2EE" />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
        {matchId ? (
          <Row gap={10} style={{ padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.line }}>
            <View style={{ width: 4, height: 36, borderRadius: 2, backgroundColor: attached?.sport.accentColor ?? colors.primary }} />
            <View style={{ flex: 1, gap: 2 }}>
              <T size={12} color={colors.muted}>
                Attached match{attached ? ` · ${attached.sport.name}` : ''}
              </T>
              <D size={18} w={800} numberOfLines={1}>
                {attached ? `${outcomeWord(attached)} ${attached.headline ?? ''}` : 'Match'}
              </D>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Remove match" onPress={() => setMatchId(null)} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" size={18} color={colors.muted} />
            </Pressable>
          </Row>
        ) : null}
        {formError ? <Notice tone="error" icon="alert" text={formError} /> : null}
      </View>

      <Sheet visible={picking} onClose={() => setPicking(false)} scroll>
        <T size={17} w={700}>
          Attach a match
        </T>
        {decided.length ? (
          decided.slice(0, 12).map((m) => (
            <Tap
              key={m.matchId}
              label={`${outcomeWord(m)} ${m.headline ?? ''}`}
              onPress={() => {
                setMatchId(m.matchId);
                setPicking(false);
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, backgroundColor: m.matchId === matchId ? colors.raised : colors.bg }}
            >
              <View style={{ width: 4, height: 36, borderRadius: 2, backgroundColor: m.sport.accentColor }} />
              <View style={{ flex: 1 }}>
                <T size={14} w={600} numberOfLines={1}>
                  {outcomeWord(m)} vs {m.opponents.join(' & ') || 'guest'}
                </T>
                <T size={12} color={colors.muted}>
                  {shortDay(m.playedAt)} · {m.sport.name}
                </T>
              </View>
              <D size={16} w={800}>
                {m.headline}
              </D>
            </Tap>
          ))
        ) : (
          <T size={14} color={colors.muted}>
            Your finished matches show up here.
          </T>
        )}
      </Sheet>
    </Screen>
  );
}
