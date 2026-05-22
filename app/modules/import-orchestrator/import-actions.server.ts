import type { ImportStatus } from "@prisma/client";

export type ImportActionState = {
  status: ImportStatus;
  parsedRows: number;
};

export function canRetryCategorization(importRow: ImportActionState) {
  return importRow.parsedRows > 0 && (importRow.status === "ERROR" || importRow.status === "REVIEW");
}
