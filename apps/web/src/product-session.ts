interface ResourceStorage {
  readonly length: number;
  key(index: number): string | null;
  removeItem(key: string): void;
}
/** Resource IDs are not credentials, but must not reopen a previous account's workspace. */
export function clearLearningStorage(storage: ResourceStorage): void {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (
      key === "khotwa-active-attempt" ||
      key?.startsWith("khotwa-episode:") ||
      key?.startsWith("khotwa-path:")
    )
      keys.push(key);
  }
  for (const key of keys) storage.removeItem(key);
}
