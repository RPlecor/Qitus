import { describe, expect, it } from "vitest";
import { ActivityLogCenter, toTimelineItem, type ActivityLogSummary } from "../app/modules/activity-log/activity-log-center.server";

describe("ActivityLogCenter", () => {
  it("exports activity rows as CSV", async () => {
    class TestActivityLogCenter extends ActivityLogCenter {
      async listActivity(): Promise<ActivityLogSummary[]> {
        return [{
          id: "log_1",
          action: "document.generated",
          entityType: "document",
          entityId: "doc_1",
          metadata: { filename: "912345678FEC20251231.txt" },
          createdAt: "2026-05-19T09:00:00.000Z",
        }];
      }
    }

    await expect(new TestActivityLogCenter().exportActivityCsv({} as never)).resolves.toContain(
      "\"document.generated\",\"document\",\"doc_1\",\"{\"\"filename\"\":\"\"912345678FEC20251231.txt\"\"}\""
    );
  });

  it("turns technical actions into readable timeline items", () => {
    expect(toTimelineItem({
      id: "log_1",
      action: "document.generated",
      entityType: "document",
      entityId: "doc_1",
      metadata: { filenames: ["912345678FEC20251231.txt"] },
      createdAt: "2026-05-19T09:00:00.000Z",
    })).toMatchObject({
      label: "Document généré",
      detail: "912345678FEC20251231.txt",
    });

    expect(toTimelineItem({
      id: "log_2",
      action: "document.blocked",
      entityType: "document",
      entityId: null,
      metadata: { type: "fec", message: "Génération bloquée" },
      createdAt: "2026-05-19T09:00:00.000Z",
    })).toMatchObject({
      label: "Génération document bloquée",
    });
  });
});
