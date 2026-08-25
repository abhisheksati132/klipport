// Cryptographic utilities using the native Web Crypto API

// ArrayBuffer-backed byte alias required by BufferSource under TS 5.7+ generics
type CryptoBytes = Uint8Array<ArrayBuffer>;

function asCryptoBytes(bytes: Uint8Array): CryptoBytes {
  return bytes as CryptoBytes;
}

// Legacy global salt — kept only for decrypting clips created before per-user salts existed
const LEGACY_KDF_SALT = "klipport-e2ee-custom-key-salt-987123";

export function generateKdfSalt(): string {
  const bytes = window.crypto.getRandomValues(new Uint8Array(16));
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Safe base64 encoder — avoids stack overflow from .apply(null, largeArray)
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const len: number = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): CryptoBytes {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return asCryptoBytes(bytes);
}

function splitIvAndCiphertext(base64: string): { iv: CryptoBytes; ciphertext: CryptoBytes } {
  const bytes = base64ToUint8Array(base64);
  return { iv: asCryptoBytes(bytes.slice(0, 12)), ciphertext: asCryptoBytes(bytes.slice(12)) };
}

// Derive a 256-bit AES-GCM key from a passphrase.
// Pass the user's stored kdf_salt; omitting it uses the legacy global salt.
export async function deriveKey(passphrase: string, saltOverride: string | null = null): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passphraseBytes = encoder.encode(passphrase);
  const saltBytes = encoder.encode(saltOverride || LEGACY_KDF_SALT);

  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    passphraseBytes,
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );

  return await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: 100000,
      hash: "SHA-256"
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// Encrypt text content client-side
export async function encryptText(text: string, key: CryptoKey): Promise<string> {
  const encoder = new TextEncoder();
  const plainBytes = encoder.encode(text);

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plainBytes
  );

  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return uint8ToBase64(combined);
}

// Decrypt encrypted text content client-side
export async function decryptText(encryptedBase64: string, key: CryptoKey): Promise<string> {
  try {
    const { iv, ciphertext } = splitIvAndCiphertext(encryptedBase64);

    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (err) {
    console.error("Decryption failed:", err);
    throw new Error("Decryption failed. Please check your passphrase.", { cause: err });
  }
}

// Encrypt file ArrayBuffer client-side
export async function encryptFile(arrayBuffer: ArrayBuffer, key: CryptoKey): Promise<ArrayBuffer> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    arrayBuffer
  );

  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return combined.buffer;
}

// Decrypt file ArrayBuffer client-side
export async function decryptFile(encryptedBuffer: ArrayBuffer, key: CryptoKey): Promise<ArrayBuffer> {
  try {
    const bytes = new Uint8Array(encryptedBuffer);
    const iv = bytes.slice(0, 12);
    const ciphertext = bytes.slice(12);

    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext
    );

    return decrypted;
  } catch (err) {
    console.error("File decryption failed:", err);
    throw new Error("File decryption failed. Invalid passphrase.", { cause: err });
  }
}

// Generate an RSA-OAEP 2048-bit keypair for E2EE asymmetric sharing
export async function generateAsymmetricKeyPair(): Promise<CryptoKeyPair> {
  return await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256"
    },
    true,
    ["encrypt", "decrypt"]
  );
}

// Export a public key as JWK format
export async function exportPublicKey(key: CryptoKey): Promise<JsonWebKey> {
  return await window.crypto.subtle.exportKey("jwk", key);
}

// Import a public key from JWK format
export async function importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return await window.crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );
}

// Encrypt a raw workspace symmetric key (represented as a raw key buffer) using a user's public key
export async function encryptWorkspaceKey(rawKey: CryptoBytes, publicKey: CryptoKey): Promise<string> {
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    rawKey
  );
  return uint8ToBase64(new Uint8Array(encrypted));
}

// Decrypt a workspace key using a private key and return raw key buffer
export async function decryptWorkspaceKey(encryptedKeyBase64: string, privateKey: CryptoKey): Promise<ArrayBuffer> {
  const bytes = base64ToUint8Array(encryptedKeyBase64);
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    bytes
  );
  return decrypted;
}

// Export and encrypt a private key using the user's master derived symmetric key
export async function encryptPrivateKey(privateKey: CryptoKey, symmetricKey: CryptoKey): Promise<{ encryptedKey: string; iv: string }> {
  const jwk = await window.crypto.subtle.exportKey("jwk", privateKey);
  const jwkString = JSON.stringify(jwk);
  const encoder = new TextEncoder();
  const plainBytes = encoder.encode(jwkString);

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    symmetricKey,
    plainBytes
  );

  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return {
    encryptedKey: uint8ToBase64(combined),
    iv: uint8ToBase64(iv)
  };
}

// Decrypt and import a private key using the user's master derived symmetric key
export async function decryptPrivateKey(encryptedBase64: string, symmetricKey: CryptoKey): Promise<CryptoKey> {
  const { iv, ciphertext } = splitIvAndCiphertext(encryptedBase64);

  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    symmetricKey,
    ciphertext
  );

  const decoder = new TextDecoder();
  const jwk: JsonWebKey = JSON.parse(decoder.decode(decrypted));

  return await window.crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["decrypt"]
  );
}
