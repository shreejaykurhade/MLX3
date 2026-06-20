export function shortHex(h?: string | null, head = 6, tail = 4): string {
  if (!h) return "—";
  if (h.length <= head + tail + 2) return h;
  return `${h.slice(0, head)}…${h.slice(-tail)}`;
}

export function formatMon(wei?: string | null): string {
  if (!wei) return "—";
  try {
    const v = BigInt(wei);
    const whole = v / 10n ** 18n;
    const frac = (v % 10n ** 18n).toString().padStart(18, "0").slice(0, 4).replace(/0+$/, "");
    return frac ? `${whole}.${frac} MON` : `${whole} MON`;
  } catch {
    return "—";
  }
}

export function timeAgo(iso?: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function providerName(p?: { metadata?: any; address?: string } | null): string {
  if (!p) return "—";
  const name = (p.metadata && (p.metadata.name as string)) || null;
  return name || shortHex(p.address);
}
