"use client"

import type { FieldError as HookFormFieldError } from "react-hook-form"
import { Controller, type Control, type UseFormRegister } from "react-hook-form"

import { OptionCombobox } from "@/components/option-combobox"
import {
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { DashboardCrudFormField } from "./dashboard-crud-utils"

export function DashboardCrudFieldControl<TItem>({
  field,
  control,
  register,
  error,
}: {
  field: DashboardCrudFormField<TItem>
  control: Control<Record<string, string>>
  register: UseFormRegister<Record<string, string>>
  error?: HookFormFieldError
}) {
  const inputId = `dashboard-crud-field-${field.name}`

  return (
    <Field
      data-invalid={!!error}
      className={cn(
        (field.colSpan === 2 || field.type === "textarea") && "md:col-span-2"
      )}
    >
      <FieldLabel htmlFor={field.type === "select" ? undefined : inputId}>
        {field.label}
      </FieldLabel>
      <FieldContent>
        {field.type === "select" ? (
          <Controller
            control={control}
            name={field.name}
            render={({ field: controllerField }) => (
              <OptionCombobox
                value={controllerField.value}
                options={[...(field.options ?? [])]}
                placeholder={field.placeholder ?? field.label}
                onChange={controllerField.onChange}
              />
            )}
          />
        ) : field.type === "textarea" ? (
          <Textarea
            id={inputId}
            rows={field.rows ?? 4}
            placeholder={field.placeholder}
            aria-invalid={!!error}
            {...register(field.name)}
          />
        ) : (
          <Input
            id={inputId}
            type={field.type === "number" ? "number" : "text"}
            min={field.type === "number" ? field.min : undefined}
            max={field.type === "number" ? field.max : undefined}
            step={field.type === "number" ? field.step : undefined}
            placeholder={field.placeholder}
            aria-invalid={!!error}
            {...register(field.name)}
          />
        )}
        <FieldError errors={error ? [error] : []} />
      </FieldContent>
    </Field>
  )
}
