import { useEffect, useMemo, useState } from "react";
import { useParams, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/hooks/use-toast";
import * as paillier from "paillier-bigint";
import { supabase } from "@/integrations/supabase/client";
import Seo from "@/components/Seo";
import { createElectionKeys, getPublicKey, submitEncryptedVote } from "@/lib/api";
import {getResult} from "@/lib/api"

const Vote = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [topic, setTopic] = useState<string>("");
  const [categoria, setCategoria] = useState<string>("");
  const [choice, setChoice] = useState<"si" | "no" | "">("");
  const [loadingKey, setLoadingKey] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pubKey, setPubKey] = useState<{ n: string; g: string } | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [numUtenti, setNumUtenti] = useState<number>(0);
  const [voteSubmitted, setVoteSubmitted] = useState(false);
  const [showViewResults, setShowViewResults] = useState(false);
  

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      
      try {
        // Fetch public key for this specific election
        let key = await createElectionKeys(Number(id));
        if (!key) throw new Error('Errore recupero chiave')
          key = await getPublicKey(Number(id))
        setPubKey(key);
      } catch (e: any) {
        toast({ title: "Errore", description: e?.message ?? "Impossibile recuperare la chiave pubblica", variant: "destructive" });
      } finally {
        setLoadingKey(false);
      }
    };
    load();
  }, [id]);

  useEffect(() => {
    const fetchVotazione = async () => {
      if (!id || !user) return;
      
      // Check if user has already voted by querying the votes table
      try {
        const { data: voteData } = await supabase
          .from("votes")
          .select("user_id")
          .eq("votazione_id", Number(id))
          .eq("user_id", user.id)
          .single();
        
        setHasVoted(!!voteData);
      } catch (error) {
        // No vote found, user hasn't voted yet
        setHasVoted(false);
      }
      
      try {
        const { data, error } = await supabase
          .from("votazioni")
          .select("topic, categoria")
          .eq("id", Number(id))
          .single();
        
        if (error) throw error;
        if (data) {
          setTopic(data.topic ?? "");
          setCategoria(data.categoria ?? "");
          
          // Get number of users in this category
          const { data: categoryData } = await supabase
            .from("categoria")
            .select("num_utenti")
            .eq("nome", data.categoria)
            .single();
          
          if (categoryData) {
            setNumUtenti(categoryData.num_utenti || 0);
          }
        }
      } catch (error: any) {
        toast({
          title: "Errore",
          description: "Impossibile caricare i dati della votazione",
          variant: "destructive"
        });
      }
    };
    fetchVotazione();
  }, [id, user]);

  const title = useMemo(() => (topic ? `Vota | ${topic}` : "Vota"), [topic]);

  if (!loading && !user) return <Navigate to="/auth" replace />;

  const onSubmit = async () => {
    if (!id) return;
    if (!pubKey) {
      toast({ title: "Chiave mancante", description: "Riprovare più tardi.", variant: "destructive" });
      return;
    }
    if (!choice) {
      toast({ title: "Seleziona un'opzione", description: "Scegli Sì o No prima di inviare." });
      return;
    }

    setSubmitting(true);
    try {
      const n = BigInt(pubKey.n);
      const g = BigInt(pubKey.g);
      const pk = new paillier.PublicKey(n, g);
      const m = choice === "si" ? 1n : 0n;
      const c = pk.encrypt(m);
      const ciphertext = c.toString();

      // Call the new backend endpoint with all required data
      const response = await submitEncryptedVote(Number(id), ciphertext, numUtenti, topic);
      
      // Insert vote record in database to track user has voted
      await supabase.from("votes").insert({
        votazione_id: Number(id),
        user_id: user.id
      });
      
      setHasVoted(true);

      toast({ title: "Voto inviato", description: "Il tuo voto cifrato è stato inviato correttamente." });
      setVoteSubmitted(true);
      
      // Check if voting is concluded to show results button
      setTimeout(async () => {
        try {
          const resultData = await getResult(Number(id), numUtenti);
          if (resultData.status === 'ok') {
            setShowViewResults(true);
          }
        } catch (error) {
          console.log('Could not check voting status for results button');
        }
      }, 1000);
    } catch (e: any) {
      toast({ title: "Errore inoltro voto", description: e?.message ?? "Qualcosa è andato storto.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Seo title={title} description="Vota in modo sicuro con cifratura Paillier." canonical={`${window.location.origin}/vote/${id}`} />
      <main className="container mx-auto px-4 py-8">
        <Card className="max-w-xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl">Pagina di voto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {loadingKey ? (
              <p className="text-muted-foreground">Caricamento chiave pubblica...</p>
            ) : hasVoted ? (
              <div className="text-center py-8">
                <h3 className="text-lg font-medium mb-2">Hai già votato!</h3>
                <p className="text-muted-foreground mb-4">
                  Hai già espresso il tuo voto per questa votazione.
                </p>
                <div className="flex gap-3">
                  <Button onClick={() => navigate('/')} size="lg" className="flex-1">
                    Torna alla Dashboard
                  </Button>
                  <Button 
                    onClick={async () => {
                      try {
                        const resultData = await getResult(Number(id), numUtenti);
                        console.log(resultData)
                        if (resultData.status === 'ok') {
                          navigate(`/results/${id}`);
                        } else {
                          toast({
                            title: "Votazione in corso",
                            description: "La votazione non è ancora conclusa. I risultati saranno disponibili quando tutti avranno votato.",
                          });
                        }
                      } catch (error) {
                        toast({
                          title: "Errore",
                          description: "Impossibile verificare lo stato della votazione." + error,
                          variant: "destructive"
                        });
                      }
                    }}
                    size="lg" 
                    variant="outline" 
                    className="flex-1"
                  >
                    Vedi Risultati
                  </Button>
                </div>
              </div>
            ) : voteSubmitted ? (
              <div className="text-center py-8">
                <h3 className="text-lg font-medium mb-2">Voto inviato con successo!</h3>
                <p className="text-muted-foreground mb-4">
                  Il tuo voto è stato registrato correttamente.
                </p>
                <div className="flex gap-3">
                  <Button onClick={() => navigate('/')} size="lg" className="flex-1">
                    Torna alla Dashboard
                  </Button>
                  {showViewResults && (
                    <Button onClick={() => navigate(`/results/${id}`)} size="lg" variant="outline" className="flex-1">
                      Vedi Risultati
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <Label>La tua scelta</Label>
                  <RadioGroup value={choice} onValueChange={(v) => setChoice(v as any)} className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="si" id="scelta-si" />
                      <Label htmlFor="scelta-si">Sì</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="scelta-no" />
                      <Label htmlFor="scelta-no">No</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="flex gap-3">
                  <Button onClick={onSubmit} disabled={submitting || !choice} className="flex-1">
                    {submitting ? "Invio..." : "Invia voto"}
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => navigate(-1)}>
                    Annulla
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Vote;