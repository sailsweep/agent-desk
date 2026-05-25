"use client";

import {
  BanIcon,
  CheckCircle2Icon,
  MoreHorizontalIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { type CustomerFormSavePayload } from "@/components/customer-form";
import {
  DashboardPage,
  DashboardTableShell,
  DashboardTableStateRow,
  DashboardToolbar,
} from "@/components/dashboard-page";
import { ListPagination } from "@/components/list-pagination";
import {
  OptionCombobox,
  type ComboboxOption,
} from "@/components/option-combobox";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type PageResult } from "@/lib/api/admin";
import { fetchCompanies, type AdminCompany } from "@/lib/api/company";
import {
  deleteCustomer,
  fetchCustomers,
  saveCustomerProfile,
  updateCustomerStatus,
  type AdminCustomer,
} from "@/lib/api/customer";
import { Gender, Status } from "@/lib/generated/enums";
import { useI18n } from "@/i18n/provider";
import { EditDialog } from "./_components/edit";

function getLabel(
  value: string,
  options: ReadonlyArray<{ value: string; label: string }>,
  fallback: string,
) {
  return options.find((item) => item.value === value)?.label ?? fallback;
}

export default function DashboardCustomersPage() {
  const t = useI18n();
  const [keywordInput, setKeywordInput] = useState("");
  const [statusFilterInput, setStatusFilterInput] = useState("all");
  const [genderFilterInput, setGenderFilterInput] = useState("all");
  const [companyFilterInput, setCompanyFilterInput] = useState("0");

  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("0");

  const [companyOptions, setCompanyOptions] = useState<ComboboxOption[]>([
    { value: "0", label: t("customer.allCompanies") },
  ]);
  const [companyNameMap, setCompanyNameMap] = useState<Record<number, string>>(
    {},
  );

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AdminCustomer | null>(null);
  const [result, setResult] = useState<PageResult<AdminCustomer>>({
    results: [],
    page: { page: 1, limit: 20, total: 0 },
  });
  const listStatusOptions = useMemo(
    () => [
      { value: "all", label: t("status.all") },
      { value: String(Status.Ok), label: t("status.ok") },
      { value: String(Status.Disabled), label: t("status.disabled") },
    ],
    [t],
  );
  const genderOptions = useMemo(
    () => [
      { value: "all", label: t("customer.allGenders") },
      { value: String(Gender.Unknown), label: t("customerForm.genderUnknown") },
      { value: String(Gender.Male), label: t("customerForm.genderMale") },
      { value: String(Gender.Female), label: t("customerForm.genderFemale") },
    ],
    [t],
  );

  useEffect(() => {
    async function loadCompanies() {
      try {
        const data = await fetchCompanies({ status: 0, page: 1, limit: 500 });
        const opts: ComboboxOption[] = [
          { value: "0", label: t("customer.allCompanies") },
          ...data.results.map((item) => ({
            value: String(item.id),
            label: item.name,
          })),
        ];
        setCompanyOptions(opts);
        const map: Record<number, string> = {};
        data.results.forEach((item: AdminCompany) => {
          map[item.id] = item.name;
        });
        setCompanyNameMap(map);
      } catch {
        // ignore
      }
    }
    void loadCompanies();
  }, [t]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCustomers({
        keyword: keyword.trim() || undefined,
        status: statusFilter === "all" ? undefined : Number(statusFilter),
        gender: genderFilter === "all" ? undefined : Number(genderFilter),
        companyId: companyFilter === "0" ? undefined : Number(companyFilter),
        page,
        limit,
      });
      setResult(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("customer.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [companyFilter, genderFilter, keyword, limit, page, statusFilter, t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const companyFilterLabel = useMemo(() => {
    return (
      companyOptions.find((item) => item.value === companyFilterInput)?.label ??
      t("customer.allCompanies")
    );
  }, [companyFilterInput, companyOptions, t]);

  function applyFilters() {
    setKeyword(keywordInput);
    setStatusFilter(statusFilterInput);
    setGenderFilter(genderFilterInput);
    setCompanyFilter(companyFilterInput);
    setPage(1);
  }

  function handleFilterKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    applyFilters();
  }

  function handlePageChange(nextPage: number) {
    if (nextPage < 1 || nextPage === page) return;
    setPage(nextPage);
  }

  function openCreateDialog() {
    setEditingItem(null);
    setDialogOpen(true);
  }

  function openEditDialog(item: AdminCustomer) {
    setEditingItem(item);
    setDialogOpen(true);
  }

  function handleDialogOpenChange(open: boolean) {
    if (saving) return;
    if (!open) setEditingItem(null);
    setDialogOpen(open);
  }

  async function handleSave(payload: CustomerFormSavePayload) {
    if (saving) return;
    setSaving(true);
    try {
      await saveCustomerProfile(payload);
      toast.success(
        editingItem
          ? t("customer.updated", { name: editingItem.name })
          : t("customer.created", { name: payload.name }),
      );
      setDialogOpen(false);
      setEditingItem(null);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("customer.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(item: AdminCustomer) {
    setActionLoadingId(item.id);
    try {
      const nextStatus = item.status === 0 ? 1 : 0;
      await updateCustomerStatus(item.id, nextStatus);
      toast.success(t(nextStatus === 0 ? "customer.enabled" : "customer.disabled", { name: item.name }));
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("customer.statusUpdateFailed"));
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleDelete(item: AdminCustomer) {
    setActionLoadingId(item.id);
    try {
      await deleteCustomer(item.id);
      toast.success(t("customer.deleted", { name: item.name }));
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("customer.deleteFailed"));
    } finally {
      setActionLoadingId(null);
    }
  }

  function getGenderText(gender: number) {
    if (gender === Gender.Male) return t("customerForm.genderMale");
    if (gender === Gender.Female) return t("customerForm.genderFemale");
    return t("customerForm.genderUnknown");
  }

  return (
    <>
      <DashboardPage>
        <DashboardToolbar
          actions={
            <Button onClick={openCreateDialog}>
              <PlusIcon />
              {t("customer.new")}
            </Button>
          }
        >
          <div className="relative w-full sm:w-72">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              onKeyDown={handleFilterKeyDown}
              placeholder={t("customer.keywordPlaceholder")}
              className="pl-9"
            />
          </div>

          <OptionCombobox
            value={genderFilterInput}
            options={genderOptions}
            placeholder={getLabel(genderFilterInput, genderOptions, t("customer.select"))}
            onChange={(v) => setGenderFilterInput(v)}
          />

          <div className="w-full xl:w-56">
            <OptionCombobox
              value={companyFilterInput}
              options={companyOptions}
              placeholder={companyFilterLabel}
              searchPlaceholder={t("customer.searchCompany")}
              onChange={(v) => setCompanyFilterInput(v)}
            />
          </div>

          <OptionCombobox
            value={statusFilterInput}
            options={listStatusOptions}
            placeholder={getLabel(statusFilterInput, listStatusOptions, t("customer.select"))}
            onChange={(v) => setStatusFilterInput(v)}
          />

          <Button variant="outline" onClick={applyFilters} disabled={loading}>
            <SearchIcon />
            {t("customer.query")}
          </Button>
        </DashboardToolbar>

        <DashboardTableShell
          pagination={
            <ListPagination
              page={result.page.page}
              total={result.page.total}
              limit={result.page.limit}
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
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">ID</TableHead>
                <TableHead>{t("customer.columnName")}</TableHead>
                <TableHead className="w-20">{t("customer.columnGender")}</TableHead>
                <TableHead>{t("customer.columnCompany")}</TableHead>
                <TableHead>{t("customer.columnMobile")}</TableHead>
                <TableHead>{t("customer.columnEmail")}</TableHead>
                <TableHead className="w-24">{t("customer.columnStatus")}</TableHead>
                <TableHead className="w-40">{t("customer.columnActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading || result.results.length === 0 ? (
                <DashboardTableStateRow
                  colSpan={8}
                  loading={loading}
                  loadingText={t("customer.loading")}
                  emptyText={t("customer.empty")}
                />
              ) : (
                result.results.map((item) => {
                  const actionLoading = actionLoadingId === item.id;
                  return (
                    <TableRow key={item.id}>
                      <TableCell>{item.id}</TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {getGenderText(item.gender)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.companyId > 0
                          ? (companyNameMap[item.companyId] ??
                            String(item.companyId))
                          : "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.primaryMobile || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.primaryEmail || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={item.status === 0 ? "default" : "secondary"}
                        >
                          {item.status === 0 ? t("status.ok") : t("status.disabled")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <ButtonGroup className="w-full justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(item)}
                          >
                            {t("customer.edit")}
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={actionLoading}
                                />
                              }
                              aria-label={t("customer.moreActions", { name: item.name })}
                            >
                              <MoreHorizontalIcon />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-40 min-w-40"
                            >
                              <DropdownMenuItem
                                disabled={item.status === Status.Deleted}
                                onClick={() => void handleToggleStatus(item)}
                              >
                                {actionLoadingId === item.id ? (
                                  t("customer.processing")
                                ) : item.status === 0 ? (
                                  <>
                                    <BanIcon />
                                    {t("customer.disable")}
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2Icon />
                                    {t("customer.enable")}
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                disabled={item.status === Status.Deleted}
                                onClick={() => void handleDelete(item)}
                              >
                                <Trash2Icon />
                                {t("customer.delete")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </ButtonGroup>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </DashboardTableShell>
      </DashboardPage>

      <EditDialog
        open={dialogOpen}
        saving={saving}
        itemId={editingItem?.id ?? null}
        onOpenChange={handleDialogOpenChange}
        onSave={handleSave}
      />
    </>
  );
}
