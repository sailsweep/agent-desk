"use client";

import {
  MoreHorizontalIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  UserCogIcon
} from "lucide-react";
import { useCallback, useEffect, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";

import {
  DashboardTableShell,
  DashboardTableStateRow,
  DashboardToolbar,
} from "@/components/dashboard-page";
import { ListPagination } from "@/components/list-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { OptionCombobox } from "@/components/option-combobox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createAgentProfile,
  deleteAgentProfile,
  fetchAgentProfiles,
  updateAgentProfile,
  type AdminAgentProfile,
  type AdminAgentTeam,
  type CreateAdminAgentProfilePayload,
  type PageResult,
} from "@/lib/api/admin";
import { useI18n } from "@/i18n/provider";
import { ServiceStatus } from "@/lib/generated/enums";
import { formatDateTime } from "@/lib/utils";
import { EditDialog } from "./_components/edit";
import { AgentTeamSidebar } from "./_components/team-sidebar";

type TFunction = (key: string, values?: Record<string, string | number>) => string;

function getServiceStatusOptions(t: TFunction) {
  return [
    { value: "all", label: t("agentProfile.allStatuses") },
    { value: String(ServiceStatus.Idle), label: t("agentProfile.statusIdle") },
    { value: String(ServiceStatus.Busy), label: t("agentProfile.statusBusy") },
  ];
}

function getStatusLabel(value: number, t: TFunction) {
  return getServiceStatusOptions(t).find((item) => item.value === String(value))?.label ?? String(value);
}

