import { api } from "@/lib/api";

export interface Review {
  doctorId: string;
  doctorSessionId: string;
  rating: number;
  comment?: string;
}

export async function submitReview(payload: Review) {
  const res = await api.post("/reviews", payload);

  return res.data;
}
