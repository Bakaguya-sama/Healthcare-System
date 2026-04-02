import { useMemo, useRef, useState } from "react";
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
  ActionCard,
  type ActionCardItem,
} from "@repo/ui/components/ui/action-card";
import {
  Ban,
  BookOpen,
  Check,
  CircleSlash,
  Download,
  Ellipsis,
  Eye,
  FileText,
  Search,
  Trash2,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";

type TabSwitch = "doc" | "words";
type DocumentStatus = "processing" | "error" | "active" | "inactive";
type DocumentType = "pdf" | "doc" | "docx" | "txt";

type DocumentItem = {
  id: string;
  title: string;
  fileUrl: string;
  fileType: DocumentType;
  status: DocumentStatus;
  uploadedBy: string;
  createdAt: string;
  isEnabled: boolean;
};

const MOCK_DOCUMENTS: DocumentItem[] = [
  {
    id: "doc-1",
    title: "Clinical Guidelines 2025",
    fileUrl:
      "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    fileType: "pdf",
    status: "active",
    uploadedBy: "Admin1",
    createdAt: "Mar 1, 2026",
    isEnabled: true,
  },
  {
    id: "doc-2",
    title: "COVID-19 Treatment Protocol",
    fileUrl:
      "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    fileType: "pdf",
    status: "active",
    uploadedBy: "Dr. Chen",
    createdAt: "Feb 22, 2026",
    isEnabled: false,
  },
  {
    id: "doc-3",
    title: "Drug Interaction Reference",
    fileUrl:
      "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    fileType: "docx",
    status: "processing",
    uploadedBy: "Admin1",
    createdAt: "Feb 15, 2026",
    isEnabled: false,
  },
  {
    id: "doc-4",
    title: "Mental Health Assessment Tool",
    fileUrl:
      "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    fileType: "docx",
    status: "error",
    uploadedBy: "Dr. Nguyen",
    createdAt: "Jan 5, 2026",
    isEnabled: false,
  },
  {
    id: "doc-5",
    title: "Emergency Response Manual",
    fileUrl:
      "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    fileType: "pdf",
    status: "inactive",
    uploadedBy: "Admin1",
    createdAt: "Dec 20, 2025",
    isEnabled: false,
  },
  {
    id: "doc-6",
    title: "Pediatric Care Handbook",
    fileUrl:
      "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    fileType: "pdf",
    status: "active",
    uploadedBy: "Dr. Nari",
    createdAt: "Jan 30, 2026",
    isEnabled: true,
  },
  {
    id: "doc-7",
    title: "Surgical Best Practices",
    fileUrl:
      "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    fileType: "pdf",
    status: "active",
    uploadedBy: "Dr. Hays",
    createdAt: "Jan 18, 2026",
    isEnabled: false,
  },
];

const INITIAL_BLACKLIST_WORDS = [
  "spam",
  "insult",
  "fake-news",
  "harassment",
  "misinformation",
  "abuse",
  "violence",
  "scam",
  "clickbait",
  "hate-speech",
];

function getStatusClassName(status: DocumentStatus) {
  if (status === "active") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "inactive") {
    return "border-slate-200 bg-slate-100 text-slate-600";
  }
  if (status === "processing") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-red-200 bg-red-50 text-red-600";
}

function getStatusLabel(status: DocumentStatus) {
  if (status === "active") return "Active";
  if (status === "inactive") return "Inactive";
  if (status === "processing") return "Processing";
  return "Error";
}

function getFileTypeFromName(fileName: string): DocumentType {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "doc") return "doc";
  if (ext === "docx") return "docx";
  return "txt";
}