export default function DashboardAgentsPage() {
  const t = useI18n();
  const serviceStatusOptions = getServiceStatusOptions(t);
  const [selectedTeam, setSelectedTeam] = useState<AdminAgentTeam | null>(null);
  const [teams, setTeams] = useState<AdminAgentTeam[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [agentCodeInput, setAgentCodeInput] = useState("");
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [statusFilterInput, setStatusFilterInput] = useState("all");
  const [agentCode, setAgentCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AdminAgentProfile | null>(
    null,
  );
  const [result, setResult] = useState<PageResult<AdminAgentProfile>>({
    results: [],
    page: { page: 1, limit: 20, total: 0 },
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAgentProfiles({
        teamId: selectedTeam?.id,
        agentCode: agentCode.trim() || undefined,
        displayName: displayName.trim() || undefined,
        serviceStatus: statusFilter === "all" ? undefined : statusFilter,
        page,
        limit,
      });
      setResult(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("agentProfile.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [agentCode, displayName, limit, page, selectedTeam?.id, statusFilter, t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    setPage(1);
  }, [selectedTeam?.id]);

  useEffect(() => {
    if (teams.length === 0) {
      if (selectedTeam) {
        setSelectedTeam(null);
      }
      return;
    }
    if (!selectedTeam) {
      setSelectedTeam(teams[0]);
      return;
    }
    const matchedTeam = teams.find((item) => item.id === selectedTeam.id);
    if (!matchedTeam) {
      setSelectedTeam(teams[0]);
      return;
    }
    if (matchedTeam !== selectedTeam) {
      setSelectedTeam(matchedTeam);
    }
  }, [selectedTeam, teams]);

  function applyFilters() {
    setAgentCode(agentCodeInput);
    setDisplayName(displayNameInput);
    setStatusFilter(statusFilterInput);
    setPage(1);
  }

  function handleFilterKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    applyFilters();
  }

  function handlePageChange(nextPage: number) {
    if (nextPage < 1 || nextPage === page) {
      return;
    }
    setPage(nextPage);
  }

  function openCreateDialog() {
    setEditingItem(null);
    setDialogOpen(true);
  }

  function openEditDialog(item: AdminAgentProfile) {
    setEditingItem(item);
    setDialogOpen(true);
  }

  function handleDialogOpenChange(open: boolean) {
    if (saving) {
      return;
    }
    if (!open) {
      setEditingItem(null);
    }
    setDialogOpen(open);
  }

  async function handleSubmit(payload: CreateAdminAgentProfilePayload) {
    if (saving) {
      return;
    }
    setSaving(true);
    try {
      if (editingItem) {
        await updateAgentProfile({ id: editingItem.id, ...payload });
        toast.success(t("agentProfile.updated", { name: editingItem.displayName }));
      } else {
        await createAgentProfile(payload);
        toast.success(t("agentProfile.created", { name: payload.displayName }));
      }
      setDialogOpen(false);
      setEditingItem(null);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("agentProfile.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: AdminAgentProfile) {
    setActionLoadingId(item.id);
    try {
      await deleteAgentProfile(item.id);
      toast.success(t("agentProfile.deleted", { name: item.displayName }));
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("agentProfile.deleteFailed"));
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <>
      <div className="flex h-[calc(100vh-4rem)]">
        <div
          className={`shrink-0 overflow-hidden transition-[width] duration-200 ${
            sidebarCollapsed ? "w-0" : "w-80"
          }`}
        >
          <AgentTeamSidebar
            selectedTeamId={selectedTeam?.id ?? null}
            onSelectTeam={setSelectedTeam}
            onTeamsChange={setTeams}
          />
        </div>
        <div className="relative shrink-0 bg-background">
          <Button
            variant="outline"
            size="icon"
            className="absolute top-4 left-1/2 z-10 size-7 -translate-x-1/2 rounded-full shadow-sm"
            onClick={() => setSidebarCollapsed((value) => !value)}
            aria-label={sidebarCollapsed ? t("agentProfile.expandTeams") : t("agentProfile.collapseTeams")}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpenIcon className="size-3.5" />
            ) : (
              <PanelLeftCloseIcon className="size-3.5" />
            )}
          </Button>
        </div>
        <div className="min-w-0 flex-1 p-4 lg:p-6">
          <div className="flex h-full flex-col gap-6">
            <DashboardToolbar
              actions={
                <Button onClick={openCreateDialog}>
                  <PlusIcon />
                  {t("agentProfile.new")}
                </Button>
              }
            >
                <div className="relative w-full sm:w-72">
                  <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={displayNameInput}
                    onChange={(event) =>
                      setDisplayNameInput(event.target.value)
                    }
                    onKeyDown={handleFilterKeyDown}
                    placeholder={t("agentProfile.filterDisplayName")}
                    className="pl-9"
                  />
                </div>
                <Input
                  value={agentCodeInput}
                  onChange={(event) => setAgentCodeInput(event.target.value)}
                  onKeyDown={handleFilterKeyDown}
                  placeholder={t("agentProfile.filterAgentCode")}
                  className="w-full sm:w-44"
                />
                <div className="w-full sm:w-36">
                  <OptionCombobox
                    value={statusFilterInput}
                    options={serviceStatusOptions}
                    placeholder={t("agentProfile.allStatuses")}
                    searchPlaceholder={t("agentProfile.searchStatus")}
                    emptyText={t("agentProfile.emptyStatus")}
                    onChange={(value) => setStatusFilterInput(value ?? "all")}
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={applyFilters}
                  disabled={loading}
                >
                  <SearchIcon />
                  {t("agentProfile.query")}
                </Button>
            </DashboardToolbar>
            <DashboardTableShell
              className="min-h-0"
              pagination={
                <ListPagination
                  page={result.page.page}
                  total={result.page.total}
                  limit={limit}
                  loading={loading}
                  onPageChange={handlePageChange}
                  onLimitChange={(nextLimit) => {
                    setLimit(nextLimit);
                    setPage(1);
                  }}
                />
              }
            >
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead>{t("agentProfile.columnAgent")}</TableHead>
                      <TableHead>{t("agentProfile.columnRules")}</TableHead>
                      <TableHead>{t("agentProfile.columnDispatch")}</TableHead>
                      <TableHead>{t("agentProfile.columnRecent")}</TableHead>
                      <TableHead className="w-[92px] text-right">
                        {t("agentProfile.columnActions")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.results.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex size-10 items-center justify-center overflow-hidden rounded-2xl bg-muted">
                              {item.avatar ? (
                                <img
                                  src={item.avatar}
                                  alt={item.displayName}
                                  className="size-full object-cover"
                                />
                              ) : (
                                <UserCogIcon className="size-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium">
                                {item.displayName}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {item.nickname ||
                                  item.username ||
                                  t("agentProfile.userFallback", { id: item.userId })}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {t("agentProfile.agentCode", { code: item.agentCode })}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getStatusLabel(item.serviceStatus, t)}
                          </Badge>
                          <div className="mt-2 text-sm text-muted-foreground">
                            {t("agentProfile.capacityPriority", {
                              capacity: item.maxConcurrentCount,
                              priority: item.priorityLevel,
                            })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1.5">
                            <Badge
                              variant={
                                item.autoAssignEnabled ? "secondary" : "outline"
                              }
                            >
                              {item.autoAssignEnabled
                                ? t("agentProfile.autoAssign")
                                : t("agentProfile.noAutoAssign")}
                            </Badge>
                            <Badge
                              variant={
                                item.receiveOfflineMessage
                                  ? "secondary"
                                  : "outline"
                              }
                            >
                              {item.receiveOfflineMessage
                                ? t("agentProfile.offlineReceive")
                                : t("agentProfile.noOfflineReceive")}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {t("agentProfile.onlineAt", { time: formatDateTime(item.lastOnlineAt) })}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {t("agentProfile.statusAt", { time: formatDateTime(item.lastStatusAt) })}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <ButtonGroup className="ml-auto">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(item)}
                            >
                              {t("agentProfile.edit")}
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button variant="outline" size="icon-sm" />
                                }
                                aria-label={t("agentProfile.moreActions", { name: item.displayName })}
                              >
                                <MoreHorizontalIcon />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="w-40 min-w-40"
                              >
                                <DropdownMenuItem
                                  onClick={() => void handleDelete(item)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2Icon />
                                  {actionLoadingId === item.id
                                    ? t("agentProfile.deleting")
                                    : t("agentProfile.delete")}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </ButtonGroup>
                        </TableCell>
                      </TableRow>
                    ))}
                    {loading || result.results.length === 0 ? (
                      <DashboardTableStateRow
                        colSpan={5}
                        loading={loading}
                        loadingText={t("agentProfile.loadingRows")}
                        emptyText={
                          selectedTeam
                            ? t("agentProfile.emptyTeamRows")
                            : t("agentProfile.emptyRows")
                        }
                      />
                    ) : null}
                  </TableBody>
                </Table>
            </DashboardTableShell>
          </div>
        </div>
      </div>
      <EditDialog
        open={dialogOpen}
        saving={saving}
        itemId={editingItem?.id ?? null}
        defaultTeamId={selectedTeam?.id ?? null}
        onOpenChange={handleDialogOpenChange}
        onSubmit={handleSubmit}
      />
    </>
  );
}
