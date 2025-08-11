import { useEffect, useMemo, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import Seo from "@/components/Seo";
import { supabase } from "@/integrations/supabase/client";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import {getResult} from "@/lib/api"

interface ChartDatum { name: string; value: number }

const Results = () => {
  const { id } = useParams();
  const { user, loading } = useAuth();
  const [topic, setTopic] = useState<string>("");
  const [yes, setYes] = useState(0);
  const [no, setNo] = useState(0);
  const [loadingResult, setLoadingResult] = useState(true);
  const total = yes + no;

  useEffect(() => {
    const loadResult = async () => {
      if (!id) return;

      try {
        // Check if voting is concluded via the endpoint
        const {data: catData} = await supabase.from("votazioni").select("categoria").eq("id", Number(id)).single();
        const {data: numData} = await supabase.from("categoria").select("num_utenti").eq("nome", catData.categoria).single();
        const response = await getResult(Number(id), Number(numData.num_utenti));
        if (!(response.status === "ok"))
           throw new Error(`Errore recupero risultati: ${response.status}`);
        
        if (response.status !== 'ok') {
          toast({
            title: "Votazione non conclusa",
            description: "La votazione è ancora in corso",
            variant: "destructive"
          });
          setLoadingResult(false);
          return;
        }

        // If voting is concluded, get results from database
        const { data: votazioneData, error } = await supabase
          .from("votazioni")
          .select("si, no")
          .eq("id", Number(id))
          .single();

        if (error) throw error;
        
        setYes(votazioneData?.si || 0);
        setNo(votazioneData?.no || 0);
      } catch (error: any) {
        toast({
          title: "Errore",
          description: error.message || "Impossibile caricare i risultati",
          variant: "destructive"
        });
      } finally {
        setLoadingResult(false);
      }
    };

    loadResult();
  }, [id]);

  useEffect(() => {
    const fetchTopic = async () => {
      if (!id) return;
      try {
        const { data, error } = await supabase
          .from("votazioni")
          .select("topic")
          .eq("id", Number(id))
          .single();
        if (!error && data) setTopic(data.topic ?? "");
      } catch (error) {
        // Silent fail for topic fetch
      }
    };
    fetchTopic();
  }, [id]);

  const title = useMemo(() => (topic ? `Risultati | ${topic}` : "Risultati"), [topic]);

  if (!loading && !user) return <Navigate to="/auth" replace />;

  if (loadingResult) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-xl">Caricamento risultati...</h2>
        </div>
      </div>
    );
  }

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
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex justify-between items-center">
            <Button 
              onClick={() => window.location.href = '/'} 
              variant="outline"
            >
              ← Torna alla Dashboard
            </Button>
          </div>
          <Card>
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
        </div>
      </main>
    </div>
  );
};

export default Results;