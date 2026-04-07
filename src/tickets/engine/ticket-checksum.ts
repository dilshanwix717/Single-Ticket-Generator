/**
 * ============================================================
 *  TICKET NUMBER GENERATION  (ISO 7064 Mod 997-10 checksum)
 * ============================================================
 * Produces ticket numbers in the format defined by PRD §7.1:
 *
 *   NO.YYYYMMDD-XXXXXXXXXXXXXX-YYY
 *   ^^^^^^^^    ^^^^^^^^^^^^^^  ^^^
 *   date        14-digit code   3-digit check
 *
 * The 14-digit code is a random numeric string — it does not expose
 * sequence, bet, or batch, but combined with the issue date it
 * uniquely identifies the ticket in the database (ticket_no is
 * indexed unique).
 *
 * The 3-digit check uses Mod 997-10 (same concept as IBAN Mod 97-10
 * but with modulus 997, giving check values 002–998).
 * ============================================================
 */

import { randomIntInclusive } from '../utils/random.utils';

// ─────────────────────────────────────────────────────────────
// NUMERIC CODE GENERATION
// ─────────────────────────────────────────────────────────────

/**
 * generateNumericCode
 * -------------------
 * Generates a 14-digit random numeric string for the X portion of the
 * ticket number.  No sequence, bet, or batch information is embedded.
 */
export function generateNumericCode(): string {
  let code = '';
  for (let i = 0; i < 14; i++) {
    code += randomIntInclusive(0, 9).toString();
  }
  return code;
}

// ─────────────────────────────────────────────────────────────
// MOD 997-10 CHECKSUM
// ─────────────────────────────────────────────────────────────

/**
 * expandAlnumForMod
 * -----------------
 * Converts an alphanumeric string into a pure digit string so that
 * modular arithmetic can be applied.
 *
 *   '0'–'9'  → kept as-is
 *   'A'–'Z'  → 10–35  (A=10, ..., Z=35)
 *   'a'–'z'  → 10–35  (same mapping)
 *   '-', '.' → stripped
 */
function expandAlnumForMod(input: string): string {
  let out = '';
  for (const ch of input) {
    if (ch >= '0' && ch <= '9') {
      out += ch;
    } else if (ch >= 'A' && ch <= 'Z') {
      out += (ch.charCodeAt(0) - 55).toString();
    } else if (ch >= 'a' && ch <= 'z') {
      out += (ch.charCodeAt(0) - 87).toString();
    }
    // '-' and '.' are intentionally skipped
  }
  return out;
}

/**
 * modFromNumericString
 * --------------------
 * Computes `bigNumber % divisor` where bigNumber is a string of digits.
 * Processes one digit at a time to avoid floating-point overflow on
 * very long strings.
 */
function modFromNumericString(numeric: string, divisor: number): number {
  let rem = 0;
  for (let i = 0; i < numeric.length; i++) {
    const d = numeric.charCodeAt(i) - 48;
    rem = (rem * 10 + d) % divisor;
  }
  return rem;
}

/**
 * computeChecksum3
 * ----------------
 * Computes a 3-digit Mod 997-10 check code for a ticket payload string.
 *
 * Steps:
 *   1. Expand the payload (letters → numbers, punctuation stripped).
 *   2. Append "000" placeholder.
 *   3. remainder = expandedString % 997
 *   4. check = 998 − remainder  (range: 002–998)
 *   5. Pad to 3 digits.
 */
export function computeChecksum3(payload: string): string {
  const expanded = expandAlnumForMod(payload);
  const rem = modFromNumericString(expanded + '000', 997);
  const check = 998 - rem;
  return check.toString().padStart(3, '0');
}

// ─────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────

/**
 * buildTicketNo
 * -------------
 * Assembles the complete human-readable ticket number.
 *
 * Format:  NO.{YYYYMMDD}-{14 digits}-{3-digit check}
 * Example: NO.20260406-47291836501847-312
 *
 * @param ymd         - Date in YYYYMMDD format (e.g. "20260406")
 * @param numericCode - 14-digit random numeric code
 */
export function buildTicketNo(ymd: string, numericCode: string): string {
  const payload = `NO.${ymd}-${numericCode}`;
  const check = computeChecksum3(payload);
  return `${payload}-${check}`;
}
