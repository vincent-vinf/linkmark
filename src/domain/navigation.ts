export function webNavigationCopy(
  credential?: { username?: string; password?: string } | null,
): { label: string; value: string } | null {
  if (credential?.username)
    return { label: "账号", value: credential.username };
  if (credential?.password)
    return { label: "密码", value: credential.password };
  return null;
}
