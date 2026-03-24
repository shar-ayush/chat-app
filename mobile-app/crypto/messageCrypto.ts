import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';
import * as ExpoCrypto from 'expo-crypto';
import { getKeyPair } from './keyManager';

function patchNaclRandom() {
  nacl.setPRNG((output: Uint8Array, length: number) => {
    const randomBytes = ExpoCrypto.getRandomBytes(length);
    for (let i = 0; i < length; i++) {
      output[i] = randomBytes[i];
    }
  });
}

export async function encryptMessage(plaintext: string, recipientPublicKeyB64: string) {
  patchNaclRandom(); // always patch before use
  const { secretKey: senderSecretKeyB64, publicKey: senderPublicKey } = await getKeyPair();

  const senderSecretKey = decodeBase64(senderSecretKeyB64);
  const recipientPublicKey = decodeBase64(recipientPublicKeyB64);

  // Random 24-byte nonces - one for recipient payload and one for sender payload
  const recipientNonce = nacl.randomBytes(nacl.box.nonceLength);
  const senderNonce = nacl.randomBytes(nacl.box.nonceLength);

  // TextEncoder gives a proper Uint8Array, avoids tweetnacl-util type issues
  const messageBytes = new TextEncoder().encode(plaintext);

  // nacl.box = X25519 key exchange + XSalsa20-Poly1305 encryption
  const encryptedForRecipient = nacl.box(
    messageBytes,
    recipientNonce,
    recipientPublicKey,
    senderSecretKey
  );

  // Sender copy allows decrypting your own historical messages on this device.
  const encryptedForSender = nacl.box(
    messageBytes,
    senderNonce,
    decodeBase64(senderPublicKey),
    senderSecretKey
  );

  return {
    ciphertext: encodeBase64(encryptedForRecipient),
    nonce: encodeBase64(recipientNonce),
    senderCiphertext: encodeBase64(encryptedForSender),
    senderNonce: encodeBase64(senderNonce),
    // Public key so recipient knows whose key to use for decryption
    senderPublicKey,
  };
}

type DecryptableMessage = {
  sender?: { _id?: string } | string;
  ciphertext?: string;
  nonce?: string;
  senderCiphertext?: string;
  senderNonce?: string;
};

export function selectEncryptedPayloadForUser<T extends DecryptableMessage>(
  message: T,
  currentUserId?: string
) {
  const senderId =
    typeof message.sender === "string" ? message.sender : message.sender?._id;
  const isFromCurrentUser = Boolean(currentUserId && senderId === currentUserId);

  if (isFromCurrentUser && message.senderCiphertext && message.senderNonce) {
    return {
      ciphertext: message.senderCiphertext,
      nonce: message.senderNonce,
    };
  }

  if (message.ciphertext && message.nonce) {
    return {
      ciphertext: message.ciphertext,
      nonce: message.nonce,
    };
  }

  return null;
}

export async function decryptMessage(payload: {
  ciphertext: string;
  nonce: string;
  senderPublicKey: string;
}): Promise<string> {
  const { secretKey: mySecretKeyB64 } = await getKeyPair();

  const mySecretKey = decodeBase64(mySecretKeyB64);
  const senderPublicKey = decodeBase64(payload.senderPublicKey);
  const ciphertext = decodeBase64(payload.ciphertext);
  const nonce = decodeBase64(payload.nonce);

  const decrypted = nacl.box.open(
    ciphertext,
    nonce,
    senderPublicKey,
    mySecretKey
  );

  if (!decrypted) throw new Error('Decryption failed — message may be tampered with.');
  return new TextDecoder().decode(decrypted);
}