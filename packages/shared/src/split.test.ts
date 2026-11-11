import { describe, expect, it } from "vitest";
import { splitAmount, weightsToBasisPoints } from "./split";

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

describe("weightsToBasisPoints", () => {
  it("splits equal weights equally", () => {
    expect(weightsToBasisPoints([1, 1])).toEqual([5000, 5000]);
    expect(weightsToBasisPoints([2, 2, 2, 2])).toEqual([2500, 2500, 2500, 2500]);
  });

  it("splits proportionally to the weights", () => {
    expect(weightsToBasisPoints([3, 1])).toEqual([7500, 2500]);
    expect(weightsToBasisPoints([100, 1])).toEqual([9901, 99]);
  });

  it("gives leftover basis points to the first members, one each", () => {
    expect(weightsToBasisPoints([1, 1, 1])).toEqual([3334, 3333, 3333]);
    expect(weightsToBasisPoints([1, 1, 1, 1, 1, 1, 1])).toEqual([1429, 1429, 1429, 1429, 1428, 1428, 1428]);
  });

  it("gives nothing to a member with weight 0", () => {
    expect(weightsToBasisPoints([1, 0, 1])).toEqual([5000, 0, 5000]);
    expect(weightsToBasisPoints([0, 3])).toEqual([0, 10000]);
  });

  it("gives everything to a single member", () => {
    expect(weightsToBasisPoints([1])).toEqual([10000]);
    expect(weightsToBasisPoints([57])).toEqual([10000]);
  });

  it("always adds up to exactly 10000", () => {
    const cases = [
      [7, 11, 13],
      [1, 2, 3, 4, 5, 6],
      [99, 98, 97],
      [3, 3, 3],
      [100, 100, 1],
      [17, 0, 23, 5],
    ];
    for (const weights of cases) expect(sum(weightsToBasisPoints(weights))).toBe(10000);
  });

  it("refuses an empty list or weights that are all zero", () => {
    expect(() => weightsToBasisPoints([])).toThrow();
    expect(() => weightsToBasisPoints([0, 0])).toThrow();
  });
});

describe("splitAmount", () => {
  it("splits cents proportionally to the weights", () => {
    expect(splitAmount(4280, [3, 1])).toEqual([3210, 1070]);
    expect(splitAmount(1000, [1, 1])).toEqual([500, 500]);
  });

  it("gives leftover cents one each to the first people, in order", () => {
    expect(splitAmount(1001, [3, 1])).toEqual([751, 250]);
    expect(splitAmount(1000, [1, 1, 1])).toEqual([334, 333, 333]);
    expect(splitAmount(2, [1, 1, 1])).toEqual([1, 1, 0]);
  });

  it("never gives anything to a weight of 0, not even leftovers", () => {
    expect(splitAmount(1001, [0, 3, 1])).toEqual([0, 751, 250]);
    expect(splitAmount(5, [0, 1, 0, 1])).toEqual([0, 3, 0, 2]);
  });

  it("gives everything to a single person", () => {
    expect(splitAmount(4280, [1])).toEqual([4280]);
    expect(splitAmount(1, [0, 7])).toEqual([0, 1]);
  });

  it("rescales stored shares to a new amount in the same proportions", () => {
    expect(splitAmount(4400, [3210, 1070])).toEqual([3300, 1100]);
  });

  it("stays exact with the largest amounts and uneven weights", () => {
    // 10^7 × 10^7 is still far below 2^53, so the integer math is exact.
    const shares = splitAmount(10_000_000, [10_000_000, 1]);
    expect(sum(shares)).toBe(10_000_000);
    // The second share is 0.9999999 cents before rounding down; the leftover cent goes to the first person.
    expect(shares).toEqual([10_000_000, 0]);
    expect(splitAmount(10_000_000, [1, 2, 3])).toEqual([1_666_667, 3_333_333, 5_000_000]);
  });

  it("always adds up to exactly the amount", () => {
    const cases: [number, number[]][] = [
      [1, [1, 1, 1, 1]],
      [7, [7, 11, 13]],
      [9999, [1, 2, 3, 4, 5, 6]],
      [3333, [99, 98, 97]],
      [100, [100, 100, 1]],
      [12345, [17, 0, 23, 5]],
    ];
    for (const [amount, weights] of cases) expect(sum(splitAmount(amount, weights))).toBe(amount);
  });

  it("refuses an empty list, weights that are all zero, or an amount that isn't a positive whole number", () => {
    expect(() => splitAmount(100, [])).toThrow();
    expect(() => splitAmount(100, [0, 0])).toThrow();
    expect(() => splitAmount(0, [1])).toThrow();
    expect(() => splitAmount(-5, [1])).toThrow();
    expect(() => splitAmount(10.5, [1])).toThrow();
  });
});
