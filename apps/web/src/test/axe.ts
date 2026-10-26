import { axe } from "vitest-axe";
import { expect } from "vitest";

/** Page-level accessibility check: all axe rules, including landmarks. */
export async function expectNoA11yViolations(container: Element) {
  const results = await axe(container);
  expect(results.violations.map(({ id, help }) => `${id}: ${help}`)).toEqual([]);
}
