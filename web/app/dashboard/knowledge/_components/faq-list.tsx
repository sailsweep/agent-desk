"use client";

import {
  MoreHorizontalIcon,
  PencilIcon,
  SearchIcon,
  Trash2Icon,
  WrenchIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";

import {
  useDashboardPagedList,
  type DashboardPagedListFilter,
} from "@/components/dashboard/list";
import { ListPagination } from "@/components/list-pagination";
import { OptionCombobox } from "@/components/option-combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  buildKnowledgeFAQIndex,
  createKnowledgeFAQ,
  deleteKnowledgeFAQ,
  fetchKnowledgeFAQs,
  updateKnowledgeFAQ,
  type CreateKnowledgeFAQPayload,
  type KnowledgeFAQ,
} from "@/lib/api/admin";
import { KnowledgeDocumentIndexStatus } from "@/lib/generated/enums";
import { useI18n } from "@/i18n/provider";
import { formatDateTime } from "@/lib/utils";
import { FAQEditDialog } from "./faq-edit";
import { FAQImportDialog } from "./faq-import-dialog";
import { KnowledgeDirectoryPanel } from "./knowledge-directory-panel";

type FAQListProps = {
  knowledgeBaseId: number | null;
  onActionStateChange?: (state: FAQListActionState) => void;
};

export type FAQListActionState = {
  onRefresh: () => void;
  onCreate: () => void;
  onImport: () => void;
  loading: boolean;
  importing: boolean;
};

type TFunction = (key: string, values?: Record<string, string | number>) => string;

function getIndexStatusOptions(t: TFunction) {
  return [
    { value: "all", label: t("knowledge.allIndexStatus") },
    { value: KnowledgeDocumentIndexStatus.Pending, label: t("knowledge.indexPending") },
    { value: KnowledgeDocumentIndexStatus.Indexed, label: t("knowledge.indexIndexed") },
    { value: KnowledgeDocumentIndexStatus.Failed, label: t("knowledge.indexFailed") },
  ];
}

function getIndexStatusLabel(status: string, t: TFunction) {
  if (status === KnowledgeDocumentIndexStatus.Pending) return t("knowledge.indexPending");
  if (status === KnowledgeDocumentIndexStatus.Indexed) return t("knowledge.indexIndexed");
  if (status === KnowledgeDocumentIndexStatus.Failed) return t("knowledge.indexFailed");
  return status || "-";
}

