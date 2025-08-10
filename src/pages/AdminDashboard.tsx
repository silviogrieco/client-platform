import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRoles } from "@/hooks/useRoles";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import Seo from "@/components/Seo";

const AdminDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: rolesLoading } = useRoles();
  const [votazioni, setVotazioni] = useState<any[]>([]);
  const [loadingVotazioni, setLoadingVotazioni] = useState(true);
  const [creatingVotazione, setCreatingVotazione] = useState(false);
  const [categories, setCategories] = useState<{ nome: string }[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [newVotazione, setNewVotazione] = useState({
    topic: "",
    categoria: "",
  });

  if (!authLoading && !user) return <Navigate to="/auth" replace />;
  if (!rolesLoading && !isAdmin) return <Navigate to="/" replace />;

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load votazioni
        const { data: votazioniData, error: votazioniError } = await supabase.rpc('rpc_dashboard_ballots');
        if (votazioniError) throw votazioniError;
        setVotazioni(votazioniData || []);

        // Load categories
        setLoadingCategories(true);
        const { data: categoriesData, error: categoriesError } = await supabase
          .from('categoria')
          .select('nome')
          .order('nome');
        if (categoriesError) throw categoriesError;
        setCategories(categoriesData || []);
      } catch (error: any) {
        toast({
          title: "Errore",
          description: "Impossibile caricare i dati",
          variant: "destructive"
        });
      } finally {
        setLoadingVotazioni(false);
        setLoadingCategories(false);
      }
    };

    if (user && isAdmin) {
      loadData();
    }
  }, [user, isAdmin]);

  const handleAddCategory = async () => {
    if (!newCategory.trim()) {
      toast({
        title: "Nome categoria richiesto",
        description: "Inserisci un nome per la categoria",
        variant: "destructive"
      });
      return;
    }

    setAddingCategory(true);
    try {
      const { error } = await supabase
        .from('categoria')
        .insert([{ nome: newCategory.trim() }]);

      if (error) throw error;

      toast({
        title: "Categoria aggiunta",
        description: "La categoria è stata aggiunta con successo"
      });

      // Reload categories
      const { data } = await supabase
        .from('categoria')
        .select('nome')
        .order('nome');
      setCategories(data || []);
      setNewCategory("");
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Impossibile aggiungere la categoria",
        variant: "destructive"
      });
    } finally {
      setAddingCategory(false);
    }
  };

  const handleCreateVotazione = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVotazione.topic.trim() || !newVotazione.categoria.trim()) {
      toast({
        title: "Campi richiesti",
        description: "Compila tutti i campi",
        variant: "destructive"
      });
      return;
    }

    setCreatingVotazione(true);
    try {
      const { data, error } = await supabase
        .from('votazioni')
        .insert([{
          topic: newVotazione.topic,
          categoria: newVotazione.categoria,
          si: 0,
          no: 0,
          concluded: false
        }])
        .select()
        .single();

      if (error) throw error;

      // Get category user count for backend call
      const { data: categoryData } = await supabase
        .from('categoria')
        .select('num_utenti')
        .eq('nome', newVotazione.categoria)
        .single();

      // Call backend to generate Paillier keys for this election
      try {
        const response = await fetch(`https://aogegjtluttpgbkqciod.supabase.co/functions/v1/elections/${data.id}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
          },
          body: JSON.stringify({
            numUtenti: categoryData?.num_utenti || 0
          })
        });

        if (!response.ok) {
          console.warn('Failed to generate keys for election:', response.statusText);
        }
      } catch (keyError) {
        console.warn('Failed to generate keys for election:', keyError);
      }

      toast({
        title: "Votazione creata",
        description: "La votazione è stata creata con successo"
      });

      // Reset form
      setNewVotazione({ topic: "", categoria: "" });
      
      // Reload votazioni
      const { data: updatedVotazioni } = await supabase.rpc('rpc_dashboard_ballots');
      setVotazioni(updatedVotazioni || []);
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Impossibile creare la votazione",
        variant: "destructive"
      });
    } finally {
      setCreatingVotazione(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Dashboard Amministratore"
        description="Gestione votazioni e categorie"
        canonical={`${window.location.origin}/admin`}
      />
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Dashboard Amministratore</h1>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Crea Nuova Votazione</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Add new category section */}
                <div className="space-y-4 p-4 border rounded-lg">
                  <h3 className="text-lg font-medium">Aggiungi nuova categoria</h3>
                  <div className="flex gap-2">
                    <Input
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      placeholder="Nome della categoria"
                      disabled={addingCategory}
                    />
                    <Button 
                      onClick={handleAddCategory} 
                      disabled={addingCategory || !newCategory.trim()}
                    >
                      {addingCategory ? "Aggiunta..." : "Aggiungi"}
                    </Button>
                  </div>
                </div>

                {/* Create new votazione section */}
                <form onSubmit={handleCreateVotazione} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="topic">Argomento della votazione</Label>
                    <Textarea
                      id="topic"
                      value={newVotazione.topic}
                      onChange={(e) => setNewVotazione(prev => ({ ...prev, topic: e.target.value }))}
                      placeholder="Inserisci l'argomento della votazione"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="categoria">Categoria</Label>
                    <Select 
                      value={newVotazione.categoria} 
                      onValueChange={(value) => setNewVotazione(prev => ({ ...prev, categoria: value }))}
                      disabled={loadingCategories}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={loadingCategories ? "Caricamento..." : "Seleziona categoria"} />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.nome} value={cat.nome}>
                            {cat.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button type="submit" disabled={creatingVotazione} className="w-full">
                    {creatingVotazione ? "Creazione..." : "Crea Votazione"}
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Votazioni Esistenti</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingVotazioni ? (
                <p className="text-muted-foreground">Caricamento...</p>
              ) : votazioni.length === 0 ? (
                <p className="text-muted-foreground">Nessuna votazione trovata.</p>
              ) : (
                <div className="space-y-4">
                  {votazioni.map((votazione) => (
                    <div key={votazione.ballot_id} className="p-4 border rounded-lg">
                      <h3 className="font-medium">{votazione.topic}</h3>
                      <p className="text-sm text-muted-foreground">
                        Categoria: {votazione.categoria} | 
                        Status: {votazione.conclusa ? "Conclusa" : "Attiva"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;