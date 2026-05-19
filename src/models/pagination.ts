export interface Pagination {
  currentPage: number
  perPage: number
  totalItems: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}
