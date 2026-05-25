"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVerticalIcon,
  MoreHorizontalIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  Trash2Icon
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { toast } from "sonner";

import {
  DashboardPage,
  DashboardTableShell,
  DashboardTableStateRow,
  DashboardToolbar,
} from "@/components/dashboard-page";
import { ListPagination } from "@/components/list-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createAIConfig,
  deleteAIConfig,
  fetchAIConfigs,
  updateAIConfig,
  updateAIConfigSort,
  updateAIConfigStatus,
  type AIConfig,
  type CreateAIConfigPayload,
  type PageResult,
} from "@/lib/api/admin";
import {
  AIModelType,
  AIProvider,
  Status,
} from "@/lib/generated/enums";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { EditDialog } from "./_components/edit";
import { OptionCombobox } from "./_components/option-combobox";

type TFunction = (key: string, values?: Record<string, string | number>) => string;

function getStatusOptions(t: TFunction) {
  return [
    { value: "all", label: t("aiConfig.allStatuses") },
    { value: String(Status.Ok), label: t("aiConfig.enabled") },
    { value: String(Status.Disabled), label: t("aiConfig.disabled") },
    { value: String(Status.Deleted), label: t("aiConfig.deletedStatus") },
  ];
}

function getProviderOptions(t: TFunction, includeAll = true) {
  const options = [
    { value: String(AIProvider.OpenAI), label: t("aiConfig.providerOpenAI") },
  ];
  return includeAll ? [{ value: "all", label: t("aiConfig.allProviders") }, ...options] : options;
}

function getModelTypeOptions(t: TFunction, includeAll = true) {
  const options = [
    { value: String(AIModelType.LLM), label: t("aiConfig.modelTypeLlm") },
    { value: String(AIModelType.Embedding), label: t("aiConfig.modelTypeEmbedding") },
    { value: String(AIModelType.Rerank), label: t("aiConfig.modelTypeRerank") },
  ];
  return includeAll ? [{ value: "all", label: t("aiConfig.allTypes") }, ...options] : options;
}

function getStatusLabel(value: Status, t: TFunction) {
  return getStatusOptions(t).find((item) => item.value === String(value))?.label ?? String(value);
}

function getProviderLabel(value: AIProvider, t: TFunction) {
  return getProviderOptions(t, false).find((item) => item.value === String(value))?.label ?? String(value);
}

function getModelTypeLabel(value: AIModelType, t: TFunction) {
  return getModelTypeOptions(t, false).find((item) => item.value === String(value))?.label ?? String(value);
}

function maskAPIKey(value: string) {
  const text = value.trim();
  if (!text) {
    return "-";
  }
  if (text.length <= 8) {
    return "****";
  }
  return `${text.slice(0, 4)}****${text.slice(-4)}`;
}

type SortableAIConfigRowProps = {
  item: AIConfig;
  disabled: boolean;
  actionLoadingId: number | null;
  t: TFunction;
  openEditDialog: (item: AIConfig) => void;
  handleToggleStatus: (item: AIConfig) => void;
  handleDelete: (item: AIConfig) => void;
};

