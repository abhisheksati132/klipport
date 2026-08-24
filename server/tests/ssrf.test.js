import { describe, it, expect } from "vitest";
import { isPrivateHost } from "../src/app";

describe("SSRF guard: isPrivateHost", () => {
  it("blocks localhost variants", () => {
    expect(isPrivateHost("localhost")).toBe(true);
    expect(isPrivateHost("127.0.0.1")).toBe(true);
    expect(isPrivateHost("::1")).toBe(true);
    expect(isPrivateHost("metadata.local")).toBe(true);
    expect(isPrivateHost("service.internal")).toBe(true);
  });

  it("blocks RFC1918 and link-local IPv4 ranges", () => {
    expect(isPrivateHost("10.0.0.1")).toBe(true);
    expect(isPrivateHost("10.255.255.255")).toBe(true);
    expect(isPrivateHost("172.16.0.1")).toBe(true);
    expect(isPrivateHost("172.31.255.255")).toBe(true);
    expect(isPrivateHost("192.168.1.50")).toBe(true);
    expect(isPrivateHost("169.254.169.254")).toBe(true);
    expect(isPrivateHost("0.0.0.0")).toBe(true);
  });

  it("does not block public hosts", () => {
    expect(isPrivateHost("example.com")).toBe(false);
    expect(isPrivateHost("172.32.0.1")).toBe(false);
    expect(isPrivateHost("172.15.255.255")).toBe(false);
    expect(isPrivateHost("11.0.0.1")).toBe(false);
    expect(isPrivateHost("193.168.1.1")).toBe(false);
    expect(isPrivateHost("8.8.8.8")).toBe(false);
  });

  it("treats missing hostnames as private (fail closed)", () => {
    expect(isPrivateHost(undefined)).toBe(true);
    expect(isPrivateHost("")).toBe(true);
  });
});
