import { describe, expect, it } from "vitest";
import { isAuthPage, isPublicPath } from "./routes";

describe("isPublicPath", () => {
  it.each(["/", "/login", "/signup", "/auth/callback"])(
    "%s est public",
    (path) => {
      expect(isPublicPath(path)).toBe(true);
    },
  );

  it.each(["/dashboard", "/groups/123", "/loginx", "/authentification"])(
    "%s exige une session",
    (path) => {
      expect(isPublicPath(path)).toBe(false);
    },
  );
});

describe("isAuthPage", () => {
  it("ne concerne que la connexion et l'inscription", () => {
    expect(isAuthPage("/login")).toBe(true);
    expect(isAuthPage("/signup")).toBe(true);
    expect(isAuthPage("/")).toBe(false);
    expect(isAuthPage("/auth/callback")).toBe(false);
  });
});
