import { useEffect, useMemo, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { getResult } from "@/lib/api";
import Seo from "@/components/Seo";
import { supabase } from "@/integrations/supabase/client";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

interface ChartDatum { name: string; value: number }

const Results = () => {
  const { id } = useParams();
  const { user, loading } = useAuth();
  const [topic, setTopic] = useState<string>("");
  const [yes, setYes] = useState(0);
  const [no, setNo] = useState(0);
  const total = yes + no;

  useEffect(() => {
    const load = async () => {
      try {
        if (!id) return;
        const r = await getResult(Number(id));
        const yRaw = (r as any).Si ?? (r as any).si ?? r.yes ?? 0;
        const nRaw = (r as any).No ?? (r as any).no ?? r.no_count ?? 0;
        setYes(Number(yRaw || 0));
        setNo(Number(nRaw || 0));
      } catch (e: any) {
        toast({ title: "Errore risultati", description: e?.message ?? "Impossibile recuperare i risultati", variant: "destructive" });
      }
    };
    load();
  }, [id]);

  useEffect(() => {
    const fetchTopic = async () => {
      if (!id) return;
      const { data, error } = await supabase.from("Votazioni").select("Topic").eq("id", Number(id)).single();
      if (!error && data) setTopic(data.Topic ?? "");
    };
    fetchTopic();
  }, [id]);

  const title = useMemo(() => (topic ? `Risultati | ${topic}` : "Risultati"), [topic]);

  if (!loading && !user) return <Navigate to="/auth" replace />;

  const data: ChartDatum[] = [
    { name: "Sì", value: yes },
    { name: "No", value: no },
  ];
  const yesColor = "hsl(var(--primary))";
  const noColor = "hsl(var(--destructive))";

  const siPerc = total ? (yes / total) * 100 : 0;
  const noPerc = total ? (no / total) * 100 : 0;

  return (
    <div className="min-h-screen bg-background">
      <Seo title={title} description="Risultati della votazione con percentuali e grafico." canonical={`${window.location.origin}/results/${id}`} />
      <main className="container mx-auto px-4 py-8">
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl">Risultati</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex gap-4 items-center">
              <Badge variant="outline">ID: {id}</Badge>
              {topic && <span className="text-muted-foreground">{topic}</span>}
            </div>

            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-3xl font-bold">{yes}</div>
                <div className="text-sm text-muted-foreground">Totale Sì ({siPerc.toFixed(1)}%)</div>
              </div>
              <div>
                <div className="text-3xl font-bold">{no}</div>
                <div className="text-sm text-muted-foreground">Totale No ({noPerc.toFixed(1)}%)</div>
              </div>
              <div className="col-span-2">
                <div className="text-lg font-semibold">Totale votanti: {total}</div>
              </div>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    <Cell key="si" fill={yesColor} />
                    <Cell key="no" fill={noColor} />
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Results;