function DocumentPreviewModal({
  document,
  isOpen,
  onClose,
}: {
  document: DocumentItem | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen || !document) return null;

  const isPdf = document.fileType === "pdf";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative flex h-[88vh] w-full max-w-6xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {document.title}
            </h3>
            <p className="text-sm text-slate-500">
              {document.fileType.toUpperCase()} document preview
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden p-4">
          {isPdf ? (
            <iframe
              src={document.fileUrl}
              title={document.title}
              className="h-full w-full rounded-lg border border-slate-200"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <FileText className="mb-3 h-10 w-10 text-slate-500" />
              <p className="text-base font-semibold text-slate-700">
                Preview is not supported for this file type.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Please download the file to view full content.
              </p>
              <a
                href={document.fileUrl}
                download={document.title}
                className="mt-4 inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                <Download className="mr-2 h-4 w-4" />
                Download file
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AIManagement() {
  const [tab, setTab] = useState<TabSwitch>("doc");
  const [docList, setDocList] = useState<DocumentItem[]>(MOCK_DOCUMENTS);
  const [searchDoc, setSearchDoc] = useState("");
  const [selectedType, setSelectedType] = useState<"all" | DocumentType>("all");
  const [selectedStatus, setSelectedStatus] = useState<"all" | DocumentStatus>(
    "all",
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [openActionFor, setOpenActionFor] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const [blacklistWords, setBlacklistWords] = useState<string[]>(
    INITIAL_BLACKLIST_WORDS,
  );
  const [searchWord, setSearchWord] = useState("");
  const [newWord, setNewWord] = useState("");

  const inputFileRef = useRef<HTMLInputElement | null>(null);

  const filteredDocs = useMemo(() => {
    return docList.filter((doc) => {
      const q = searchDoc.trim().toLowerCase();
      const matchesSearch =
        !q ||
        doc.title.toLowerCase().includes(q) ||
        doc.uploadedBy.toLowerCase().includes(q);
      const matchesType =
        selectedType === "all" || doc.fileType === selectedType;
      const matchesStatus =
        selectedStatus === "all" || doc.status === selectedStatus;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [docList, searchDoc, selectedType, selectedStatus]);

  const itemsPerPage = 7;
  const totalPages = Math.max(1, Math.ceil(filteredDocs.length / itemsPerPage));
  const currentSafePage = Math.min(currentPage, totalPages);
  const startIndex = (currentSafePage - 1) * itemsPerPage;
  const paginatedDocs = filteredDocs.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  const filteredWords = useMemo(() => {
    const q = searchWord.trim().toLowerCase();
    if (!q) return blacklistWords;
    return blacklistWords.filter((word) => word.toLowerCase().includes(q));
  }, [blacklistWords, searchWord]);

  const totalDocuments = docList.length;
  const activeDocuments = docList.filter((x) => x.status === "active").length;
  const inactiveDocuments = docList.filter(
    (x) => x.status === "inactive",
  ).length;
  const errorDocuments = docList.filter((x) => x.status === "error").length;

  const openPreview = (doc: DocumentItem) => {
    setPreviewDoc(doc);
    setIsPreviewOpen(true);
    setOpenActionFor(null);
  };

  const handleDownload = (doc: DocumentItem) => {
    const link = document.createElement("a");
    link.href = doc.fileUrl;
    link.download = doc.title;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setOpenActionFor(null);
  };

  const handleDelete = (id: string) => {
    setDocList((prev) => prev.filter((doc) => doc.id !== id));
    setOpenActionFor(null);
  };

  const handleToggleEnable = (id: string) => {
    setDocList((prev) =>
      prev.map((doc) => {
        if (doc.id !== id) return doc;
        const nextEnabled = !doc.isEnabled;
        return {
          ...doc,
          isEnabled: nextEnabled,
          status: nextEnabled ? "active" : "inactive",
        };
      }),
    );
    setOpenActionFor(null);
  };

  const getActionItems = (doc: DocumentItem): ActionCardItem[] => {
    return [
      {
        id: `view-${doc.id}`,
        title: "View",
        icon: <Eye className="h-4 w-4" />,
        onHandle: () => openPreview(doc),
      },
      {
        id: `download-${doc.id}`,
        title: "Download",
        icon: <Download className="h-4 w-4" />,
        onHandle: () => handleDownload(doc),
      },
      {
        id: `delete-${doc.id}`,
        title: "Delete",
        icon: <Trash2 className="h-4 w-4" />,
        iconColor: "text-red-600",
        onHandle: () => handleDelete(doc.id),
      },
      {
        id: `toggle-${doc.id}`,
        title: doc.isEnabled ? "Activate" : "Deactivate",
        icon: <CircleSlash className="h-4 w-4" />,
        onHandle: () => handleToggleEnable(doc.id),
      },
    ];
  };

  const handleChooseLocalFile = () => {
    inputFileRef.current?.click();
  };

  const handleUploadFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const createdAt = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const newDocs: DocumentItem[] = Array.from(files).map((file, index) => ({
      id: `doc-upload-${Date.now()}-${index}`,
      title: file.name,
      fileUrl: URL.createObjectURL(file),
      fileType: getFileTypeFromName(file.name),
      status: "processing",
      uploadedBy: "Admin",
      createdAt,
      isEnabled: false,
    }));

    setDocList((prev) => [...newDocs, ...prev]);
    setCurrentPage(1);
  };

  const addBlacklistWord = () => {
    const sanitized = newWord.trim().toLowerCase();
    if (!sanitized) return;
    if (blacklistWords.includes(sanitized)) return;
    setBlacklistWords((prev) => [sanitized, ...prev]);
    setNewWord("");
  };

  const removeBlacklistWord = (word: string) => {
    setBlacklistWords((prev) => prev.filter((item) => item !== word));
  };

  return (
    <div className="w-full p-6">
      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h1 className="text-3xl font-semibold text-slate-900">
            AI Knowledge Base
          </h1>
          <p className="text-sm text-slate-500">
            Manage RAG documents and content restrictions for AI medical
            assistance.
          </p>
        </div>

        <div className="mb-4 border-b border-slate-200">
          <div className="flex items-center gap-6">
            <button
              type="button"
              className={`flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-semibold transition ${
                tab === "doc"
                  ? "border-brand text-brand"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
              onClick={() => setTab("doc")}
            >
              <BookOpen className="h-4 w-4" />
              Knowledge Documents
              <span className="ml-1 text-xs text-slate-400">
                {docList.length}
              </span>
            </button>

            <button
              type="button"
              className={`flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-semibold transition ${
                tab === "words"
                  ? "border-red-400 text-red-500"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
              onClick={() => setTab("words")}
            >
              <Ban className="h-4 w-4" />
              Blacklist Words
              <span className="ml-1 text-xs text-slate-400">
                {blacklistWords.length}
              </span>
            </button>
          </div>
        </div>

        {tab === "doc" ? (
          <div>
            <ul className="mb-3 grid grid-cols-1 gap-3 lg:grid-cols-4">
              <li className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <FileText className="h-5 w-5" />
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {totalDocuments}
                </p>
                <p className="text-sm text-slate-600">Total Documents</p>
              </li>
              <li className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <Check className="h-5 w-5" />
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {activeDocuments}
                </p>
                <p className="text-sm text-slate-600">Active</p>
              </li>
              <li className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <CircleSlash className="h-5 w-5" />
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {inactiveDocuments}
                </p>
                <p className="text-sm text-slate-600">Inactive</p>
              </li>
              <li className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600">
                  <TriangleAlert className="h-5 w-5" />
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {errorDocuments}
                </p>
                <p className="text-sm text-slate-600">Error</p>
              </li>
            </ul>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-200 p-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchDoc}
                      onChange={(e) => {
                        setSearchDoc(e.target.value);
                        setCurrentPage(1);
                      }}
                      placeholder="Search by name or uploader..."
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-700 outline-none transition focus:ring-2 focus:ring-brand/30 md:w-64"
                    />
                  </div>

                  <Combobox
                    value={selectedType}
                    onValueChange={(value) => {
                      setSelectedType(value as "all" | DocumentType);
                      setCurrentPage(1);
                    }}
                  >
                    <ComboboxInput
                      placeholder="All types"
                      className="w-full md:w-44"
                    />
                    <ComboboxContent>
                      <ComboboxEmpty>No type found.</ComboboxEmpty>
                      <ComboboxList>
                        <ComboboxItem value="all">All types</ComboboxItem>
                        <ComboboxItem value="pdf">PDF</ComboboxItem>
                        <ComboboxItem value="doc">DOC</ComboboxItem>
                        <ComboboxItem value="docx">DOCX</ComboboxItem>
                        <ComboboxItem value="txt">TXT</ComboboxItem>
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>

                  <Combobox
                    value={selectedStatus}
                    onValueChange={(value) => {
                      setSelectedStatus(value as "all" | DocumentStatus);
                      setCurrentPage(1);
                    }}
                  >
                    <ComboboxInput
                      placeholder="All status"
                      className="w-full md:w-44"
                    />
                    <ComboboxContent>
                      <ComboboxEmpty>No status found.</ComboboxEmpty>
                      <ComboboxList>
                        <ComboboxItem value="all">All status</ComboboxItem>
                        <ComboboxItem value="active">Active</ComboboxItem>
                        <ComboboxItem value="inactive">Inactive</ComboboxItem>
                        <ComboboxItem value="processing">
                          Processing
                        </ComboboxItem>
                        <ComboboxItem value="error">Error</ComboboxItem>
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                </div>

                <div>
                  <input
                    ref={inputFileRef}
                    type="file"
                    className="hidden"
                    multiple
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={(e) => {
                      handleUploadFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    className="h-9 rounded-full bg-lime-500 px-4 text-white hover:bg-lime-600"
                    onClick={handleChooseLocalFile}
                  >
                    <Upload className="mr-1 h-4 w-4" />
                    Upload New Document
                  </Button>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-3 text-xs text-slate-400">
                      DOCUMENT NAME
                    </TableHead>
                    <TableHead className="px-3 text-xs text-slate-400">
                      UPLOADED BY
                    </TableHead>
                    <TableHead className="px-3 text-xs text-slate-400">
                      UPLOADED DATE
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
                  {paginatedDocs.length > 0 ? (
                    paginatedDocs.map((doc) => {
                      const actions = getActionItems(doc);
                      return (
                        <TableRow key={doc.id}>
                          <TableCell className="px-3 py-3">
                            <div className="flex items-center gap-3">
                              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                <FileText className="h-4 w-4" />
                              </span>
                              <div>
                                <p className="text-sm font-semibold text-slate-800">
                                  {doc.title}
                                </p>
                                <p className="text-xs uppercase tracking-wide text-slate-400">
                                  {doc.fileType}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="px-3 text-sm text-slate-600">
                            {doc.uploadedBy}
                          </TableCell>
                          <TableCell className="px-3 text-sm text-slate-500">
                            {doc.createdAt}
                          </TableCell>
                          <TableCell className="px-3">
                            <Badge
                              variant="outline"
                              className={`h-5 rounded-full border px-2 text-[10px] font-medium ${getStatusClassName(doc.status)}`}
                            >
                              {getStatusLabel(doc.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-3">
                            <div className="relative inline-flex items-center gap-2">
                              <button
                                type="button"
                                className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100"
                                onClick={() => {
                                  setOpenActionFor((prev) =>
                                    prev === doc.id ? null : doc.id,
                                  );
                                }}
                              >
                                <Ellipsis className="h-4 w-4" />
                              </button>

                              {openActionFor === doc.id ? (
                                <ActionCard
                                  actions={actions}
                                  onClickOutside={() => setOpenActionFor(null)}
                                />
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="px-3 py-10 text-center text-sm text-slate-500"
                      >
                        No documents found with your current filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              <div className="flex flex-col gap-3 border-t border-slate-200 px-3 py-2 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                <p>
                  Showing {paginatedDocs.length} of {filteredDocs.length}{" "}
                  documents
                </p>

                {totalPages > 1 ? (
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
                            if (currentSafePage > 1)
                              setCurrentPage(currentSafePage - 1);
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
                            if (currentSafePage < totalPages)
                              setCurrentPage(currentSafePage + 1);
                          }}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 p-5">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-500">
                  <Ban className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Restricted Words Manager
                  </h3>
                  <p className="text-sm text-slate-500">
                    Manage words blocked from AI-generated responses
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className="rounded-full border-red-200 bg-red-50 px-3 py-1 text-sm text-red-500"
              >
                {blacklistWords.length} words
              </Badge>
            </div>

            <div className="p-5">
              <div className="mb-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchWord}
                    onChange={(e) => setSearchWord(e.target.value)}
                    placeholder="Search restricted words..."
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:ring-2 focus:ring-red-100"
                  />
                </div>

                <input
                  type="text"
                  value={newWord}
                  onChange={(e) => setNewWord(e.target.value)}
                  placeholder="Type a new word to blacklist..."
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:ring-2 focus:ring-red-100"
                />

                <Button
                  type="button"
                  className="h-10 rounded-lg bg-red-300 px-5 text-white hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={addBlacklistWord}
                  disabled={
                    !newWord.trim() ||
                    blacklistWords.includes(newWord.trim().toLowerCase())
                  }
                >
                  + Add Word
                </Button>
              </div>

              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                All Restricted Words
              </p>

              <div className="flex flex-wrap gap-2">
                {filteredWords.length > 0 ? (
                  filteredWords.map((word) => (
                    <span
                      key={word}
                      className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-sm font-medium text-red-500"
                    >
                      <Ban className="h-3.5 w-3.5" />
                      {word}
                      <button
                        type="button"
                        className="rounded p-0.5 text-red-300 transition hover:bg-red-100 hover:text-red-500"
                        onClick={() => removeBlacklistWord(word)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    No matching restricted words found.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <DocumentPreviewModal
          document={previewDoc}
          isOpen={isPreviewOpen}
          onClose={() => {
            setIsPreviewOpen(false);
            setPreviewDoc(null);
          }}
        />
      </div>
    </div>
  );
}
