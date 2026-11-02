import { validateTargetConfig, type Target } from "./targets";

/** POSIX shell arguments: preserve literal paths/usernames without evaluating shell input. */
function quote(value: string): string {
  return /^[a-zA-Z0-9_@%+=:,./-]+$/.test(value)
    ? value
    : `'${value.replaceAll("'", "'\\''")}'`;
}

export function buildSshCommand(
  config: Target["config"],
  username = "",
): string | null {
  if (
    !validateTargetConfig("ssh", config) ||
    username.length > 256 ||
    /[\x00-\x1f\x7f]/.test(username)
  )
    return null;
  const args = ["ssh", "-p", String(config.port)];
  if (username) args.push("-l", username);
  if (config.identityFile) args.push("-i", String(config.identityFile));
  if (config.jumpHost)
    args.push(
      "-J",
      `${String(config.jumpHost).trim()}${config.jumpPort ? `:${config.jumpPort}` : ""}`,
    );
  if (config.forwardAgent) args.push("-A");
  if (config.compression) args.push("-C");
  args.push(
    "--",
    String(config.host)
      .trim()
      .replace(/^\[(.*)\]$/, "$1"),
  );
  return args.map(quote).join(" ");
}
