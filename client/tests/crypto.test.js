import { describe, it, expect } from "vitest";
import {
  deriveKey,
  generateKdfSalt,
  encryptText,
  decryptText,
  encryptFile,
  decryptFile
} from "../src/utils/crypto";

describe("E2EE crypto", () => {
  it("round-trips text through deriveKey/encryptText/decryptText", async () => {
    const key = await deriveKey("correct horse battery staple");
    const secret = "hello klipport 🔒 https://example.com";
    const encrypted = await encryptText(secret, key);
    expect(encrypted).not.toContain("klipport");
    const decrypted = await decryptText(encrypted, key);
    expect(decrypted).toBe(secret);
  });

  it("produces different ciphertext for the same plaintext (random IV)", async () => {
    const key = await deriveKey("passphrase");
    const a = await encryptText("same input", key);
    const b = await encryptText("same input", key);
    expect(a).not.toBe(b);
  });

  it("fails to decrypt with the wrong passphrase key", async () => {
    const goodKey = await deriveKey("right-passphrase");
    const badKey = await deriveKey("wrong-passphrase");
    const encrypted = await encryptText("top secret", goodKey);
    await expect(decryptText(encrypted, badKey)).rejects.toThrow();
  });

  it("derives different keys from different salts", async () => {
    const saltA = generateKdfSalt();
    const saltB = generateKdfSalt();
    expect(saltA).not.toBe(saltB);

    const keyA = await deriveKey("same passphrase", saltA);
    const keyB = await deriveKey("same passphrase", saltB);
    const encrypted = await encryptText("payload", keyA);
    await expect(decryptText(encrypted, keyB)).rejects.toThrow();
  });

  it("legacy path: no salt still round-trips (backward compatibility)", async () => {
    const key = await deriveKey("legacy-user-passphrase");
    const encrypted = await encryptText("old clip", key);
    expect(await decryptText(encrypted, key)).toBe("old clip");
  });

  it("round-trips file buffers through encryptFile/decryptFile", async () => {
    const key = await deriveKey("file-key");
    const original = new Uint8Array([1, 2, 3, 250, 0, 42]).buffer;
    const encrypted = await encryptFile(original, key);
    const decrypted = await decryptFile(encrypted, key);
    expect(new Uint8Array(decrypted)).toEqual(new Uint8Array(original));
  });

  it("fails file decryption with the wrong key", async () => {
    const keyA = await deriveKey("a");
    const keyB = await deriveKey("b");
    const encrypted = await encryptFile(new Uint8Array([9, 9, 9]).buffer, keyA);
    await expect(decryptFile(encrypted, keyB)).rejects.toThrow();
  });
});
