import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { LogOut, Settings } from 'lucide-react';
import { useRoles } from "@/hooks/useRoles";

interface DashboardBallot {
  id: number;
  topic: string;
  categoria: string;
  concluded: boolean;
}

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const [ballots, setBallots] = useState<DashboardBallot[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const { isAdmin } = useRoles();



  const fetchDashboardBallots = async () => {
    try {
      const { data, error } = await supabase.from("votazioni").select('id, topic, categoria, concluded')
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

    // Redirect to auth if not authenticated (after all hooks)
  if (!loading && !user) {
    return <Navigate to="/auth" replace />;
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
              <Card key={ballot.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg">{ballot.topic}</CardTitle>
                  {isAdmin && (
                    <div className="text-sm text-muted-foreground">
                      Categoria: {ballot.categoria} | Status: {ballot.concluded ? "Conclusa" : "Attiva"}
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    {!ballot.concluded && (
                      <Button asChild className="flex-1">
                        <Link to={`/vote/${ballot.id}`}>
                          Vota
                        </Link>
                      </Button>
                    )}
                    {ballot.concluded && (
                      <Button variant="outline" asChild className="flex-1">
                        <Link to={`/results/${ballot.id}`}>
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