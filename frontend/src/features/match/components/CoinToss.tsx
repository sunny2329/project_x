import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Animated, Easing, Modal, Pressable, View } from 'react-native';
import { GOLD, useTheme } from '@/shared/theme';
import { Button, D, T } from '@/shared/ui';

const FLIP_MS = 1600;

function Face({ letter, name, back }: { letter: string; name: string; back?: boolean }) {
  return (
    <View
      style={{
        position: 'absolute',
        width: 168,
        height: 168,
        borderRadius: 84,
        backgroundColor: GOLD,
        borderWidth: 8,
        borderColor: '#C9A23F',
        alignItems: 'center',
        justifyContent: 'center',
        backfaceVisibility: 'hidden',
        ...(back ? { transform: [{ rotateY: '180deg' }] } : {}),
      }}
    >
      <D size={64} color="#5A4310">
        {letter}
      </D>
      <T size={12} w={700} color="#5A4310" numberOfLines={1} style={{ maxWidth: 120 }}>
        {name}
      </T>
    </View>
  );
}

/**
 * "Toss a coin": a full-screen flip that lands on side A or B at random, then says who won the
 * toss. The winner serves first (the caller picks that side).
 */
export function CoinToss({ visible, sides, onResult, onClose }: { visible: boolean; sides: [string, string]; onResult: (side: 0 | 1) => void; onClose: () => void }) {
  const { colors } = useTheme();
  const [spin] = useState(() => new Animated.Value(0));
  const [lift] = useState(() => new Animated.Value(0));
  const [result, setResult] = useState<0 | 1 | null>(null);
  const [flipping, setFlipping] = useState(false);

  const toss = () => {
    const side: 0 | 1 = Math.random() < 0.5 ? 0 : 1;
    // Whole turns land on face A; an extra half turn lands on B.
    const halfTurns = 10 + side;
    setResult(null);
    setFlipping(true);
    spin.setValue(0);
    lift.setValue(0);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    Animated.parallel([
      Animated.timing(spin, { toValue: halfTurns, duration: FLIP_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(lift, { toValue: 1, duration: FLIP_MS * 0.45, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(lift, { toValue: 0, duration: FLIP_MS * 0.55, easing: Easing.bounce, useNativeDriver: true }),
      ]),
    ]).start(() => {
      setFlipping(false);
      setResult(side);
      onResult(side);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    });
  };

  const rotateY = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const translateY = lift.interpolate({ inputRange: [0, 1], outputRange: [0, -140] });
  const scale = lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });

  return (
    <Modal visible={visible} transparent animationType="fade" onShow={toss} onRequestClose={onClose} statusBarTranslucent>
      <Pressable accessibilityLabel="Close" disabled={flipping} onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(5,8,15,0.85)', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 36 }}>
        <Animated.View accessibilityLabel={result === null ? 'Tossing the coin' : `Side ${result === 0 ? 'A' : 'B'}`} style={{ width: 168, height: 168, transform: [{ perspective: 800 }, { translateY }, { rotateY }, { scale }] }}>
          <Face letter="A" name={sides[0]} />
          <Face letter="B" name={sides[1]} back />
        </Animated.View>
        <View style={{ alignItems: 'center', gap: 6, minHeight: 70 }}>
          {result === null ? (
            <T size={16} w={600} color="#F6F2EE">
              Tossing…
            </T>
          ) : (
            <>
              <D size={34} upper color="#F6F2EE" center>
                {sides[result]} serve first
              </D>
              <T size={14} color="#ABA39B" center>
                Side {result === 0 ? 'A' : 'B'} won the toss.
              </T>
            </>
          )}
        </View>
        {result !== null ? (
          <View style={{ flexDirection: 'row', gap: 10, alignSelf: 'stretch' }}>
            <Button label="Toss again" variant="outline" textColor="#F6F2EE" style={{ flex: 1 }} onPress={toss} />
            <Button label="Done" style={{ flex: 1 }} color={colors.primary} textColor={colors.onPrimary} onPress={onClose} />
          </View>
        ) : null}
      </Pressable>
    </Modal>
  );
}
