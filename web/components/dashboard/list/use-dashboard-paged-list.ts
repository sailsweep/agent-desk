"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import {
  buildDashboardCrudQuery,
  normalizeDashboardCrudPageResult,
  type DashboardCrudPageResult,
  type DashboardCrudFilterStateConfig,
  type DashboardCrudQueryFilter,
  type DashboardCrudQueryValue,
} from "@/components/dashboard/crud"
import { useDashboardCrudFilters } from "@/components/dashboard/crud"

export type DashboardPagedListFilter = DashboardCrudQueryFilter &
  DashboardCrudFilterStateConfig

export type DashboardPagedListOptions<TItem> = {
  filters: DashboardPagedListFilter[]
  fetchList: (
    query: Record<string, DashboardCrudQueryValue>
  ) => Promise<DashboardCrudPageResult<TItem>>
  pageSize?: number
  loadFailed: string
  enabled?: boolean
}

export function useDashboardPagedList<TItem>({
  filters,
  fetchList,
  pageSize = 20,
  loadFailed,
  enabled = true,
}: DashboardPagedListOptions<TItem>) {
  const filtersKey = filters
    .map(
      (filter) =>
        `${filter.name}:${String(filter.defaultValue)}:${String(filter.allValue)}:${filter.trim ? "1" : "0"}:${filter.valueType ?? ""}`
    )
    .join("|")
  const { draftFilters, appliedFilters, setDraftFilter, applyFilter, applyFilters } =
    useDashboardCrudFilters(filters)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(pageSize)
  const [loading, setLoading] = useState(enabled)
  const [result, setResult] = useState<DashboardCrudPageResult<TItem>>({
    results: [],
    page: { page: 1, limit: pageSize, total: 0 },
  })

  const loadData = useCallback(async () => {
    if (!enabled) {
      setLoading(false)
      setResult({ results: [], page: { page: 1, limit, total: 0 } })
      return
    }

    setLoading(true)
    try {
      const data = await fetchList(
        buildDashboardCrudQuery({
          values: appliedFilters,
          filters,
          page,
          limit,
        })
      )
      setResult(normalizeDashboardCrudPageResult(data, page, limit))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : loadFailed)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedFilters, enabled, fetchList, filtersKey, limit, loadFailed, page])

  useEffect(() => {
    void loadData()
  }, [loadData])

  function applyDraftFilters() {
    applyFilters()
    setPage(1)
  }

  function applyDraftFilter(name: string, value: string | number | undefined) {
    applyFilter(name, value)
    setPage(1)
  }

  function handlePageChange(nextPage: number) {
    if (nextPage < 1 || nextPage === page) return
    setPage(nextPage)
  }

  function handleLimitChange(nextLimit: number) {
    if (nextLimit <= 0 || nextLimit === limit) return
    setLimit(nextLimit)
    setPage(1)
  }

  return {
    draftFilters,
    setDraftFilter,
    applyFilter: applyDraftFilter,
    applyFilters: applyDraftFilters,
    page,
    setPage,
    limit,
    setLimit,
    loading,
    result,
    setResult,
    loadData,
    handlePageChange,
    handleLimitChange,
  }
}
