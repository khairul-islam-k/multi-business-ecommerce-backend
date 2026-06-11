export function shouldUseDefaultAddress(
  requestedDefault: boolean | undefined,
  existingAddressCount: number,
) {
  return requestedDefault === true || existingAddressCount === 0;
}
