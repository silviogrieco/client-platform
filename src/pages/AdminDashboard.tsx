import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useRoles } from "@/hooks/useRoles";
import { supabase } from "@/integrations/supabase/client";
import Seo from "@/components/Seo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowDownAZ, ArrowUpAZ, RefreshCcw } from "lucide-react";

interface Votazione {
  id: number;
  Topic: string | null;
  Si: number | null;
  No: number | null;
  Num_elettori: number | null;
  Percentuale_si: number | null;
  Percentuale_no: number | null;
  Concluded?: boolean | null;
}

type SortKey = "Topic" | "Si" | "No" | "Num_elettori" | "Percentuale_si" | "Percentuale_no";

const AdminDashboard = () => {
  const { user, loading } = useAuth();
  const { isAdmin, loading: rolesLoading } = useRoles();
  const [votazioni, setVotazioni] = useState<Votazione[]>([]);
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("Topic");
  const [sortAsc, setSortAsc] = useState(true);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase
        .from("Votazioni")
        .select("id, Topic, Si, No, Num_elettori, Percentuale_si, Percentuale_no, Concluded")
        .eq("Concluded", true)
        .order("id", { ascending: false });
      if (!error) setVotazioni(data || []);
      setLoadingData(false);
    };
    fetchData();
  }, []);

  const rows = useMemo(() => {
    const norm = (n: number | null | undefined) => Number(n ?? 0);
    const filtered = votazioni.filter(v => (v.Topic || "").toLowerCase().includes(filter.toLowerCase()));
    const sorted = [...filtered].sort((a, b) => {
      const A: any = a[sortKey] ?? (typeof a[sortKey] === "number" ? 0 : "");
      const B: any = b[sortKey] ?? (typeof b[sortKey] === "number" ? 0 : "");
      if (sortKey === "Topic") {
        return sortAsc ? String(A).localeCompare(String(B)) : String(B).localeCompare(String(A));
      }
      return sortAsc ? norm(A) - norm(B) : norm(B) - norm(A);
    });
    return sorted.map(v => {
      const si = norm(v.Si);
      const no = norm(v.No);
      const total = si + no;
      const pSi = total ? (si / total) * 100 : 0;
      const pNo = total ? (no / total) * 100 : 0;
      return { ...v, _total: total, _pSi: pSi, _pNo: pNo } as any;
    });
  }, [votazioni, filter, sortKey, sortAsc]);

  if (!loading && !user) return <Navigate to="/auth" replace />;
  if (!rolesLoading && !isAdmin) return <Navigate to="/" replace />;

  const title = "Dashboard Amministratore | Votazioni Concluse";

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title={title}
        description="Elenco votazioni concluse con risultati e percentuali."
        canonical={`${window.location.origin}/admin`}
      />
      <main className="container mx-auto px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold">Votazioni concluse</h1>
          <p className="text-sm text-muted-foreground">Consulta, filtra e ordina i risultati.</p>
        </header>

        <Card>
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-xl">Risultati</CardTitle>
            <div className="flex gap-2">
              <Input
                placeholder="Filtra per topic..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-64"
                aria-label="Filtra per topic"
              />
              <Button variant="outline" onClick={() => setSortAsc(!sortAsc)} aria-label="Inverti ordinamento">
                {sortAsc ? <ArrowDownAZ className="h-4 w-4" /> : <ArrowUpAZ className="h-4 w-4" />}
              </Button>
              <Button variant="outline" onClick={() => { setLoadingData(true); window.location.reload(); }} aria-label="Ricarica">
                <RefreshCcw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="w-full overflow-auto">
              <Table>
                <TableCaption>Votazioni concluse (solo per amministratori)</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer" onClick={() => setSortKey("Topic")}>Topic</TableHead>
                    <TableHead className="cursor-pointer" onClick={() => setSortKey("Si")}>Totale Sì</TableHead>
                    <TableHead className="cursor-pointer" onClick={() => setSortKey("No")}>Totale No</TableHead>
                    <TableHead className="cursor-pointer" onClick={() => setSortKey("Num_elettori")}>Totale votanti</TableHead>
                    <TableHead className="cursor-pointer" onClick={() => setSortKey("Percentuale_si")}>% Sì</TableHead>
                    <TableHead className="cursor-pointer" onClick={() => setSortKey("Percentuale_no")}>% No</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingData ? (
                    <TableRow>
                      <TableCell colSpan={6}>Caricamento...</TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-muted-foreground">Nessuna votazione trovata.</TableCell>
                    </TableRow>
                  ) : (
                    rows.map((v: any) => (
                      <TableRow key={v.id}>
                        <TableCell>{v.Topic}</TableCell>
                        <TableCell>{v.Si}</TableCell>
                        <TableCell>{v.No}</TableCell>
                        <TableCell>{v._total}</TableCell>
                        <TableCell>{v._pSi.toFixed(1)}%</TableCell>
                        <TableCell>{v._pNo.toFixed(1)}%</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminDashboard;
