import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { apiRequest } from '@/shared/api/client';

export interface UploadedMedia {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
}

/** Longest side after resizing; keeps uploads well under the 3 MB limit. */
const MAX_SIDE = 1600;

/** Opens the photo library; null when cancelled. `square` crops (profile photos). */
export async function pickPhoto(options: { square?: boolean } = {}): Promise<{ uri: string; width: number; height: number } | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: !!options.square,
    aspect: options.square ? [1, 1] : undefined,
    quality: 1,
  });
  if (result.canceled || !result.assets[0]) return null;
  const { uri, width, height } = result.assets[0];
  return { uri, width, height };
}

/** Resizes to at most 1600px, re-encodes as JPEG and uploads to /api/v1/media. */
export async function uploadPhoto(photo: { uri: string; width: number; height: number }): Promise<UploadedMedia> {
  const context = ImageManipulator.ImageManipulator.manipulate(photo.uri);
  const scale = Math.min(1, MAX_SIDE / Math.max(photo.width || MAX_SIDE, photo.height || MAX_SIDE));
  if (scale < 1) context.resize(photo.width >= photo.height ? { width: Math.round(photo.width * scale) } : { height: Math.round(photo.height * scale) });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: ImageManipulator.SaveFormat.JPEG, compress: 0.8, base64: true });
  if (!saved.base64) throw new Error('Could not read the photo.');
  const { media } = await apiRequest<{ media: UploadedMedia }>('/api/v1/media', {
    method: 'POST',
    body: { data: saved.base64, mimeType: 'image/jpeg', width: saved.width, height: saved.height },
    authenticated: true,
  });
  return media;
}
