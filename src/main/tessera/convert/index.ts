import * as ClashProxies from "./clashProxies";
import { decodeBase64, type Parsed } from "./conversion";
import { trim } from "./jvm";
import * as ShareLinks from "./shareLinks";
import * as WireGuardConf from "./wireGuardConf";

export { Parsed, type Skipped, type SkipReason, type SourceFormat } from "./conversion";

/**
 * Сборка профиля из того, что не sing-box JSON (§3.1): ссылки, base64-подписки, Clash YAML, WireGuard.
 * null — формат не узнан.
 */
export function parse(text: string): Parsed | null {
  let value = trim(text);
  if (value.startsWith("\uFEFF")) value = value.slice(1);
  if (value === "") return null;
  if (WireGuardConf.matches(value)) return WireGuardConf.parse(value);
  if (ClashProxies.matches(value)) return ClashProxies.parse(value);
  const links = ShareLinks.parse(value);
  if (links) return links;
  const decoded = decodeBase64(value);
  return decoded == null ? null : ShareLinks.parse(decoded);
}
