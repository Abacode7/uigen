// @vitest-environment node
import { test, expect, vi, beforeEach } from "vitest";
import { jwtVerify } from "jose";

// Mock server-only (throws in non-server environments)
vi.mock("server-only", () => ({}));

// Mock next/headers cookies
const mockSet = vi.fn();
const mockGet = vi.fn();
const mockDelete = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(() =>
    Promise.resolve({
      set: mockSet,
      get: mockGet,
      delete: mockDelete,
    })
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const JWT_SECRET = new TextEncoder().encode("development-secret-key");

test("createSession sets a cookie with correct options", async () => {
  const { createSession } = await import("@/lib/auth");

  await createSession("user-123", "test@example.com");

  expect(mockSet).toHaveBeenCalledOnce();
  const [name, token, options] = mockSet.mock.calls[0];

  expect(name).toBe("auth-token");
  expect(typeof token).toBe("string");
  expect(options.httpOnly).toBe(true);
  expect(options.sameSite).toBe("lax");
  expect(options.path).toBe("/");
  expect(options.expires).toBeInstanceOf(Date);
});

test("createSession produces a valid JWT with correct payload", async () => {
  const { createSession } = await import("@/lib/auth");

  await createSession("user-123", "test@example.com");

  const token = mockSet.mock.calls[0][1];
  const { payload } = await jwtVerify(token, JWT_SECRET);

  expect(payload.userId).toBe("user-123");
  expect(payload.email).toBe("test@example.com");
  expect(payload.expiresAt).toBeDefined();
});

test("createSession sets expiry ~7 days from now", async () => {
  const { createSession } = await import("@/lib/auth");

  const before = Date.now();
  await createSession("user-123", "test@example.com");
  const after = Date.now();

  const cookieExpires = mockSet.mock.calls[0][2].expires as Date;
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  expect(cookieExpires.getTime()).toBeGreaterThanOrEqual(before + sevenDaysMs);
  expect(cookieExpires.getTime()).toBeLessThanOrEqual(after + sevenDaysMs);
});

test("getSession returns null when no cookie exists", async () => {
  mockGet.mockReturnValue(undefined);
  const { getSession } = await import("@/lib/auth");

  const session = await getSession();

  expect(session).toBeNull();
  expect(mockGet).toHaveBeenCalledWith("auth-token");
});

test("getSession returns session payload for valid token", async () => {
  const { createSession, getSession } = await import("@/lib/auth");

  // Create a session to get a valid token
  await createSession("user-456", "valid@example.com");
  const validToken = mockSet.mock.calls[0][1];

  // Mock the cookie to return that token
  mockGet.mockReturnValue({ value: validToken });

  const session = await getSession();

  expect(session).not.toBeNull();
  expect(session?.userId).toBe("user-456");
  expect(session?.email).toBe("valid@example.com");
});

test("getSession returns null for invalid/malformed token", async () => {
  mockGet.mockReturnValue({ value: "invalid-token" });
  const { getSession } = await import("@/lib/auth");

  const session = await getSession();

  expect(session).toBeNull();
});

test("getSession returns null for expired token", async () => {
  // Create an expired token manually
  const { SignJWT } = await import("jose");
  const expiredToken = await new SignJWT({
    userId: "user-789",
    email: "expired@example.com",
    expiresAt: new Date(Date.now() - 1000),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(Math.floor(Date.now() / 1000) - 60) // expired 60s ago
    .sign(JWT_SECRET);

  mockGet.mockReturnValue({ value: expiredToken });
  const { getSession } = await import("@/lib/auth");

  const session = await getSession();

  expect(session).toBeNull();
});

test("deleteSession deletes the auth-token cookie", async () => {
  const { deleteSession } = await import("@/lib/auth");

  await deleteSession();

  expect(mockDelete).toHaveBeenCalledOnce();
  expect(mockDelete).toHaveBeenCalledWith("auth-token");
});

test("verifySession returns null when no cookie in request", async () => {
  const { verifySession } = await import("@/lib/auth");

  const mockRequest = {
    cookies: {
      get: vi.fn().mockReturnValue(undefined),
    },
  } as any;

  const session = await verifySession(mockRequest);

  expect(session).toBeNull();
  expect(mockRequest.cookies.get).toHaveBeenCalledWith("auth-token");
});

test("verifySession returns session payload for valid token in request", async () => {
  const { createSession, verifySession } = await import("@/lib/auth");

  // Create a session to get a valid token
  await createSession("user-verify", "verify@example.com");
  const validToken = mockSet.mock.calls[0][1];

  const mockRequest = {
    cookies: {
      get: vi.fn().mockReturnValue({ value: validToken }),
    },
  } as any;

  const session = await verifySession(mockRequest);

  expect(session).not.toBeNull();
  expect(session?.userId).toBe("user-verify");
  expect(session?.email).toBe("verify@example.com");
});

test("verifySession returns null for invalid token in request", async () => {
  const { verifySession } = await import("@/lib/auth");

  const mockRequest = {
    cookies: {
      get: vi.fn().mockReturnValue({ value: "invalid-token" }),
    },
  } as any;

  const session = await verifySession(mockRequest);

  expect(session).toBeNull();
});

test("verifySession returns null for expired token in request", async () => {
  const { SignJWT } = await import("jose");
  const expiredToken = await new SignJWT({
    userId: "user-expired",
    email: "expired@example.com",
    expiresAt: new Date(Date.now() - 1000),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
    .sign(JWT_SECRET);

  const { verifySession } = await import("@/lib/auth");

  const mockRequest = {
    cookies: {
      get: vi.fn().mockReturnValue({ value: expiredToken }),
    },
  } as any;

  const session = await verifySession(mockRequest);

  expect(session).toBeNull();
});
