import { VatDeclarationCenter } from "./vat-declaration-center.server";

export class VatDeclarationFreshnessCenter extends VatDeclarationCenter {}

export { buildVatDeclarationFreshness } from "./vat-declaration-center.server";

export type {
  VatDeclarationFreshness,
  VatDeclarationFreshnessReason,
} from "./vat-declaration-center.server";
