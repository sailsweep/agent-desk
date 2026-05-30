export type DashboardNavActiveItem = {
  url: string
}

function normalizePath(path: string) {
  return path !== "/" ? path.replace(/\/+$/, "") : path
}

export function isDashboardNavItemActive(pathname: string, itemUrl: string) {
  const currentPath = normalizePath(pathname)
  const targetPath = normalizePath(itemUrl)

  if (targetPath === "/" || targetPath === "/dashboard") {
    return currentPath === targetPath
  }
  return currentPath === targetPath || currentPath.startsWith(targetPath + "/")
}

export function dashboardNavSectionHasActiveItem(
  items: ReadonlyArray<DashboardNavActiveItem>,
  pathname: string
) {
  return items.some((item) => isDashboardNavItemActive(pathname, item.url))
}
