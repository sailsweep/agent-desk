"use client"

import { ChevronRightIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

import {
  dashboardNavSectionHasActiveItem,
  isDashboardNavItemActive,
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
  title,
  items,
}: {
  icon?: React.ReactNode
  title: string
  items: ReadonlyArray<{
    title: string
    url: string
    icon?: React.ReactNode
  }>
}) {
  const pathname = usePathname()
  const hasActiveItem = dashboardNavSectionHasActiveItem(items, pathname)
  const [open, setOpen] = useState(true)

  useEffect(() => {
    if (hasActiveItem) {
      setOpen(true)
    }
  }, [hasActiveItem])

  return (
    <SidebarGroup className="px-2 py-0 first:pt-2 last:pb-2">
      <SidebarMenu>
        <Collapsible
          open={open}
          onOpenChange={setOpen}
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
