// Supabase returns at most 1,000 rows per request, so read everything in pages
export async function fetchAllPages<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const pageSize = 1000;
  const all: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) throw error;
    if (!data) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return all;
}
