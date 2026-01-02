// src/api/locals.ts
import { apiFetch } from "./client";

export type LocalItem = {
  id: string;
  code: string;
  name: string;
};

export async function fetchMyLocals() {
  return apiFetch<{ items: LocalItem[] }>("/locals/mine");
}
