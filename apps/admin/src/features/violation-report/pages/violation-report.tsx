import { useEffect, useMemo, useState } from "react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@repo/ui/components/ui/combobox";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@repo/ui/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import {
  Bot,
  CheckCircle,
  CircleAlert,
  Flag,
  MessageSquareX,
  Search,
  ShieldAlert,
  TriangleAlert,
  User,
  UserX,
  X,
} from "lucide-react";

import { useReportList } from "../hooks/useReportManagement";
import { useChangeReportStatus } from "../hooks/useChangeReportStatus";
import { useViewProfile } from "@/features/shared/hooks/useProfile";
import { useBanUser } from "@/features/user-management/hooks/useUserManagement";
import { showToast } from "@repo/ui/components/ui/toasts";

type ReportType =
  | "harassment"
  | "spam"
  | "misinformation"
  | "inappropriate_content"
  | "impersonation"
  | "fraud"
  | "ai_hallucination"
  | "other";

type ReportStatus = "pending" | "resolved";
type AccountStatus = "active" | "banned";

type ViolationReportItem = {
  id: string;
  reportedUserId: string;
  reporterName: string;
  reportedAccount: string;
  reportType: ReportType;
  reason: string;
  status: ReportStatus;
  accountStatus: AccountStatus;
  createdAt: string;
};

const REPORT_TYPE_META: Record<
  ReportType,
  {
    label: string;
    icon: typeof MessageSquareX;
    iconClassName: string;
    badgeClassName: string;
  }
> = {
  harassment: {
    label: "Harassment",
    icon: MessageSquareX,
    iconClassName: "text-red-600",
    badgeClassName: "bg-red-50 text-red-600 border-red-200",
  },
  spam: {
    label: "Spam",
    icon: ShieldAlert,
    iconClassName: "text-amber-600",
    badgeClassName: "bg-amber-50 text-amber-700 border-amber-200",
  },
  misinformation: {
    label: "Misinformation",
    icon: TriangleAlert,
    iconClassName: "text-violet-600",
    badgeClassName: "bg-violet-50 text-violet-600 border-violet-200",
  },
  inappropriate_content: {
    label: "Inappropriate",
    icon: Flag,
    iconClassName: "text-pink-600",
    badgeClassName: "bg-pink-50 text-pink-600 border-pink-200",
  },
  impersonation: {
    label: "Impersonation",
    icon: User,
    iconClassName: "text-blue-600",
    badgeClassName: "bg-blue-50 text-blue-600 border-blue-200",
  },
  fraud: {
    label: "Fraud",
    icon: TriangleAlert,
    iconClassName: "text-rose-600",
    badgeClassName: "bg-rose-50 text-rose-600 border-rose-200",
  },
  ai_hallucination: {
    label: "AI Hallucination",
    icon: Bot,
    iconClassName: "text-orange-600",
    badgeClassName: "bg-orange-50 text-orange-600 border-orange-200",
  },
  other: {
    label: "Other",
    icon: CircleAlert,
    iconClassName: "text-rose-600",
    badgeClassName: "bg-rose-50 text-rose-600 border-rose-200",
  },
};

type ReportDetailModalProps = {
  report: ViolationReportItem | null;
  isOpen: boolean;
  canBan: boolean;
  onClose: () => void;
  onToggleResolved: (id: string) => void;
  onBanUser: (id: string) => void;
  isUpdating: boolean;
};

