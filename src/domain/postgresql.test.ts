import { describe, expect, it } from "vitest";
import { buildPostgresUri } from "./postgresql";

const config = {
  host: "db.example.com",
  port: "6432",
  database: "",
  sslMode: "prefer",
};
describe("PostgreSQL connection addresses", () => {
  it("builds a connection URI with the selected account and password", () => {
    expect(
      buildPostgresUri(config, {
        username: "postgres",
        password: "example-password",
      }),
    ).toBe("postgresql://postgres:example-password@db.example.com:6432");
  });
  it("encodes credentials and database names while preserving IPv6 hosts and SSL settings", () => {
    const uri = buildPostgresUri(
      {
        ...config,
        host: "[2001:db8::1]",
        database: "app/db",
        sslMode: "require",
      },
      { username: "team@ops", password: "a:b/@?#%+!" },
    );
    expect(uri).toBe(
      "postgresql://team%40ops:a%3Ab%2F%40%3F%23%25%2B%21@[2001:db8::1]:6432/app%2Fdb?sslmode=require",
    );
  });
  it("supports account-only and default local authentication without a fabricated password", () => {
    expect(buildPostgresUri(config, { username: "postgres" })).toBe(
      "postgresql://postgres@db.example.com:6432",
    );
    expect(buildPostgresUri(config)).toBe("postgresql://db.example.com:6432");
  });
  it("rejects invalid connection fields", () => {
    expect(buildPostgresUri({ ...config, host: "bad@host" })).toBeNull();
    expect(buildPostgresUri({ ...config, port: "70000" })).toBeNull();
    expect(buildPostgresUri(config, { password: "\ud800" })).toBeNull();
  });
});