function SortableAIConfigRow({
  item,
  disabled,
  actionLoadingId,
  t,
  openEditDialog,
  handleToggleStatus,
  handleDelete,
}: SortableAIConfigRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    disabled,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(
        isDragging && "relative z-10 bg-muted/60 shadow-sm",
        !disabled && "cursor-move",
      )}
    >
      <TableCell className="w-14">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 cursor-grab active:cursor-grabbing"
          disabled={disabled}
          aria-label={t("aiConfig.dragSort", { name: item.name })}
          {...attributes}
          {...listeners}
        >
          <GripVerticalIcon className="size-4 text-muted-foreground" />
        </Button>
      </TableCell>
      <TableCell>
        <div className="space-y-1 text-sm font-medium">{item.name}</div>
      </TableCell>
      <TableCell>
        <Badge variant="outline">
          {getProviderLabel(item.provider as AIProvider, t)}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <Badge variant="secondary">
            {getModelTypeLabel(item.modelType as AIModelType, t)}
          </Badge>
          <div className="text-sm">{item.modelName}</div>
          {item.dimension > 0 && (
            <div className="text-xs text-muted-foreground">
              {t("aiConfig.dimension", { count: item.dimension })}
            </div>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-1 text-sm">
          <div className="line-clamp-1">{item.baseUrl}</div>
          <div className="text-xs text-muted-foreground">
            {t("aiConfig.apiKey", { key: maskAPIKey(item.apiKey) })}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-1 text-xs text-muted-foreground">
          <div>{t("aiConfig.contextTokens", { count: item.maxContextTokens || 0 })}</div>
          <div>{t("aiConfig.outputTokens", { count: item.maxOutputTokens || 0 })}</div>
          <div>
            {t("aiConfig.timeoutRetry", {
              timeout: item.timeoutMs,
              retries: item.maxRetryCount,
            })}
          </div>
          <div>
            RPM {item.rpmLimit || 0} / TPM {item.tpmLimit || 0}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <Switch
            checked={item.status === Status.Ok}
            disabled={actionLoadingId === item.id}
            onCheckedChange={() => void handleToggleStatus(item)}
            aria-label={t("aiConfig.toggleStatus", { name: item.name })}
          />
          <Badge
            variant={
              item.status === Status.Ok ? "default" : "outline"
            }
          >
            {getStatusLabel(item.status as Status, t)}
          </Badge>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <ButtonGroup className="ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openEditDialog(item)}
          >
            {t("aiConfig.edit")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="icon-sm" />}
              aria-label={t("aiConfig.moreActions", { name: item.name })}
            >
              <MoreHorizontalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 min-w-40">
              <DropdownMenuItem
                disabled={
                  item.status === Status.Ok ||
                  actionLoadingId === item.id
                }
                onClick={() => void handleDelete(item)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2Icon />
                {item.status === Status.Ok
                  ? t("aiConfig.deleteDisabledActive")
                  : actionLoadingId === item.id
                    ? t("aiConfig.deleting")
                    : t("aiConfig.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ButtonGroup>
      </TableCell>
    </TableRow>
  );
}

export default function DashboardAIConfigsPage() {
  const t = useI18n();
  const listStatusOptions = useMemo(() => getStatusOptions(t), [t]);
  const providerFilterOptions = useMemo(() => getProviderOptions(t), [t]);
  const modelTypeFilterOptions = useMemo(() => getModelTypeOptions(t), [t]);
  const [keywordInput, setKeywordInput] = useState("");
  const [statusFilterInput, setStatusFilterInput] = useState("all");
  const [providerFilterInput, setProviderFilterInput] = useState("all");
  const [modelTypeFilterInput, setModelTypeFilterInput] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [modelTypeFilter, setModelTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [sorting, setSorting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AIConfig | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<AIConfig | null>(null);
  const [result, setResult] = useState<PageResult<AIConfig>>({
    results: [],
    page: { page: 1, limit: 20, total: 0 },
  });

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAIConfigs({
        name: keyword.trim() || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
        provider: providerFilter === "all" ? undefined : providerFilter,
        modelType: modelTypeFilter === "all" ? undefined : modelTypeFilter,
        page,
        limit,
      });
      setResult(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("aiConfig.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [keyword, statusFilter, providerFilter, modelTypeFilter, page, limit, t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function applyFilters() {
    setKeyword(keywordInput);
    setStatusFilter(statusFilterInput);
    setProviderFilter(providerFilterInput);
    setModelTypeFilter(modelTypeFilterInput);
    setPage(1);
  }

  function handleFilterKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
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

  function handleLimitChange(nextLimit: number) {
    if (nextLimit <= 0 || nextLimit === limit) {
      return;
    }
    setLimit(nextLimit);
    setPage(1);
  }

  function openCreateDialog() {
    setEditingItem(null);
    setDialogOpen(true);
  }

  function openEditDialog(item: AIConfig) {
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

  async function handleSubmit(payload: CreateAIConfigPayload) {
    if (saving) {
      return;
    }

    setSaving(true);
    try {
      if (editingItem) {
        await updateAIConfig({ id: editingItem.id, ...payload });
        toast.success(t("aiConfig.updated", { name: editingItem.name }));
      } else {
        await createAIConfig(payload);
        toast.success(t("aiConfig.created", { name: payload.name }));
      }
      setDialogOpen(false);
      setEditingItem(null);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("aiConfig.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(item: AIConfig) {
    setActionLoadingId(item.id);
    try {
      const nextStatus =
        item.status === Status.Ok
          ? Status.Disabled
          : Status.Ok;
      await updateAIConfigStatus(item.id, nextStatus);
      toast.success(
        t("aiConfig.statusChanged", {
          name: item.name,
          status: nextStatus === Status.Ok ? t("aiConfig.enabled") : t("aiConfig.disabled"),
        }),
      );
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("aiConfig.statusUpdateFailed"));
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleDelete(item: AIConfig) {
    if (item.status === Status.Ok) {
      toast.error(t("aiConfig.activeDeleteBlocked"));
      return;
    }
    setDeletingItem(item);
    setDeleteDialogOpen(true);
  }

  async function handleConfirmDelete() {
    if (!deletingItem) {
      return;
    }
    const item = deletingItem;
    setActionLoadingId(item.id);
    try {
      await deleteAIConfig(item.id);
      toast.success(t("aiConfig.deleted", { name: item.name }));
      setDeleteDialogOpen(false);
      setDeletingItem(null);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("aiConfig.deleteFailed"));
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || sorting) {
      return;
    }

    const previousResults = result.results;
    const oldIndex = previousResults.findIndex((item) => item.id === active.id);
    const newIndex = previousResults.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    const nextResults = arrayMove(previousResults, oldIndex, newIndex);
    setResult((current) => ({
      ...current,
      results: nextResults,
    }));
    setSorting(true);

    try {
      await updateAIConfigSort(nextResults.map((item) => item.id));
      toast.success(t("aiConfig.sortUpdated"));
      await loadData();
    } catch (error) {
      setResult((current) => ({
        ...current,
        results: previousResults,
      }));
      toast.error(error instanceof Error ? error.message : t("aiConfig.sortUpdateFailed"));
    } finally {
      setSorting(false);
    }
  }

  return (
    <>
      <DashboardPage>
        <DashboardToolbar
          actions={
            <>
              <Button
                variant="outline"
                onClick={() => void loadData()}
                disabled={loading}
              >
                <RefreshCwIcon className={loading ? "animate-spin" : ""} />
                {t("aiConfig.refresh")}
              </Button>
              <Button onClick={openCreateDialog}>
                <PlusIcon />
                {t("aiConfig.new")}
              </Button>
            </>
          }
        >
          <div className="relative w-full sm:w-72">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              onKeyDown={handleFilterKeyDown}
              placeholder={t("aiConfig.filterName")}
              className="pl-9"
            />
          </div>
          <div className="w-full sm:w-40">
            <OptionCombobox
              value={modelTypeFilterInput}
              options={modelTypeFilterOptions}
              placeholder={t("aiConfig.allTypes")}
              searchPlaceholder={t("aiConfig.searchModelType")}
              emptyText={t("aiConfig.emptyModelType")}
              onChange={setModelTypeFilterInput}
            />
          </div>
          <div className="w-full sm:w-40">
            <OptionCombobox
              value={providerFilterInput}
              options={providerFilterOptions}
              placeholder={t("aiConfig.allProviders")}
              searchPlaceholder={t("aiConfig.searchProvider")}
              emptyText={t("aiConfig.emptyProvider")}
              onChange={setProviderFilterInput}
            />
          </div>
          <div className="w-full sm:w-32">
            <OptionCombobox
              value={statusFilterInput}
              options={listStatusOptions}
              placeholder={t("aiConfig.allStatuses")}
              searchPlaceholder={t("aiConfig.searchStatus")}
              emptyText={t("aiConfig.emptyStatus")}
              onChange={setStatusFilterInput}
            />
          </div>
          <Button variant="outline" onClick={applyFilters} disabled={loading}>
            <SearchIcon />
            {t("aiConfig.query")}
          </Button>
        </DashboardToolbar>

        <DashboardTableShell
          pagination={
            <ListPagination
              page={result.page.page}
              limit={result.page.limit}
              total={result.page.total}
              onPageChange={handlePageChange}
              onLimitChange={handleLimitChange}
            />
          }
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14"></TableHead>
                  <TableHead>{t("aiConfig.columnConfig")}</TableHead>
                  <TableHead>{t("aiConfig.columnProvider")}</TableHead>
                  <TableHead>{t("aiConfig.columnModel")}</TableHead>
                  <TableHead>{t("aiConfig.columnAccess")}</TableHead>
                  <TableHead>{t("aiConfig.columnLimits")}</TableHead>
                  <TableHead>{t("aiConfig.columnStatus")}</TableHead>
                  <TableHead className="text-right">{t("aiConfig.columnActions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading || result.results.length === 0 ? (
                  <DashboardTableStateRow
                    colSpan={8}
                    loading={loading}
                    loadingText={t("aiConfig.loadingRows")}
                    emptyText={t("aiConfig.emptyRows")}
                  />
                ) : (
                  <SortableContext
                    items={result.results.map((item) => item.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {result.results.map((item) => (
                      <SortableAIConfigRow
                        key={item.id}
                        item={item}
                        disabled={sorting}
                        actionLoadingId={actionLoadingId}
                        t={t}
                        openEditDialog={openEditDialog}
                        handleToggleStatus={handleToggleStatus}
                        handleDelete={handleDelete}
                      />
                    ))}
                  </SortableContext>
                )}
              </TableBody>
            </Table>
          </DndContext>
        </DashboardTableShell>
      </DashboardPage>

      <EditDialog
        open={dialogOpen}
        saving={saving}
        itemId={editingItem?.id ?? null}
        onOpenChange={handleDialogOpenChange}
        onSubmit={handleSubmit}
      />

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (actionLoadingId) {
            return;
          }
          setDeleteDialogOpen(open);
          if (!open) {
            setDeletingItem(null);
          }
        }}
      >
        <DialogContent className="max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t("aiConfig.confirmDeleteTitle")}</DialogTitle>
            <DialogDescription>
              {deletingItem
                ? t("aiConfig.confirmDeleteDescription", { name: deletingItem.name })
                : t("aiConfig.deleteIrreversible")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={!!actionLoadingId}
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeletingItem(null);
              }}
            >
              {t("aiConfig.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!!actionLoadingId}
              onClick={() => void handleConfirmDelete()}
            >
              {actionLoadingId ? t("aiConfig.deleting") : t("aiConfig.confirmDelete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
