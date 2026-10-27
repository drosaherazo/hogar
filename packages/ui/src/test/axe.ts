import { axe } from "vitest-axe";
import { expect } from "vitest";

/**
 * Fails the test with the list of axe violations, if any.
 * `region` (all content inside landmarks) is a page-level rule: components rendered on
 * their own, or portaled to <body>, can't satisfy it. App page tests keep it enabled.
 */
export async function expectNoA11yViolations(container: Element) {
  const results = await axe(container, { rules: { region: { enabled: false } } });
  expect(results.violations.map(({ id, help }) => `${id}: ${help}`)).toEqual([]);
}
