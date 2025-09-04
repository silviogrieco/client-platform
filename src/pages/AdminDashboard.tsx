import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRoles } from '@/hooks/useRoles';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { toast } from '@/hooks/use-toast';
import { Loader2, Trash2, Edit, Search } from 'lucide-react';
import { getUsers, updateUserCategory, deleteUser, getAllVotazioni, startSimulation, endSimulation, getCategories, User, VoteModel, SimulationStart, SimulationResponse, newCategoria, newElection, deleteElection } from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';
import Seo from '@/components/Seo';


const AdminDashboard = () => {
  const { user, loading, signOut } = useAuth();
  const { isAdmin, loading: rolesLoading } = useRoles();
  const [users, setUsers] = useState<User[]>([]);
  const [votazioni, setVotazioni] = useState<VoteModel[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingVotazioni, setLoadingVotazioni] = useState(true);
  const [simulationData, setSimulationData] = useState<SimulationResponse | null>(null);
  const [simulationForm, setSimulationForm] = useState<SimulationStart>({ count: 10 });
  const [isSimulating, setIsSimulating] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newCategory, setNewCategory] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newVote, setNewVote] = useState<{ topic: string; categoria: string }>({
    topic: '',
    categoria: '',
  });
  const [creatingVote, setCreatingVote] = useState(false);
  // Search states
  const [userSearch, setUserSearch] = useState('');
  const [votazioniSearch, setVotazioniSearch] = useState('');
  const debouncedUserSearch = useDebounce(userSearch, 300);
  const debouncedVotazioniSearch = useDebounce(votazioniSearch, 300);
  
  // Selection states
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [selectedVotazioni, setSelectedVotazioni] = useState<Set<number>>(new Set());

  
  const loadData = async () => {
    try {
      const [usersData, votazioniData, categoriesData] = await Promise.all([
        getUsers(),
        getAllVotazioni(),
        getCategories()
      ]);
      setUsers(usersData);
      setVotazioni(votazioniData);
      setCategories(categoriesData);
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Impossibile caricare i dati",
        variant: "destructive"
      });
    } finally {
      setLoadingUsers(false);
      setLoadingVotazioni(false);
    }
  };

  useEffect(() => {
    loadData();
    
    // Auto-terminate simulation on page unload
    const handleBeforeUnload = () => {
      const simId = sessionStorage.getItem('simulationId');
      if (simId) {
        endSimulation(Number(simId)).catch(console.error);
        sessionStorage.removeItem('simulationId');
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Check for pending simulation on mount
  useEffect(() => {
    const simId = sessionStorage.getItem('simulationId');
    if (simId && !simulationData) {
      // Try to end any pending simulation
      endSimulation(Number(simId)).catch(console.error);
      sessionStorage.removeItem('simulationId');
    }
  }, [simulationData]);

  if (loading || rolesLoading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;


  const handleUpdateCategory = async () => {
    if (!editingUser || !newCategory) return;
    
    try {
      await updateUserCategory(editingUser.id, newCategory);
      setUsers(users.map(u => u.id === editingUser.id ? { ...u, categoria: newCategory } : u));
      setEditingUser(null);
      setNewCategory('');
      toast({
        title: "Successo",
        description: "Categoria aggiornata con successo"
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Impossibile aggiornare la categoria",
        variant: "destructive"
      });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await deleteUser(userId);
      setUsers(users.filter(u => u.id !== userId));
      setSelectedUsers(prev => new Set([...prev].filter(id => id !== userId)));
      toast({
        title: "Successo",
        description: "Utente eliminato con successo"
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Impossibile eliminare l'utente",
        variant: "destructive"
      });
    }
  };

  const handleDeleteSelectedUsers = async () => {
    const userIds = Array.from(selectedUsers);
    try {
      await Promise.all(userIds.map(id => deleteUser(id)));
      setUsers(users.filter(u => !selectedUsers.has(u.id)));
      setSelectedUsers(new Set());
      toast({
        title: "Successo",
        description: `${userIds.length} utenti eliminati con successo`
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Errore nell'eliminazione degli utenti",
        variant: "destructive"
      });
    }
  };  

  const handleCreateCategory = async () => {
    const nome = newCategory.trim();
    if (!nome) return;
    setCreatingCategory(true);
    try {
      await newCategoria(nome);
      setCategories(prev => Array.from(new Set([...prev, nome])).sort());
      setNewCategory('');
      toast({ title: 'Categoria creata', description: `“${nome}” aggiunta con successo.` });
    } catch (e: any) {
      toast({ title: 'Errore', description: e.message ?? 'Impossibile creare la categoria', variant: 'destructive' });
      throw e
    } finally {
      setCreatingCategory(false);
    }
};

  const handleCreateVotazione = async () => {
  const topic = newVote.topic.trim();
  const categoria = (newVote.categoria || '').trim();
  if (!topic || !categoria) {
    toast({ title: 'Dati mancanti', description: 'Compila topic e categoria', variant: 'destructive' });
    return;
  }
  setCreatingVote(true);
  try {
    const created = await newElection(topic, categoria)

     const normalized: VoteModel = {
      id: Number(created.id),
      topic: String(created.topic),
      categoria: String(created.categoria),
      concluded: Boolean(created.concluded),
    };

    setVotazioni(prev => [...prev, normalized].sort((a,b) => a.id - b.id));
    setNewVote({ topic: '', categoria: '' });
    toast({ title: 'Votazione creata', description: `#${normalized.id} – ${normalized.topic}` });
  } catch (e: any) {
    toast({ title: 'Errore', description: e.message ?? 'Impossibile creare la votazione', variant: 'destructive' });
  } finally {
    setCreatingVote(false);
  }
};

  const handleStartSimulation = async () => {
    if (!simulationForm.count || !simulationForm.categoria) return;
    
    setIsSimulating(true);
    try {
      const response = await startSimulation(simulationForm);
      setSimulationData(response);
      sessionStorage.setItem('simulationId', response.simulation_id.toString());
      toast({
        title: "Successo",
        description: "Simulazione avviata con successo"
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Impossibile avviare la simulazione",
        variant: "destructive"
      });
    } finally {
      setIsSimulating(false);
    }
  };

  const handleEndSimulation = async () => {
    if (!simulationData) return;
    
    try {
      await endSimulation(simulationData.simulation_id);
      setSimulationData(null);
      sessionStorage.removeItem('simulationId');
      toast({
        title: "Successo",
        description: "Simulazione terminata e utenti fittizi eliminati"
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Impossibile terminare la simulazione",
        variant: "destructive"
      });
    }
  };

  // Filter functions
  const filteredUsers = users.filter(user => {
    if (!debouncedUserSearch) return true;
    const search = debouncedUserSearch.toLowerCase();
    return (
      user.nome?.toLowerCase().includes(search) ||
      user.cognome?.toLowerCase().includes(search) ||
      user.categoria?.toLowerCase().includes(search)
    );
  });

  const filteredVotazioni = votazioni.filter(votazione => {
    if (!debouncedVotazioniSearch) return true;
    const search = debouncedVotazioniSearch.toLowerCase();
    return (
      votazione.topic?.toLowerCase().includes(search) ||
      votazione.categoria?.toLowerCase().includes(search)
    );
  });

  // Selection handlers
  const handleSelectAllUsers = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
    } else {
      setSelectedUsers(new Set());
    }
  };

  const handleSelectUser = (userId: string, checked: boolean) => {
    const newSelected = new Set(selectedUsers);
    if (checked) {
      newSelected.add(userId);
    } else {
      newSelected.delete(userId);
    }
    setSelectedUsers(newSelected);
  };

  const handleSelectAllVotazioni = (checked: boolean) => {
    if (checked) {
      setSelectedVotazioni(new Set(filteredVotazioni.map(v => v.id)));
    } else {
      setSelectedVotazioni(new Set());
    }
  };

  const handleSelectVotazione = (votazioneId: number, checked: boolean) => {
    const newSelected = new Set(selectedVotazioni);
    if (checked) {
      newSelected.add(votazioneId);
    } else {
      newSelected.delete(votazioneId);
    }
    setSelectedVotazioni(newSelected);
  };

  const handleDeleteVotazione = async (id: number) => {
  try {
    await deleteElection(id);
    setVotazioni(prev => prev.filter(v => v.id !== id));
    setSelectedVotazioni(prev => {
      const s = new Set(prev);
      s.delete(id);
      return s;
    });
    toast({ title: 'Eliminata', description: `Votazione #${id} rimossa.` });
  } catch (e: any) {
    toast({ title: 'Errore', description: e.message ?? 'Impossibile eliminare la votazione', variant: 'destructive' });
    throw e
  }
};


const handleDeleteSelectedVotazioni = async () => {
  const ids = Array.from(selectedVotazioni);
  if (ids.length === 0) return;
  try {
    ids.forEach(async element => {
      await deleteElection(element);
    });
    setVotazioni(prev => prev.filter(v => !selectedVotazioni.has(v.id)));
    setSelectedVotazioni(new Set());
    toast({ title: 'Eliminate', description: `${ids.length} votazioni rimosse.` });
  } catch (e: any) {
    toast({ title: 'Errore', description: e.message ?? 'Impossibile eliminare le votazioni', variant: 'destructive' });
    throw e;
}
};

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Dashboard Amministratore"
        description="Gestione utenti, votazioni e simulazioni"
        canonical={`${window.location.origin}/admin`}
      />
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">VotingSystem - Dashboard Amministratore</h1>
          <Button 
            onClick={signOut} 
            variant="outline"
          >
            ← Esci
          </Button>
        </div>

        <div className="space-y-6">
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Crea votazione o categoria</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              {/* Crea categoria */}
              <div className="space-y-3">
                <div className="text-sm font-medium">Nuova categoria</div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Nome categoria"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                  />
                  <Button onClick={handleCreateCategory} disabled={creatingCategory || !newCategory.trim()}>
                    {creatingCategory ? 'Creazione...' : 'Aggiungi'}
                  </Button>
                </div>
              </div>

              {/* Crea votazione */}
              <div className="space-y-3">
                <div className="text-sm font-medium">Nuova votazione</div>
                <Input
                  placeholder="Topic"
                  value={newVote.topic}
                  onChange={(e) => setNewVote(v => ({ ...v, topic: e.target.value }))}
                  className="mb-2"
                />
                <Select
                  value={newVote.categoria}
                  onValueChange={(value) => setNewVote(v => ({ ...v, categoria: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div>
                  <Button onClick={handleCreateVotazione} disabled={creatingVote || !newVote.topic.trim() || !newVote.categoria}>
                    {creatingVote ? 'Creazione...' : 'Crea votazione'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Gestione Utenti */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Gestione Utenti</CardTitle>
                {selectedUsers.size > 0 && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Elimina selezionati ({selectedUsers.size})
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Conferma eliminazione multipla</AlertDialogTitle>
                        <AlertDialogDescription>
                          Sei sicuro di voler eliminare {selectedUsers.size} utenti selezionati?
                          Questa azione non può essere annullata.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteSelectedUsers}>
                          Elimina
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Cerca per nome, cognome o categoria..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent>
              {loadingUsers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Caricamento utenti...</span>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={filteredUsers.length > 0 && selectedUsers.size === filteredUsers.length}
                          onCheckedChange={handleSelectAllUsers}
                        />
                      </TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Cognome</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedUsers.has(user.id)}
                            onCheckedChange={(checked) => handleSelectUser(user.id, !!checked)}
                          />
                        </TableCell>
                        <TableCell>{user.nome}</TableCell>
                        <TableCell>{user.cognome}</TableCell>
                        <TableCell>{user.categoria}</TableCell>
                        <TableCell className="space-x-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingUser(user);
                                  setNewCategory(user.categoria || '');
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Cambia Categoria</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <p>Utente: {user.nome} {user.cognome}</p>
                                  <p className="text-sm text-muted-foreground">Categoria attuale: {user.categoria}</p>
                                </div>
                                <Select value={newCategory} onValueChange={setNewCategory}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Seleziona categoria" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {categories.map(cat => (
                                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button onClick={handleUpdateCategory} disabled={!newCategory}>
                                  Aggiorna
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm">
                                <Trash2 className="h-4 w-4" />
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
                                <AlertDialogAction onClick={() => handleDeleteUser(user.id)}>
                                  Elimina
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Votazioni */}
          <Card>
            <CardHeader>
              <CardTitle>Votazioni</CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Cerca per topic o categoria..."
                  value={votazioniSearch}
                  onChange={(e) => setVotazioniSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
                <div className="mt-3 flex justify-end">
                  {selectedVotazioni.size > 0 && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Elimina selezionate ({selectedVotazioni.size})
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Conferma eliminazione multipla</AlertDialogTitle>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annulla</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDeleteSelectedVotazioni}>
                            Elimina
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
              </div>  
            </CardHeader>
            <CardContent>
              {loadingVotazioni ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Caricamento votazioni...</span>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={filteredVotazioni.length > 0 && selectedVotazioni.size === filteredVotazioni.length}
                          onCheckedChange={handleSelectAllVotazioni}
                        />
                      </TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Topic</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead>Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVotazioni.map((votazione) => (
                      <TableRow key={votazione.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedVotazioni.has(votazione.id)}
                            onCheckedChange={(checked) => handleSelectVotazione(votazione.id, !!checked)}
                          />
                        </TableCell>
                        <TableCell>{votazione.id}</TableCell>
                        <TableCell>{votazione.topic}</TableCell>
                        <TableCell>{votazione.categoria}</TableCell>
                        <TableCell>
                          <Badge variant={votazione.concluded ? "secondary" : "default"}>
                            {votazione.concluded ? "Conclusa" : "In corso"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {votazione.concluded && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.location.href = `/results/${votazione.id}`}
                            >
                              Vedi Risultati
                            </Button>

                          )}
                          {!votazione.concluded && (
                            <Badge variant="outline">Attiva</Badge>
                          )}

                           <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm" className="ml-2">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Eliminare la votazione #{votazione.id}?</AlertDialogTitle>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annulla</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteVotazione(votazione.id)}>
                                  Elimina
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Simulazione Elezione */}
          <Card>
            <CardHeader>
              <CardTitle>Simulazione Elezione</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!simulationData ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Categoria *</label>
                    <Select 
                      value={simulationForm.categoria || ''} 
                      onValueChange={(value) => setSimulationForm({
                        ...simulationForm,
                        categoria: value
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Topic votazione</label>
                    <Input
                      placeholder="Argomento della votazione di test"
                      value={simulationForm.topic || ''}
                      onChange={(e) => setSimulationForm({
                        ...simulationForm,
                        topic: e.target.value
                      })}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Numero utenti (10-30)</label>
                    <Input
                      type="number"
                      min="10"
                      max="30"
                      value={simulationForm.count}
                      onChange={(e) => setSimulationForm({
                        ...simulationForm,
                        count: parseInt(e.target.value) || 10
                      })}
                    />
                  </div>
                  
                  <Button 
                    onClick={handleStartSimulation}
                    disabled={isSimulating || !simulationForm.count || !simulationForm.categoria}
                  >
                    {isSimulating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Avvia Simulazione
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Simulation ID</div>
                      <div className="font-mono">{simulationData.simulation_id}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Votazione ID</div>
                      <div className="font-mono">{simulationData.votazione_id}</div>
                    </div>
                  </div>
                  
                  {/* Chart Results */}
                  <div>
                    <div className="text-sm text-muted-foreground mb-4">Risultati</div>
                    <div className="grid grid-cols-2 gap-4 text-center mb-4">
                      <div>
                        <div className="text-3xl font-bold">{simulationData.result["Totale SI"]}</div>
                        <div className="text-sm text-muted-foreground">
                          Totale Sì ({simulationData.result["Totale voti"] > 0 ? ((simulationData.result["Totale SI"] / simulationData.result["Totale voti"]) * 100).toFixed(1) : 0}%)
                        </div>
                      </div>
                      <div>
                        <div className="text-3xl font-bold">{simulationData.result["Totale NO"]}</div>
                        <div className="text-sm text-muted-foreground">
                          Totale No ({simulationData.result["Totale voti"] > 0 ? ((simulationData.result["Totale NO"] / simulationData.result["Totale voti"]) * 100).toFixed(1) : 0}%)
                        </div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-lg font-semibold">Totale votanti: {simulationData.result["Totale voti"]}</div>
                      </div>
                    </div>
                    
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie 
                            data={[
                              { name: "Sì", value: simulationData.result["Totale SI"] },
                              { name: "No", value: simulationData.result["Totale NO"] }
                            ]} 
                            dataKey="value" 
                            nameKey="name" 
                            cx="50%" 
                            cy="50%" 
                            outerRadius={80} 
                            label
                          >
                            <Cell fill="hsl(var(--primary))" />
                            <Cell fill="hsl(var(--destructive))" />
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-muted-foreground mb-2">Utenti generati</div>
                    <div className="max-h-40 overflow-y-auto border rounded p-2">
                      {simulationData.generated_users.map((user, index) => (
                        <div key={user.id} className="text-sm py-1 flex justify-between">
                          <span>{index + 1}. {user.nome} {user.cognome}</span>
                          <span className="text-muted-foreground">{user.categoria}</span>
                          <span className="text-xs text-muted-foreground font-mono">{user.id}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive">
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
                          Termina
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