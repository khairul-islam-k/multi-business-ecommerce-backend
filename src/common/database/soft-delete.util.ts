export const notDeleted = {
  deletedAt: null,
} as const;

export function deletedNow() {
  return {
    deletedAt: new Date(),
  };
}