function ReportDetailModal({
  report,
  isOpen,
  canBan,
  onClose,
  onToggleResolved,
  onBanUser,
  isUpdating,
}: ReportDetailModalProps) {
  if (!isOpen || !report) return null;

  const typeMeta = REPORT_TYPE_META[report.reportType];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-[880px] rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-blue-50 p-2">
              <typeMeta.icon className={`h-5 w-5 ${typeMeta.iconClassName}`} />
            </div>
            <div>
              <p className="text-3xl font-semibold text-slate-900">
                {typeMeta.label} Report
              </p>
              <p className="text-sm text-slate-500">{report.createdAt}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <Badge
          variant="outline"
          className={`mb-5 rounded-full border px-2 py-1 text-xs ${
            report.status === "resolved"
              ? "border-emerald-200 bg-emerald-50 text-emerald-600"
              : "border-amber-200 bg-amber-50 text-amber-700"
          }`}
        >
          {report.status === "resolved" ? "Resolved" : "Pending"}
        </Badge>

        <div className="mb-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl bg-[#F7F8FA] p-4">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Reported By
            </p>
            <p className="text-base font-semibold text-slate-900">
              {report.reporterName}
            </p>
          </div>
          <div className="rounded-2xl bg-[#FEF2F2] p-4">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Reported Account
            </p>
            <p className="text-base font-semibold text-slate-900">
              {report.reportedAccount}
            </p>
          </div>
        </div>

        <div className="mb-6 rounded-2xl bg-slate-50 p-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Report Details
          </p>
          <p className="text-base text-slate-700">{report.reason}</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="sm:min-w-36"
            onClick={onClose}
          >
            Close
          </Button>
          <Button
            type="button"
            className={`sm:min-w-36 text-white ${
              report.status === "pending"
                ? "bg-lime-500 hover:bg-lime-600"
                : "bg-slate-600 hover:bg-slate-700"
            }`}
            onClick={() => onToggleResolved(report.id)}
            disabled={isUpdating}
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            {report.status === "pending" ? "Mark Resolved" : "Unmark"}
          </Button>
          <Button
            type="button"
            className={`sm:min-w-36 text-white ${
              canBan
                ? "bg-red-500 hover:bg-red-600"
                : "cursor-not-allowed bg-slate-300 text-slate-100"
            }`}
            onClick={() => onBanUser(report.id)}
            disabled={!canBan || isUpdating}
          >
            <UserX className="mr-2 h-4 w-4" />
            {canBan ? "Ban User" : "Banned"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ViolationReport() {
  const [reportOverrides, setReportOverrides] = useState<
    Record<
      string,
      Partial<Pick<ViolationReportItem, "status" | "accountStatus">>
    >
  >({});
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ReportStatus>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | ReportType>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmittingBan, setIsSubmittingBan] = useState(false);
  const itemsPerPage = 8;
  const {
    response: reportListResponse,
    isLoading: isReportListLoading,
    error: reportListError,
    loadReportList,
  } = useReportList();
  const {
    changeReportStatus,
    isLoading: isChangingReportStatus,
    error: changeReportStatusError,
  } = useChangeReportStatus();
  const {
    submitBanUser,
    isLoading: isBanningUser,
    error: banUserError,
  } = useBanUser();

  const modalLoading =
    isChangingReportStatus || isBanningUser || isSubmittingBan;

  useEffect(() => {
    const fetchReports = async () => {
      const loaded = await loadReportList();
      if (loaded === null) {
        showToast.error("Failed to load violation reports");
      }
    };

    void fetchReports();
  }, [loadReportList]);

  const reportList = useMemo(() => {
    if (!reportListResponse) {
      return [] as ViolationReportItem[];
    }

    return reportListResponse.reportListReceiver.map((item) => ({
      id: item.id,
      reportedUserId: item.reportedUserId,
      reporterName: item.reporterName,
      reportedAccount: item.reportedAccount,
      reportType: item.reportType,
      reason: item.reason,
      status: reportOverrides[item.id]?.status ?? item.status,
      accountStatus:
        reportOverrides[item.id]?.accountStatus ?? item.accountStatus,
      createdAt: item.createdAt,
    }));
  }, [reportListResponse, reportOverrides]);

  const selectedReport = useMemo(
    () => reportList.find((item) => item.id === selectedReportId) ?? null,
    [reportList, selectedReportId],
  );

  const {
    data: selectedReportedUserProfile,
    isLoading: isLoadingSelectedReportedUser,
  } = useViewProfile(
    selectedReport?.reportedUserId ?? null,
    isModalOpen && Boolean(selectedReport?.reportedUserId),
  );

  const filteredReports = useMemo(() => {
    return reportList.filter((report) => {
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        report.reporterName.toLowerCase().includes(query) ||
        report.reportedAccount.toLowerCase().includes(query) ||
        report.reason.toLowerCase().includes(query);
      const matchesStatus =
        statusFilter === "all" || report.status === statusFilter;
      const matchesType =
        typeFilter === "all" || report.reportType === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [reportList, searchQuery, statusFilter, typeFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredReports.length / itemsPerPage),
  );
  const currentSafePage = Math.min(currentPage, totalPages);
  const startIndex = (currentSafePage - 1) * itemsPerPage;
  const paginatedReports = filteredReports.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  const pendingCount = reportList.filter((x) => x.status === "pending").length;

  const openReportModal = (report: ViolationReportItem) => {
    setSelectedReportId(report.id);
    setIsModalOpen(true);
  };

  const handleToggleResolved = async (id: string) => {
    const currentReport = reportList.find((item) => item.id === id);
    if (!currentReport) {
      return;
    }

    const nextStatus: ReportStatus =
      currentReport.status === "pending" ? "resolved" : "pending";

    try {
      const updated = await changeReportStatus({
        id,
        status: nextStatus,
      });

      if (!updated) {
        showToast.error("Failed to update report status");
        return;
      }

      setReportOverrides((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          status: nextStatus,
        },
      }));
    } catch {
      showToast.error("Failed to update report status");
    }
  };

  const handleBanUser = async (id: string) => {
    if (isSubmittingBan || isBanningUser) {
      return;
    }

    if (selectedReportedUserProfile?.account_status === "banned") {
      return;
    }

    const targetReport = reportList.find((item) => item.id === id);
    if (!targetReport?.reportedUserId) {
      return;
    }

    setIsSubmittingBan(true);
    try {
      const response = await submitBanUser({
        id: targetReport.reportedUserId,
        reason: `Violation report ${id}`,
      });

      if (!response) {
        showToast.error(banUserError || "Cannot ban this user!");
        return;
      }

      setReportOverrides((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          accountStatus: "banned",
          status: "resolved",
        },
      }));
      showToast.success("User banned successfully!");
    } catch {
      showToast.error("Cannot ban this user!");
    } finally {
      setIsSubmittingBan(false);
    }
  };

  const canBanSelectedUser =
    selectedReport?.accountStatus === "active" &&
    selectedReportedUserProfile?.account_status !== "banned" &&
    !isLoadingSelectedReportedUser;

  return (
    <div className="w-full p-6">
      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h1 className="text-3xl font-semibold text-slate-900">
            Violation Reports
          </h1>
          <p className="text-sm text-slate-500">
            Review reports from patients and doctors to keep the platform safe.
          </p>
          <p className="py-4 text-2xl">
            You have{" "}
            <span className="font-bold text-amber-500">{pendingCount}</span>{" "}
            pending reports.
          </p>
        </div>

        {/* Loading */}
        {isReportListLoading ? (
          <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Loading violation reports...
          </div>
        ) : null}

        {reportListError || changeReportStatusError || banUserError ? (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {reportListError || changeReportStatusError || banUserError}
          </div>
        ) : null}

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search by reporter, account or details..."
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-700 outline-none ring-brand/30 transition focus:ring-2 md:w-72"
                />
              </div>

              <Combobox
                value={typeFilter}
                onValueChange={(value) => {
                  setTypeFilter(value as "all" | ReportType);
                  setCurrentPage(1);
                }}
              >
                <ComboboxInput
                  placeholder="Filter by type"
                  className="w-full md:w-52"
                />
                <ComboboxContent>
                  <ComboboxEmpty>No type found.</ComboboxEmpty>
                  <ComboboxList>
                    <ComboboxItem value="all">All types</ComboboxItem>
                    {Object.entries(REPORT_TYPE_META).map(([value, meta]) => (
                      <ComboboxItem key={value} value={value}>
                        {meta.label}
                      </ComboboxItem>
                    ))}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>

              <Combobox
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value as "all" | ReportStatus);
                  setCurrentPage(1);
                }}
              >
                <ComboboxInput
                  placeholder="Filter by status"
                  className="w-full md:w-44"
                />
                <ComboboxContent>
                  <ComboboxEmpty>No status found.</ComboboxEmpty>
                  <ComboboxList>
                    <ComboboxItem value="all">All status</ComboboxItem>
                    <ComboboxItem value="pending">Pending</ComboboxItem>
                    <ComboboxItem value="resolved">Resolved</ComboboxItem>
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-3 text-xs text-slate-400">
                  TYPE
                </TableHead>
                <TableHead className="px-3 text-xs text-slate-400">
                  REPORTED BY
                </TableHead>
                <TableHead className="px-3 text-xs text-slate-400">
                  REPORTED ACCOUNT
                </TableHead>
                <TableHead className="px-3 text-xs text-slate-400">
                  DETAILS
                </TableHead>
                <TableHead className="px-3 text-xs text-slate-400">
                  DATE
                </TableHead>
                <TableHead className="px-3 text-xs text-slate-400">
                  STATUS
                </TableHead>
                <TableHead className="px-3 text-xs text-slate-400">
                  ACTIONS
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedReports.length > 0 ? (
                paginatedReports.map((report) => {
                  const typeMeta = REPORT_TYPE_META[report.reportType];
                  const TypeIcon = typeMeta.icon;

                  return (
                    <TableRow key={report.id}>
                      <TableCell className="px-4">
                        <Badge
                          variant="outline"
                          className={`h-6 gap-1 rounded-full border px-2 text-[11px] ${typeMeta.badgeClassName}`}
                        >
                          <TypeIcon
                            className={`h-3.5 w-3.5 ${typeMeta.iconClassName}`}
                          />
                          {typeMeta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 text-sm font-medium text-slate-700">
                        {report.reporterName}
                      </TableCell>
                      <TableCell className="px-4 text-sm text-slate-600">
                        {report.reportedAccount}
                      </TableCell>
                      <TableCell className="max-w-[320px] truncate px-4 text-sm text-slate-500">
                        {report.reason}
                      </TableCell>
                      <TableCell className="px-4 text-sm text-slate-500">
                        {report.createdAt}
                      </TableCell>
                      <TableCell className="px-4">
                        <Badge
                          variant="outline"
                          className={`h-5 rounded-full border px-2 text-[10px] font-medium ${
                            report.status === "pending"
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : "border-emerald-200 bg-emerald-50 text-emerald-600"
                          }`}
                        >
                          {report.status === "pending" ? "Pending" : "Resolved"}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 text-left">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-lg text-xs"
                          onClick={() => openReportModal(report)}
                          disabled={modalLoading}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="px-4 py-8 text-center text-sm text-slate-500"
                  >
                    No report found for your current filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="flex flex-col gap-3 border-t border-slate-200 px-3 py-2 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Showing {paginatedReports.length} of {filteredReports.length}{" "}
              results
            </p>

            {totalPages > 1 && (
              <Pagination className="mx-0 w-auto justify-end">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      text=""
                      className={
                        currentSafePage === 1
                          ? "pointer-events-none opacity-40"
                          : ""
                      }
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentSafePage > 1) {
                          setCurrentPage(currentSafePage - 1);
                        }
                      }}
                    />
                  </PaginationItem>

                  {Array.from({ length: totalPages }).map((_, index) => {
                    const page = index + 1;
                    return (
                      <PaginationItem key={page}>
                        <PaginationLink
                          href="#"
                          isActive={page === currentSafePage}
                          onClick={(e) => {
                            e.preventDefault();
                            setCurrentPage(page);
                          }}
                          className="h-7 w-7 rounded-lg text-xs"
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}

                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      text=""
                      className={
                        currentSafePage === totalPages
                          ? "pointer-events-none opacity-40"
                          : ""
                      }
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentSafePage < totalPages) {
                          setCurrentPage(currentSafePage + 1);
                        }
                      }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </div>
        </div>

        <ReportDetailModal
          report={selectedReport}
          isOpen={isModalOpen}
          canBan={canBanSelectedUser}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedReportId(null);
          }}
          onToggleResolved={handleToggleResolved}
          onBanUser={handleBanUser}
          isUpdating={modalLoading}
        />
      </div>
    </div>
  );
}
