"use client"

import { ChevronRightIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

import {
  dashboardNavSectionHasActiveItem,
  getDashboardNavSectionStorageKey,
  isDashboardNavItemActive,
  parseDashboardNavSectionOpenState,
} from "@/lib/navigation-active"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"

export function NavMain({
  icon,
  sectionKey,
  title,
  items,
}: {
  icon?: React.ReactNode
  sectionKey: string
  title: string
  items: ReadonlyArray<{
    title: string
    url: string
    icon?: React.ReactNode
  }>
}) {
  const pathname = usePathname()
  const hasActiveItem = dashboardNavSectionHasActiveItem(items, pathname)
  const storageKey = getDashboardNavSectionStorageKey(sectionKey)
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") {
      return true
    }
    return parseDashboardNavSectionOpenState(window.localStorage.getItem(storageKey)) ?? true
  })

  useEffect(() => {
    const storedOpen = parseDashboardNavSectionOpenState(
      window.localStorage.getItem(storageKey)
    )
    if (storedOpen !== undefined) {
      setOpen(storedOpen)
      return
    }
    if (hasActiveItem) {
      setOpen(true)
    }
  }, [hasActiveItem, storageKey])

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    window.localStorage.setItem(storageKey, String(nextOpen))
  }

  return (
    <SidebarGroup className="px-2 py-0 first:pt-2 last:pb-2">
      <SidebarMenu>
        <Collapsible
          open={open}
          onOpenChange={handleOpenChange}
          className="group/collapsible"
          render={<SidebarMenuItem />}
        >
          <CollapsibleTrigger render={<SidebarMenuButton tooltip={title} />}>
            {icon}
            <span>{title}</span>
            <ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-open/collapsible:rotate-90" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {items.map((item) => (
                <SidebarMenuSubItem key={item.title}>
                  <SidebarMenuSubButton
                    render={<Link href={item.url} />}
                    isActive={isDashboardNavItemActive(pathname, item.url)}
                  >
                    <span>{item.title}</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </Collapsible>
      </SidebarMenu>
    </SidebarGroup>
  )
}
