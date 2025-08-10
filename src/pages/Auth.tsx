import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categories, setCategories] = useState<{ nome: string }[]>([]);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    nome: '',
    cognome: '',
    username: '',
    categoria: '',
  });

  const { user, signIn, signUp } = useAuth();

  // Redirect if already authenticated
  if (user) {
    return <Navigate to="/" replace />;
  }

  // Load categories on mount
  useEffect(() => {
    const loadCategories = async () => {
      setCategoriesLoading(true);
      try {
        const { data, error } = await supabase
          .from('categoria')
          .select('nome')
          .order('nome');
        
        if (error) throw error;
        setCategories(data || []);
      } catch (error: any) {
        toast({
          title: "Errore",
          description: "Impossibile caricare le categorie",
          variant: "destructive"
        });
      } finally {
        setCategoriesLoading(false);
      }
    };
    
    loadCategories();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(formData.email, formData.password);
        if (error) {
          toast({
            title: "Errore di accesso",
            description: error.message,
            variant: "destructive"
          });
        } else {
          toast({
            title: "Accesso effettuato",
            description: "Benvenuto nella piattaforma di e-voting!"
          });
        }
      } else {
        // Validate categoria is selected for registration
        if (!formData.categoria) {
          toast({
            title: "Categoria richiesta",
            description: "Seleziona una categoria per registrarti",
            variant: "destructive"
          });
          return;
        }

        const { error } = await signUp(formData.email, formData.password, {
          nome: formData.nome,
          cognome: formData.cognome,
          username: formData.username,
          categoria: formData.categoria,
        });
        if (error) {
          toast({
            title: "Errore di registrazione",
            description: error.message,
            variant: "destructive"
          });
        } else {
          toast({
            title: "Registrazione completata",
            description: "Controlla la tua email per confermare l'account."
          });
        }
      }
    } catch (error) {
      toast({
        title: "Errore",
        description: "Si è verificato un errore inaspettato.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">
            {isLogin ? 'Accedi' : 'Registrati'}
          </CardTitle>
          <CardDescription className="text-center">
            {isLogin 
              ? 'Accedi alla piattaforma di e-voting' 
              : 'Crea un nuovo account per votare'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome</Label>
                  <Input
                    id="nome"
                    name="nome"
                    type="text"
                    value={formData.nome}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cognome">Cognome</Label>
                  <Input
                    id="cognome"
                    name="cognome"
                    type="text"
                    value={formData.cognome}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    value={formData.username}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="categoria">Categoria *</Label>
                  <Select 
                    value={formData.categoria} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, categoria: value }))}
                    disabled={categoriesLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={categoriesLoading ? "Caricamento..." : "Seleziona categoria"} />
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
              </>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleInputChange}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading 
                ? 'Caricamento...' 
                : (isLogin ? 'Accedi' : 'Registrati')
              }
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Button
              variant="ghost"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm"
            >
              {isLogin 
                ? 'Non hai un account? Registrati' 
                : 'Hai già un account? Accedi'
              }
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;