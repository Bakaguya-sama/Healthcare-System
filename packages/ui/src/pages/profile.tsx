import { useMemo, useRef, useState } from "react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Field,
  FieldControl,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "../components/ui/field";
import { Input } from "../components/ui/input";
import {
  Camera,
  FileText,
  Pencil,
  Plus,
  ShieldUser,
  Stethoscope,
  UserRound,
} from "lucide-react";

type UserRole = "admin" | "patient" | "doctor";

type VerificationDoc = {
  id: string;
  name: string;
  uploadedAt: string;
  fileUrl: string;
};

type ProfileProps = {
  role?: UserRole;
  onSave?: (payload: {
    role: UserRole;
    values: ProfileFormValues;
    avatarUrl: string;
    verificationDocs: VerificationDoc[];
  }) => Promise<void> | void;
};

type ProfileFormValues = {
  fullName: string;
  email: string;
  phone: string;
  gender: string;
  street: string;
  ward: string;
  district: string;
  city: string;
  adminAssignedRole: string;
  yearsOfExperience: string;
  specialty: string;
  workplace: string;
};

const ROLE_META: Record<
  UserRole,
  { label: string; icon: React.ReactNode; badgeClassName: string }
> = {
  admin: {
    label: "Admin",
    icon: <ShieldUser className="h-4 w-4" />,
    badgeClassName: "bg-violet-50 text-violet-600 border-violet-200",
  },
  doctor: {
    label: "Doctor",
    icon: <Stethoscope className="h-4 w-4" />,
    badgeClassName: "bg-blue-50 text-blue-600 border-blue-200",
  },
  patient: {
    label: "Patient",
    icon: <UserRound className="h-4 w-4" />,
    badgeClassName: "bg-emerald-50 text-emerald-600 border-emerald-200",
  },
};

