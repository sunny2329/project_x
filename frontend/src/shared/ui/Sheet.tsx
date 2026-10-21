import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/shared/theme';

/**
 * Bottom sheet: scrim, 28px top radius, a grab handle. Tapping the scrim closes it.
 * `height` fixes the sheet height (Add player is 740 of 844); otherwise it hugs its content.
 */
export function Sheet({ visible, onClose, children, height, scroll = false }: { visible: boolean; onClose: () => void; children: ReactNode; height?: number | `${number}%`; scroll?: boolean }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const body = (
    <View style={{ paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 12) + 20, gap: 16, ...(height && !scroll ? { flex: 1 } : {}) }}>{children}</View>
  );
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityLabel="Close" onPress={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5,8,15,0.6)' }} />
        <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10, maxHeight: '92%', ...(height ? { height } : {}) }}>
          <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.line2, marginBottom: 12 }} />
          {scroll ? <ScrollView keyboardShouldPersistTaps="handled">{body}</ScrollView> : body}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
