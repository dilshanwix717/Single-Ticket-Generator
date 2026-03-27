/**
 * ISO 7064 Mod 97-10 style check (same family as IBAN / ISO 11649).
 * We expand letters to two-digit numeric chunks, ignore punctuation we use as separators,
 * append "00", take mod 97, then checksum = 98 - remainder (two digits).
 */

function expandAlnumForMod97(input: string): string {
  let out = '';
  for (const ch of input) {
    if (ch >= '0' && ch <= '9') {
      out += ch;
    } else if (ch >= 'A' && ch <= 'Z') {
      out += (ch.charCodeAt(0) - 55).toString();
    } else if (ch >= 'a' && ch <= 'z') {
      out += (ch.charCodeAt(0) - 87).toString();
    }
  }
  return out;
}

function mod97FromNumericString(numeric: string): number {
  let rem = 0;
  for (let i = 0; i < numeric.length; i++) {
    const d = numeric.charCodeAt(i) - 48;
    rem = (rem * 10 + d) % 97;
  }
  return rem;
}

/** Payload is the ticket body *before* the checksum segment (includes NO. and hyphens). */
export function computeMod97Checksum(payload: string): string {
  const expanded = expandAlnumForMod97(payload);
  const rem = mod97FromNumericString(expanded + '00');
  const check = 98 - rem;
  return check.toString().padStart(2, '0');
}

export function buildTicketNo(ymd: string, ulid: string): string {
  const payload = `NO.${ymd}-${ulid}`;
  const check = computeMod97Checksum(payload);
  return `${payload}-${check}`;
}
