import * as ExpoCrypto from 'expo-crypto';
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../lib/axios';

const KEY_STORAGE = 'e2e_keypair';

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
    // console.log('Starting E2E key initialization for user:', userId);
    
    // Patch PRNG before any nacl operation
    patchNaclRandom();

    const stored = await AsyncStorage.getItem(KEY_STORAGE);

    if (stored) {
      // console.log('Found existing keypair in storage, uploading public key...');
      const parsed = JSON.parse(stored);
      await uploadPublicKey(userId, parsed.publicKey, authToken).catch(e => {
        // console.warn('Offline or failed to upload existing public key, ignoring...', e);
      });
      return parsed;
    }

    // console.log('Generating new keypair...');
    const keyPair = nacl.box.keyPair();

    const keypairData = {
      publicKey: encodeBase64(keyPair.publicKey),
      secretKey: encodeBase64(keyPair.secretKey),
    };

    await AsyncStorage.setItem(KEY_STORAGE, JSON.stringify(keypairData));
    // console.log('Keypair saved to storage, uploading public key to server...');
    await uploadPublicKey(userId, keypairData.publicKey, authToken).catch(e => {
        // console.warn('Network error: Public key upload failed, will need to upload later.', e);
    });

    return keypairData;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    // console.error('E2E key init failed:', errorMsg);
    throw err;
  }
}

async function uploadPublicKey(userId: string, publicKey: string, authToken: string) {
  try {
    const response = await api.post('/users/public-key',
      { publicKey },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    // console.log('Public key uploaded successfully:', response.data);
    return response.data;
  } catch (err) {
    // console.error('Failed to upload public key:', err);
    throw new Error(`Public key upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

export async function getKeyPair() {
  const stored = await AsyncStorage.getItem(KEY_STORAGE);
  if (!stored) throw new Error('No keypair found. Call initializeKeyPair first.');
  return JSON.parse(stored);
}