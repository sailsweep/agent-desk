"use client"

import { FileTextIcon, MessageSquareTextIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { useI18n } from "@/i18n/provider"
import { cn } from "@/lib/utils"

const workbenchRailItems = [
  {
    key: "conversations",
    titleKey: "nav.conversations",
    href: "/workbench",
    icon: MessageSquareTextIcon,
  },
  {
    key: "tickets",
    titleKey: "nav.tickets",
    href: "/dashboard/tickets",
    icon: FileTextIcon,
  },
]

export function WorkbenchRail() {
  const t = useI18n()
  const pathname = usePathname()

  return (
    <aside className="flex h-svh w-16 shrink-0 flex-col items-center border-r border-border/70 bg-sidebar px-2 py-3 text-sidebar-foreground">
      <nav className="flex w-full flex-col items-center gap-2">
        {workbenchRailItems.map((item) => {
          const Icon = item.icon
          const isActive =
            item.key === "conversations"
              ? pathname === "/workbench" || pathname?.startsWith("/workbench/")
              : pathname === item.href || pathname?.startsWith(`${item.href}/`)

          return (
            <Link
              key={item.key}
              href={item.href}
              aria-label={t(item.titleKey)}
              className={cn(
                "flex h-13 w-12 flex-col items-center justify-center gap-1 rounded-lg text-[11px] leading-none text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isActive &&
                  "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"
              )}
            >
              <Icon className="size-4" />
              <span className="max-w-full truncate">{t(item.titleKey)}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
