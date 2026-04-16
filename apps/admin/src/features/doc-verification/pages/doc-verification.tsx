import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Badge } from "@repo/ui/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@repo/ui/components/ui/pagination";
import {
  useGetDoctorDocuments,
  useApproveDoctor,
  useRejectDoctor,
} from "../hooks/useDocumentVerification";
import type {
  DocumentItemReceiver,
  VerificationFile,
} from "../services/doc-verification.service";

import { Check, X, Search } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { showToast } from "@repo/ui/components/ui/toasts";

type DocumentRecord = DocumentItemReceiver;

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getAvatarColor(seed: string) {
  const palette = [
    "bg-blue-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-violet-500",
    "bg-rose-500",
    "bg-cyan-500",
  ];
  const index = seed.charCodeAt(0) % palette.length;
  return palette[index];
}

// Modal Components
function FilePreviewComponent({ file }: { file: VerificationFile }) {
  const isImage = ["jpg", "jpeg", "png"].includes(file.type);

  if (isImage) {
    return (
      <div className="w-full h-full flex flex-col gap-3">
        <div className="flex-1 min-h-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <img
            src={file.url}
            alt={file.name}
            className="w-full h-full object-contain"
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs text-slate-600">{file.name}</p>
          <a
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-xs text-white transition hover:bg-brand-dark"
          >
            Open in new tab
          </a>
        </div>
      </div>
    );
  }

  if (file.type === "pdf") {
    return (
      <div className="w-full h-full flex flex-col gap-3">
        <div className="flex-1 min-h-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <iframe src={file.url} title={file.name} className="h-full w-full" />
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs text-slate-600">{file.name}</p>
          <a
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-xs text-white transition hover:bg-brand-dark"
          >
            Open in new tab
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center rounded-lg bg-slate-50 border border-slate-200">
      <p className="text-slate-700 font-semibold">{file.name}</p>
    </div>
  );
}

function ReviewModal({
  isOpen,
  document,
  onClose,
  onApprove,
  onReject,
  isProcessing,
}: {
  isOpen: boolean;
  document: DocumentRecord | null;
  onClose: () => void;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string, reason: string) => Promise<void>;
  isProcessing: boolean;
}) {
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [showRejectReason, setShowRejectReason] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  if (!isOpen || !document) return null;

  const selectedFile = document.verificationFiles[selectedFileIndex];

  const handleReject = async () => {
    if (rejectReason.trim()) {
      await onReject(document.id, rejectReason.trim());
    }
  };

  const handleApprove = async () => {
    await onApprove(document.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-7xl rounded-lg bg-white shadow-lg max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 flex items-center justify-between p-6 z-10">
          <h2 className="text-2xl font-semibold text-slate-900">
            Document Review - {document.name}
          </h2>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg hover:bg-slate-100 flex items-center justify-center"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)_380px]">
            {/* File List - Left */}
            <div className="min-w-0">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="mb-3 text-sm font-semibold text-slate-700">
                  Documents ({document.verificationFiles.length})
                </p>

                {document.verificationFiles.length > 0 ? (
                  <div className="flex max-h-140 flex-col gap-2 overflow-y-auto pr-1">
                    {document.verificationFiles.map((file, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedFileIndex(idx)}
                        className={`cursor-pointer rounded-md border px-2 py-2 text-left transition ${
                          selectedFileIndex === idx
                            ? "border-brand bg-brand/5"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <p className="truncate text-[11px] font-medium text-slate-900">
                          {file.name}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-500">
                          {file.type.toUpperCase()} ·{" "}
                          {Math.max(file.size / 1024, 1).toFixed(0)} KB
                        </p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex h-140 items-center justify-center rounded-md border border-dashed border-slate-200 bg-white px-3 text-center text-sm text-slate-500">
                    No documents uploaded
                  </div>
                )}
              </div>
            </div>

            {/* File Preview - Middle */}
            <div className="min-w-0">
              <div className="flex h-140 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-4">
                {selectedFile ? (
                  <FilePreviewComponent file={selectedFile} />
                ) : (
                  <p className="text-slate-500">No file selected</p>
                )}
              </div>
            </div>

            {/* Doctor Info - Right */}
            <div className="min-w-0">
              <div className="space-y-4 rounded-lg bg-slate-50 p-5">
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                    Professional Information
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-slate-500 text-xs">Full Name</p>
                      <p className="text-slate-900 font-semibold">
                        {document.name}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs">Email</p>
                      <p className="text-slate-900 font-semibold">
                        {document.email}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs">Phone</p>
                      <p className="text-slate-900 font-semibold">
                        {document.phone}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs">Specialty</p>
                      <p className="text-slate-900 font-semibold">
                        {document.specialty}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs">Experience</p>
                      <p className="text-slate-900 font-semibold">
                        {document.experience}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs">Workplace</p>
                      <p className="text-slate-900 font-semibold truncate">
                        {document.workplace}
                      </p>
                    </div>
                  </div>
                </div>

                {document.rejectionReason && (
                  <div className="border-t border-slate-200 pt-4">
                    <p className="text-xs font-semibold text-red-600 mb-2">
                      REJECTION REASON
                    </p>
                    <p className="text-sm text-slate-700">
                      {document.rejectionReason}
                    </p>
                  </div>
                )}

                {showRejectReason && (
                  <>
                    <div className="border-t border-slate-200 pt-4">
                      <p className="text-xs font-semibold text-red-600 mb-2">
                        REJECTION REASON
                      </p>
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Explain why you are rejecting this application..."
                        className="min-h-45 w-full rounded-lg border border-red-200 p-3 text-sm outline-none focus:ring-2 focus:ring-red-500"
                        rows={5}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 p-6 flex gap-3 justify-end">
          {showRejectReason ? (
            <>
              <Button
                onClick={() => {
                  setShowRejectReason(false);
                  setRejectReason("");
                }}
                variant="outline"
                disabled={isProcessing}
              >
                Back
              </Button>
              <Button
                onClick={() => void handleReject()}
                disabled={!rejectReason.trim() || isProcessing}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="h-4 w-4 mr-2" />
                {isProcessing ? "Processing..." : "Confirm Rejection"}
              </Button>
            </>
          ) : document.status === "pending" ? (
            <>
              <Button
                onClick={() => setShowRejectReason(true)}
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-50"
                disabled={isProcessing}
              >
                <X className="h-4 w-4 mr-2" />
                Reject
              </Button>

              <Button
                onClick={() => void handleApprove()}
                className={`bg-green-600 hover:bg-green-700 `}
                disabled={isProcessing}
              >
                <Check className="h-4 w-4 mr-2" />
                {isProcessing ? "Processing..." : "Approve"}
              </Button>

              <Button
                onClick={onClose}
                variant="outline"
                disabled={isProcessing}
              >
                Close
              </Button>
            </>
          ) : (
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function DocumentVerification() {
  type StatusFilter = "all" | "pending" | "approved" | "rejected";

  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [reviewingDoc, setReviewingDoc] = useState<DocumentRecord | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [statusOverrides, setStatusOverrides] = useState<
    Record<string, Partial<Pick<DocumentRecord, "status" | "rejectionReason">>>
  >({});

  const itemsPerPage = 10;
  const deferredSearchQuery = useDeferredValue(searchQuery.trim());
  const requestQuery = useMemo(
    () => ({
      status: selectedStatus === "all" ? undefined : selectedStatus,
      page: currentPage,
      limit: itemsPerPage,
      search: deferredSearchQuery || undefined,
    }),
    [selectedStatus, currentPage, itemsPerPage, deferredSearchQuery],
  );

  const {
    data: documentData,
    isLoading,
    error: loadError,
    refresh,
  } = useGetDoctorDocuments(requestQuery);
  const { approve, isLoading: isApproving } = useApproveDoctor();
  const { reject, isLoading: isRejecting } = useRejectDoctor();

  const isProcessing = isApproving || isRejecting;

  const documents = useMemo(
    () => documentData?.doctorDocumentList ?? [],
    [documentData],
  );
  const mergedDocuments = useMemo(
    () =>
      documents.map((doc) => {
        const override = statusOverrides[doc.id];
        return override ? { ...doc, ...override } : doc;
      }),
    [documents, statusOverrides],
  );

  const summary = documentData?.summary;
  const pagination = documentData?.pagination;

  const statusFilters: {
    key: Exclude<StatusFilter, "all">;
    label: string;
    count: number;
  }[] = [
    {
      key: "pending",
      label: "Pending",
      count: summary?.pending ?? 0,
    },
    {
      key: "approved",
      label: "Approved",
      count: summary?.approved ?? 0,
    },
    {
      key: "rejected",
      label: "Rejected",
      count: summary?.rejected ?? 0,
    },
  ];
  const totalPages = Math.max(1, pagination?.pages ?? 1);

  // Count by status
  const pendingCount = summary?.pending ?? 0;

  useEffect(() => {
    if (loadError) {
      showToast.error(loadError);
    }
  }, [loadError]);

  const handleApprove = async (id: string) => {
    try {
      const res = await approve(id);
      if (!res) {
        return;
      }

      setStatusOverrides((prev) => ({
        ...prev,
        [id]: {
          status: "approved",
          rejectionReason: undefined,
        },
      }));

      setReviewingDoc((prev) =>
        prev && prev.id === id
          ? { ...prev, status: "approved", rejectionReason: undefined }
          : prev,
      );
      showToast.success("Approved successfully");
      void refresh();
      setIsReviewOpen(false);
    } catch (error) {
      showToast.error(
        error instanceof Error ? error.message : "Failed to approve doctor",
      );
    }
  };

  const handleReject = async (id: string, reason: string) => {
    try {
      const res = await reject(id, reason);
      if (!res) {
        return;
      }

      setStatusOverrides((prev) => ({
        ...prev,
        [id]: {
          status: "rejected",
          rejectionReason: reason,
        },
      }));

      setReviewingDoc((prev) =>
        prev && prev.id === id
          ? { ...prev, status: "rejected", rejectionReason: reason }
          : prev,
      );

      showToast.success("Rejected successfully");
      void refresh();
      setIsReviewOpen(false);
    } catch (error) {
      showToast.error(
        error instanceof Error ? error.message : "Failed to reject doctor",
      );
    }
  };

  const openReviewModal = (doc: DocumentRecord) => {
    setReviewingDoc(doc);
    setIsReviewOpen(true);
  };

  return (
    <div className="w-full p-6">
      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">
              Document Verification
            </h1>
            <p className="text-sm text-slate-500">
              Review and verify doctor certificates and credentials.
            </p>
            <p className="py-6 text-2xl">
              You have{" "}
              <span className="font-bold text-[#F59E0B]">{pendingCount}</span>{" "}
              pending reviews.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
          {isLoading && (
            <div className="border-b border-slate-200 px-3 py-2 text-sm text-slate-500">
              Loading doctor documents...
            </div>
          )}

          <div className="flex flex-col gap-3 border-b border-slate-200 p-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              {statusFilters.map((item) => (
                <Button
                  key={item.key}
                  type="button"
                  variant={selectedStatus === item.key ? "outline" : "ghost"}
                  size="sm"
                  className={`rounded-xl px-3 ${
                    selectedStatus === item.key
                      ? "border-slate-300 bg-slate-50"
                      : "text-slate-500"
                  }`}
                  onClick={() => {
                    setSelectedStatus(item.key);
                    setCurrentPage(1);
                  }}
                >
                  {item.label}
                  <Badge
                    variant="outline"
                    className="ml-1 h-4 px-1.5 text-[10px] leading-none"
                  >
                    {item.count}
                  </Badge>
                </Button>
              ))}
              <Button
                type="button"
                variant={selectedStatus === "all" ? "outline" : "ghost"}
                size="sm"
                className={`rounded-xl px-3 ${
                  selectedStatus === "all"
                    ? "border-slate-300 bg-slate-50"
                    : "text-slate-500"
                }`}
                onClick={() => {
                  setSelectedStatus("all");
                  setCurrentPage(1);
                }}
              >
                All
                <Badge
                  variant="outline"
                  className="ml-1 h-4 px-1.5 text-[10px] leading-none"
                >
                  {summary?.total ?? 0}
                </Badge>
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search name or email..."
                  className="h-9 w-64 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-700 outline-none ring-brand/30 transition focus:ring-2"
                />
              </div>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-3 text-xs text-slate-400">
                  USER
                </TableHead>
                <TableHead className="px-3 text-xs text-slate-400">
                  EMAIL
                </TableHead>
                <TableHead className="px-3 text-xs text-slate-400">
                  SPECIALTY
                </TableHead>
                <TableHead className="px-3 text-xs text-slate-400">
                  WORKPLACE
                </TableHead>
                <TableHead className="px-3 text-xs text-slate-400">
                  SENT AT
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
              {mergedDocuments.length > 0 ? (
                mergedDocuments.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-white ${getAvatarColor(
                            doc.name,
                          )}`}
                        >
                          {getInitials(doc.name)}
                        </div>
                        <span className="text-sm text-slate-700">
                          {doc.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-3 text-sm text-slate-500">
                      {doc.email}
                    </TableCell>

                    <TableCell className="px-3 text-sm text-slate-500">
                      <span className="bg-[#DBEAFE] p-1 rounded-xl text-[#3B7BF8] text-xs font-medium">
                        {doc.specialty}
                      </span>
                    </TableCell>

                    <TableCell className="px-3 text-sm text-slate-500">
                      {doc.workplace}
                    </TableCell>
                    <TableCell className="px-3 text-sm text-slate-500">
                      {doc.sent_at}
                    </TableCell>
                    <TableCell className="px-3">
                      <Badge
                        variant="outline"
                        className={`h-5 rounded-full border px-2 text-[10px] font-medium ${
                          doc.status === "pending"
                            ? "border-blue-200 bg-blue-50 text-blue-600"
                            : doc.status === "approved"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                              : "border-red-200 bg-red-50 text-red-500"
                        }`}
                      >
                        {doc.status === "pending"
                          ? "Pending"
                          : doc.status === "approved"
                            ? "Approved"
                            : "Rejected"}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-3 text-left">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-lg text-xs"
                        onClick={() => openReviewModal(doc)}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="px-3 py-8 text-center text-sm text-slate-500"
                  >
                    No users found for your current filter.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="flex flex-col gap-3 border-t border-slate-200 px-3 py-2 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Showing {mergedDocuments.length} of {pagination?.total ?? 0}{" "}
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
                        currentPage === 1
                          ? "pointer-events-none opacity-40"
                          : ""
                      }
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentPage > 1) setCurrentPage(currentPage - 1);
                      }}
                    />
                  </PaginationItem>

                  {Array.from({ length: totalPages }).map((_, index) => {
                    const page = index + 1;
                    return (
                      <PaginationItem key={page}>
                        <PaginationLink
                          href="#"
                          isActive={page === currentPage}
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
                        currentPage === totalPages
                          ? "pointer-events-none opacity-40"
                          : ""
                      }
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentPage < totalPages)
                          setCurrentPage(currentPage + 1);
                      }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </div>
        </div>

        <ReviewModal
          key={reviewingDoc?.id ?? "review-modal"}
          isOpen={isReviewOpen}
          document={reviewingDoc}
          onClose={() => setIsReviewOpen(false)}
          onApprove={handleApprove}
          onReject={handleReject}
          isProcessing={isProcessing}
        />
      </div>
    </div>
  );
}
