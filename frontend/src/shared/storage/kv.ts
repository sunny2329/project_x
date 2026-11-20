import * as SecureStore from 'expo-secure-store';

/**
 * Small key-value store: the phone's secure store (Keychain / Keystore) on iOS and Android.
 * `kv.web.ts` is the browser version.
 */
export const kv = {
  get: (key: string, options?: SecureStore.SecureStoreOptions) => SecureStore.getItemAsync(key, options),
  set: (key: string, value: string, options?: SecureStore.SecureStoreOptions) => SecureStore.setItemAsync(key, value, options),
  remove: (key: string, options?: SecureStore.SecureStoreOptions) => SecureStore.deleteItemAsync(key, options),
};

export const KV_AFTER_FIRST_UNLOCK = SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY;
