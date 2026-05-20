import { Input } from "@repo/ui/components/ui/input";
import { Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { DoctorCard } from "../components/doctor-card";
import { ProfileModal } from "@repo/ui/components/complex-modal/ProfileModal";
import { RequestModal } from "../components/request-modal";
import { useMyDoctor } from "../hooks/useMyDoctor";
import { useViewProfile } from "@/features/shared/hooks/useProfile";
import { doctorSpecialty } from "../services/my-doctor.service";
import { useAuthStore } from "@repo/ui/store/useAuthStore";

export function MyDoctors() {
  const [searchTerm, setSearchTerm] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"highest-rated" | "most-reviewed">(
    "highest-rated",
  );
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [isProfileOpen, setProfileOpen] = useState(false);
  const [isRequestModalOpen, setRequestModalOpen] = useState(false);
  const [selectedRequestDoctorId, setSelectedRequestDoctorId] =
    useState<string>("");

  const {
    data: doctors,
    isLoading,
    isRequesting,
    error,
    requestSession,
    requestedDoctorIds,
  } = useMyDoctor();

  const { data: profileData } = useViewProfile(selectedDoctorId, isProfileOpen);

  const me = useAuthStore();
  const currentViewer =
    me.user?.id && me.user?.name && me.user?.role
      ? {
          id: me.user.id,
          name: me.user.name,
          role: me.user.role,
        }
      : undefined;

  const handleOpenViewProfile = (id: string) => {
    if (!id) {
      setProfileOpen(false);
      setSelectedDoctorId("");
      return;
    }
    setProfileOpen(true);
    setSelectedDoctorId(id);
  };

  const handleCloseViewProfile = () => {
    setProfileOpen(false);
    setSelectedDoctorId("");
  };

  const handleOpenRequestModal = (id: string) => {
    setSelectedRequestDoctorId(id);
    setRequestModalOpen(true);
  };

  const handleCloseRequestModal = () => {
    setRequestModalOpen(false);
    setSelectedRequestDoctorId("");
  };

  const handleSendRequest = async (patientNote: string) => {
    if (!selectedRequestDoctorId) {
      return;
    }

    await requestSession(selectedRequestDoctorId, patientNote);

    handleCloseRequestModal();
  };

  const selectedRequestDoctor = doctors.find(
    (doctor) => doctor.id === selectedRequestDoctorId,
  );

  const selectedDoctor = doctors.find(
    (doctor) => doctor.id === selectedDoctorId,
  );

  const filteredDoctors = useMemo(() => {
    const normalizedQuery = searchTerm.trim().toLowerCase();

    const filtered = doctors.filter((doctor) => {
      const matchSearch =
        normalizedQuery.length === 0 ||
        doctor.fullName.toLowerCase().includes(normalizedQuery) ||
        doctor.specialty.toLowerCase().includes(normalizedQuery) ||
        doctor.workplace.toLowerCase().includes(normalizedQuery);

      const matchSpecialty =
        specialtyFilter === "all" || doctor.specialtyId === specialtyFilter;

      const matchOnline = !onlineOnly || doctor.isOnline;

      return matchSearch && matchSpecialty && matchOnline;
    });

    return filtered.sort((a, b) => {
      if (sortBy === "most-reviewed") {
        return b.totalReview - a.totalReview;
      }

      return (
        Number.parseFloat(b.averageRating) - Number.parseFloat(a.averageRating)
      );
    });
  }, [doctors, onlineOnly, searchTerm, sortBy, specialtyFilter]);

  const onlineCount = filteredDoctors.filter(
    (doctor) => doctor.isOnline,
  ).length;

  const requestedDoctorSet = useMemo(
    () => new Set(Array.from(requestedDoctorIds || [])),
    [requestedDoctorIds],
  );

  const profileSeed = profileData
    ? profileData
    : selectedDoctor
      ? {
          id: selectedDoctor.id,
          full_name: selectedDoctor.fullName,
          role: "doctor" as const,
          avatar_url: selectedDoctor.avatarUrl,
          role_specific: {
            specialty: selectedDoctor.specialty,
            workplace: selectedDoctor.workplace,
            experience_years: selectedDoctor.yearsOfExperience,
          },
        }
      : undefined;

  return (
    <>
      <div className="w-full bg-slate-100/70 p-6">
        <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-col gap-1">
            <h1 className="text-3xl font-semibold text-slate-900">
              My Doctors
            </h1>
            <p className="text-sm text-slate-500">
              Find and connect with verified healthcare specialists
            </p>
            {isLoading && (
              <p className="text-xs text-slate-500">Loading doctors...</p>
            )}
            {isRequesting && !isLoading && (
              <p className="text-xs text-slate-500">
                Sending consultation request...
              </p>
            )}
            {error && <p className="text-xs text-rose-600">{error}</p>}
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(280px,1fr)_220px_220px_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name..."
                className="h-11 rounded-xl border-slate-200 bg-slate-50 pl-10 text-sm"
              />
            </label>

            <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
              <SlidersHorizontal className="h-4 w-4 text-slate-400" />
              <span className="text-slate-500">Specialty:</span>
              <select
                value={specialtyFilter}
                onChange={(event) => setSpecialtyFilter(event.target.value)}
                className="h-10 flex-1 bg-transparent font-medium text-slate-800 outline-none"
              >
                <option value="all">All</option>
                {doctorSpecialty.map((specialty) => (
                  <option key={specialty.id} value={specialty.id}>
                    {specialty.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
              <span className="text-slate-500">Sort:</span>
              <select
                value={sortBy}
                onChange={(event) =>
                  setSortBy(
                    event.target.value as "highest-rated" | "most-reviewed",
                  )
                }
                className="h-10 flex-1 bg-transparent font-medium text-slate-800 outline-none"
              >
                <option value="highest-rated">Highest Rated</option>
                <option value="most-reviewed">Most Reviewed</option>
              </select>
            </label>

            <button
              type="button"
              onClick={() => setOnlineOnly((prev) => !prev)}
              className={`inline-flex h-11 items-center justify-center rounded-xl border px-4 text-sm font-medium transition-colors ${
                onlineOnly
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-slate-50 text-slate-600"
              }`}
            >
              {onlineOnly ? "Online Only: On" : "Online Only"}
            </button>
          </div>

          <div className="mt-5 flex items-center gap-2 text-sm text-slate-500">
            <span>Showing {filteredDoctors.length} doctors</span>
            <span className="text-slate-300">•</span>
            <span className="font-medium text-emerald-600">
              {onlineCount} available now
            </span>
          </div>

          <ul className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filteredDoctors.map((doctor) => (
              <li key={doctor.id}>
                <DoctorCard
                  id={doctor.id}
                  fullName={doctor.fullName}
                  yearsOfExperience={doctor.yearsOfExperience}
                  isOnline={doctor.isOnline}
                  avatarUrl={doctor.avatarUrl}
                  specialty={doctor.specialty}
                  workplace={doctor.workplace}
                  averageRating={doctor.averageRating}
                  totalReview={doctor.totalReview}
                  isRequested={requestedDoctorSet.has(doctor.id)}
                  onViewProfile={handleOpenViewProfile}
                  onRequest={handleOpenRequestModal}
                />
              </li>
            ))}
          </ul>

          {filteredDoctors.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              {isLoading
                ? "Loading doctors..."
                : "No doctors matched your search criteria."}
            </div>
          ) : null}
        </div>
      </div>
      <ProfileModal
        id={selectedDoctorId}
        isOpen={isProfileOpen}
        onClose={handleCloseViewProfile}
        profileSeed={profileSeed}
        reportViewer={currentViewer}
      />

      <RequestModal
        isOpen={isRequestModalOpen}
        name={selectedRequestDoctor?.fullName ?? ""}
        specialty={selectedRequestDoctor?.specialty ?? ""}
        avatarUrl={selectedRequestDoctor?.avatarUrl}
        isOnline={selectedRequestDoctor?.isOnline}
        patientNote={""}
        onClose={handleCloseRequestModal}
        onSendRequest={handleSendRequest}
      />
    </>
  );
}
