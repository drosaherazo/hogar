import { EXPENSE_DESCRIPTION_MAX } from "@hogar/shared";

/** Upper-cases the first letter for `locale`, leaving the rest as written. */
function capitalize(text: string, locale: string): string {
  const [first] = text;
  return first ? first.toLocaleUpperCase(locale) + text.slice(first.length) : text;
}

/**
 * The title of an expense recorded when finishing shopping ("Milk, eggs, bread and 4 more"):
 * the items in list order, as many whole names as fit in an expense description, then how many
 * more there are, joined the way `locale` joins a list and starting with a capital letter.
 *
 * `more` translates the count left out (`shopping:purchaseTitle.more`, "4 more" / "4 más"). It
 * is the list's last element, so the list format adds the conjunction ("and" / "y", "e" before
 * an "i" sound, the Oxford comma where the region uses one) and no language repeats it. The
 * 50-character item name cap means the first name and "and 99 more" always fit.
 */
export function purchaseTitle(names: readonly string[], locale: string, more: (count: number) => string): string {
  const list = new Intl.ListFormat(locale, { type: "conjunction" });
  const titleShowing = (shown: number) =>
    capitalize(
      list.format(shown === names.length ? names : [...names.slice(0, shown), more(names.length - shown)]),
      locale,
    );

  for (let shown = names.length; shown > 1; shown--) {
    const title = titleShowing(shown);
    if (title.length <= EXPENSE_DESCRIPTION_MAX) return title;
  }
  return titleShowing(Math.min(1, names.length));
}
