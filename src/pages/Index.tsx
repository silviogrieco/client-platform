import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { LogOut, Plus, Settings } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRoles } from "@/hooks/useRoles";
import { createElectionKeys } from "@/lib/api";

interface DashboardBallot {
  ballot_id: number;
  topic: string;
  categoria: string;
  conclusa: boolean;
}

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const [ballots, setBallots] = useState<DashboardBallot[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [newTopic, setNewTopic] = useState('');
  const [newCategoria, setNewCategoria] = useState('');
  const [creatingVotazione, setCreatingVotazione] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { isAdmin } = useRoles();

  // Redirect to auth if not authenticated (after all hooks)
  if (!loading && !user) {
    return <Navigate to="/auth" replace />;
  }

  const fetchDashboardBallots = async () => {
    try {
      const { data, error } = await supabase.rpc('rpc_dashboard_ballots');

      if (error) {
        toast({
          title: "Errore",
          description: "Errore nel caricamento delle votazioni: " + error.message,
          variant: "destructive"
        });
        return;
      }

      setBallots(data || []);
    } catch (error) {
      toast({
        title: "Errore",
        description: "Errore nel caricamento delle votazioni",
        variant: "destructive"
      });
    }
  };

  const createVotazione = async () => {
    if (!newTopic.trim() || !newCategoria.trim()) return;

    setCreatingVotazione(true);
    try {
      const { data, error } = await supabase
        .from('Votazioni')
        .insert({
          Topic: newTopic.trim(),
          categoria: newCategoria.trim(),
          Si: 0,
          No: 0,
          Num_elettori: 0,
          Percentuale_si: 0,
          Percentuale_no: 0,
          Concluded: false
        })
        .select('id')
        .single();

      if (error || !data) {
        toast({
          title: "Errore",
          description: "Errore nella creazione della votazione: " + error.message,
          variant: "destructive"
        });
        return;
      }
      
      
      await createElectionKeys(data.id);

      toast({
        title: "Votazione creata",
        description: `Votazione "${newTopic}" creata con successo!`
      });

      setNewTopic('');
      setNewCategoria('');
      setDialogOpen(false);
      fetchDashboardBallots();
    } catch (error) {
      toast({
        title: "Errore",
        description: "Errore nella creazione della votazione",
        variant: "destructive"
      });
    } finally {
      setCreatingVotazione(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchDashboardBallots().finally(() => {
        setLoadingData(false);
      });
    }
  }, [user]);

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-xl">Caricamento...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Piattaforma E-Voting</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Benvenuto, {user?.email}
            </span>
            {isAdmin && (
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin">
                  <Settings className="w-4 h-4 mr-2" />
                  Admin
                </Link>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Esci
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">{isAdmin ? "Tutte le Votazioni" : "Votazioni Attive"}</h2>
          {isAdmin && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Nuova Votazione
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Crea Nuova Votazione</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="topic">Argomento della votazione</Label>
                    <Input
                      id="topic"
                      value={newTopic}
                      onChange={(e) => setNewTopic(e.target.value)}
                      placeholder="Es. Approvazione del nuovo regolamento"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="categoria">Categoria</Label>
                    <Input
                      id="categoria"
                      value={newCategoria}
                      onChange={(e) => setNewCategoria(e.target.value)}
                      placeholder="Es. Docenti, Studenti, etc."
                    />
                  </div>
                  <Button 
                    onClick={createVotazione}
                    disabled={!newTopic.trim() || !newCategoria.trim() || creatingVotazione}
                    className="w-full"
                  >
                    {creatingVotazione ? 'Creazione...' : 'Crea Votazione'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {ballots.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <h3 className="text-lg font-medium mb-2">Nessuna votazione disponibile</h3>
              <p className="text-muted-foreground">
                {isAdmin ? "Non ci sono votazioni attive. Crea la prima votazione!" : "Non ci sono votazioni attive al momento. Attendi una nuova votazione dall'amministratore."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {ballots.map((ballot) => (
              <Card key={ballot.ballot_id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg">{ballot.topic}</CardTitle>
                  {isAdmin && (
                    <div className="text-sm text-muted-foreground">
                      Categoria: {ballot.categoria} | Status: {ballot.conclusa ? "Conclusa" : "Attiva"}
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    {!ballot.conclusa && (
                      <Button asChild className="flex-1">
                        <Link to={`/vote/${ballot.ballot_id}`}>
                          Vota
                        </Link>
                      </Button>
                    )}
                    {ballot.conclusa && (
                      <Button variant="outline" asChild className="flex-1">
                        <Link to={`/results/${ballot.ballot_id}`}>
                          Vedi Risultati
                        </Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