function getIndexStatusBadgeVariant(status: string) {
  switch (status) {
    case KnowledgeDocumentIndexStatus.Indexed:
      return "secondary" as const;
    case KnowledgeDocumentIndexStatus.Failed:
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

function renderIndexStatusBadge(item: KnowledgeFAQ, t: TFunction) {
  const badge = (
    <Badge variant={getIndexStatusBadgeVariant(item.indexStatus)}>
      {getIndexStatusLabel(item.indexStatus, t)}
    </Badge>
  );

  if (
    item.indexStatus !== KnowledgeDocumentIndexStatus.Failed ||
    !item.indexError
  ) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <span className="inline-flex">{badge}</span>
        </TooltipTrigger>
        <TooltipContent align="start" className="max-w-sm whitespace-normal">
          {item.indexError}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function FAQList({
  knowledgeBaseId,
  onActionStateChange,
}: FAQListProps) {
  const t = useI18n();
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedDirectoryId, setSelectedDirectoryId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<KnowledgeFAQ | null>(null);
  const [actionLoadingMap, setActionLoadingMap] = useState<Record<number, { rebuildIndex: boolean; delete: boolean }>>({});
  const indexStatusOptions = useMemo(() => getIndexStatusOptions(t), [t]);

  useEffect(() => {
    setSelectedDirectoryId(null);
  }, [knowledgeBaseId]);

  const filters = useMemo<DashboardPagedListFilter[]>(() => [
    {
      name: "question",
      defaultValue: "",
      trim: true,
    },
    {
      name: "indexStatus",
      defaultValue: "all",
      allValue: "all",
    },
  ], []);

  const fetchList = useCallback(async (query: Record<string, string | number | undefined>) => {
    return fetchKnowledgeFAQs({
      knowledgeBaseId: knowledgeBaseId ?? 0,
      directoryId: selectedDirectoryId === null ? undefined : selectedDirectoryId,
      question: typeof query.question === "string" ? query.question : undefined,
      indexStatus: typeof query.indexStatus === "string" ? query.indexStatus : undefined,
      page: typeof query.page === "number" ? query.page : Number(query.page ?? 1),
      limit: typeof query.limit === "number" ? query.limit : Number(query.limit ?? 20),
    });
  }, [knowledgeBaseId, selectedDirectoryId]);

  const {
    draftFilters,
    setDraftFilter,
    applyFilter,
    applyFilters,
    loading,
    result: faqs,
    loadData,
    handlePageChange,
    handleLimitChange,
  } = useDashboardPagedList<KnowledgeFAQ>({
    filters,
    fetchList,
    enabled: Boolean(knowledgeBaseId),
    reloadKey: `${knowledgeBaseId ?? 0}-${selectedDirectoryId ?? "all"}`,
    loadFailed: t("knowledge.loadFAQFailed"),
  });

  const openCreateDialog = useCallback(() => {
    setEditingItem(null);
    setDialogOpen(true);
  }, []);

  useEffect(() => {
    onActionStateChange?.({
      onRefresh: () => void loadData(),
      onCreate: openCreateDialog,
      onImport: () => setImportDialogOpen(true),
      loading,
      importing,
    });
  }, [loadData, loading, importing, onActionStateChange, openCreateDialog]);

  function handleIndexStatusFilterChange(value: string | null) {
    applyFilter("indexStatus", value ?? "all");
  }

  function handleFilterKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    applyFilters();
  }

  function openEditDialog(item: KnowledgeFAQ) {
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

  async function handleSubmit(payload: CreateKnowledgeFAQPayload) {
    if (saving) {
      return;
    }
    setSaving(true);
    try {
      if (editingItem) {
        await updateKnowledgeFAQ({ id: editingItem.id, ...payload });
        toast.success(t("knowledge.faqSaved"));
      } else {
        await createKnowledgeFAQ(payload);
        toast.success(t("knowledge.faqSaved"));
      }
      setDialogOpen(false);
      setEditingItem(null);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("knowledge.faqSaveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: KnowledgeFAQ) {
    setActionLoadingMap((prev) => ({ ...prev, [item.id]: { ...prev[item.id], delete: true } }));
    try {
      await deleteKnowledgeFAQ(item.id);
      toast.success(t("knowledge.faqDeleted"));
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("knowledge.faqDeleteFailed"));
    } finally {
      setActionLoadingMap((prev) => ({ ...prev, [item.id]: { ...prev[item.id], delete: false } }));
    }
  }

  async function handleBuildIndex(item: KnowledgeFAQ) {
    setActionLoadingMap((prev) => ({ ...prev, [item.id]: { ...prev[item.id], rebuildIndex: true } }));
    try {
      await buildKnowledgeFAQIndex(item.id);
      toast.success(t("knowledge.faqIndexRebuilt"));
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("knowledge.faqIndexRebuildFailed"));
    } finally {
      setActionLoadingMap((prev) => ({ ...prev, [item.id]: { ...prev[item.id], rebuildIndex: false } }));
    }
  }

  if (!knowledgeBaseId) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {t("knowledge.selectFAQBase")}
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full min-h-0">
        <KnowledgeDirectoryPanel
          knowledgeBaseId={knowledgeBaseId}
          selectedDirectoryId={selectedDirectoryId}
          onSelectDirectory={setSelectedDirectoryId}
          onChanged={() => void loadData()}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-col gap-2 border-b bg-background px-6 py-2">
            <div className="flex min-w-0 gap-2">
              <div className="relative min-w-0 flex-1">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={String(draftFilters.question ?? "")}
                  onChange={(event) => setDraftFilter("question", event.target.value)}
                  onKeyDown={handleFilterKeyDown}
                  placeholder={t("knowledge.searchFAQ")}
                  className="h-8 pl-8 text-xs"
                />
              </div>
              <div className="w-32 shrink-0">
                <OptionCombobox
                  value={String(draftFilters.indexStatus ?? "all")}
                  onChange={handleIndexStatusFilterChange}
                  options={indexStatusOptions}
                  placeholder={t("knowledge.allIndexStatus")}
                  searchPlaceholder={t("knowledge.searchStatus")}
                  emptyText={t("knowledge.emptyStatus")}
                />
              </div>
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <ScrollArea className="h-full">
              <div className="p-2 space-y-0.5">
                {faqs.results.map((item) => (
                  <ContextMenu key={item.id}>
                    <ContextMenuTrigger className="w-full">
                      <div className="flex items-center gap-3 bg-background p-2 transition-colors hover:bg-accent w-full">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <div className="truncate text-sm font-medium">{item.question}</div>
                            {renderIndexStatusBadge(item, t)}
                          </div>
                          <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                            {item.answer}
                          </div>
                        </div>
                        <div className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                          {formatDateTime(item.updatedAt)}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={<Button variant="ghost" size="icon" className="size-6" />}
                            aria-label={t("knowledge.moreActions", { name: item.question })}
                          >
                            <MoreHorizontalIcon className="size-3.5" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-32 min-w-32">
                            <DropdownMenuItem onClick={() => openEditDialog(item)}>
                              <PencilIcon className="mr-2 size-3.5" />
                              {t("knowledge.edit")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void handleBuildIndex(item)}>
                              <WrenchIcon className="mr-2 size-3.5" />
                              {actionLoadingMap[item.id]?.rebuildIndex ? t("knowledge.running") : t("knowledge.rebuildIndex")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => void handleDelete(item)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2Icon className="mr-2 size-3.5" />
                              {actionLoadingMap[item.id]?.delete ? t("knowledge.deleting") : t("knowledge.delete")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-40">
                      <ContextMenuItem onClick={() => openEditDialog(item)}>
                        <PencilIcon className="mr-2 size-3.5" />
                        {t("knowledge.edit")}
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => void handleBuildIndex(item)} disabled={actionLoadingMap[item.id]?.rebuildIndex}>
                        <WrenchIcon className="mr-2 size-3.5" />
                        {actionLoadingMap[item.id]?.rebuildIndex ? t("knowledge.running") : t("knowledge.rebuildIndex")}
                      </ContextMenuItem>
                      <ContextMenuItem
                        onClick={() => void handleDelete(item)}
                        variant="destructive"
                        disabled={actionLoadingMap[item.id]?.delete}
                      >
                        <Trash2Icon className="mr-2 size-3.5" />
                        {actionLoadingMap[item.id]?.delete ? t("knowledge.deleting") : t("knowledge.delete")}
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))}
                {!loading && faqs.results.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    {t("knowledge.emptyFAQ")}
                  </div>
                ) : null}
              </div>
            </ScrollArea>
          </div>
          <div className="border-t px-6 py-3">
            <ListPagination
              page={faqs.page.page}
              limit={faqs.page.limit}
              total={faqs.page.total}
              loading={loading}
              onPageChange={handlePageChange}
              onLimitChange={handleLimitChange}
            />
          </div>
        </div>
      </div>

      <FAQEditDialog
        open={dialogOpen}
        saving={saving}
        itemId={editingItem?.id ?? null}
        knowledgeBaseId={knowledgeBaseId}
        initialDirectoryId={selectedDirectoryId ?? 0}
        onOpenChange={handleDialogOpenChange}
        onSubmit={handleSubmit}
      />

      <FAQImportDialog
        open={importDialogOpen}
        knowledgeBaseId={knowledgeBaseId}
        importing={importing}
        onOpenChange={setImportDialogOpen}
        onImportingChange={setImporting}
        onImported={async () => {
          await loadData();
        }}
      />
    </>
  );
}
