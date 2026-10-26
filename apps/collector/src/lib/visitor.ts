import { isIP } from "node:net";

export function getClientIp(request: Request) {
  const ip = request.headers.get("CF-Connecting-IP");
  if (!ip || !isIP(ip)) return undefined;
  // Only use the IPv6 preservation header when the canonical value is a
  // Class E pseudo IPv4 address (Cloudflare's Overwrite Headers mode).
  const ipv6 = request.headers.get("CF-Connecting-IPv6");
  if (isIP(ip) === 4 && Number(ip.split(".")[0]) >= 240 && ipv6 && isIP(ipv6) === 6) return ipv6;
  return ip.startsWith("::ffff:") && isIP(ip.slice(7)) === 4 ? ip.slice(7) : ip;
}

export function getRequestHostname(request: Request) {
  const value = request.headers.get("Origin") ?? request.headers.get("Referer");
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.hostname.toLowerCase() : undefined;
  } catch { return undefined; }
}

export function matchesDomain(hostname: string, domain: string, wildcard: boolean) {
  const host = hostname.toLowerCase();
  const base = domain.toLowerCase();
  return host === base || (wildcard && host.endsWith(`.${base}`));
}

export type NetworkFlags = { proxy: boolean | null; mobile: boolean | null; hosting: boolean | null };
export function getEventType(info: NetworkFlags) {
  if (info.proxy) return "proxy";
  if (info.mobile) return "mobile";
  if (info.hosting) return "hosting";
  return Object.values(info).every(value => value === false) ? "residential" : "unknown";
}

export function getEdgeLocation(cf: Request["cf"]) {
  const coordinate = (value: unknown, max: number) => {
    const n = typeof value === "string" && value.trim() ? Number(value) : NaN;
    return Number.isFinite(n) && Math.abs(n) <= max ? n : null;
  };
  const text = (value: unknown) => typeof value === "string" ? value.slice(0, 256) : null;
  return {
    lat: coordinate(cf?.latitude, 90), lon: coordinate(cf?.longitude, 180),
    country: text(cf?.country), region: text(cf?.region), city: text(cf?.city),
    zip: text(cf?.postalCode), isp: null, asName: text(cf?.asOrganization),
  };
}
