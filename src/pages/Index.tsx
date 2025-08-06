import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VotingCard } from '@/components/VotingCard';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { LogOut, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Votazione {
  id: number;
  Topic: string;
  Si: number;
  No: number;
  Num_elettori: number;
  Percentuale_si: number;
  Percentuale_no: number;
}

interface UserVote {
  votazione_id: number;
  voto: boolean;
}

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const [votazioni, setVotazioni] = useState<Votazione[]>([]);
  const [userVotes, setUserVotes] = useState<UserVote[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [newTopic, setNewTopic] = useState('');
  const [creatingVotazione, setCreatingVotazione] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Redirect to auth if not authenticated (after all hooks)
  if (!loading && !user) {
    return <Navigate to="/auth" replace />;
  }

  const fetchVotazioni = async () => {
    try {
      const { data, error } = await supabase
        .from('Votazioni')
        .select('*')
        .order('id', { ascending: false });

      if (error) {
        toast({
          title: "Errore",
          description: "Errore nel caricamento delle votazioni: " + error.message,
          variant: "destructive"
        });
        return;
      }

      setVotazioni(data || []);
    } catch (error) {
      toast({
        title: "Errore",
        description: "Errore nel caricamento delle votazioni",
        variant: "destructive"
      });
    }
  };

  const fetchUserVotes = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_votes')
        .select('votazione_id, voto')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching user votes:', error);
        return;
      }

      setUserVotes(data || []);
    } catch (error) {
      console.error('Error fetching user votes:', error);
    }
  };

  const createVotazione = async () => {
    if (!newTopic.trim()) return;

    setCreatingVotazione(true);
    try {
      const { error } = await supabase
        .from('Votazioni')
        .insert({
          Topic: newTopic.trim(),
          Si: 0,
          No: 0,
          Num_elettori: 0,
          Percentuale_si: 0,
          Percentuale_no: 0
        });

      if (error) {
        toast({
          title: "Errore",
          description: "Errore nella creazione della votazione: " + error.message,
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Votazione creata",
        description: `Votazione "${newTopic}" creata con successo!`
      });

      setNewTopic('');
      setDialogOpen(false);
      fetchVotazioni();
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
      Promise.all([fetchVotazioni(), fetchUserVotes()]).finally(() => {
        setLoadingData(false);
      });
    }
  }, [user]);

  const handleVoteSuccess = () => {
    fetchVotazioni();
    fetchUserVotes();
  };

  const getUserVote = (votazioneId: number): boolean | null => {
    const vote = userVotes.find(v => v.votazione_id === votazioneId);
    return vote ? vote.voto : null;
  };

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
          <h2 className="text-xl font-semibold">Votazioni Attive</h2>
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
                <Button 
                  onClick={createVotazione}
                  disabled={!newTopic.trim() || creatingVotazione}
                  className="w-full"
                >
                  {creatingVotazione ? 'Creazione...' : 'Crea Votazione'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {votazioni.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <h3 className="text-lg font-medium mb-2">Nessuna votazione disponibile</h3>
              <p className="text-muted-foreground">
                Non ci sono votazioni attive al momento. Crea la prima votazione!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {votazioni.map((votazione) => (
              <VotingCard
                key={votazione.id}
                votazione={votazione}
                userVote={getUserVote(votazione.id)}
                onVoteSuccess={handleVoteSuccess}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
