export class CreditValidationError extends Error {}

export function parseCredits(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new CreditValidationError("Enter a credit value of zero or more.");
  }
  return value;
}