function initialsFromName(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="border-t border-slate-100 pt-6 first:border-t-0 first:pt-0">
      <p className="text-base font-semibold text-slate-900">{title}</p>
      <p className="text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}

function AdminRoleSection({ assignedRole }: { assignedRole: string }) {
  return (
    <>
      <SectionTitle title="System role" />
      <div className="rounded-xl border border-violet-100 bg-violet-50/50 ">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 p-2">
          Assigned Admin Role
        </p>
        <div className="rounded-xl border border-violet-200 bg-white px-4 py-3">
          <p className="mt-1 text-sm font-semibold text-violet-700">
            {assignedRole}
          </p>
        </div>
      </div>
    </>
  );
}

function DoctorRoleSection({
  values,
  verificationDocs,
  onFieldChange,
  onAddDocs,
  onReplaceDoc,
}: {
  values: ProfileFormValues;
  verificationDocs: VerificationDoc[];
  onFieldChange: <K extends keyof ProfileFormValues>(
    key: K,
    value: ProfileFormValues[K],
  ) => void;
  onAddDocs: (files: FileList | null) => void;
  onReplaceDoc: (docId: string, file: File | null) => void;
}) {
  return (
    <div className="space-y-4">
      <SectionTitle title="Professional Information" />

      <FieldGroup className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field className="gap-1.5">
          <FieldLabel
            htmlFor="yoe"
            className="text-xs uppercase tracking-wide text-slate-500"
          >
            YEAR OF EXPERIENCE
          </FieldLabel>
          <FieldControl>
            <Input
              id="yoe"
              value={values.yearsOfExperience}
              onChange={(e) =>
                onFieldChange("yearsOfExperience", e.target.value)
              }
              className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:border-0 focus-visible:ring-0"
            />
          </FieldControl>
        </Field>

        <Field className="gap-1.5">
          <FieldLabel
            htmlFor="specialty"
            className="text-xs uppercase tracking-wide text-slate-500"
          >
            Specialty
          </FieldLabel>
          <FieldControl>
            <Input
              id="specialty"
              value={values.specialty}
              onChange={(e) => onFieldChange("specialty", e.target.value)}
              className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:border-0 focus-visible:ring-0"
            />
          </FieldControl>
        </Field>

        <Field className="gap-1.5">
          <FieldLabel
            htmlFor="workplace"
            className="text-xs uppercase tracking-wide text-slate-500"
          >
            Workplace
          </FieldLabel>
          <FieldControl>
            <Input
              id="workplace"
              value={values.workplace}
              onChange={(e) => onFieldChange("workplace", e.target.value)}
              className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:border-0 focus-visible:ring-0"
            />
          </FieldControl>
        </Field>
      </FieldGroup>

      <div className="rounded-xl border border-slate-200 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Verification Documents
            </p>
            <p className="text-xs text-slate-500">
              Upload new files or replace existing verification docs.
            </p>
          </div>

          <label className="inline-flex cursor-pointer items-center rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700">
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add Docs
            <input
              type="file"
              className="hidden"
              multiple
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => {
                onAddDocs(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        <div className="space-y-2">
          {verificationDocs.length > 0 ? (
            verificationDocs.map((doc) => (
              <div
                key={doc.id}
                className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {doc.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      Uploaded {doc.uploadedAt}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    View
                  </a>

                  <label className="inline-flex cursor-pointer items-center rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100">
                    <Pencil className="mr-1 h-3.5 w-3.5" />
                    Replace
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => {
                        onReplaceDoc(doc.id, e.target.files?.[0] ?? null);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">
              No verification documents uploaded yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function Profile({ role = "admin", onSave }: ProfileProps) {
  const [savedAvatarUrl, setSavedAvatarUrl] = useState<string>("");
  const [savedValues, setSavedValues] = useState<ProfileFormValues>({
    fullName: "Alexandra Chen",
    email: "admin@medi.com",
    phone: "+84 912 345 678",
    gender: "Female",
    street: "142 Le Loi Street, Apt 5B",
    ward: "Ben Thanh Ward",
    district: "District 1",
    city: "Ho Chi Minh City",
    adminAssignedRole: "Super Admin",
    yearsOfExperience: "8",
    specialty: "Cardiology",
    workplace: "Central Medical Hospital",
  });
  const [savedVerificationDocs, setSavedVerificationDocs] = useState<
    VerificationDoc[]
  >([
    {
      id: "doc-1",
      name: "Medical_License.pdf",
      uploadedAt: "Mar 3, 2026",
      fileUrl:
        "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    },
    {
      id: "doc-2",
      name: "Specialist_Certificate.jpg",
      uploadedAt: "Mar 8, 2026",
      fileUrl:
        "https://dummyimage.com/1200x800/e2e8f0/475569&text=Doctor+Document",
    },
  ]);

  const [draftAvatarUrl, setDraftAvatarUrl] = useState<string>(savedAvatarUrl);
  const [draftValues, setDraftValues] =
    useState<ProfileFormValues>(savedValues);
  const [draftVerificationDocs, setDraftVerificationDocs] = useState<
    VerificationDoc[]
  >(savedVerificationDocs);
  const [isSaving, setIsSaving] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const roleMeta = ROLE_META[role];
  const avatarInitials = useMemo(
    () => initialsFromName(draftValues.fullName || "User"),
    [draftValues.fullName],
  );

  const isDirty = useMemo(() => {
    return (
      draftAvatarUrl !== savedAvatarUrl ||
      JSON.stringify(draftValues) !== JSON.stringify(savedValues) ||
      JSON.stringify(draftVerificationDocs) !==
        JSON.stringify(savedVerificationDocs)
    );
  }, [
    draftAvatarUrl,
    draftValues,
    draftVerificationDocs,
    savedAvatarUrl,
    savedValues,
    savedVerificationDocs,
  ]);

  const onFieldChange = <K extends keyof ProfileFormValues>(
    key: K,
    value: ProfileFormValues[K],
  ) => {
    setDraftValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleAvatarUpload = (file: File | null) => {
    if (!file) return;
    setDraftAvatarUrl(URL.createObjectURL(file));
  };

  const handleAddVerificationDocs = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const uploadedAt = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const nextDocs = Array.from(files).map((file, index) => ({
      id: `new-doc-${Date.now()}-${index}`,
      name: file.name,
      uploadedAt,
      fileUrl: URL.createObjectURL(file),
    }));

    setDraftVerificationDocs((prev) => [...nextDocs, ...prev]);
  };

  const handleReplaceVerificationDoc = (docId: string, file: File | null) => {
    if (!file) return;

    const uploadedAt = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    setDraftVerificationDocs((prev) =>
      prev.map((doc) =>
        doc.id === docId
          ? {
              ...doc,
              name: file.name,
              uploadedAt,
              fileUrl: URL.createObjectURL(file),
            }
          : doc,
      ),
    );
  };

  const handleDiscardChanges = () => {
    setDraftAvatarUrl(savedAvatarUrl);
    setDraftValues(savedValues);
    setDraftVerificationDocs(savedVerificationDocs);
  };

  const handleSaveChanges = async () => {
    if (!isDirty || isSaving) return;

    setIsSaving(true);
    try {
      await onSave?.({
        role,
        values: draftValues,
        avatarUrl: draftAvatarUrl,
        verificationDocs: draftVerificationDocs,
      });

      setSavedAvatarUrl(draftAvatarUrl);
      setSavedValues(draftValues);
      setSavedVerificationDocs(draftVerificationDocs);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full p-6">
      <div className="mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-3 border-b border-slate-100 pb-6">
          <div className="relative">
            {draftAvatarUrl ? (
              <img
                src={draftAvatarUrl}
                alt="Profile avatar"
                className="h-24 w-24 rounded-full border-2 border-white object-cover shadow-md"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-3xl font-bold text-white shadow-md">
                {avatarInitials || "U"}
              </div>
            )}

            <button
              type="button"
              className="absolute -bottom-1 -right-1 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white bg-slate-900 text-white shadow-sm hover:bg-slate-700"
              onClick={() => avatarInputRef.current?.click()}
            >
              <Camera className="h-4 w-4" />
            </button>

            <input
              ref={avatarInputRef}
              type="file"
              className="hidden"
              accept="image/*"
              onChange={(e) => {
                handleAvatarUpload(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
          </div>

          <Badge
            variant="outline"
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${roleMeta.badgeClassName}`}
          >
            <span className="mr-1 inline-flex">{roleMeta.icon}</span>
            {roleMeta.label}
          </Badge>
        </div>

        <FieldSet className="gap-6">
          <SectionTitle title="Basic Information" />

          <FieldGroup className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field className="gap-1.5 md:col-span-2">
              <FieldLabel
                htmlFor="fullName"
                className="text-xs uppercase tracking-wide text-slate-500"
              >
                Full Name
              </FieldLabel>
              <FieldControl>
                <Input
                  id="fullName"
                  value={draftValues.fullName}
                  onChange={(e) => onFieldChange("fullName", e.target.value)}
                  className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:border-0 focus-visible:ring-0"
                />
              </FieldControl>
            </Field>

            <Field className="gap-1.5 md:col-span-2">
              <FieldLabel
                htmlFor="email"
                className="text-xs uppercase tracking-wide text-slate-500"
              >
                Email Address
              </FieldLabel>
              <FieldControl>
                <Input
                  id="email"
                  disabled
                  readOnly
                  value={draftValues.email}
                  className="h-auto cursor-not-allowed border-0 bg-transparent px-0 py-0 shadow-none focus-visible:border-0 focus-visible:ring-0"
                />
              </FieldControl>
            </Field>

            <Field className="gap-1.5">
              <FieldLabel
                htmlFor="phone"
                className="text-xs uppercase tracking-wide text-slate-500"
              >
                Phone Number
              </FieldLabel>
              <FieldControl>
                <Input
                  id="phone"
                  value={draftValues.phone}
                  onChange={(e) => onFieldChange("phone", e.target.value)}
                  className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:border-0 focus-visible:ring-0"
                />
              </FieldControl>
            </Field>

            <Field className="gap-1.5">
              <FieldLabel
                htmlFor="gender"
                className="text-xs uppercase tracking-wide text-slate-500"
              >
                Gender
              </FieldLabel>
              <FieldControl>
                <select
                  id="gender"
                  value={draftValues.gender}
                  onChange={(e) => onFieldChange("gender", e.target.value)}
                  className="h-auto w-full border-0 bg-transparent px-0 py-0 text-sm text-slate-900 outline-none focus-visible:ring-0"
                >
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                </select>
              </FieldControl>
            </Field>
          </FieldGroup>

          <SectionTitle title="Contact Address" />

          <FieldGroup className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field className="gap-1.5 md:col-span-2">
              <FieldLabel
                htmlFor="street"
                className="text-xs uppercase tracking-wide text-slate-500"
              >
                Street and House Number
              </FieldLabel>
              <FieldControl>
                <Input
                  id="street"
                  value={draftValues.street}
                  onChange={(e) => onFieldChange("street", e.target.value)}
                  className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:border-0 focus-visible:ring-0"
                />
              </FieldControl>
            </Field>

            <Field className="gap-1.5">
              <FieldLabel
                htmlFor="ward"
                className="text-xs uppercase tracking-wide text-slate-500"
              >
                Ward
              </FieldLabel>
              <FieldControl>
                <Input
                  id="ward"
                  value={draftValues.ward}
                  onChange={(e) => onFieldChange("ward", e.target.value)}
                  className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:border-0 focus-visible:ring-0"
                />
              </FieldControl>
            </Field>

            <Field className="gap-1.5">
              <FieldLabel
                htmlFor="district"
                className="text-xs uppercase tracking-wide text-slate-500"
              >
                District
              </FieldLabel>
              <FieldControl>
                <Input
                  id="district"
                  value={draftValues.district}
                  onChange={(e) => onFieldChange("district", e.target.value)}
                  className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:border-0 focus-visible:ring-0"
                />
              </FieldControl>
            </Field>

            <Field className="gap-1.5 md:col-span-2">
              <FieldLabel
                htmlFor="city"
                className="text-xs uppercase tracking-wide text-slate-500"
              >
                City / Province
              </FieldLabel>
              <FieldControl>
                <Input
                  id="city"
                  value={draftValues.city}
                  onChange={(e) => onFieldChange("city", e.target.value)}
                  className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:border-0 focus-visible:ring-0"
                />
              </FieldControl>
            </Field>
          </FieldGroup>

          {role === "admin" ? (
            <AdminRoleSection assignedRole={draftValues.adminAssignedRole} />
          ) : null}

          {role === "doctor" ? (
            <DoctorRoleSection
              values={draftValues}
              verificationDocs={draftVerificationDocs}
              onFieldChange={onFieldChange}
              onAddDocs={handleAddVerificationDocs}
              onReplaceDoc={handleReplaceVerificationDoc}
            />
          ) : null}

          {/* {role === "patient" ? <PatientRoleSection /> : null} */}

          <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-4">
            <Button
              type="button"
              className="rounded-xl px-6 text-white"
              onClick={handleSaveChanges}
              disabled={!isDirty || isSaving}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl px-6"
              onClick={handleDiscardChanges}
              disabled={!isDirty || isSaving}
            >
              Discard
            </Button>
          </div>
        </FieldSet>
      </div>
    </div>
  );
}
