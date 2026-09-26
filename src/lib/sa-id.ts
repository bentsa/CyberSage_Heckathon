/**
 * South African ID number validator.
 * Format: YYMMDD SSSS C A Z
 *   YYMMDD = date of birth
 *   SSSS   = sequence (0000-4999 female, 5000-9999 male)
 *   C      = 0 SA citizen, 1 permanent resident
 *   A      = race/usage digit (legacy, usually 8)
 *   Z      = Luhn checksum
 */
export type SaIdParsed = {
  valid: boolean;
  reasons: string[];
  dateOfBirth?: string; // YYYY-MM-DD
  gender?: "male" | "female";
  citizenship?: "SA Citizen" | "Permanent Resident";
};

export function parseSaId(raw: string): SaIdParsed {
  const reasons: string[] = [];
  const id = raw.replace(/\s|-/g, "");
  if (!/^\d{13}$/.test(id)) return { valid: false, reasons: ["ID must be 13 digits"] };

  const yy = parseInt(id.slice(0, 2), 10);
  const mm = parseInt(id.slice(2, 4), 10);
  const dd = parseInt(id.slice(4, 6), 10);
  const seq = parseInt(id.slice(6, 10), 10);
  const citizen = parseInt(id.slice(10, 11), 10);
  // pos 11 is legacy race digit, ignored
  const check = parseInt(id.slice(12, 13), 10);

  // DOB — pick century: assume 2000s if YY<= currentYY%100, else 1900s
  const nowYY = new Date().getFullYear() % 100;
  const century = yy <= nowYY ? 2000 : 1900;
  const year = century + yy;
  const dob = new Date(Date.UTC(year, mm - 1, dd));
  const dobValid =
    dob.getUTCFullYear() === year && dob.getUTCMonth() === mm - 1 && dob.getUTCDate() === dd;
  if (!dobValid) reasons.push("Date of birth digits are invalid");

  if (citizen !== 0 && citizen !== 1) reasons.push("Citizenship digit must be 0 or 1");

  // Luhn checksum (per SA spec)
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    let d = parseInt(id[i], 10);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  const computed = (10 - (sum % 10)) % 10;
  if (computed !== check) reasons.push("Checksum digit failed Luhn validation");

  if (reasons.length) return { valid: false, reasons };
  return {
    valid: true,
    reasons: [],
    dateOfBirth: `${year.toString().padStart(4, "0")}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`,
    gender: seq >= 5000 ? "male" : "female",
    citizenship: citizen === 0 ? "SA Citizen" : "Permanent Resident",
  };
}
