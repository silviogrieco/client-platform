import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRoles } from "@/hooks/useRoles";
import { Navigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getUsers, updateUserCategory, deleteUser, getAllVotazioni, startSimulation, endSimulation, User, VoteModel, SimulationResponse } from "@/lib/api";
import Seo from "@/components/Seo";

const AdminDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: rolesLoading } = useRoles();
  const [votazioni, setVotazioni] = useState<VoteModel[]>([]);
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

  // User management state
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);

  // Simulation state
  const [simulationData, setSimulationData] = useState({
    count: 1,
    categoria: "",
    topic: ""
  });
  const [activeSimulation, setActiveSimulation] = useState<SimulationResponse | null>(null);
  const [simulationLoading, setSimulationLoading] = useState(false);

  if (!authLoading && !user) return <Navigate to="/auth" replace />;
  if (!rolesLoading && !isAdmin) return <Navigate to="/" replace />;

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load categories
        setLoadingCategories(true);
        const { data: categoriesData, error: categoriesError } = await supabase
          .from('categoria')
          .select('nome')
          .order('nome');
        if (categoriesError) throw categoriesError;
        setCategories(categoriesData || []);

        // Load users
        setLoadingUsers(true);
        const usersData = await getUsers();
        setUsers(usersData);

        // Load votazioni from API instead of database
        const votazioniData = await getAllVotazioni();
        setVotazioni(votazioniData);
       
      } catch (error: any) {
        toast({
          title: "Errore",
          description: error.message || "Impossibile caricare i dati",
          variant: "destructive"
        });
      } finally {
        setLoadingVotazioni(false);
        setLoadingCategories(false);
        setLoadingUsers(false);
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
      const updatedVotazioni = await getAllVotazioni();
      setVotazioni(updatedVotazioni);
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

  const handleUpdateUserCategory = async (userId: string, newCategoria: string) => {
    if (!newCategoria.trim()) return;
    
    setUpdatingUser(userId);
    try {
      await updateUserCategory(userId, newCategoria);
      setUsers(prev => prev.map(user => 
        user.id === userId ? { ...user, categoria: newCategoria } : user
      ));
      toast({
        title: "Categoria aggiornata",
        description: "La categoria dell'utente è stata aggiornata con successo"
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Impossibile aggiornare la categoria",
        variant: "destructive"
      });
    } finally {
      setUpdatingUser(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await deleteUser(userId);
      setUsers(prev => prev.filter(user => user.id !== userId));
      toast({
        title: "Utente eliminato",
        description: "L'utente è stato eliminato con successo"
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Impossibile eliminare l'utente",
        variant: "destructive"
      });
    }
  };

  const handleStartSimulation = async () => {
    if (simulationData.count < 1) {
      toast({
        title: "Errore",
        description: "Il numero di utenti deve essere almeno 1",
        variant: "destructive"
      });
      return;
    }

    setSimulationLoading(true);
    try {
      const result = await startSimulation({
        count: simulationData.count,
        categoria: simulationData.categoria || undefined,
        topic: simulationData.topic || undefined
      });
      setActiveSimulation(result);
      toast({
        title: "Simulazione avviata",
        description: "La simulazione è stata avviata con successo"
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Impossibile avviare la simulazione",
        variant: "destructive"
      });
    } finally {
      setSimulationLoading(false);
    }
  };

  const handleEndSimulation = async () => {
    if (!activeSimulation) return;
    
    try {
      await endSimulation(activeSimulation.simulation_id);
      setActiveSimulation(null);
      setSimulationData({ count: 1, categoria: "", topic: "" });
      toast({
        title: "Simulazione terminata",
        description: "La simulazione è stata terminata e gli utenti fittizi sono stati eliminati"
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Impossibile terminare la simulazione",
        variant: "destructive"
      });
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
          <Button 
            onClick={() => window.location.href = '/'} 
            variant="outline"
          >
            ← Torna alla Dashboard
          </Button>
        </div>

        <div className="space-y-8">
          {/* Create new votazione section */}
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

                {/* Create new votazione form */}
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

          {/* User management section */}
          <Card>
            <CardHeader>
              <CardTitle>Gestione Utenti</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingUsers ? (
                <p className="text-muted-foreground">Caricamento utenti...</p>
              ) : users.length === 0 ? (
                <p className="text-muted-foreground">Nessun utente trovato.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Cognome</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>{user.nome}</TableCell>
                        <TableCell>{user.cognome}</TableCell>
                        <TableCell>{user.categoria}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Select
                              value={user.categoria}
                              onValueChange={(value) => handleUpdateUserCategory(user.id, value)}
                              disabled={updatingUser === user.id}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.map((cat) => (
                                  <SelectItem key={cat.nome} value={cat.nome}>
                                    {cat.nome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm">
                                  Elimina
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Sei sicuro di voler eliminare l'utente {user.nome} {user.cognome}? 
                                    Questa azione non può essere annullata.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => handleDeleteUser(user.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Elimina
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Votazioni section */}
          <Card>
            <CardHeader>
              <CardTitle>Tutte le Votazioni</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingVotazioni ? (
                <p className="text-muted-foreground">Caricamento...</p>
              ) : votazioni.length === 0 ? (
                <p className="text-muted-foreground">Nessuna votazione trovata.</p>
              ) : (
                <div className="space-y-4">
                  {votazioni.map((votazione) => (
                    <div key={votazione.id} className="p-4 border rounded-lg">
                      <h3 className="font-medium">{votazione.topic}</h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        Categoria: {votazione.categoria} | 
                        Status: {votazione.concluded ? "Conclusa" : "Attiva"}
                      </p>
                      {votazione.concluded && (
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/results/${votazione.id}`}>
                            Vedi Risultati
                          </Link>
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Simulation section */}
          <Card>
            <CardHeader>
              <CardTitle>Simulazione Elezione</CardTitle>
            </CardHeader>
            <CardContent>
              {!activeSimulation ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="simCount">Numero utenti *</Label>
                    <Input
                      id="simCount"
                      type="number"
                      min="1"
                      value={simulationData.count}
                      onChange={(e) => setSimulationData(prev => ({ ...prev, count: parseInt(e.target.value) || 1 }))}
                      disabled={simulationLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="simCategoria">Categoria (opzionale)</Label>
                    <Input
                      id="simCategoria"
                      value={simulationData.categoria}
                      onChange={(e) => setSimulationData(prev => ({ ...prev, categoria: e.target.value }))}
                      placeholder="Lascia vuoto per generazione automatica"
                      disabled={simulationLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="simTopic">Topic votazione (opzionale)</Label>
                    <Input
                      id="simTopic"
                      value={simulationData.topic}
                      onChange={(e) => setSimulationData(prev => ({ ...prev, topic: e.target.value }))}
                      placeholder="Topic della votazione di test"
                      disabled={simulationLoading}
                    />
                  </div>
                  <Button 
                    onClick={handleStartSimulation} 
                    disabled={simulationLoading || simulationData.count < 1}
                    className="w-full"
                  >
                    {simulationLoading ? "Avvio simulazione..." : "Avvia Simulazione"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Simulazione Attiva</h3>
                  <div className="space-y-2 text-sm">
                    <p><strong>ID Simulazione:</strong> {activeSimulation.simulation_id}</p>
                    <p><strong>ID Votazione:</strong> {activeSimulation.votazione_id}</p>
                    <p><strong>Categoria:</strong> {activeSimulation.categoria}</p>
                    <p><strong>Risultati:</strong></p>
                    <ul className="ml-4 space-y-1">
                      <li>Totale SI: {activeSimulation.result["Totale SI"]}</li>
                      <li>Totale NO: {activeSimulation.result["Totale NO"]}</li>
                      <li>Totale voti: {activeSimulation.result["Totale voti"]}</li>
                    </ul>
                    <p><strong>Utenti generati:</strong></p>
                    <div className="max-h-32 overflow-y-auto">
                      {activeSimulation.generated_users.map((user, index) => (
                        <p key={index} className="text-xs">
                          {user.nome} {user.cognome} ({user.categoria})
                        </p>
                      ))}
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="w-full">
                        Termina Simulazione
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Conferma terminazione</AlertDialogTitle>
                        <AlertDialogDescription>
                          Sei sicuro di voler terminare la simulazione? Tutti gli utenti fittizi verranno eliminati.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                        <AlertDialogAction onClick={handleEndSimulation}>
                          Termina Simulazione
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
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