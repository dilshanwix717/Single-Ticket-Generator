/**
 * ============================================================
 *  TICKET CHECKSUM  (ISO 7064 Mod 97-10)
 * ============================================================
 * This file generates a "check number" appended to every ticket
 * number. It uses the same algorithm as IBAN bank account numbers
 * (ISO 7064 Mod 97-10).
 *
 * WHY CHECKSUMS?
 *   If a player misreads one character of their ticket number,
 *   the system can immediately detect the typo — the math will
 *   not add up — rather than silently looking up the wrong ticket.
 *
 * HOW IT WORKS (step by step):
 *   1. Convert the ticket body to a pure string of digits:
 *      letters become two-digit numbers (A=10, B=11 … Z=35),
 *      punctuation like '-' and '.' is stripped.
 *   2. Append "00" as a placeholder.
 *   3. Compute: remainder = bigNumber % 97
 *   4. Checksum = 98 − remainder   (always 02–98)
 *   5. Pad to 2 digits and append to the ticket number.
 *
 * EXAMPLE:
 *   Payload:   "NO.20240315-01HXYZ..."
 *   Expanded:  "2300202403150110..."    ← letters → numbers, punctuation stripped
 *   Remainder: 56
 *   Checksum:  98 − 56 = 42  → "42"
 *   Result:    "NO.20240315-01HXYZ...-42"
 * ============================================================
 */

/**
 * expandAlnumForMod97
 * -------------------
 * Converts an alphanumeric string into a pure numeric string so
 * that Mod 97 arithmetic can be applied.
 *
 * Rules:
 *   '0'–'9'  → kept as-is
 *   'A'–'Z'  → 10–35   (A=10, B=11, ..., Z=35)
 *   'a'–'z'  → 10–35   (same mapping as uppercase)
 *   '-', '.' → stripped (ignored completely)
 *
 * Example: expandAlnumForMod97("A1B") → "10111"
 *          (A→10, 1→1, B→11)
 *
 * @param input - The raw ticket payload string
 */
function expandAlnumForMod97(input: string): string {
  let out = '';
  for (const ch of input) {
    if (ch >= '0' && ch <= '9') {
      // Digit — keep as-is
      out += ch;
    } else if (ch >= 'A' && ch <= 'Z') {
      // Uppercase letter: 'A' is ASCII 65 → 65 - 55 = 10, 'Z' → 35
      out += (ch.charCodeAt(0) - 55).toString();
    } else if (ch >= 'a' && ch <= 'z') {
      // Lowercase letter: 'a' is ASCII 97 → 97 - 87 = 10, same range as uppercase
      out += (ch.charCodeAt(0) - 87).toString();
    }
    // Punctuation ('-', '.') is intentionally skipped
  }
  return out;
}

/**
 * mod97FromNumericString
 * ----------------------
 * Computes `bigNumber % 97` where `bigNumber` is given as a string of digits.
 *
 * We cannot use JavaScript's `%` operator directly because the number can be
 * 50+ digits long, which would cause floating-point precision loss.
 *
 * Instead we use the identity:
 *   (X * 10 + d) % 97  ≡  ((X % 97) * 10 + d) % 97
 *
 * This processes one digit at a time, keeping the running remainder
 * small (0–96) no matter how long the number string is.
 *
 * @param numeric - A string containing only digit characters
 */
function mod97FromNumericString(numeric: string): number {
  let rem = 0;
  for (let i = 0; i < numeric.length; i++) {
    // Convert the character to its digit value: '0' is ASCII 48
    const d = numeric.charCodeAt(i) - 48;
    // Shift the current remainder one decimal place, add the new digit, take mod 97
    rem = (rem * 10 + d) % 97;
  }
  return rem;
}

/**
 * computeMod97Checksum
 * --------------------
 * Computes the two-digit Mod 97 check number for a ticket payload.
 *
 * Steps:
 *   1. Expand the payload (letters → numbers, punctuation stripped).
 *   2. Append "00" (required placeholder before the mod operation).
 *   3. Compute remainder = expandedString % 97.
 *   4. Checksum = 98 − remainder.
 *   5. Pad to 2 digits and return.
 *
 * @param payload - The ticket body before the checksum (e.g. "NO.20240315-01HXYZ...")
 */
export function computeMod97Checksum(payload: string): string {
  console.log(`[Checksum] Computing checksum for payload: "${payload}"`);

  const expanded = expandAlnumForMod97(payload);
  console.log(
    `[Checksum] Expanded (letters→numbers, punctuation stripped): "${expanded.slice(0, 40)}..." (${expanded.length} digits total)`,
  );

  const rem = mod97FromNumericString(expanded + '00');
  console.log(`[Checksum] Remainder after mod 97: ${rem}`);

  const check = 98 - rem;
  const checkStr = check.toString().padStart(2, '0');
  console.log(`[Checksum] Checksum = 98 - ${rem} = ${check} — padded: "${checkStr}"`);

  return checkStr;
}

/**
 * buildTicketNo
 * -------------
 * Assembles the complete human-readable ticket number.
 *
 * Format:  NO.{YYYYMMDD}-{ULID}-{checksum}
 * Example: NO.20240315-01HXYZ3K9PQRS1T2U3V4W5X6Y7-42
 *
 * The checksum covers the entire "NO.YYYYMMDD-ULID" portion, so
 * changing any character causes the checksum to no longer match.
 *
 * @param ymd  - Date in YYYYMMDD format (e.g. "20240315")
 * @param ulid - The ULID string for this ticket
 */
export function buildTicketNo(ymd: string, ulid: string): string {
  const payload = `NO.${ymd}-${ulid}`;
  console.log(`[Ticket Number] Payload (before checksum): "${payload}"`);

  const check = computeMod97Checksum(payload);

  const ticketNo = `${payload}-${check}`;
  console.log(`[Ticket Number] Complete ticket number: "${ticketNo}"`);
  return ticketNo;
}
