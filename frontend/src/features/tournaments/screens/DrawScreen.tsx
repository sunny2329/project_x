import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { useResource } from '@/shared/hooks/useResource';
import { useSubmit } from '@/shared/hooks/useSubmit';
import { sportText, useTheme, withAlpha } from '@/shared/theme';
import { Button, D, EmptyState, Field, Header, Icon, Label, Loading, Notice, Row, Screen, Sheet, T, TextButton } from '@/shared/ui';
import { tournamentsApi } from '../api/tournaments.api';
import { drawSummary, fixtureSide } from '../components/TournamentBits';
import type { DrawPreview, EventDetail } from '../types';

type PreviewStage = DrawPreview['preview'][number];
const short = (name: string) => name.split(' & ').map((p) => p.split(' ')[0]).join(' / ');

function Seed({ n }: { n: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ width: 20, height: 20, borderRadius: 6, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 6 }}>
      <T size={11} w={800} color={colors.ink}>
        {n}
      </T>
    </View>
  );
}

/** First-round pairs in two halves ("ROUND OF 16 · TOP HALF"). */
function KnockoutPreview({ stage }: { stage: PreviewStage }) {
  const { colors } = useTheme();
  const first = Math.min(...stage.fixtures.map((f) => f.round));
  const round = stage.fixtures.filter((f) => f.round === first).sort((a, b) => a.position - b.position);
  const half = Math.ceil(round.length / 2);
  const halves = round.length > 2 ? [round.slice(0, half), round.slice(half)] : [round];
  const name = (round[0]?.roundName ?? 'First round').toUpperCase();
  return (
    <>
      {halves.map((h, i) => (
        <View key={i} style={{ gap: 8 }}>
          <Row between gap={8}>
            <Label>{i === 0 ? `${name}${halves.length > 1 ? ' · TOP HALF' : ''}` : 'BOTTOM HALF'}</Label>
            {i === 0 && halves.length > 1 ? (
              <T size={12} color={colors.muted}>
                Seeds 1 & 2 can only meet in the final
              </T>
            ) : null}
          </Row>
          <View style={{ borderRadius: 14, backgroundColor: colors.surface, overflow: 'hidden' }}>
            {h.map((f, j) => (
              <Row key={f.position} gap={6} style={{ height: 42, paddingHorizontal: 12, borderBottomWidth: j === h.length - 1 ? 0 : 1, borderBottomColor: colors.raised }}>
                <T size={12} color={colors.muted} style={{ width: 44 }}>
                  R{f.round}-{f.position}
                </T>
                {[0, 1].map((s) => (
                  <View key={s} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 }}>
                    {s === 1 ? (
                      <T color={colors.faint} style={{ width: 24, textAlign: 'center' }}>
                        v
                      </T>
                    ) : null}
                    {f.seeds[s] ? <Seed n={f.seeds[s]!} /> : null}
                    <T size={14} w={f.seeds[s] ? 600 : 400} italic={f.slots[s] === 'Bye'} color={f.slots[s] === 'Bye' ? colors.faint : colors.fg} numberOfLines={1} style={{ flexShrink: 1 }}>
                      {short(f.slots[s] ?? '')}
                    </T>
                  </View>
                ))}
              </Row>
            ))}
          </View>
        </View>
      ))}
    </>
  );
}

