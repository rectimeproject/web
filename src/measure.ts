export default async function measure<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();
  const result = await fn();
  console.log("%s took %o ms", name, performance.now() - startTime);
  return result;
}
