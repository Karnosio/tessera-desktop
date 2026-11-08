// Строки, числа и base64 как в Kotlin на JVM: от этого зависит, примет ли ссылку Windows так же, как Android

/** `Char.isWhitespace()`: в отличие от JS, BOM — не пробел, а \u001C…\u001F — пробел. */
export function isWhitespace(code: number): boolean {
  return (
    (code >= 0x09 && code <= 0x0d) ||
    (code >= 0x1c && code <= 0x20) ||
    code === 0xa0 ||
    code === 0x1680 ||
    (code >= 0x2000 && code <= 0x200a) ||
    code === 0x2028 ||
    code === 0x2029 ||
    code === 0x202f ||
    code === 0x205f ||
    code === 0x3000
  );
}

export function trim(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && isWhitespace(value.charCodeAt(start))) start++;
  while (end > start && isWhitespace(value.charCodeAt(end - 1))) end--;
  return value.slice(start, end);
}

export function isBlank(value: string): boolean {
  for (let i = 0; i < value.length; i++) if (!isWhitespace(value.charCodeAt(i))) return false;
  return true;
}

export const lines = (value: string): string[] => value.split(/\r\n|\n|\r/);

/** `substringBefore` / `substringAfter`: без разделителя — вся строка или `missing`. */
export function before(value: string, delimiter: string): string {
  const index = value.indexOf(delimiter);
  return index < 0 ? value : value.slice(0, index);
}

export function after(value: string, delimiter: string, missing = value): string {
  const index = value.indexOf(delimiter);
  return index < 0 ? missing : value.slice(index + delimiter.length);
}

export function beforeLast(value: string, delimiter: string): string {
  const index = value.lastIndexOf(delimiter);
  return index < 0 ? value : value.slice(0, index);
}

export function afterLast(value: string, delimiter: string, missing = value): string {
  const index = value.lastIndexOf(delimiter);
  return index < 0 ? missing : value.slice(index + delimiter.length);
}

export function trimChars(value: string, chars: string, start = true, end = true): string {
  let from = 0;
  let to = value.length;
  while (start && from < to && chars.includes(value[from])) from++;
  while (end && to > from && chars.includes(value[to - 1])) to--;
  return value.slice(from, to);
}

const DECIMAL_DIGIT = /\p{Nd}/u;

/** `Char.isDigit()`: любая десятичная цифра Unicode. */
export const isDigit = (code: number): boolean => DECIMAL_DIGIT.test(String.fromCharCode(code));

export function allDigits(value: string): boolean {
  for (let i = 0; i < value.length; i++) if (!isDigit(value.charCodeAt(i))) return false;
  return true;
}

/** `Character.digit`: Unicode-цифры и полноширинные латинские буквы тоже. */
function digitOf(code: number, radix: number): number {
  let digit = -1;
  if (code >= 0x30 && code <= 0x39) digit = code - 0x30;
  else if (code >= 0x41 && code <= 0x5a) digit = code - 0x41 + 10;
  else if (code >= 0x61 && code <= 0x7a) digit = code - 0x61 + 10;
  else if (code >= 0xff21 && code <= 0xff3a) digit = code - 0xff21 + 10;
  else if (code >= 0xff41 && code <= 0xff5a) digit = code - 0xff41 + 10;
  else if (isDigit(code)) {
    // Цифры Unicode идут подряд десятками от нуля
    let zero = code;
    while (isDigit(zero - 1)) zero--;
    digit = (code - zero) % 10;
  }
  return digit < radix ? digit : -1;
}

