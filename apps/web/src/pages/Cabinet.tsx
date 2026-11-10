import { useNavigate } from "react-router-dom";
import { CabinetView } from "../components/CabinetView";
import { ErrorBox, Loading } from "../components/Bits";
import { acceptKeepsake } from "../lib/keepsake";
import { useSession } from "../lib/session";
import type { KeepsakeItem } from "../lib/types";
import { useFetch } from "../lib/useFetch";

interface Dex {
  collected: number;
  total: number;
  items: KeepsakeItem[];
}

export function CabinetPage() {
  const { me, reload } = useSession();
  const nav = useNavigate();
  const { data, error, loading } = useFetch<Dex>("/api/me/keepsakes");
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return null;
  const accept = async (item: KeepsakeItem) => {
    await acceptKeepsake(item);
    await reload();
    nav("/tries", { state: { hello: true } });
  };
  return <CabinetView collected={data.collected} total={data.total} items={data.items} pendingId={me?.pet?.pending?.deedId} onAccept={accept} />;
}
