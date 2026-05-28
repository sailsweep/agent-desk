"use client"

import type { ReactNode } from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  MoreHorizontalIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import {
  DashboardPage,
  DashboardTableShell,
  DashboardTableStateRow,
  DashboardToolbar,
} from "@/components/dashboard-page"
import { ListPagination } from "@/components/list-pagination"
import { OptionCombobox } from "@/components/option-combobox"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  buildDashboardCrudQuery,
  normalizeDashboardCrudPageResult,
  type DashboardCrudFormField,
  type DashboardCrudPageResult,
  type DashboardCrudQueryFilter,
  type DashboardCrudQueryValue,
} from "./dashboard-crud-utils"
import { DashboardCrudFormDialog } from "./dashboard-crud-form-dialog"

type DashboardCrudFilter<TValue extends string | number = string> =
  DashboardCrudQueryFilter & {
    label: string
    placeholder?: string
    defaultValue: TValue
    type?: "text" | "select"
    className?: string
    options?: ReadonlyArray<{ value: string; label: string }>
  }

type DashboardCrudColumn<TItem> = {
  key: string
  label: ReactNode
  className?: string
  render: (item: TItem, context: DashboardCrudRowActionContext<TItem>) => ReactNode
}

type DashboardCrudDialogProps<TItem, TPayload> = {
  open: boolean
  saving: boolean
  item: TItem | null
  itemId: number | null
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: TPayload) => Promise<void>
}

type DashboardCrudRowActionContext<TItem> = {
  item: TItem
  actionLoading: boolean
  actionLoadingId: number | null
  reload: () => Promise<void>
  setActionLoadingId: (id: number | null) => void
}

type DashboardCrudPageProps<TItem, TPayload> = {
  filters: DashboardCrudFilter[]
  columns: DashboardCrudColumn<TItem>[]
  fetchList: (
    query: Record<string, DashboardCrudQueryValue>
  ) => Promise<DashboardCrudPageResult<TItem>>
  renderEditDialog?: (props: DashboardCrudDialogProps<TItem, TPayload>) => ReactNode
  form?: {
    fields: DashboardCrudFormField<TItem>[]
    fetchDetail?: (id: number) => Promise<TItem>
    transformSubmitValues?: (
      values: Record<string, string | number>,
      context: { mode: "create" | "edit"; item: TItem | null }
    ) => TPayload
    labels: {
      createTitle: string
      editTitle: string
      create: string
      save: string
      saving: string
      cancel: string
      loadingDetail: string
      required: string
      invalidNumber: string
      minValue: (min: number) => string
      maxValue: (max: number) => string
    }
  }
  getItemId: (item: TItem) => number
  createItem: (payload: TPayload) => Promise<unknown>
  updateItem: (item: TItem, payload: TPayload) => Promise<unknown>
  deleteItem?: (item: TItem) => Promise<unknown>
  canDelete?: (item: TItem) => boolean
  renderRowActions?: (context: DashboardCrudRowActionContext<TItem>) => ReactNode
  pageSize?: number
  labels: {
    refresh: string
    create: string
    query: string
    loading: string
    empty: string
    actions: string
    edit: string
    delete: string
    processing: string
    moreActions: (item: TItem) => string
    loadFailed: string
    saveFailed: string
    deleteFailed: string
    created: (item: TPayload) => string
    updated: (item: TItem, payload: TPayload) => string
    deleted?: (item: TItem) => string
  }
}

