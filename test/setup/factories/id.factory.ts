let counter = 0;

export function uniqueTestId(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

export function uniqueTestEmail(prefix = "user") {
  return `${uniqueTestId(prefix)}@example.test`;
}
