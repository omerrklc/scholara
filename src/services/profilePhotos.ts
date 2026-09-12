import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/services/supabase';

const BUCKET = 'profile-photos';
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const SIGNED_URL_SECONDS = 60 * 60;

export type PhotoUploadResult = { avatarPath: string | null; previewUri: string | null; error: string | null };

export async function chooseAndUploadProfilePhoto(userId: string): Promise<PhotoUploadResult> {
  if (!supabase) return { avatarPath: null, previewUri: null, error: 'Supabase is not configured.' };

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return { avatarPath: null, previewUri: null, error: 'Photo library permission is required to choose a profile photo.' };
  }

  const selection = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (selection.canceled || !selection.assets[0]) return { avatarPath: null, previewUri: null, error: null };

  try {
    const context = ImageManipulator.manipulate(selection.assets[0].uri);
    context.resize({ width: 1200, height: 1200 });
    const rendered = await context.renderAsync();
    const optimized = await rendered.saveAsync({ compress: 0.82, format: SaveFormat.JPEG });
    const file = new File(optimized.uri);
    if (file.size > MAX_UPLOAD_BYTES) {
      return { avatarPath: null, previewUri: null, error: 'The selected photo is still larger than 5 MB. Please choose another photo.' };
    }

    const avatarPath = `${userId}/avatar.jpg`;
    const bytes = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(avatarPath, bytes, {
      cacheControl: '60',
      contentType: 'image/jpeg',
      upsert: true,
    });
    if (uploadError) return { avatarPath: null, previewUri: null, error: uploadError.message };

    const { error: profileError } = await supabase.from('profiles').update({ avatar_path: avatarPath }).eq('id', userId);
    if (profileError) {
      await supabase.storage.from(BUCKET).remove([avatarPath]);
      return { avatarPath: null, previewUri: null, error: 'Your photo could not be saved. Please update your profile and try again.' };
    }
    return { avatarPath, previewUri: optimized.uri, error: null };
  } catch {
    return { avatarPath: null, previewUri: null, error: 'The photo could not be prepared. Please try a different image.' };
  }
}

export async function removeProfilePhoto(userId: string) {
  if (!supabase) return 'Supabase is not configured.';
  const avatarPath = `${userId}/avatar.jpg`;
  const { error: profileError } = await supabase.from('profiles').update({ avatar_path: '' }).eq('id', userId);
  if (profileError) return profileError.message;
  await supabase.storage.from(BUCKET).remove([avatarPath]);
  return null;
}

export async function createProfilePhotoUrl(avatarPath: string) {
  if (!supabase || !avatarPath) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(avatarPath, SIGNED_URL_SECONDS);
  return error ? null : data.signedUrl;
}

export async function createProfilePhotoUrls(paths: string[]) {
  if (!supabase) return new Map<string, string>();
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  if (!uniquePaths.length) return new Map<string, string>();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(uniquePaths, SIGNED_URL_SECONDS);
  if (error) return new Map<string, string>();
  return new Map((data ?? []).flatMap((item) => item.signedUrl ? [[item.path, item.signedUrl] as const] : []));
}
