// Cryptographic utilities using the native Web Crypto API

// Derive a 256-bit AES-GCM key from a passphrase
export async function deriveKey(passphrase) {
  const encoder = new TextEncoder();
  const passphraseBytes = encoder.encode(passphrase);
  
  // Use a static salt to ensure the derived key remains identical for the same passphrase
  const saltBytes = encoder.encode("clipsync-e2ee-custom-key-salt-987123");

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
export async function encryptText(text, key) {
  const encoder = new TextEncoder();
  const plainBytes = encoder.encode(text);
  
  // Generate a random 12-byte initialization vector (IV)
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plainBytes
  );

  // Combine IV and ciphertext into one buffer
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  
  // Convert to Base64
  return btoa(String.fromCharCode.apply(null, combined));
}

// Decrypt ciphertext content client-side
export async function decryptText(base64Ciphertext, key) {
  try {
    const binary = atob(base64Ciphertext);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    
    // Extract IV and ciphertext
    const iv = bytes.slice(0, 12);
    const ciphertext = bytes.slice(12);
    
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (err) {
    console.error("Decryption failed:", err);
    throw new Error("Decryption failed. Please check your passphrase.");
  }
}

// Encrypt file ArrayBuffer client-side
export async function encryptFile(arrayBuffer, key) {
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
export async function decryptFile(encryptedBuffer, key) {
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
    throw new Error("File decryption failed. Invalid passphrase.");
  }
}

// Generate an RSA-OAEP 2048-bit keypair for E2EE asymmetric sharing
export async function generateAsymmetricKeyPair() {
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
export async function exportPublicKey(key) {
  return await window.crypto.subtle.exportKey("jwk", key);
}

// Import a public key from JWK format
export async function importPublicKey(jwk) {
  return await window.crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );
}

// Encrypt a raw workspace symmetric key (represented as a raw key buffer) using a user's public key
export async function encryptWorkspaceKey(rawKey, publicKey) {
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    rawKey
  );
  return btoa(String.fromCharCode.apply(null, new Uint8Array(encrypted)));
}

// Decrypt a workspace key using a private key and return raw key buffer
export async function decryptWorkspaceKey(encryptedKeyBase64, privateKey) {
  const binary = atob(encryptedKeyBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    bytes
  );
  return decrypted;
}

// Export and encrypt a private key using the user's master derived symmetric key
export async function encryptPrivateKey(privateKey, symmetricKey) {
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
    encryptedKey: btoa(String.fromCharCode.apply(null, combined)),
    iv: btoa(String.fromCharCode.apply(null, iv))
  };
}

// Decrypt and import a private key using the user's master derived symmetric key
export async function decryptPrivateKey(encryptedBase64, symmetricKey) {
  const binary = atob(encryptedBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  
  const iv = bytes.slice(0, 12);
  const ciphertext = bytes.slice(12);
  
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    symmetricKey,
    ciphertext
  );
  
  const decoder = new TextDecoder();
  const jwk = JSON.parse(decoder.decode(decrypted));
  
  return await window.crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["decrypt"]
  );
}
