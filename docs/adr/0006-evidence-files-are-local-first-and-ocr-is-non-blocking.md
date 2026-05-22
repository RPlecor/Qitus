# ADR 0006 — Evidence Files Are Local-First And OCR Is Non-Blocking

## Status

Accepted.

## Context

Phase 11 turns calculated evidence requirements into uploaded accounting proof files. The beta remains local-first and must not depend on cloud OCR, object storage, or a cabinet workflow to stay demoable.

## Decision

- Uploaded proof files are represented by `Attachment` and stored through `EvidenceStorage`.
- `LocalEvidenceStorageAdapter` is the default Adapter; object storage remains a prepared Seam.
- OCR is best-effort and local: `pdftotext` for PDFs, `tesseract` for images, direct text for `.txt`.
- OCR failure never blocks the accounting proof workflow. The file remains attached, downloadable, and manually editable.
- `AttachmentLink` is the proof that a file supports a Transaction, JournalEntry, ClosingAdjustment, or FiscalYear.

## Consequences

- The app can prove which entries still lack files without requiring OCR success.
- The evidence bundle can include attachment metadata and availability even if a local file is missing.
- Factur-X and a full electronic invoice workflow remain later work.
