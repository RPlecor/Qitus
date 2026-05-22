import { describe, expect, it } from "vitest";
import { TransactionFilterStateCenter } from "../app/modules/transactions/transaction-filter-state";

describe("TransactionFilterState", () => {
  it("normalizes invalid query params to safe defaults", () => {
    const filters = new TransactionFilterStateCenter();
    const state = filters.parseFromUrl(new URL("http://paperasse.test/transactions?page=-4&pageSize=42&status=nope&direction=sideways&dateFrom=bad"));
    expect(state).toMatchObject({
      page: 1,
      pageSize: 25,
      status: "all",
      direction: "all",
      dateFrom: "",
    });
  });

  it("serializes only active filters and describes them in French", () => {
    const filters = new TransactionFilterStateCenter();
    const state = filters.normalize({ status: "review", search: "stripe", pageSize: 50, page: 2 });
    expect(filters.toUrlParams(state).toString()).toBe("page=2&pageSize=50&status=review&search=stripe");
    expect(filters.describeActiveFilters(state).map((filter) => filter.label)).toEqual(["À vérifier", "Recherche: stripe", "50 par page"]);
  });
});
