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
