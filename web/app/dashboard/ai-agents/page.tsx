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
  BotMessageSquareIcon,
  GripVerticalIcon,
  MoreHorizontalIcon,
  PlusIcon,
  PowerIcon,
  RefreshCwIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
} from "react";
import { toast } from "sonner";

import {
  DashboardPage,
  DashboardTableShell,
  DashboardTableStateRow,
  DashboardToolbar,
} from "@/components/dashboard-page";
import { ListPagination } from "@/components/list-pagination";
import { OptionCombobox } from "@/components/option-combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  createAIAgent,
  deleteAIAgent,
  fetchAIAgents,
  updateAIAgent,
  updateAIAgentSort,
  updateAIAgentStatus,
  type AIAgent,
  type CreateAIAgentPayload,
  type PageResult,
} from "@/lib/api/admin";
import { IMConversationServiceMode, Status } from "@/lib/generated/enums";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { EditDialog } from "./_components/edit";
import { ButtonGroup } from "@/components/ui/button-group";

type TFunction = (key: string, values?: Record<string, string | number>) => string;

function getStatusOptions(t: TFunction) {
  return [
    { value: "all", label: t("aiAgent.allStatuses") },
    { value: String(Status.Ok), label: t("aiAgent.enabled") },
    { value: String(Status.Disabled), label: t("aiAgent.disabled") },
    { value: String(Status.Deleted), label: t("status.deleted") },
  ];
}

function getStatusLabel(value: string, t: TFunction) {
  return (
    getStatusOptions(t).find((item) => item.value === value)?.label ??
    t("aiAgent.allStatuses")
  );
}

function getServiceModeLabel(mode: number, t: TFunction) {
  switch (mode) {
    case IMConversationServiceMode.AIOnly:
      return t("aiAgent.serviceAiOnly");
    case IMConversationServiceMode.HumanOnly:
      return t("aiAgent.serviceHumanOnly");
    case IMConversationServiceMode.AIFirst:
      return t("aiAgent.serviceAiFirst");
    default:
      return "-";
  }
}

type SortableAIAgentRowProps = {
  item: AIAgent;
  disabled: boolean;
  actionLoadingId: number | null;
  t: TFunction;
  openEditDialog: (item: AIAgent) => void;
  handleToggleStatus: (item: AIAgent) => void;
  handleDelete: (item: AIAgent) => void;
};

