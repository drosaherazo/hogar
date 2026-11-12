import type { Locale } from "./locale";

/**
 * Starter names (ADR 0008): the playful name a new person gets when nobody has given one, so
 * nobody in a household is ever nameless. "Brave Otter" in English, "Nutria Valiente" in Spanish.
 *
 * Reviewed in both languages: no animal that doubles as an insult in Spanish (no ballena, foca,
 * burro, cerdo, pato…), and only positive adjectives. Every Spanish adjective is gender-invariant
 * (valiente, veloz, ágil…), so any animal pairs with any adjective without breaking agreement.
 * Starter names are not unique; names never were.
 */
export const STARTER_ANIMALS = [
  { en: "Otter", es: "Nutria" },
  { en: "Panda", es: "Panda" },
  { en: "Fox", es: "Zorro" },
  { en: "Owl", es: "Búho" },
  { en: "Koala", es: "Koala" },
  { en: "Hedgehog", es: "Erizo" },
  { en: "Dolphin", es: "Delfín" },
  { en: "Penguin", es: "Pingüino" },
  { en: "Squirrel", es: "Ardilla" },
  { en: "Turtle", es: "Tortuga" },
  { en: "Rabbit", es: "Conejo" },
  { en: "Hummingbird", es: "Colibrí" },
  { en: "Raccoon", es: "Mapache" },
  { en: "Beaver", es: "Castor" },
  { en: "Lynx", es: "Lince" },
  { en: "Bear", es: "Oso" },
  { en: "Tiger", es: "Tigre" },
  { en: "Falcon", es: "Halcón" },
  { en: "Bee", es: "Abeja" },
  { en: "Llama", es: "Llama" },
] as const satisfies readonly Record<Locale, string>[];

export const STARTER_ADJECTIVES = [
  { en: "Brave", es: "Valiente" },
  { en: "Cheerful", es: "Alegre" },
  { en: "Swift", es: "Veloz" },
  { en: "Kind", es: "Amable" },
  { en: "Happy", es: "Feliz" },
  { en: "Bold", es: "Audaz" },
  { en: "Bright", es: "Brillante" },
  { en: "Elegant", es: "Elegante" },
  { en: "Great", es: "Genial" },
  { en: "Steadfast", es: "Tenaz" },
  { en: "Smiling", es: "Sonriente" },
  { en: "Patient", es: "Paciente" },
  { en: "Loyal", es: "Leal" },
  { en: "Friendly", es: "Cordial" },
  { en: "Jolly", es: "Jovial" },
  { en: "Strong", es: "Fuerte" },
  { en: "Nimble", es: "Ágil" },
  { en: "Sweet", es: "Dulce" },
  { en: "Noble", es: "Noble" },
  { en: "Gentle", es: "Gentil" },
] as const satisfies readonly Record<Locale, string>[];

function pick<T>(list: readonly T[], random: () => number): T {
  const item = list[Math.floor(random() * list.length)];
  if (item === undefined) throw new Error("random() must return a number in [0, 1)");
  return item;
}

/**
 * True when `name` is a starter name in either language. A starter name is one name, so the
 * interface greets "Brave Otter" in full instead of taking its first word as a first name.
 */
export function isStarterName(name: string): boolean {
  const [first, second, ...rest] = name.trim().split(/\s+/);
  if (!first || !second || rest.length > 0) return false;
  const has = (list: readonly Record<Locale, string>[], locale: Locale, word: string) =>
    list.some((entry) => entry[locale] === word);
  return (
    (has(STARTER_ADJECTIVES, "en", first) && has(STARTER_ANIMALS, "en", second)) ||
    (has(STARTER_ANIMALS, "es", first) && has(STARTER_ADJECTIVES, "es", second))
  );
}

/** A random starter name in `locale`. `random` returns a number in [0, 1), like `Math.random`. */
export function pickStarterName(locale: Locale, random: () => number = Math.random): string {
  const animal = pick(STARTER_ANIMALS, random)[locale];
  const adjective = pick(STARTER_ADJECTIVES, random)[locale];
  return locale === "es" ? `${animal} ${adjective}` : `${adjective} ${animal}`;
}