function GroupsPreview({ stage, color, slug, qualifiers }: { stage: PreviewStage; color: string; slug: string; qualifiers: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 10 }}>
      {stage.groups.map((g) => (
        <View key={g.key} style={{ borderRadius: 14, backgroundColor: colors.surface, overflow: 'hidden' }}>
          <Row between style={{ paddingVertical: 10, paddingHorizontal: 14, backgroundColor: withAlpha(color, 0.14) }}>
            <D size={20} upper>
              {g.name}
            </D>
            {qualifiers ? (
              <T size={12} color={colors.soft}>
                Top {qualifiers} go through
              </T>
            ) : null}
          </Row>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 10, paddingHorizontal: 14, rowGap: 6 }}>
            {g.entries.map((e, i) => (
              <T key={e} size={13} color={g.seeds[i] ? colors.fg : colors.soft} style={{ width: '50%' }} numberOfLines={1}>
                {g.seeds[i] ? (
                  <T size={13} w={700} color={sportText(colors, slug)}>
                    {g.seeds[i]}{'  '}
                  </T>
                ) : null}
                {short(e)}
              </T>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

/** The saved draw: first-round pairs or groups, from the event itself. */
function SavedDraw({ event }: { event: EventDetail }) {
  const { colors } = useTheme();
  const stage = event.stages[0];
  if (!stage) return null;
  if (stage.type === 'round_robin') {
    return (
      <View style={{ gap: 10 }}>
        {stage.groups.map((g) => (
          <View key={g.id} style={{ borderRadius: 14, backgroundColor: colors.surface, overflow: 'hidden' }}>
            <View style={{ paddingVertical: 10, paddingHorizontal: 14, backgroundColor: withAlpha(event.sport.accentColor, 0.14) }}>
              <D size={20} upper>
                {g.name}
              </D>
            </View>
            <View style={{ paddingVertical: 10, paddingHorizontal: 14, gap: 6 }}>
              {(g.standings ?? []).map((r) => (
                <T key={r.entryId} size={13}>
                  {short(r.name)}
                </T>
              ))}
            </View>
          </View>
        ))}
      </View>
    );
  }
  const first = event.fixtures.filter((f) => f.stageId === stage.id && f.round === 1).sort((a, b) => a.position - b.position);
  return (
    <View style={{ borderRadius: 14, backgroundColor: colors.surface, overflow: 'hidden' }}>
      {first.map((f, j) => (
        <Row key={f.id} gap={6} style={{ height: 42, paddingHorizontal: 12, borderBottomWidth: j === first.length - 1 ? 0 : 1, borderBottomColor: colors.raised }}>
          <T size={12} color={colors.muted} style={{ width: 44 }}>
            R1-{f.position}
          </T>
          <T size={14} flex numberOfLines={1}>
            {fixtureSide(f, 0).name}
          </T>
          <T color={colors.faint}>v</T>
          <T size={14} flex numberOfLines={1} right>
            {fixtureSide(f, 1).name}
          </T>
        </Row>
      ))}
    </View>
  );
}

/** Draw preview (knockout or groups): reshuffle with a draw code, confirm; after saving, reset until a match is played. */
export default function DrawScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = useResource(() => tournamentsApi.event(id), [id]);
  const [preview, setPreview] = useState<DrawPreview | null>(null);
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState('');
  const shuffle = useSubmit();
  const save = useSubmit();

  const e = event.data?.event;
  const drawn = !!e && e.stages.length > 0;

  const load = useCallback(
    (seed?: number) =>
      void shuffle.submit(async () => {
        setPreview(await tournamentsApi.previewDraw(id, seed));
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id],
  );
  useEffect(() => {
    if (e && !drawn && !preview) load();
  }, [e, drawn, preview, load]);

  if (event.loading) return <Loading />;
  if (!e) {
    return (
      <Screen>
        <Header display="Draw preview" />
        <EmptyState title="Event not found" body={event.error ?? undefined} />
      </Screen>
    );
  }

  const approved = e.entries.filter((x) => x.status === 'approved').length;
  const qualifiers = e.drawFormat === 'groups_knockout' ? Number(e.drawConfig.qualifiersPerGroup ?? 2) : 0;
  const stage = preview?.preview[0];
  const played = e.fixtures.some((f) => f.status === 'completed' || f.status === 'live');

  const confirm = () =>
    void save.submit(async () => {
      if (!preview) return;
      await tournamentsApi.draw(id, preview.randomSeed);
      router.replace({ pathname: '/tournament/[id]/schedule', params: { id: e.tournament.id, event: e.id } });
    });

  const reset = () =>
    Alert.alert('Reset the draw?', 'All fixtures for this event are removed. You can make a new draw after.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset draw',
        style: 'destructive',
        onPress: () =>
          void save.submit(async () => {
            const r = await tournamentsApi.resetDraw(id);
            event.setData(r);
            setPreview(null);
          }),
      },
    ]);

  return (
    <Screen
      gap={12}
      footerBar
      footer={
        drawn ? (
          <Row gap={10}>
            <Button label="Reset draw" variant="outline" height={54} textColor={colors.bad} style={{ flex: 1 }} disabled={played} loading={save.submitting} onPress={reset} />
            <Button label="Schedule" height={54} weight={800} style={{ flex: 1.4 }} onPress={() => router.push({ pathname: '/tournament/[id]/schedule', params: { id: e.tournament.id, event: e.id } })} />
          </Row>
        ) : (
          <Row gap={10}>
            <Button label="Reshuffle" icon="shuffle" variant="outline" height={54} style={{ flex: 1 }} loading={shuffle.submitting} onPress={() => load()} />
            <Button label="Confirm draw" height={54} weight={800} style={{ flex: 1.4 }} disabled={!preview} loading={save.submitting} onPress={confirm} />
          </Row>
        )
      }
    >
      <Header kicker={`${e.name} · ${drawSummary(e).toLowerCase()} · ${approved}`} display={drawn ? 'Draw' : 'Draw preview'} />

      {drawn ? (
        <Row gap={10} style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.raised }}>
          <Icon name="check" size={18} color={colors.good} />
          <T size={13} color={colors.soft} flex>
            {played ? 'Saved. Matches have started, so the draw can’t be reset.' : 'Saved. You can reset it until the first match is played.'}
          </T>
        </Row>
      ) : preview ? (
        <Row gap={10} style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.warnBg }}>
          <Icon name="eye" size={18} color={colors.warnText} />
          <T size={13} color={colors.warnText} flex>
            Not saved yet · draw code {preview.randomSeed}
          </T>
          <TextButton label="Use a code" size={13} color={colors.warnText} onPress={() => setCodeOpen(true)} />
        </Row>
      ) : null}

      {shuffle.formError || save.formError ? <Notice tone="error" icon="alert" text={(shuffle.formError ?? save.formError)!} /> : null}

      {drawn ? (
        <SavedDraw event={e} />
      ) : stage ? (
        stage.type === 'knockout' ? (
          <KnockoutPreview stage={stage} />
        ) : (
          <GroupsPreview stage={stage} color={e.sport.accentColor} slug={e.sport.slug} qualifiers={qualifiers} />
        )
      ) : !shuffle.formError ? (
        <Loading />
      ) : null}

      {!drawn && stage ? (
        stage.type === 'knockout' ? (
          <T size={13} color={colors.muted}>
            Seeds placed first. Everyone else is shuffled. The same code always gives the same draw.
          </T>
        ) : (
          <Row gap={10} style={{ alignItems: 'flex-start', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.raised }}>
            <Icon name="snake" size={18} color={colors.soft} />
            <T size={13} lh={19} color={colors.soft} flex>
              Snake seeding: seeds go A, B, C then C, B, A so every group gets a fair mix.{qualifiers ? ' Knockout pairs group winners with other groups’ runners-up.' : ''}
            </T>
          </Row>
        )
      ) : null}

      <Sheet visible={codeOpen} onClose={() => setCodeOpen(false)}>
        <T size={20} w={700}>
          Use a draw code
        </T>
        <T size={13} color={colors.muted}>
          The same code always gives the same draw, so anyone can check it was fair.
        </T>
        <Field label="Draw code" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 10))} keyboardType="number-pad" display size={28} height={60} background={colors.bg} autoFocus />
        <Button
          label="Show this draw"
          disabled={!code}
          onPress={() => {
            setCodeOpen(false);
            load(Number(code));
          }}
        />
      </Sheet>
    </Screen>
  );
}
