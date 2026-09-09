import * as ExpoCrypto from 'expo-crypto';
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../lib/axios';

const KEY_STORAGE_PREFIX = 'e2e_keypair_';
const LEGACY_KEY_STORAGE = 'e2e_keypair';

// Patch nacl's PRNG with expo-crypto as a guaranteed fallback
function patchNaclRandom() {
  nacl.setPRNG((output: Uint8Array, length: number) => {
    const randomBytes = ExpoCrypto.getRandomBytes(length);
    for (let i = 0; i < length; i++) {
      output[i] = randomBytes[i];
    }
  });
}

export async function initializeKeyPair(userId: string, authToken: string) {
  try {
    patchNaclRandom();

    const userStorageKey = `${KEY_STORAGE_PREFIX}${userId}`;
    let stored = await AsyncStorage.getItem(userStorageKey);

    if (!stored) {
      // Check legacy single-user storage
      stored = await AsyncStorage.getItem(LEGACY_KEY_STORAGE);
      if (stored) {
        await AsyncStorage.setItem(userStorageKey, stored);
      }
    }

    // 1. If we have keys locally, ensure backend has the backup
    if (stored) {
      const parsed = JSON.parse(stored);
      await syncKeyPairToBackend(parsed.publicKey, parsed.secretKey, authToken).catch(() => {});
      return parsed;
    }

    // 2. If no local keys (e.g. app reinstalled or new device), try to restore from backend!
    try {
      const remote = await fetchKeyPairFromBackend(authToken);
      if (remote?.publicKey && remote?.secretKey) {
        console.log('[keyManager] Restored keypair from backend backup for user:', userId);
        await AsyncStorage.setItem(userStorageKey, JSON.stringify(remote));
        await AsyncStorage.setItem(LEGACY_KEY_STORAGE, JSON.stringify(remote));
        return remote;
      }
    } catch (fetchErr) {
      // No existing backup on backend, will generate new keys below
    }

    // 3. First time setup: generate new keypair and backup to backend
    const keyPair = nacl.box.keyPair();

    const keypairData = {
      publicKey: encodeBase64(keyPair.publicKey),
      secretKey: encodeBase64(keyPair.secretKey),
    };

    await AsyncStorage.setItem(userStorageKey, JSON.stringify(keypairData));
    await AsyncStorage.setItem(LEGACY_KEY_STORAGE, JSON.stringify(keypairData));
    await syncKeyPairToBackend(keypairData.publicKey, keypairData.secretKey, authToken).catch(() => {});

    return keypairData;
  } catch (err) {
    throw err;
  }
}

async function syncKeyPairToBackend(publicKey: string, secretKey: string, authToken: string) {
  try {
    const response = await api.post('/users/key-pair',
      { publicKey, secretKey },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    return response.data;
  } catch (err) {
    // Fallback to public-key only if key-pair route is unreachable
    return api.post('/users/public-key',
      { publicKey, secretKey },
      { headers: { Authorization: `Bearer ${authToken}` } }
    ).catch(() => {});
  }
}

async function fetchKeyPairFromBackend(authToken: string) {
  try {
    const response = await api.get('/users/key-pair', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    return response.data;
  } catch (err) {
    return null;
  }
}

export async function getKeyPair(userId?: string) {
  if (userId) {
    const userStored = await AsyncStorage.getItem(`${KEY_STORAGE_PREFIX}${userId}`);
    if (userStored) return JSON.parse(userStored);
  }
  const stored = await AsyncStorage.getItem(LEGACY_KEY_STORAGE);
  if (!stored) throw new Error('No keypair found. Call initializeKeyPair first.');
  return JSON.parse(stored);
}