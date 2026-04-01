import { Input } from "@repo/ui/components/ui/input";
import { Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { DoctorCard } from "../components/doctor-card";
import { ProfileModal } from "@repo/ui/components/complex-modal/ProfileModal";
import { RequestModal } from "../components/request-modal";

export const doctorSpecialty = [
  { id: "general_practitioner", name: "General Practitioner" },
  { id: "internal_medicine", name: "Internal Medicine" },
  { id: "cardiology", name: "Cardiology" },
  { id: "dermatology", name: "Dermatology" },
  { id: "neurology", name: "Neurology" },
  { id: "orthopedics", name: "Orthopedics" },
  { id: "pediatrics", name: "Pediatrics" },
  { id: "obstetrics_gynecology", name: "Obstetrics & Gynecology" },
  { id: "ophthalmology", name: "Ophthalmology" },
  { id: "ent", name: "Ear, Nose, and Throat (ENT)" },
  { id: "psychiatry", name: "Psychiatry" },
  { id: "radiology", name: "Radiology" },
  { id: "anesthesiology", name: "Anesthesiology" },
  { id: "emergency_medicine", name: "Emergency Medicine" },
  { id: "family_medicine", name: "Family Medicine" },
  { id: "endocrinology", name: "Endocrinology" },
  { id: "gastroenterology", name: "Gastroenterology" },
  { id: "hematology", name: "Hematology" },
  { id: "nephrology", name: "Nephrology" },
  { id: "oncology", name: "Oncology" },
  { id: "pulmonology", name: "Pulmonology" },
  { id: "urology", name: "Urology" },
  { id: "rheumatology", name: "Rheumatology" },
  { id: "infectious_disease", name: "Infectious Disease" },
  { id: "plastic_surgery", name: "Plastic Surgery" },
  { id: "general_surgery", name: "General Surgery" },
  { id: "neurosurgery", name: "Neurosurgery" },
  { id: "cardiothoracic_surgery", name: "Cardiothoracic Surgery" },
  { id: "rehabilitation", name: "Physical Medicine & Rehabilitation" },
  { id: "sports_medicine", name: "Sports Medicine" },
  { id: "allergy_immunology", name: "Allergy & Immunology" },
  { id: "geriatrics", name: "Geriatrics" },
  { id: "preventive_medicine", name: "Preventive Medicine" },
];

type DoctorItem = {
  id: string;
  fullName: string;
  yearsOfExperience: number;
  isOnline: boolean;
  avatarUrl?: string;
  specialty: string;
  specialtyId: string;
  workplace: string;
  averageRating: string;
  totalReview: number;
};

const MOCK_DOCTOR_DATA: DoctorItem[] = [
  {
    id: "doc-001",
    fullName: "Sarah Chen",
    yearsOfExperience: 8,
    isOnline: true,
    avatarUrl:
      "https://images.unsplash.com/photo-1594824475317-1f0c1f4d2f57?auto=format&fit=crop&w=240&q=80",
    specialty: "Cosmetic Dermatology",
    specialtyId: "dermatology",
    workplace: "City Skin Clinic",
    averageRating: "4.9",
    totalReview: 204,
  },
  {
    id: "doc-002",
    fullName: "Aisha Roberts",
    yearsOfExperience: 10,
    isOnline: true,
    avatarUrl:
      "https://images.unsplash.com/photo-1607746882042-944635dfe10e?auto=format&fit=crop&w=240&q=80",
    specialty: "General Pediatrics",
    specialtyId: "pediatrics",
    workplace: "Children Wellness Clinic",
    averageRating: "4.9",
    totalReview: 317,
  },
  {
    id: "doc-003",
    fullName: "Marcus Lee",
    yearsOfExperience: 12,
    isOnline: true,
    avatarUrl:
      "https://images.unsplash.com/photo-1612349316228-5942a9b489c2?auto=format&fit=crop&w=240&q=80",
    specialty: "Interventional Cardiology",
    specialtyId: "cardiology",
    workplace: "Boston Medical Center",
    averageRating: "4.8",
    totalReview: 120,
  },
  {
    id: "doc-004",
    fullName: "Emily Watson",
    yearsOfExperience: 9,
    isOnline: true,
    avatarUrl:
      "https://images.unsplash.com/photo-1651008376553-1f8f88ff4f59?auto=format&fit=crop&w=240&q=80",
    specialty: "Diabetes & Thyroid",
    specialtyId: "endocrinology",
    workplace: "Horizon Medical Group",
    averageRating: "4.8",
    totalReview: 156,
  },
  {
    id: "doc-005",
    fullName: "James Park",
    yearsOfExperience: 15,
    isOnline: false,
    avatarUrl:
      "https://images.unsplash.com/photo-1582750433449-648ed127bb54?auto=format&fit=crop&w=240&q=80",
    specialty: "Headache & Migraine",
    specialtyId: "neurology",
    workplace: "NeuroHealth Institute",
    averageRating: "4.7",
    totalReview: 95,
  },
  {
    id: "doc-006",
    fullName: "Priya Sharma",
    yearsOfExperience: 11,
    isOnline: true,
    avatarUrl:
      "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=240&q=80",
    specialty: "Respiratory Medicine",
    specialtyId: "pulmonology",
    workplace: "Breathe Wellness Clinic",
    averageRating: "4.7",
    totalReview: 98,
  },
  {
    id: "doc-007",
    fullName: "Robert Nguyen",
    yearsOfExperience: 18,
    isOnline: false,
    avatarUrl:
      "https://images.unsplash.com/photo-1612276529731-4b21494e6d71?auto=format&fit=crop&w=240&q=80",
    specialty: "Sports Medicine",
    specialtyId: "sports_medicine",
    workplace: "ActiveCare Sports Center",
    averageRating: "4.6",
    totalReview: 74,
  },
  {
    id: "doc-008",
    fullName: "David Kim",
    yearsOfExperience: 14,
    isOnline: false,
    avatarUrl:
      "https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&w=240&q=80",
    specialty: "Digestive Health",
    specialtyId: "gastroenterology",
    workplace: "GastroHealth Partners",
    averageRating: "4.5",
    totalReview: 81,
  },
];

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

  const handleSendRequest = (patientNote: string) => {
    // TODO: call API create consultation request with selectedRequestDoctorId and patientNote
    console.log("Send request", { selectedRequestDoctorId, patientNote });
    handleCloseRequestModal();
  };

  const selectedRequestDoctor = MOCK_DOCTOR_DATA.find(
    (doctor) => doctor.id === selectedRequestDoctorId,
  );

  const filteredDoctors = useMemo(() => {
    const normalizedQuery = searchTerm.trim().toLowerCase();

    const filtered = MOCK_DOCTOR_DATA.filter((doctor) => {
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
  }, [onlineOnly, searchTerm, sortBy, specialtyFilter]);

  const onlineCount = filteredDoctors.filter(
    (doctor) => doctor.isOnline,
  ).length;

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
                  onViewProfile={handleOpenViewProfile}
                  onRequest={handleOpenRequestModal}
                />
              </li>
            ))}
          </ul>

          {filteredDoctors.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              No doctors matched your search criteria.
            </div>
          ) : null}
        </div>
      </div>
      <ProfileModal
        id={selectedDoctorId}
        isOpen={isProfileOpen}
        onClose={handleCloseViewProfile}
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
