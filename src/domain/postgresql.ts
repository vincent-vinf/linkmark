import { validateTargetConfig, type Target } from "./targets";

const encode = (value: string) =>
  encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );

export function buildPostgresUri(
  config: Target["config"],
  credential?: { username?: string; password?: string } | null,
): string | null {
  if (!validateTargetConfig("postgresql", config)) return null;
  try {
    const username = credential?.username ?? "";
    const password = credential?.password ?? "";
    const authentication =
      username || password
        ? `${encode(username)}${password ? `:${encode(password)}` : ""}@`
        : "";
    const database = config.database
      ? `/${encode(String(config.database))}`
      : "";
    const ssl =
      config.sslMode && config.sslMode !== "prefer"
        ? `?sslmode=${encode(String(config.sslMode))}`
        : "";
    return `postgresql://${authentication}${String(config.host).trim()}:${config.port}${database}${ssl}`;
  } catch {
    return null;
  }
}
