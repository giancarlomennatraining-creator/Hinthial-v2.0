export interface PasswordCriterion {
  id: string;
  label: string;
  test: (password: string) => boolean;
}

/** Canonical strong-password criteria, checked live as the user types. */
export const PASSWORD_CRITERIA: PasswordCriterion[] = [
  { id: "minLength", label: "Almeno 8 caratteri", test: (p) => p.length >= 8 },
  { id: "uppercase", label: "Una lettera maiuscola", test: (p) => /[A-Z]/.test(p) },
  { id: "lowercase", label: "Una lettera minuscola", test: (p) => /[a-z]/.test(p) },
  { id: "number", label: "Un numero", test: (p) => /[0-9]/.test(p) },
  {
    id: "specialChar",
    label: "Un carattere speciale (es. ! ? @ # $)",
    test: (p) => /[^A-Za-z0-9]/.test(p),
  },
];

// A short list of extremely common passwords --- not meant to be
// exhaustive (that's what a real breach-database check, e.g.
// Have I Been Pwned's k-anonymity API, would be for --- out of scope
// here), just enough to catch "P@ssw0rd1" passing every regex above
// while still being trivially guessable.
const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "password123",
  "12345678",
  "123456789",
  "1234567890",
  "qwerty123",
  "qwertyuiop",
  "11111111",
  "123123123",
  "welcome123",
  "admin1234",
  "letmein123",
  "iloveyou1",
]);

export type PasswordStrengthLevel =
  | "molto-debole"
  | "debole"
  | "discreta"
  | "buona"
  | "forte";

export interface PasswordStrength {
  /** 0 (empty/very weak) to 5 (all criteria met). */
  score: number;
  level: PasswordStrengthLevel;
  label: string;
  /** ids of PASSWORD_CRITERIA satisfied by this password. */
  satisfied: string[];
  isCommon: boolean;
}

const LEVELS: { level: PasswordStrengthLevel; label: string }[] = [
  { level: "molto-debole", label: "Molto debole" },
  { level: "molto-debole", label: "Molto debole" },
  { level: "debole", label: "Debole" },
  { level: "discreta", label: "Discreta" },
  { level: "buona", label: "Buona" },
  { level: "forte", label: "Forte" },
];

export function evaluatePasswordStrength(password: string): PasswordStrength {
  const satisfied = PASSWORD_CRITERIA.filter((c) => c.test(password)).map((c) => c.id);
  const isCommon = COMMON_PASSWORDS.has(password.toLowerCase());

  // A common password never scores as more than "weak", regardless of
  // which character-class boxes it happens to tick.
  const score = isCommon ? Math.min(satisfied.length, 1) : satisfied.length;
  const { level, label } = LEVELS[score];

  return { score, level, label, satisfied, isCommon };
}