export function DashboardCrudPage<TItem, TPayload>({
  filters,
  columns,
  fetchList,
  renderEditDialog,
  form,
  getItemId,
  createItem,
  updateItem,
  deleteItem,
  canDelete,
  renderRowActions,
  pageSize = 20,
  labels,
}: DashboardCrudPageProps<TItem, TPayload>) {
  const initialFilters = useMemo(
    () =>
      Object.fromEntries(
        filters.map((filter) => [filter.name, filter.defaultValue])
      ) as Record<string, string | number | undefined>,
    [filters]
  )
  const [draftFilters, setDraftFilters] = useState(initialFilters)
  const [appliedFilters, setAppliedFilters] = useState(initialFilters)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(pageSize)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<TItem | null>(null)
  const [result, setResult] = useState<DashboardCrudPageResult<TItem>>({
    results: [],
    page: { page: 1, limit: pageSize, total: 0 },
  })

  useEffect(() => {
    setDraftFilters(initialFilters)
    setAppliedFilters(initialFilters)
  }, [initialFilters])

  const loadData = useCallback(async () => {
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
      toast.error(error instanceof Error ? error.message : labels.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [appliedFilters, fetchList, filters, labels.loadFailed, limit, page])

  useEffect(() => {
    void loadData()
  }, [loadData])

  function applyFilters() {
    setAppliedFilters(draftFilters)
    setPage(1)
  }

  function handleFilterKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return
    event.preventDefault()
    applyFilters()
  }

  function openCreateDialog() {
    setEditingItem(null)
    setDialogOpen(true)
  }

  function openEditDialog(item: TItem) {
    setEditingItem(item)
    setDialogOpen(true)
  }

  function handleDialogOpenChange(open: boolean) {
    if (saving) return
    if (!open) setEditingItem(null)
    setDialogOpen(open)
  }

  async function handleSubmit(payload: TPayload) {
    if (saving) return
    setSaving(true)
    try {
      if (editingItem) {
        await updateItem(editingItem, payload)
        toast.success(labels.updated(editingItem, payload))
      } else {
        await createItem(payload)
        toast.success(labels.created(payload))
      }
      setDialogOpen(false)
      setEditingItem(null)
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : labels.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(item: TItem) {
    if (!deleteItem) return
    const id = getItemId(item)
    setActionLoadingId(id)
    try {
      await deleteItem(item)
      toast.success(labels.deleted?.(item) ?? labels.delete)
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : labels.deleteFailed)
    } finally {
      setActionLoadingId(null)
    }
  }

  const colSpan = columns.length + 1

  return (
    <>
      <DashboardPage>
        <DashboardToolbar
          actions={
            <>
              <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
                <RefreshCwIcon className={loading ? "animate-spin" : undefined} />
                {labels.refresh}
              </Button>
              <Button onClick={openCreateDialog}>
                <PlusIcon />
                {labels.create}
              </Button>
            </>
          }
        >
          {filters.map((filter) => {
            const value = draftFilters[filter.name]
            if (filter.type === "select") {
              return (
                <div key={filter.name} className={filter.className ?? "w-full sm:w-40"}>
                  <OptionCombobox
                    value={String(value ?? "")}
                    onChange={(nextValue) =>
                      setDraftFilters((current) => ({
                        ...current,
                        [filter.name]: nextValue,
                      }))
                    }
                    placeholder={filter.placeholder ?? filter.label}
                    options={[...(filter.options ?? [])]}
                  />
                </div>
              )
            }

            return (
              <div key={filter.name} className={filter.className ?? "w-full sm:w-64"}>
                <Input
                  value={String(value ?? "")}
                  onChange={(event) =>
                    setDraftFilters((current) => ({
                      ...current,
                      [filter.name]: event.target.value,
                    }))
                  }
                  onKeyDown={handleFilterKeyDown}
                  placeholder={filter.placeholder ?? filter.label}
                />
              </div>
            )
          })}
          <Button variant="outline" onClick={applyFilters} disabled={loading}>
            <SearchIcon />
            {labels.query}
          </Button>
        </DashboardToolbar>

        <DashboardTableShell
          pagination={
            <ListPagination
              page={result.page.page}
              total={result.page.total}
              limit={limit}
              loading={loading}
              onPageChange={(nextPage) => {
                if (nextPage < 1 || nextPage === page) return
                setPage(nextPage)
              }}
              onLimitChange={(nextLimit) => {
                setLimit(nextLimit)
                setPage(1)
              }}
            />
          }
        >
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column.key} className={column.className}>
                    {column.label}
                  </TableHead>
                ))}
                <TableHead className="w-[92px] text-right">
                  {labels.actions}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.results.map((item) => {
                const id = getItemId(item)
                const actionLoading = actionLoadingId === id
                return (
                  <TableRow key={id}>
                    {columns.map((column) => (
                      <TableCell key={column.key} className={column.className}>
                        {column.render(item, {
                          item,
                          actionLoading,
                          actionLoadingId,
                          reload: loadData,
                          setActionLoadingId,
                        })}
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      <ButtonGroup className="ml-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(item)}
                        >
                          {labels.edit}
                        </Button>
                        {renderRowActions || deleteItem ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={<Button variant="outline" size="icon-sm" />}
                              aria-label={labels.moreActions(item)}
                            >
                              <MoreHorizontalIcon />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40 min-w-40">
                              {renderRowActions?.({
                                item,
                                actionLoading,
                                actionLoadingId,
                                reload: loadData,
                                setActionLoadingId,
                              })}
                              {deleteItem ? (
                                <DropdownMenuItem
                                  onClick={() => void handleDelete(item)}
                                  disabled={canDelete ? !canDelete(item) : false}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2Icon />
                                  {actionLoading ? labels.processing : labels.delete}
                                </DropdownMenuItem>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </ButtonGroup>
                    </TableCell>
                  </TableRow>
                )
              })}
              {loading || result.results.length === 0 ? (
                <DashboardTableStateRow
                  colSpan={colSpan}
                  loading={loading}
                  loadingText={labels.loading}
                  emptyText={labels.empty}
                />
              ) : null}
            </TableBody>
          </Table>
        </DashboardTableShell>
      </DashboardPage>
      {form ? (
        <DashboardCrudFormDialog
          open={dialogOpen}
          saving={saving}
          item={editingItem}
          itemId={editingItem ? getItemId(editingItem) : null}
          fields={form.fields}
          fetchDetail={form.fetchDetail}
          transformSubmitValues={form.transformSubmitValues}
          labels={form.labels}
          onOpenChange={handleDialogOpenChange}
          onSubmit={handleSubmit}
        />
      ) : (
        renderEditDialog?.({
          open: dialogOpen,
          saving,
          item: editingItem,
          itemId: editingItem ? getItemId(editingItem) : null,
          onOpenChange: handleDialogOpenChange,
          onSubmit: handleSubmit,
        })
      )}
    </>
  )
}
