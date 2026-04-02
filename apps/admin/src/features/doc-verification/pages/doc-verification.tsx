import { useState } from "react";
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

import { Check, X, Search } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";

type VerificationFile = {
  name: string;
  url: string;
  type: "pdf" | "jpg" | "jpeg" | "png";
  size: number;
};

type DocumentRecord = {
  id: string;
  name: string;
  email: string;
  phone: string;
  specialty: string;
  experience: string;
  workplace: string;
  sent_at: string;
  status: "pending" | "approved" | "rejected";
  verificationFiles: VerificationFile[];
  rejectionReason?: string;
};

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

// Mock data - Replace with API calls
const mockDocuments: DocumentRecord[] = [
  {
    id: "1",
    name: "Dr. Marcus Lee",
    email: "ml@clinic.com",
    phone: "+1 (333) 584-3843",
    specialty: "Neurology",
    experience: "5 years",
    workplace: "Stanford Medical School",
    sent_at: "Dec 1, 2025",
    status: "pending",
    verificationFiles: [
      {
        name: "Medical_License_Marcus_Lee.pdf",
        url: "https://via.placeholder.com/800x600?text=Medical+License+PDF",
        type: "pdf",
        size: 2048,
      },
      {
        name: "degree_certificate.jpg",
        url: "https://via.placeholder.com/800x600?text=Degree+Certificate",
        type: "jpg",
        size: 1024,
      },
    ],
  },
  {
    id: "2",
    name: "Dr. Sarah Johnson",
    email: "sarah.j@hospital.com",
    phone: "+1 (415) 555-2671",
    specialty: "Cardiology",
    experience: "8 years",
    workplace: "Johns Hopkins Hospital",
    sent_at: "Dec 2, 2025",
    status: "approved",
    verificationFiles: [
      {
        name: "CardiolgyLicense_SarahJ.pdf",
        url: "https://via.placeholder.com/800x600?text=License",
        type: "pdf",
        size: 3072,
      },
    ],
  },
  {
    id: "3",
    name: "Dr. James Wilson",
    email: "j.wilson@medical.com",
    phone: "+1 (415) 555-2672",
    specialty: "Pediatrics",
    experience: "10 years",
    workplace: "Children's Hospital",
    sent_at: "Dec 3, 2025",
    status: "rejected",
    verificationFiles: [
      {
        name: "expired_license.pdf",
        url: "https://via.placeholder.com/800x600?text=Expired+License",
        type: "pdf",
        size: 2560,
      },
    ],
    rejectionReason: "Document expired - valid until Dec 31, 2024",
  },
  {
    id: "4",
    name: "Dr. Emily Chen",
    email: "emily.chen@clinic.com",
    phone: "+1 (551) 555-2673",
    specialty: "Dermatology",
    experience: "6 years",
    workplace: "Mayo Clinic",
    sent_at: "Dec 4, 2025",
    status: "pending",
    verificationFiles: [
      {
        name: "dermatology_cert.jpg",
        url: "https://via.placeholder.com/800x600?text=Dermatology+Certificate",
        type: "jpg",
        size: 1536,
      },
      {
        name: "license_2024.pdf",
        url: "https://via.placeholder.com/800x600?text=License+2024",
        type: "pdf",
        size: 2200,
      },
      {
        name: "professional_credential.png",
        url: "https://via.placeholder.com/800x600?text=Professional+Credential",
        type: "png",
        size: 1800,
      },
    ],
  },
  {
    id: "5",
    name: "Dr. Michael Brown",
    email: "m.brown@hospital.com",
    phone: "+1 (216) 555-2674",
    specialty: "Orthopedics",
    experience: "12 years",
    workplace: "Cleveland Clinic",
    sent_at: "Dec 5, 2025",
    status: "pending",
    verificationFiles: [
      {
        name: "orthopedic_license.pdf",
        url: "https://via.placeholder.com/800x600?text=Orthopedic+License",
        type: "pdf",
        size: 3000,
      },
    ],
  },
];

