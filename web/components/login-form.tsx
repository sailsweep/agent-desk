"use client"

import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { startTransition, useEffect, useState } from "react"
import { toast } from "sonner"

import { useAuth } from "@/components/auth-provider"
import { loginWithPassword } from "@/lib/api/auth"
import { useI18n } from "@/i18n/provider"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { KeyRoundIcon } from "lucide-react"

function detectWxWorkEnvironment() {
  if (typeof navigator === "undefined") {
    return false
  }
  const userAgent = navigator.userAgent.toLowerCase()
  return userAgent.includes("wxwork")
}

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const t = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { session } = useAuth()
  const [isPending, setIsPending] = useState(false)
  const [isWxWorkEnv, setIsWxWorkEnv] = useState(false)
  const nextPath = searchParams.get("next")
  const wxworkError = searchParams.get("wxworkError")
  const oidcError = searchParams.get("oidcError")
  const redirectPath =
    nextPath && nextPath.startsWith("/") ? nextPath : "/dashboard"

  useEffect(() => {
    if (session) {
      router.replace(redirectPath)
    }
  }, [redirectPath, router, session])

  useEffect(() => {
    if (wxworkError) {
      toast.error(wxworkError)
    }
  }, [wxworkError])

  useEffect(() => {
    if (oidcError) {
      toast.error(oidcError)
    }
  }, [oidcError])

  useEffect(() => {
    setIsWxWorkEnv(detectWxWorkEnvironment())
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const username = formData.get("username")?.toString().trim() ?? ""
    const password = formData.get("password")?.toString() ?? ""

    setIsPending(true)

    try {
      await loginWithPassword({ username, password })
      toast.success(t("auth.loginSuccess"))
      startTransition(() => {
        router.push(redirectPath)
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("auth.loginFailed"))
    } finally {
      setIsPending(false)
    }
  }

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      onSubmit={handleSubmit}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col gap-2 text-center">
          <span className="mx-auto inline-flex rounded-full border border-amber-300/60 bg-amber-50 px-3 py-1 text-[11px] font-medium tracking-[0.22em] text-amber-900 uppercase">
            {t("auth.badge")}
          </span>
          <h1 className="text-3xl font-semibold tracking-tight">{t("auth.welcome")}</h1>
        </div>
        <Field>
          <FieldLabel htmlFor="username">{t("auth.username")}</FieldLabel>
          <Input
            id="username"
            name="username"
            placeholder={t("auth.usernamePlaceholder")}
            autoComplete="username"
            required
          />
        </Field>
        <Field>
          <div className="flex items-center">
            <FieldLabel htmlFor="password">{t("auth.password")}</FieldLabel>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder={t("auth.passwordPlaceholder")}
            autoComplete="current-password"
            required
          />
        </Field>
        <Field>
          <Button type="submit" disabled={isPending}>
            {isPending ? t("auth.signingIn") : t("auth.signIn")}
          </Button>
        </Field>
        <Field>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => {
              const path = isWxWorkEnv ? "/api/auth/wxwork_login" : "/api/auth/wxwork_qr_login"
              window.location.href = `${path}?next=${encodeURIComponent(redirectPath)}`
            }}
          >
            <Image src="/images/wxwork.svg" alt="" width={16} height={16} className="size-4 shrink-0" />
            {t("auth.wxworkSignIn")}
          </Button>
        </Field>
        <Field>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => {
              window.location.href = `/api/auth/oidc_login?next=${encodeURIComponent(redirectPath)}`
            }}
          >
            <KeyRoundIcon className="size-4 shrink-0" />
            {t("auth.oidcSignIn")}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
