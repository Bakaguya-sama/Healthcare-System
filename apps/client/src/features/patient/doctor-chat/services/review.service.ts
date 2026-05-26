import { api } from "@/lib/api";

export interface Review {
  doctorId: string;
  doctorSessionId: string;
  rating: number;
  comment?: string;
}

export interface ReviewRecord {
  _id?: string;
  id?: string;
  rating?: number;
  rate?: number;
  comment?: string;
}

export interface ReviewUpdatePayload {
  rating: number;
  comment?: string;
}

export async function submitReview(payload: Review) {
  const res = await api.post("/reviews", payload);

  return res.data;
}

export async function getReviewBySession(sessionId: string) {
  const res = await api.get(`/reviews/session/${sessionId}`);
  const data = res.data as
    | ReviewRecord
    | { data?: ReviewRecord; review?: ReviewRecord };
  const review =
    (data as { data?: ReviewRecord; review?: ReviewRecord }).data ??
    (data as { data?: ReviewRecord; review?: ReviewRecord }).review ??
    (data as ReviewRecord);

  return review;
}

export async function updateReview(
  reviewId: string,
  payload: ReviewUpdatePayload,
) {
  const res = await api.patch(`/reviews/${reviewId}`, payload);

  return res.data;
}
