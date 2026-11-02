import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { buildSshCommand } from "../src/domain/ssh";
import { validateTargetConfig } from "../src/domain/targets";

describe("SSH commands", () => {
  it("builds a command with the common connection options and a separate credential username", () => {
    expect(
      buildSshCommand(
        {
          host: "server.example.com",
          port: "2222",
          identityFile: "~/.ssh/id_ed25519",
          jumpHost: "bastion.example.com",
          jumpPort: "2200",
          forwardAgent: true,
          compression: true,
        },
        "deploy",
      ),
    ).toBe(
      "ssh -p 2222 -l deploy -i '~/.ssh/id_ed25519' -J bastion.example.com:2200 -A -C -- server.example.com",
    );
  });
  it("supports a default local user and IPv6 destinations", () => {
    expect(buildSshCommand({ host: "[::1]", port: "22" })).toBe(
      "ssh -p 22 -- ::1",
    );
    expect(
      buildSshCommand({
        host: "server",
        port: "22",
        jumpHost: "[2001:db8::1]",
        jumpPort: "22",
      }),
    ).toContain("-J '[2001:db8::1]:22'");
  });
  it.each(["0", "65536", "22 -oProxyCommand=id", "-1", "abc"])(
    "rejects invalid port %s",
    (port) => {
      expect(buildSshCommand({ host: "server", port })).toBeNull();
    },
  );
  it("rejects option injection, control characters and secrets in connection fields", () => {
    expect(
      buildSshCommand({ host: "-oProxyCommand=id", port: "22" }),
    ).toBeNull();
    expect(
      buildSshCommand({
        host: "server",
        port: "22",
        identityFile: "key\nfile",
      }),
    ).toBeNull();
    expect(
      buildSshCommand({ host: "server", port: "22" }, "user\nname"),
    ).toBeNull();
    expect(
      validateTargetConfig("ssh", {
        host: "server",
        port: "22",
        password: "secret",
      }),
    ).toBe(false);
    expect(
      validateTargetConfig("ssh", {
        host: "server",
        port: "22",
        username: "root",
      }),
    ).toBe(false);
    expect(
      validateTargetConfig("ssh", {
        host: "server",
        port: "22",
        extraOptions: "-oProxyCommand=id",
      }),
    ).toBe(false);
  });
  it("preserves spaces, quotes and shell metacharacters as literal arguments", () => {
    const identityFile = "/keys/team's key;$(printf injected)`printf injected`";
    const username = "team'$(printf injected)";
    const command = buildSshCommand(
      { host: "server", port: "22", identityFile },
      username,
    )!;
    const result = spawnSync(
      "/bin/sh",
      ["-c", `ssh() { printf '%s\\0' "$@"; }\n${command}`],
      { encoding: "utf8" },
    );
    expect(result.status).toBe(0);
    expect(result.stdout.split("\0").filter(Boolean)).toEqual([
      "-p",
      "22",
      "-l",
      username,
      "-i",
      identityFile,
      "--",
      "server",
    ]);
  });
});
