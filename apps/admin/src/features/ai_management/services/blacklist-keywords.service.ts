import { api } from "@/lib/api";

export type ApiKeywordReceiver = {
  id: string;
  keyword: string;
};

export interface ApiKeywordList {
  keywordList: ApiKeywordReceiver[];
}

type ApiKeywordItem = {
  _id: string;
  keyword: string;
  createdAt: string;
};

interface ApiKeywordListReceiver {
  data: ApiKeywordItem[];
  total: number;
}

export async function getKeywordList(): Promise<ApiKeywordList> {
  const res = await api.get<ApiKeywordListReceiver>("/blacklist-keywords");

  return {
    keywordList: res.data.data
      .map((obj) => {
        return {
          id: obj._id,
          keyword: obj.keyword,
        };
      })
      .filter((item): item is ApiKeywordReceiver =>
        Boolean(item.id && item.keyword),
      ),
  };
}

export async function updateKeyword(id: string, newKeyword: string) {
  const res = await api.patch(`/blacklist-keywords/${id}`, {
    keyword: newKeyword,
  });

  return res.data;
}

export async function addKeyword(newKeyword: string) {
  const res = await api.post(`/blacklist-keywords`, {
    keyword: newKeyword,
  });

  return res.data;
}

export async function deleteKeyword(id: string) {
  const res = await api.delete(`/blacklist-keywords/${id}`);

  return res.data;
}
