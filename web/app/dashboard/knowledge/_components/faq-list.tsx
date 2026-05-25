"use client";

import {
  MoreHorizontalIcon,
  SearchIcon,
  Trash2Icon,
  WrenchIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ListPagination } from "@/components/list-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { OptionCombobox } from "@/components/option-combobox";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  type PageResult,
} from "@/lib/api/admin";
import {
  KnowledgeDocumentIndexStatus,
} from "@/lib/generated/enums";
import { useI18n } from "@/i18n/provider";
import { formatDateTime } from "@/lib/utils";
import { FAQEditDialog } from "./faq-edit";
import { FAQImportDialog } from "./faq-import-dialog";

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
  const [keywordInput, setKeywordInput] = useState("");
  const [indexStatusFilterInput, setIndexStatusFilterInput] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [indexStatusFilter, setIndexStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [actionLoadingMap, setActionLoadingMap] = useState<
    Record<number, { rebuildIndex: boolean; delete: boolean }>
  >({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<KnowledgeFAQ | null>(null);
  const [result, setResult] = useState<PageResult<KnowledgeFAQ>>({
    results: [],
    page: { page: 1, limit: 20, total: 0 },
  });
  const indexStatusOptions = useMemo(() => getIndexStatusOptions(t), [t]);

  const loadData = useCallback(
    async (options?: {
      keyword?: string;
      indexStatusFilter?: string;
      page?: number;
      limit?: number;
    }) => {
      const nextKeyword = options?.keyword ?? keyword;
      const nextIndexStatusFilter =
        options?.indexStatusFilter ?? indexStatusFilter;
      const nextPage = options?.page ?? page;
      const nextLimit = options?.limit ?? limit;

    if (!knowledgeBaseId) {
      setResult({
        results: [],
        page: { page: 1, limit: 20, total: 0 },
      });
      return;
    }
    setLoading(true);
    try {
      const data = await fetchKnowledgeFAQs({
        knowledgeBaseId,
        question: nextKeyword.trim() || undefined,
        indexStatus:
          nextIndexStatusFilter === "all" ? undefined : nextIndexStatusFilter,
        page: nextPage,
        limit: nextLimit,
      });
      setResult(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("knowledge.loadFAQFailed"));
    } finally {
      setLoading(false);
    }
    },
    [indexStatusFilter, keyword, knowledgeBaseId, limit, page, t],
  );

  useEffect(() => {
    void loadData();
  }, [knowledgeBaseId, loadData]);

  useEffect(() => {
    onActionStateChange?.({
      onRefresh: () => void loadData(),
      onCreate: () => {
        setEditingItem(null);
        setDialogOpen(true);
      },
      onImport: () => setImportDialogOpen(true),
      loading,
      importing,
    });
  }, [importing, loadData, loading, onActionStateChange]);

  function applyFilters() {
    const nextKeyword = keywordInput;
    const nextIndexStatusFilter = indexStatusFilterInput;
    setKeyword(nextKeyword);
    setIndexStatusFilter(nextIndexStatusFilter);
    setPage(1);
    void loadData({
      keyword: nextKeyword,
      indexStatusFilter: nextIndexStatusFilter,
      page: 1,
    });
  }

  async function handleSubmit(payload: CreateKnowledgeFAQPayload) {
    setSaving(true);
    try {
      if (editingItem) {
        await updateKnowledgeFAQ({ id: editingItem.id, ...payload });
      } else {
        await createKnowledgeFAQ(payload);
      }
      setDialogOpen(false);
      setEditingItem(null);
      await loadData();
      toast.success(t("knowledge.faqSaved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("knowledge.faqSaveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: KnowledgeFAQ) {
    setActionLoadingMap((prev) => ({
      ...prev,
      [item.id]: { ...prev[item.id], delete: true },
    }));
    try {
      await deleteKnowledgeFAQ(item.id);
      toast.success(t("knowledge.faqDeleted"));
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("knowledge.faqDeleteFailed"));
    } finally {
      setActionLoadingMap((prev) => ({
        ...prev,
        [item.id]: { ...prev[item.id], delete: false },
      }));
    }
  }

  async function handleBuildIndex(item: KnowledgeFAQ) {
    setActionLoadingMap((prev) => ({
      ...prev,
      [item.id]: { ...prev[item.id], rebuildIndex: true },
    }));
    try {
      await buildKnowledgeFAQIndex(item.id);
      toast.success(t("knowledge.faqIndexRebuilt"));
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("knowledge.faqIndexRebuildFailed"));
    } finally {
      setActionLoadingMap((prev) => ({
        ...prev,
        [item.id]: { ...prev[item.id], rebuildIndex: false },
      }));
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
      <div className="flex h-full flex-col gap-4 p-4">
        <div className="flex items-center gap-2">
          <div className="relative max-w-md flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  applyFilters();
                }
              }}
              placeholder={t("knowledge.searchFAQ")}
              className="pl-9"
            />
          </div>
          <OptionCombobox
            value={indexStatusFilterInput}
            onChange={(value) => setIndexStatusFilterInput(value ?? "all")}
            options={indexStatusOptions}
            placeholder={t("knowledge.allIndexStatus")}
            searchPlaceholder={t("knowledge.searchStatus")}
            emptyText={t("knowledge.emptyStatus")}
          />
          <Button
            variant="outline"
            onClick={applyFilters}
            disabled={loading}
          >
            {t("knowledge.query")}
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden rounded-md border">
          <div className="h-full overflow-auto">
            <table className="w-full min-w-max caption-bottom text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("knowledge.question")}</TableHead>
                  <TableHead>{t("knowledge.indexStatus")}</TableHead>
                  <TableHead>{t("knowledge.similarQuestions")}</TableHead>
                  <TableHead>{t("knowledge.updatedAt")}</TableHead>
                  <TableHead className="w-20 text-right">{t("knowledge.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.results.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="max-w-sm">
                      <div className="font-medium">{item.question}</div>
                      <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {item.answer}
                      </div>
                    </TableCell>
                    <TableCell>{renderIndexStatusBadge(item, t)}</TableCell>
                    <TableCell>
                      {Array.isArray(item.similarQuestions)
                        ? item.similarQuestions.length
                        : 0}
                    </TableCell>
                    <TableCell>{formatDateTime(item.updatedAt)}</TableCell>
                    <TableCell className="w-20 text-right">
                      <ButtonGroup className="ml-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingItem(item);
                            setDialogOpen(true);
                          }}
                        >
                          {t("knowledge.edit")}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={<Button variant="outline" size="icon-sm" />}
                            aria-label={t("knowledge.moreActions", { name: item.question })}
                          >
                            <MoreHorizontalIcon className="size-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => void handleBuildIndex(item)}
                            >
                              <WrenchIcon className="mr-2 size-4" />
                              {actionLoadingMap[item.id]?.rebuildIndex
                                ? t("knowledge.rebuilding")
                                : t("knowledge.rebuildIndex")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => void handleDelete(item)}
                            >
                              <Trash2Icon className="mr-2 size-4" />
                              {actionLoadingMap[item.id]?.delete
                                ? t("knowledge.deleting")
                                : t("knowledge.delete")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </ButtonGroup>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && result.results.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-12 text-center text-sm text-muted-foreground"
                    >
                      {t("knowledge.emptyFAQ")}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </table>
          </div>
        </div>

        <ListPagination
          page={result.page.page}
          limit={result.page.limit}
          total={result.page.total}
          onPageChange={(nextPage: number) => {
            setPage(nextPage);
            void loadData({ page: nextPage });
          }}
          onLimitChange={(next: number) => {
            setLimit(next);
            setPage(1);
            void loadData({ limit: next, page: 1 });
          }}
        />
      </div>

      <FAQEditDialog
        open={dialogOpen}
        saving={saving}
        itemId={editingItem?.id ?? null}
        knowledgeBaseId={knowledgeBaseId}
        onOpenChange={(open) => {
          if (!open) {
            setEditingItem(null);
          }
          setDialogOpen(open);
        }}
        onSubmit={handleSubmit}
      />

      <FAQImportDialog
        open={importDialogOpen}
        knowledgeBaseId={knowledgeBaseId}
        importing={importing}
        onOpenChange={setImportDialogOpen}
        onImportingChange={setImporting}
        onImported={loadData}
      />
    </>
  );
}
