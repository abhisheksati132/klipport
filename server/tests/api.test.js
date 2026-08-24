import { describe, it, expect } from "vitest";
import { checkRateLimit, previewCacheGet, previewCacheSet } from "../src/app";

describe("rate limiter", () => {
  it("allows up to 30 requests per window per key", () => {
    const key = `test-ip-${Math.random()}`;
    let allowed = 0;
    for (let i = 0; i < 35; i++) {
      if (checkRateLimit(key).allowed) allowed++;
    }
    expect(allowed).toBe(30);
  });

  it("tracks keys independently", () => {
    const a = `key-a-${Math.random()}`;
    const b = `key-b-${Math.random()}`;
    for (let i = 0; i < 30; i++) checkRateLimit(a);
    expect(checkRateLimit(a).allowed).toBe(false);
    expect(checkRateLimit(b).allowed).toBe(true);
  });
});

describe("preview cache", () => {
  it("returns null on miss and payload on hit", () => {
    const url = `https://example.com/${Math.random()}`;
    expect(previewCacheGet(url)).toBeNull();
    previewCacheSet(url, { title: "Example" });
    expect(previewCacheGet(url)).toEqual({ title: "Example" });
  });

  it("evicts the oldest entry beyond 200 entries", () => {
    const firstUrl = `https://old.example.com/${Math.random()}`;
    previewCacheSet(firstUrl, { title: "oldest" });
    for (let i = 0; i < 200; i++) {
      previewCacheSet(`https://filler.example.com/${i}`, { title: String(i) });
    }
    expect(previewCacheGet(firstUrl)).toBeNull();
    expect(previewCacheGet("https://filler.example.com/199")).toEqual({ title: "199" });
  });
});
