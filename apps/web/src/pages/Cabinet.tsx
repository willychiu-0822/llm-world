import { CabinetView } from "../components/CabinetView";
import { ErrorBox, Loading } from "../components/Bits";
import type { KeepsakeItem } from "../lib/types";
import { useFetch } from "../lib/useFetch";

interface Dex {
  collected: number;
  total: number;
  items: KeepsakeItem[];
}

export function CabinetPage() {
  const { data, error, loading } = useFetch<Dex>("/api/me/keepsakes");
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return null;
  return <CabinetView collected={data.collected} total={data.total} items={data.items} />;
}
