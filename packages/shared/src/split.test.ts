import { describe, expect, it } from "vitest";
import { weightsToBasisPoints } from "./split";

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
