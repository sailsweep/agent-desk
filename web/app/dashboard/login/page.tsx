"use client"

import { LoginForm } from "@/components/login-form"
import { LocaleSwitcher } from "@/components/locale-switcher"
import { useI18n } from "@/i18n/provider"
import { ShieldCheckIcon } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"

export default function LoginPage() {
  const t = useI18n()
  const heroPoints = [
    t("auth.heroPoint1"),
    t("auth.heroPoint2"),
    t("auth.heroPoint3"),
  ]

  return (
    <div className="grid min-h-svh bg-[linear-gradient(145deg,#fff7ed_0%,#ffffff_32%,#ecfeff_100%)] lg:grid-cols-[1.1fr_0.9fr]">
      <div className="relative hidden overflow-hidden border-r bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(6,182,212,0.18),transparent_28%),linear-gradient(145deg,#111827_0%,#1f2937_35%,#0f172a_100%)] lg:block">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),transparent_22%)]" />
        <div className="relative flex h-full flex-col justify-between p-10 text-white">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1 text-xs tracking-[0.2em] uppercase text-white/80">
              <ShieldCheckIcon className="size-3.5" />
              {t("auth.heroBadge")}
            </div>
            <div className="space-y-3">
              <h2 className="max-w-lg text-5xl font-semibold tracking-tight">
                {t("auth.heroTitle")}
              </h2>
              <p className="max-w-xl text-sm leading-6 text-white/72">
                {t("auth.heroSubtitle")}
              </p>
            </div>
          </div>
          <div className="grid gap-3">
            {heroPoints.map((text, index) => (
              <div
                key={index}
                className="rounded-2xl border border-white/10 bg-white/7 p-4 backdrop-blur"
              >
                <p className="text-sm leading-6 text-white/70">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex items-center justify-between gap-2">
          <Link href="/dashboard/login" className="flex items-center gap-2 font-medium">
            <img
              src="/images/logo.svg"
              alt={t("app.brand")}
              width="32"
              height="32"
              className="size-7 shrink-0 object-contain"
            />
            {t("app.brand")}
          </Link>
          <LocaleSwitcher />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-md rounded-[28px] border border-white/70 bg-white/90 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
            <Suspense fallback={<div className="min-h-80" />}>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  )
}