/** `toIntOrNull`: знак `+` или `-`, без пробелов, в пределах Int. */
export function toIntOrNull(value: string, radix = 10): number | null {
  if (value.length === 0) return null;
  let index = 0;
  let negative = false;
  if (value[0] < "0") {
    if (value.length === 1) return null;
    index = 1;
    if (value[0] === "-") negative = true;
    else if (value[0] !== "+") return null;
  }
  const limit = negative ? 2 ** 31 : 2 ** 31 - 1;
  let result = 0;
  for (; index < value.length; index++) {
    const digit = digitOf(value.charCodeAt(index), radix);
    if (digit < 0) return null;
    result = result * radix + digit;
    if (result > limit) return null;
  }
  return (negative ? -result : result) || 0;
}

/** `Integer.valueOf`, затем `Long`, затем `BigInteger` — как SnakeYAML строит целые. */
export function toBigIntOrNull(value: string): bigint | null {
  let index = value[0] === "-" || value[0] === "+" ? 1 : 0;
  if (index === value.length) return null;
  let result = 0n;
  for (; index < value.length; index++) {
    const digit = digitOf(value.charCodeAt(index), 10);
    if (digit < 0) return null;
    result = result * 10n + BigInt(digit);
  }
  return value[0] === "-" ? -result : result;
}

/** `Number.toInt()`: у Long и BigInteger — младшие 32 бита, у Double — отсечение с насыщением. */
export function numberToInt(value: bigint | number): number {
  if (typeof value === "bigint") return Number(BigInt.asIntN(32, value));
  if (Number.isNaN(value)) return 0;
  return Math.max(-(2 ** 31), Math.min(2 ** 31 - 1, Math.trunc(value))) || 0;
}

/** `Double.toString()`: `443.0`, `1.0E-5`, `1.0E7`. */
export function doubleToString(value: number): string {
  if (Number.isNaN(value)) return "NaN";
  if (value === Infinity) return "Infinity";
  if (value === -Infinity) return "-Infinity";
  if (value === 0) return Object.is(value, -0) ? "-0.0" : "0.0";
  const sign = value < 0 ? "-" : "";
  const magnitude = Math.abs(value);
  const [mantissa, power] = magnitude.toExponential().split("e");
  const digits = mantissa.replace(".", "");
  const exponent = Number(power);
  if (magnitude >= 1e-3 && magnitude < 1e7) {
    if (exponent < 0) return `${sign}0.${"0".repeat(-exponent - 1)}${digits}`;
    return `${sign}${digits.slice(0, exponent + 1).padEnd(exponent + 1, "0")}.${digits.slice(exponent + 1) || "0"}`;
  }
  return `${sign}${digits[0]}.${digits.slice(1) || "0"}E${exponent}`;
}

const upper = (char: string): string => {
  const value = char.toUpperCase();
  return value.length === 1 ? value : char;
};

const lower = (char: string): string => {
  if (char === "\u0130") return "i";
  const value = char.toLowerCase();
  return value.length === 1 ? value : char;
};

/** `equals(…, ignoreCase = true)`: посимвольно, как `String.equalsIgnoreCase`. */
export function equalsIgnoreCase(value: string | null | undefined, other: string): boolean {
  if (value == null || value.length !== other.length) return false;
  for (let i = 0; i < value.length; i++) {
    if (value[i] === other[i]) continue;
    const a = upper(value[i]);
    const b = upper(other[i]);
    if (a !== b && lower(a) !== lower(b)) return false;
  }
  return true;
}

const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}(?:==)?|[A-Za-z0-9+/]{3}=?)?$/;

/** `Base64.getDecoder().decode`: строгий алфавит, отступ необязателен, но если есть — верный. */
export function base64(value: string): Buffer | null {
  return BASE64.test(value) ? Buffer.from(value, "base64") : null;
}

const UTF8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

/** Строгий UTF-8, как `newDecoder()` с отказом на ошибке; BOM остаётся в тексте. */
export function decodeUtf8(bytes: Uint8Array): string | null {
  try {
    return UTF8.decode(bytes);
  } catch {
    return null;
  }
}

/** `String.toByteArray()`: одиночная суррогатная половина — `?`. */
export const wellFormed = (value: string): string => value.replace(/\p{Cs}/gu, "?");
