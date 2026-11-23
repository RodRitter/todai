export class UserNameValidationError extends Error {}

export function parseUserName(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 100 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new UserNameValidationError("Enter a name of 1 to 100 characters without control characters.");
  }
  return value.trim();
}
