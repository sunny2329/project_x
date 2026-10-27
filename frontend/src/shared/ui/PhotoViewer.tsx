import { useEffect, useState, type ComponentProps } from 'react';
import { Animated, Image, Modal, Pressable, useWindowDimensions, View } from 'react-native';
import { Avatar, mediaUri } from './Display';
import { T } from './Text';

/**
 * A profile photo enlarged over a dimmed screen, Instagram-style: it springs up from small,
 * and a tap anywhere (or Back) closes it.
 */
export function PhotoViewer({ photoUrl, name, caption, onClose }: { photoUrl: string | null; name: string; caption?: string; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const [progress] = useState(() => new Animated.Value(0));
  const uri = mediaUri(photoUrl);
  const size = Math.min(width - 64, height * 0.5, 360);

  useEffect(() => {
    if (!uri) return;
    progress.setValue(0);
    Animated.spring(progress, { toValue: 1, useNativeDriver: true, friction: 7, tension: 80 }).start();
  }, [uri, progress]);

  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable accessibilityRole="button" accessibilityLabel="Close photo" onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(5,8,15,0.88)', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
        {uri ? (
          <Animated.View
            style={{
              opacity: progress,
              transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }],
              width: size,
              height: size,
              borderRadius: size / 2,
              overflow: 'hidden',
              backgroundColor: '#111',
            }}
          >
            <Image source={{ uri }} style={{ width: size, height: size }} accessibilityLabel={`${name}'s photo`} accessibilityIgnoresInvertColors />
          </Animated.View>
        ) : null}
        <View style={{ alignItems: 'center', gap: 2, paddingHorizontal: 24 }}>
          <T size={17} w={700} color="#fff" center numberOfLines={1}>
            {name}
          </T>
          {caption ? (
            <T size={14} color="rgba(255,255,255,0.65)" center numberOfLines={1}>
              {caption}
            </T>
          ) : null}
        </View>
      </Pressable>
    </Modal>
  );
}

/** An Avatar that opens the PhotoViewer when tapped (only when there is a photo to show). */
export function ExpandableAvatar({ caption, ...avatar }: ComponentProps<typeof Avatar> & { caption?: string }) {
  const [open, setOpen] = useState(false);
  if (!avatar.photoUrl) return <Avatar {...avatar} />;
  return (
    <>
      <Pressable accessibilityRole="imagebutton" accessibilityLabel={`View ${avatar.name}'s photo`} onPress={() => setOpen(true)} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
        <Avatar {...avatar} />
      </Pressable>
      {open ? <PhotoViewer photoUrl={avatar.photoUrl} name={avatar.name} caption={caption} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
