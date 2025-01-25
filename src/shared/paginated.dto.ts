export class Paginated<T> {
  data: Array<T>;
  total: number;
  size: number;
  page: number;
}

export const DEFAULT_PAGE_SIZE = 24;

export const getPagination = (page: number, size = DEFAULT_PAGE_SIZE) => {
  const from = (page - 1) * size;
  const to = from + size;

  return { from, to };
};
