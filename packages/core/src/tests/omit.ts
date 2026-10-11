/**
 * Copy `obj` without `keys`.
 *
 * Under `exactOptionalPropertyTypes` a fixture cannot unset an optional field
 * by spreading `{ key: undefined }` over it; dropping the key states the same
 * thing, "this field is absent", in a form the type accepts.
 */
export function omit<T extends object, K extends keyof T>(
  obj: T,
  ...keys: K[]
): Omit<T, K> {
  const copy: Partial<T> = { ...obj };
  for (const key of keys) delete copy[key];
  return copy as Omit<T, K>;
}