// Modal Components
function FilePreviewComponent({ file }: { file: VerificationFile }) {
  const isImage = ["jpg", "jpeg", "png"].includes(file.type);

  if (isImage) {
    return (
      <img
        src={file.url}
        alt={file.name}
        className="w-full h-full object-contain rounded-lg"
      />
    );
  }

  if (file.type === "pdf") {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-4 rounded-lg bg-slate-50 border border-slate-200">
        <div className="text-6xl">📄</div>
        <p className="text-slate-700 font-semibold">{file.name}</p>
        <p className="text-sm text-slate-500">PDF Document</p>
        <a
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark transition"
        >
          Open in new tab
        </a>
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
}: {
  isOpen: boolean;
  document: DocumentRecord | null;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [showRejectReason, setShowRejectReason] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  if (!isOpen || !document) return null;

  const selectedFile = document.verificationFiles[selectedFileIndex];

  const handleReject = () => {
    if (rejectReason.trim()) {
      onReject(document.id);
      setRejectReason("");
      setShowRejectReason(false);
      onClose();
    }
  };

  const handleApprove = () => {
    onApprove(document.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-5xl rounded-lg bg-white shadow-lg max-h-[90vh] overflow-y-auto">
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* File Preview - Large */}
            <div className="lg:col-span-2">
              <div className="rounded-lg border border-slate-200 overflow-hidden bg-slate-50 p-4 h-[500px] flex items-center justify-center">
                {selectedFile ? (
                  <FilePreviewComponent file={selectedFile} />
                ) : (
                  <p className="text-slate-500">No file selected</p>
                )}
              </div>

              {/* File List */}
              {document.verificationFiles.length > 1 && (
                <div className="mt-4">
                  <p className="text-sm font-semibold text-slate-700 mb-3">
                    Documents ({document.verificationFiles.length})
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {document.verificationFiles.map((file, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedFileIndex(idx)}
                        className={`p-3 rounded-lg border-2 transition text-left ${
                          selectedFileIndex === idx
                            ? "border-brand bg-brand/5"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <p className="text-xs font-medium text-slate-900 truncate">
                          {file.name}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1">
                          {file.type.toUpperCase()}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Doctor Info - Compact */}
            <div>
              <div className="bg-slate-50 rounded-lg p-4 space-y-4">
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
              </div>
            </div>
          </div>

          {/* Reject Reason Form */}
          {showRejectReason && (
            <div className="mt-6 p-4 border border-red-200 bg-red-50 rounded-lg">
              <label className="block text-sm font-semibold text-slate-900 mb-3">
                Reason for Rejection
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why you are rejecting this application..."
                className="w-full rounded-lg border border-red-200 p-3 text-sm outline-none focus:ring-2 focus:ring-red-500"
                rows={3}
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 p-6 flex gap-3 justify-end">
          {!showRejectReason ? (
            <>
              {document.status !== "rejected" ? (
                <Button
                  onClick={() => setShowRejectReason(true)}
                  variant="outline"
                  className="border-red-300 text-red-700 hover:bg-red-50"
                >
                  <X className="h-4 w-4 mr-2" />
                  Reject
                </Button>
              ) : null}
              {document.status !== "approved" ? (
                <Button
                  onClick={handleApprove}
                  className={`bg-green-600 hover:bg-green-700 `}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Approve
                </Button>
              ) : null}
              <Button onClick={onClose} variant="outline">
                Close
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={() => {
                  setShowRejectReason(false);
                  setRejectReason("");
                }}
                variant="outline"
              >
                Back
              </Button>
              <Button
                onClick={handleReject}
                disabled={!rejectReason.trim()}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="h-4 w-4 mr-2" />
                Confirm Rejection
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function DocumentVerification() {
  const [selectedStatus, setSelectedStatus] = useState<
    "all" | "pending" | "approved" | "rejected"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [documents, setDocuments] = useState<DocumentRecord[]>(mockDocuments);
  const [reviewingDoc, setReviewingDoc] = useState<DocumentRecord | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const itemsPerPage = 10;

  // Filter documents
  const filteredDocuments = documents.filter((doc) => {
    const matchesStatus =
      selectedStatus === "all" || doc.status === selectedStatus;
    const matchesSearch =
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Pagination
  const totalPages = Math.ceil(filteredDocuments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedDocuments = filteredDocuments.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  // Count by status
  const pendingCount = documents.filter((d) => d.status === "pending").length;
  const approvedCount = documents.filter((d) => d.status === "approved").length;
  const rejectedCount = documents.filter((d) => d.status === "rejected").length;

  const handleApprove = (id: string) => {
    setDocuments((docs) =>
      docs.map((doc) => (doc.id === id ? { ...doc, status: "approved" } : doc)),
    );
  };

  const handleReject = (id: string) => {
    setDocuments((docs) =>
      docs.map((doc) => (doc.id === id ? { ...doc, status: "rejected" } : doc)),
    );
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
          <div className="flex flex-col gap-3 border-b border-slate-200 p-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { key: "pending", label: "Pending", count: pendingCount },
                { key: "approved", label: "Approved", count: approvedCount },
                { key: "rejected", label: "Rejected", count: rejectedCount },
              ].map((item) => (
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
                    setSelectedStatus(item.key as any);
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
                  {documents.length}
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
              {paginatedDocuments.length > 0 ? (
                paginatedDocuments.map((doc) => (
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
              Showing {paginatedDocuments.length} of {filteredDocuments.length}{" "}
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
          isOpen={isReviewOpen}
          document={reviewingDoc}
          onClose={() => setIsReviewOpen(false)}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      </div>
    </div>
  );
}
