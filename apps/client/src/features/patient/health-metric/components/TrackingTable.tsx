import { Button } from "@repo/ui/components/ui/button";
import { ClipboardList, Ellipsis, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ConfirmationModal } from "@repo/ui/components/complex-modal/ConfirmationModal";
import { showToast } from "@repo/ui/components/ui/toasts";
import {
  ActionCard,
  type ActionCardItem,
} from "@repo/ui/components/ui/action-card";

type TableStatus = "normal" | "high" | "low";

type MetricReading = {
  id: string;
  recordedAt: string;
  primaryValue: number;
  secondaryValue?: number;
  status: TableStatus;
};

type TrackingTableProps = {
  metricTitle: string;
  metricType: string;
  selectedDate: Date;
  today: Date;
  unit: string;
  entries: MetricReading[];
  hasData: boolean;
};

const statusStyles: Record<TableStatus, string> = {
  normal: "border-emerald-200 bg-emerald-50 text-emerald-600",
  high: "border-rose-200 bg-rose-50 text-rose-600",
  low: "border-amber-200 bg-amber-50 text-amber-600",
};

const dateKey = (date: Date) =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;

export function TrackingTable({
  metricTitle,
  metricType,
  selectedDate,
  today,
  unit,
  entries,
  hasData,
}: TrackingTableProps) {
  const now = new Date();
  const timeStringLocale = `${`${now.getHours()}`.padStart(2, "0")}:${`${now.getMinutes()}`.padStart(2, "0")}`;

  const isPastDate = dateKey(selectedDate) < dateKey(today);
  const isToday = dateKey(selectedDate) === dateKey(today);
  const [isAdding, setIsAdding] = useState(false);
  const [valueInput, setValueInput] = useState("");
  const [secondaryValueInput, setSecondaryValueInput] = useState("");
  const [timeInput, setTimeInput] = useState(timeStringLocale);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editValueInput, setEditValueInput] = useState("");
  const [editSecondaryValueInput, setEditSecondaryValueInput] = useState("");
  const [editTimeInput, setEditTimeInput] = useState(timeStringLocale);
  const [isConfirmationModalOpen, setConfirmationModalOpen] = useState(false);
  const [pendingDeleteEntryId, setPendingDeleteEntryId] = useState<
    string | null
  >(null);
  const [showActionsForEntryId, setShowActionsForEntryId] = useState<
    string | null
  >(null);

  const getActionItems = (entry: MetricReading): ActionCardItem[] => {
    return [
      {
        id: `edit-${entry.id}`,
        title: "Edit",
        icon: <Pencil className="h-4 w-4" />,
        onHandle: () => {
          startEditEntry(entry);
          setShowActionsForEntryId(null);
        },
      },
      {
        id: `delete-${entry.id}`,
        title: "Delete",
        icon: <Trash2 className="h-4 w-4" />,
        iconColor: "text-red-600",
        onHandle: () => {
          openDeleteConfirmation(entry.id);
          setShowActionsForEntryId(null);
        },
      },
    ];
  };

  const handleDeleteEntry = () => {
    if (!pendingDeleteEntryId) {
      showToast.error("Cannot find entry!");
      return;
    }

    deleteEntry(pendingDeleteEntryId);
    setPendingDeleteEntryId(null);
    setConfirmationModalOpen(false);
  };

  const [localEntries, setLocalEntries] = useState<MetricReading[]>(entries);

  useEffect(() => {
    setLocalEntries(entries);
    setIsAdding(false);
    setValueInput("");
    setSecondaryValueInput("");
    setTimeInput(timeStringLocale);
    setEditingEntryId(null);
    setEditValueInput("");
    setEditSecondaryValueInput("");
    setEditTimeInput(timeStringLocale);
    setPendingDeleteEntryId(null);
    setConfirmationModalOpen(false);
    setShowActionsForEntryId(null);
  }, [entries, selectedDate]);

  const displayEntries = useMemo(
    () =>
      [...localEntries].sort(
        (a, b) =>
          new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
      ),
    [localEntries],
  );

  const canSubmit = useMemo(() => {
    if (metricType === "blood_pressure") {
      return valueInput.trim() !== "" && secondaryValueInput.trim() !== "";
    }
    return valueInput.trim() !== "";
  }, [metricType, secondaryValueInput, valueInput]);

  const canSubmitEdit = useMemo(() => {
    if (metricType === "blood_pressure") {
      return (
        editValueInput.trim() !== "" && editSecondaryValueInput.trim() !== ""
      );
    }
    return editValueInput.trim() !== "";
  }, [editSecondaryValueInput, editValueInput, metricType]);

  const toInputTime = (isoDate: string) => {
    const date = new Date(isoDate);
    return `${`${date.getHours()}`.padStart(2, "0")}:${`${date.getMinutes()}`.padStart(2, "0")}`;
  };

  const resetForm = () => {
    setValueInput("");
    setSecondaryValueInput("");
    setTimeInput(timeStringLocale);
  };

  const resetEditForm = () => {
    setEditingEntryId(null);
    setEditValueInput("");
    setEditSecondaryValueInput("");
    setEditTimeInput(timeStringLocale);
  };

  const addEntry = () => {
    if (!canSubmit) {
      return;
    }

    const [hour, minute] = timeInput.split(":").map(Number);
    const recordedDate = new Date(selectedDate);
    recordedDate.setHours(hour || 0, minute || 0, 0, 0);

    const primaryValue = Number(valueInput);
    const secondaryValue =
      metricType === "blood_pressure" ? Number(secondaryValueInput) : undefined;

    const nextEntry: MetricReading = {
      id: `temp-${Date.now()}`,
      recordedAt: recordedDate.toISOString(),
      primaryValue,
      secondaryValue,
      status: "normal",
    };

    setLocalEntries((prev) => [nextEntry, ...prev]);
    resetForm();
    setIsAdding(false);
  };

  const startEditEntry = (entry: MetricReading) => {
    setEditingEntryId(entry.id);
    setEditValueInput(`${entry.primaryValue}`);
    setEditSecondaryValueInput(
      typeof entry.secondaryValue === "number" ? `${entry.secondaryValue}` : "",
    );
    setEditTimeInput(toInputTime(entry.recordedAt));
  };

  const saveEditEntry = (entry: MetricReading) => {
    if (!canSubmitEdit) {
      return;
    }

    const [hour, minute] = editTimeInput.split(":").map(Number);
    const recordedDate = new Date(selectedDate);
    recordedDate.setHours(hour || 0, minute || 0, 0, 0);

    const nextPrimaryValue = Number(editValueInput);
    const nextSecondaryValue =
      metricType === "blood_pressure"
        ? Number(editSecondaryValueInput)
        : undefined;

    setLocalEntries((prev) =>
      prev.map((item) =>
        item.id === entry.id
          ? {
              ...item,
              recordedAt: recordedDate.toISOString(),
              primaryValue: nextPrimaryValue,
              secondaryValue: nextSecondaryValue,
            }
          : item,
      ),
    );

    resetEditForm();
  };

  const deleteEntry = (entryId: string) => {
    setLocalEntries((prev) => prev.filter((item) => item.id !== entryId));

    if (editingEntryId === entryId) {
      resetEditForm();
    }
  };

  const openDeleteConfirmation = (entryId: string) => {
    setPendingDeleteEntryId(entryId);
    setConfirmationModalOpen(true);
  };

  if (!hasData) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="text-xl font-semibold text-slate-800">
            Records for Today
          </h3>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-400">
            0 entries
          </span>
        </div>

        <div className="flex h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-300">
            <ClipboardList className="h-7 w-7" />
          </div>
          <p className="text-lg font-semibold text-slate-500">
            0 entries found
          </p>
          <p className="mt-1 max-w-md text-sm text-slate-400">
            Complete the form to add your first{" "}
            {metricType.replaceAll("_", " ")} record.
          </p>
          <Button className="mt-5 rounded-xl bg-lime-400 px-6 text-slate-900 hover:bg-lime-500">
            <Plus className="mr-1 h-4 w-4" />
            Start Tracking
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-xl font-semibold text-slate-800">
              Records for{" "}
              {selectedDate.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
              })}
              {isToday ? " (Today)" : ""}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {displayEntries.length}{" "}
              {displayEntries.length === 1 ? "entry" : "entries"} found for this
              date
            </p>
          </div>

          {!isPastDate && (
            <Button
              className="rounded-xl bg-lime-400 text-slate-900 hover:bg-lime-500"
              onClick={() => setIsAdding((prev) => !prev)}
            >
              <Plus className="mr-1 h-4 w-4" />
              {isAdding ? "Hide Form" : "Add Entry"}
            </Button>
          )}
        </div>

        {!isPastDate && isAdding && (
          <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Add New Record
            </p>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="md:col-span-1">
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  {metricType === "blood_pressure" ? "Systolic" : "Value"}
                </label>
                <input
                  type="number"
                  value={valueInput}
                  onChange={(event) => setValueInput(event.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-lime-400"
                  placeholder="Enter value"
                />
              </div>

              {metricType === "blood_pressure" && (
                <div className="md:col-span-1">
                  <label className="mb-1 block text-xs font-medium text-slate-500">
                    Diastolic
                  </label>
                  <input
                    type="number"
                    value={secondaryValueInput}
                    onChange={(event) =>
                      setSecondaryValueInput(event.target.value)
                    }
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-lime-400"
                    placeholder="Enter value"
                  />
                </div>
              )}

              <div className="md:col-span-1">
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Time
                </label>
                <input
                  type="time"
                  value={timeInput}
                  onChange={(event) => setTimeInput(event.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-lime-400"
                />
              </div>

              <div className="flex items-end justify-end gap-2 md:col-span-1">
                <Button
                  variant="outline"
                  className="h-10"
                  onClick={() => {
                    resetForm();
                    setIsAdding(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="h-10 rounded-lg bg-lime-500 text-slate-900 hover:bg-lime-600"
                  onClick={addEntry}
                  disabled={!canSubmit}
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        )}

        {displayEntries.length === 0 ? (
          <div className="flex h-[180px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center">
            <div>
              <p className="text-base font-semibold text-slate-500">
                No records for this date
              </p>
              <p className="mt-1 text-sm text-slate-400">
                {isPastDate
                  ? "Select another date to review available records."
                  : "Click Add Entry to record your latest metric."}
              </p>
            </div>
          </div>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-slate-100">
            {displayEntries.map((entry, index) => (
              <li
                key={entry.id}
                className={`flex items-center justify-between gap-3 bg-white px-4 py-3 ${
                  index > 0 ? "border-t border-slate-100" : ""
                }`}
              >
                {editingEntryId === entry.id ? (
                  <div className="w-full">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                      <div className="md:col-span-1">
                        <label className="mb-1 block text-xs font-medium text-slate-500">
                          {metricType === "blood_pressure"
                            ? "Systolic"
                            : "Value"}
                        </label>
                        <input
                          type="number"
                          value={editValueInput}
                          onChange={(event) =>
                            setEditValueInput(event.target.value)
                          }
                          className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-lime-400"
                          placeholder="Enter value"
                        />
                      </div>

                      {metricType === "blood_pressure" && (
                        <div className="md:col-span-1">
                          <label className="mb-1 block text-xs font-medium text-slate-500">
                            Diastolic
                          </label>
                          <input
                            type="number"
                            value={editSecondaryValueInput}
                            onChange={(event) =>
                              setEditSecondaryValueInput(event.target.value)
                            }
                            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-lime-400"
                            placeholder="Enter value"
                          />
                        </div>
                      )}

                      <div className="md:col-span-1">
                        <label className="mb-1 block text-xs font-medium text-slate-500">
                          Time
                        </label>
                        <input
                          type="time"
                          value={editTimeInput}
                          onChange={(event) =>
                            setEditTimeInput(event.target.value)
                          }
                          className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-lime-400"
                        />
                      </div>

                      <div className="flex items-end justify-end gap-4 md:col-span-1">
                        <Button
                          variant="outline"
                          className="h-10"
                          onClick={resetEditForm}
                        >
                          Cancel
                        </Button>
                        <Button
                          className="h-10 flex-1 rounded-lg bg-lime-500 text-slate-900 hover:bg-lime-600"
                          onClick={() => saveEditEntry(entry)}
                          disabled={!canSubmitEdit}
                        >
                          Update
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex w-full items-center gap-4">
                    <p className="w-24 shrink-0 text-sm text-slate-400">
                      {new Date(entry.recordedAt).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      })}
                    </p>

                    <p className="min-w-0 flex-1 text-base font-semibold text-slate-800">
                      {metricType === "blood_pressure"
                        ? `${entry.primaryValue}/${entry.secondaryValue ?? "-"}`
                        : entry.primaryValue}
                      <span className="ml-1 text-sm font-medium text-slate-400">
                        {unit}
                      </span>
                    </p>

                    <span
                      className={`min-w-20 rounded-full border px-2.5 py-1 text-center text-xs font-semibold uppercase tracking-wide ${
                        statusStyles[entry.status]
                      }`}
                    >
                      {entry.status}
                    </span>

                    <div className="relative shrink-0">
                      <button
                        type="button"
                        className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100"
                        onClick={() =>
                          setShowActionsForEntryId(
                            showActionsForEntryId === entry.id
                              ? null
                              : entry.id,
                          )
                        }
                      >
                        <Ellipsis className="h-4 w-4" />
                      </button>
                      {showActionsForEntryId === entry.id && (
                        <ActionCard actions={getActionItems(entry)} />
                      )}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <ConfirmationModal
        isOpen={isConfirmationModalOpen}
        onClose={() => {
          setPendingDeleteEntryId(null);
          setConfirmationModalOpen(false);
        }}
        onConfirm={handleDeleteEntry}
      />
    </>
  );
}
