import { describe, it, expect, vi, beforeEach } from "vitest";
import { clientIp, originAllowed, rateLimited } from "@/lib/api-helpers";
import { NextRequest } from "next/server";

describe("api-helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  describe("originAllowed", () => {
    it("should allow request when origin matches host", () => {
      const req = new NextRequest("http://example.com", {
        headers: { origin: "http://example.com", host: "example.com" },
      });
      expect(originAllowed(req)).toBe(true);
    });

    it("should deny request when origin does not match host", () => {
      const req = new NextRequest("http://example.com", {
        headers: { origin: "http://attacker.com", host: "example.com" },
      });
      expect(originAllowed(req)).toBe(false);
    });

    it("should deny request when origin is missing and referer is missing", () => {
      const req = new NextRequest("http://example.com", {
        headers: { host: "example.com" },
      });
      expect(originAllowed(req)).toBe(false);
    });

    it("should fallback to referer when origin is missing", () => {
      const req = new NextRequest("http://example.com", {
        headers: { host: "example.com", referer: "http://example.com/page" },
      });
      expect(originAllowed(req)).toBe(true);
    });

    it("should deny request when x-forwarded-host is spoofed to match origin", () => {
      const req = new NextRequest("http://example.com", {
        headers: {
          origin: "http://evil.com",
          host: "example.com",
          "x-forwarded-host": "evil.com",
        },
      });
      expect(originAllowed(req)).toBe(false);
    });
  });

  describe("clientIp", () => {
    it("should use the first x-forwarded-for entry when no platform ip is present", () => {
      const req = new NextRequest("http://example.com", {
        headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" },
      });
      expect(clientIp(req)).toBe("203.0.113.9");
    });
  });

  describe("rateLimited", () => {
    it("should allow requests under the limit", async () => {
      for (let i = 0; i < 15; i++) {
        expect(await rateLimited("test-ip-1")).toBe(false);
      }
    });

    it("should deny requests over the limit", async () => {
      for (let i = 0; i < 15; i++) {
        await rateLimited("test-ip-2");
      }
      expect(await rateLimited("test-ip-2")).toBe(true);
    });
    
    it("should reset after the window expires", async () => {
      for (let i = 0; i < 15; i++) {
        await rateLimited("test-ip-3");
      }
      expect(await rateLimited("test-ip-3")).toBe(true);
      
      vi.advanceTimersByTime(60_001);
      
      expect(await rateLimited("test-ip-3")).toBe(false);
    });
  });
});
