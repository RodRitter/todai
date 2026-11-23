export function formatCredits(value: number) {
  return value > 0 && value < .01 ? "<0.01" : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
