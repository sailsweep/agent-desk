export type DashboardCrudQueryValue = string | number | undefined

export type DashboardCrudQueryFilter = {
  name: string
  trim?: boolean
  allValue?: string | number
  valueType?: "string" | "number"
}

export type DashboardCrudPageResult<T> = {
  results: T[]
  page: {
    page: number
    limit: number
    total: number
  }
}

export type DashboardCrudFormValue = string | number | undefined

export type DashboardCrudFormOption = {
  value: string
  label: string
}

export type DashboardCrudFormField<TItem = unknown> = {
  name: string
  label: string
  type?: "text" | "textarea" | "number" | "select"
  placeholder?: string
  defaultValue?: DashboardCrudFormValue
  required?: boolean
  requiredMessage?: string
  trim?: boolean
  valueType?: "string" | "number"
  min?: number
  max?: number
  step?: number
  pattern?: RegExp
  patternMessage?: string
  options?: ReadonlyArray<DashboardCrudFormOption>
  colSpan?: 1 | 2
  rows?: number
  valueFromItem?: (item: TItem) => DashboardCrudFormValue
}

export function buildDashboardCrudQuery({
  values,
  filters,
  page,
  limit,
}: {
  values: Record<string, string | number | undefined>
  filters: DashboardCrudQueryFilter[]
  page: number
  limit: number
}): Record<string, DashboardCrudQueryValue> {
  const query: Record<string, DashboardCrudQueryValue> = {}

  filters.forEach((filter) => {
    const rawValue = values[filter.name]
    const value =
      filter.trim && typeof rawValue === "string" ? rawValue.trim() : rawValue

    if (
      value === undefined ||
      value === "" ||
      (filter.allValue !== undefined && String(value) === String(filter.allValue))
    ) {
      return
    }

    if (filter.valueType === "number") {
      const numberValue = Number(value)
      if (Number.isFinite(numberValue)) {
        query[filter.name] = numberValue
      }
      return
    }

    query[filter.name] = value
  })

  query.page = page
  query.limit = limit
  return query
}

export function normalizeDashboardCrudPageResult<T>(
  result: Partial<DashboardCrudPageResult<T>> | null | undefined,
  page: number,
  limit: number
): DashboardCrudPageResult<T> {
  return {
    results: Array.isArray(result?.results) ? result.results : [],
    page: {
      page: result?.page?.page ?? page,
      limit: result?.page?.limit ?? limit,
      total: result?.page?.total ?? 0,
    },
  }
}

export function buildDashboardCrudFormValues<TItem>(
  fields: ReadonlyArray<DashboardCrudFormField<TItem>>,
  item?: TItem | null
): Record<string, string> {
  return Object.fromEntries(
    fields.map((field) => {
      let value: unknown = field.defaultValue ?? ""
      if (item) {
        if (field.valueFromItem) {
          value = field.valueFromItem(item)
        } else if (typeof item === "object" && item && field.name in item) {
          value = (item as Record<string, unknown>)[field.name]
        }
      }
      return [field.name, value === undefined || value === null ? "" : String(value)]
    })
  )
}

export function normalizeDashboardCrudSubmitValues<TItem>(
  fields: ReadonlyArray<DashboardCrudFormField<TItem>>,
  values: Record<string, string>
): Record<string, string | number> {
  const output: Record<string, string | number> = {}

  fields.forEach((field) => {
    const rawValue = values[field.name] ?? ""
    const text = field.trim ? rawValue.trim() : rawValue
    if (field.type === "number" || field.valueType === "number") {
      const numberValue = Number(text)
      output[field.name] = Number.isFinite(numberValue) ? numberValue : 0
      return
    }
    output[field.name] = text
  })

  return output
}
