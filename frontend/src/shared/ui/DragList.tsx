import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, PanResponder, Pressable, View, type PanResponderInstance } from 'react-native';
import { useTheme } from '@/shared/theme';
import { Icon } from './Icon';

/**
 * Rows of a fixed height that can be dragged into a new order by their handle (tiebreakers).
 * Also reachable without dragging: a long press on a row moves it up one place.
 */
export function DragList<T>({ items, keyOf, render, onChange, rowHeight = 50 }: { items: T[]; keyOf: (item: T) => string; render: (item: T, index: number) => ReactNode; onChange: (items: T[]) => void; rowHeight?: number }) {
  const { colors } = useTheme();
  const [dragging, setDragging] = useState<number | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const [dy] = useState(() => new Animated.Value(0));
  const latest = useRef({ items, onChange });
  useEffect(() => {
    latest.current = { items, onChange };
  });

  // One responder per row position, created once: a new one mid-drag would lose the gesture.
  const [responders] = useState(() => new Map<number, PanResponderInstance>());
  const responderFor = (index: number) => {
    const cached = responders.get(index);
    if (cached) return cached;
    const created = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Keep the drag when the screen's ScrollView wants to scroll.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        setDragging(index);
        setTarget(index);
        dy.setValue(0);
      },
      onPanResponderMove: (_, g) => {
        dy.setValue(g.dy);
        const n = latest.current.items.length;
        setTarget(Math.max(0, Math.min(n - 1, index + Math.round(g.dy / rowHeight))));
      },
      onPanResponderRelease: (_, g) => {
        const { items: list, onChange: change } = latest.current;
        const to = Math.max(0, Math.min(list.length - 1, index + Math.round(g.dy / rowHeight)));
        setDragging(null);
        setTarget(null);
        dy.setValue(0);
        if (to === index) return;
        const next = [...list];
        const [moved] = next.splice(index, 1);
        next.splice(to, 0, moved!);
        change(next);
      },
      onPanResponderTerminate: () => {
        setDragging(null);
        setTarget(null);
        dy.setValue(0);
      },
    });
    responders.set(index, created);
    return created;
  };

  const moveUp = (index: number) => {
    const { items: list, onChange: change } = latest.current;
    if (index === 0) return;
    const next = [...list];
    [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
    change(next);
  };

  return (
    <View style={{ borderRadius: 14, backgroundColor: colors.surface, overflow: 'visible' }}>
      {/* PanResponder handlers read the latest items through a ref, only while a drag runs. */}
      {/* eslint-disable-next-line react-hooks/refs */}
      {items.map((item, i) => {
        const active = dragging === i;
        // Rows between the dragged row and its target slide out of the way.
        let shift = 0;
        if (dragging !== null && target !== null && !active) {
          if (dragging < target && i > dragging && i <= target) shift = -rowHeight;
          if (dragging > target && i < dragging && i >= target) shift = rowHeight;
        }
        return (
          <Animated.View
            key={keyOf(item)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              height: rowHeight,
              paddingHorizontal: 14,
              gap: 12,
              borderBottomWidth: i === items.length - 1 ? 0 : 1,
              borderBottomColor: colors.raised,
              backgroundColor: active ? colors.raised : colors.surface,
              zIndex: active ? 2 : 1,
              elevation: active ? 4 : 0,
              transform: [{ translateY: active ? dy : shift }],
            }}
          >
            <Pressable accessibilityRole="button" accessibilityHint="Long press to move it up" onLongPress={() => moveUp(i)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, height: rowHeight }}>
              {render(item, i)}
            </Pressable>
            <View {...responderFor(i).panHandlers} accessibilityLabel="Drag to reorder" hitSlop={10} style={{ width: 32, height: rowHeight, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="drag" size={20} color={colors.muted} />
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}