function SortableAIAgentRow({
  item,
  disabled,
  actionLoadingId,
  t,
  openEditDialog,
  handleToggleStatus,
  handleDelete,
}: SortableAIAgentRowProps) {
  const knowledgeIds = item.knowledgeIds ?? [];
  const knowledgeBaseNames = item.knowledgeBaseNames ?? [];
  const skills = item.skills ?? [];
  const directTools = item.directTools ?? [];
  const directToolServerCodes = Array.from(
    new Set(directTools.map((tool) => tool.serverCode).filter(Boolean)),
  );
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
          aria-label={t("aiAgent.dragSort", { name: item.name })}
          {...attributes}
          {...listeners}
        >
          <GripVerticalIcon className="size-4 text-muted-foreground" />
        </Button>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-muted">
            <BotMessageSquareIcon className="size-4" />
          </div>
          <div>
            <div className="font-medium">{item.name}</div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        {item.aiConfigName || "-"}
      </TableCell>
      <TableCell>
        {getServiceModeLabel(item.serviceMode, t)}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {knowledgeIds.length === 0 ? (
            <span className="text-sm text-muted-foreground">
              {t("aiAgent.notConfigured")}
            </span>
          ) : (
            knowledgeBaseNames.map((name, index) => (
              <Badge key={knowledgeIds[index] ?? `${item.id}-${index}`} variant="secondary">
                {name}
              </Badge>
            ))
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {skills.length === 0 ? (
            <span className="text-sm text-muted-foreground">{t("aiAgent.ragOnly")}</span>
          ) : (
            skills.map((skill) => (
              <Badge key={skill.id} variant="outline">
                {skill.name}
              </Badge>
            ))
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1">
            <Badge variant="secondary">{skills.length} Skills</Badge>
            <Badge variant="secondary">{directTools.length} Tools</Badge>
          </div>
          <div className="flex flex-wrap gap-1">
            {directToolServerCodes.length === 0 ? (
              <span className="text-sm text-muted-foreground">
                {t("aiAgent.noMcpServer")}
              </span>
            ) : (
              directToolServerCodes.map((serverCode) => (
                <Badge key={serverCode} variant="outline">
                  {serverCode}
                </Badge>
              ))
            )}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <Switch
            checked={item.status === Status.Ok}
            disabled={actionLoadingId === item.id}
            onCheckedChange={() => void handleToggleStatus(item)}
            aria-label={t("aiAgent.toggleStatus", { name: item.name })}
          />
          <Badge
            variant={item.status === Status.Ok ? "default" : "secondary"}
          >
            {getStatusLabel(String(item.status), t)}
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
            {t("aiAgent.edit")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="icon-sm" className="ml-auto" />
              }
              aria-label={t("aiAgent.moreActions", { name: item.name })}
            >
              <MoreHorizontalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={actionLoadingId === item.id}
                onClick={() => void handleToggleStatus(item)}
              >
                <PowerIcon className="size-4" />
                {item.status === Status.Ok ? t("aiAgent.stop") : t("aiAgent.enabled")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                disabled={actionLoadingId === item.id}
                onClick={() => void handleDelete(item)}
              >
                <Trash2Icon className="size-4" />
                {t("aiAgent.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ButtonGroup>
      </TableCell>
    </TableRow>
  );
}

export default function DashboardAIAgentsPage() {
  const t = useI18n();
  const statusOptions = getStatusOptions(t);
  const [nameInput, setNameInput] = useState("");
  const [statusInput, setStatusInput] = useState("all");
  const [name, setName] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [sorting, setSorting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [result, setResult] = useState<PageResult<AIAgent>>({
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
      const data = await fetchAIAgents({
        name: name.trim() || undefined,
        status: status === "all" ? undefined : status,
        page,
        limit,
      });
      setResult(data);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("aiAgent.loadFailed"),
      );
    } finally {
      setLoading(false);
    }
  }, [limit, name, page, status, t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function applyFilters() {
    setName(nameInput);
    setStatus(statusInput);
    setPage(1);
  }

  function handleFilterKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    applyFilters();
  }

  function openCreateDialog() {
    setEditingItemId(null);
    setDialogOpen(true);
  }

  function openEditDialog(item: AIAgent) {
    setEditingItemId(item.id);
    setDialogOpen(true);
  }

  async function handleSubmit(payload: CreateAIAgentPayload) {
    if (saving) {
      return;
    }
    setSaving(true);
    try {
      if (editingItemId) {
        await updateAIAgent({ id: editingItemId, ...payload });
        toast.success(t("aiAgent.updated", { name: payload.name }));
      } else {
        const created = await createAIAgent(payload);
        toast.success(t("aiAgent.created", { name: created.name }));
      }
      setDialogOpen(false);
      setEditingItemId(null);
      await loadData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("aiAgent.saveFailed"),
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(item: AIAgent) {
    setActionLoadingId(item.id);
    try {
      const nextStatus =
        item.status === Status.Ok ? Status.Disabled : Status.Ok;
      await updateAIAgentStatus(item.id, nextStatus);
      toast.success(
        t("aiAgent.statusChanged", {
          name: item.name,
          status: nextStatus === Status.Ok ? t("aiAgent.enabled") : t("aiAgent.stop"),
        }),
      );
      await loadData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("aiAgent.statusUpdateFailed"),
      );
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleDelete(item: AIAgent) {
    setActionLoadingId(item.id);
    try {
      await deleteAIAgent(item.id);
      toast.success(t("aiAgent.deleted", { name: item.name }));
      await loadData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("aiAgent.deleteFailed"),
      );
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
      await updateAIAgentSort(nextResults.map((item) => item.id));
      toast.success(t("aiAgent.sortUpdated"));
      await loadData();
    } catch (error) {
      setResult((current) => ({
        ...current,
        results: previousResults,
      }));
      toast.error(error instanceof Error ? error.message : t("aiAgent.sortUpdateFailed"));
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
                {t("aiAgent.refresh")}
              </Button>
              <Button onClick={openCreateDialog}>
                <PlusIcon />
                {t("aiAgent.new")}
              </Button>
            </>
          }
        >
          <Input
            value={nameInput}
            onChange={(event) => setNameInput(event.target.value)}
            onKeyDown={handleFilterKeyDown}
            placeholder={t("aiAgent.filterName")}
            className="w-full sm:w-56"
          />
          <div className="w-full sm:w-52">
            <OptionCombobox
              value={statusInput}
              options={statusOptions}
              placeholder={t("aiAgent.allStatuses")}
              searchPlaceholder={t("aiAgent.searchStatus")}
              emptyText={t("aiAgent.emptyStatus")}
              onChange={setStatusInput}
            />
          </div>
          <Button variant="outline" onClick={applyFilters} disabled={loading}>
            <SearchIcon />
            {t("aiAgent.query")}
          </Button>
        </DashboardToolbar>

        <DashboardTableShell
          pagination={
            <ListPagination
              page={result.page.page}
              limit={result.page.limit}
              total={result.page.total}
              onPageChange={(nextPage) => setPage(nextPage)}
              onLimitChange={(nextLimit) => {
                setLimit(nextLimit);
                setPage(1);
              }}
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
                  <TableHead>Agent</TableHead>
                  <TableHead>{t("aiAgent.columnAiConfig")}</TableHead>
                  <TableHead>{t("aiAgent.columnServiceMode")}</TableHead>
                  <TableHead>{t("aiAgent.columnKnowledge")}</TableHead>
                  <TableHead>{t("aiAgent.columnSkills")}</TableHead>
                  <TableHead>{t("aiAgent.columnCapabilities")}</TableHead>
                  <TableHead>{t("aiAgent.columnStatus")}</TableHead>
                  <TableHead className="w-[88px] text-right">
                    {t("aiAgent.columnActions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading || result.results.length === 0 ? (
                  <DashboardTableStateRow
                    colSpan={9}
                    loading={loading}
                    loadingText={t("aiAgent.loadingRows")}
                    emptyText={t("aiAgent.emptyRows")}
                  />
                ) : null}
                <SortableContext
                  items={result.results.map((item) => item.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {result.results.map((item) => (
                    <SortableAIAgentRow
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
              </TableBody>
            </Table>
          </DndContext>
        </DashboardTableShell>
      </DashboardPage>

      <EditDialog
        open={dialogOpen}
        saving={saving}
        itemId={editingItemId}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
      />
    </>
  );
}
