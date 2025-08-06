-- Abilita Row Level Security sulle tabelle esistenti e crea politiche

-- Abilita RLS sulla tabella Utenti (anche se useremo Supabase Auth, manteniamo per compatibilità)
ALTER TABLE public."Utenti" ENABLE ROW LEVEL SECURITY;

-- Abilita RLS sulla tabella Votazioni  
ALTER TABLE public."Votazioni" ENABLE ROW LEVEL SECURITY;

-- Crea una tabella profiles per gli utenti autenticati
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT,
  cognome TEXT,
  username TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (id)
);

-- Abilita RLS sulla tabella profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Politiche per la tabella profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can create their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id);

-- Politiche per la tabella Votazioni
CREATE POLICY "Authenticated users can view votazioni" 
ON public."Votazioni" 
FOR SELECT 
TO authenticated
USING (true);

-- Solo admin possono modificare votazioni (per ora permettiamo a tutti gli utenti autenticati)
CREATE POLICY "Authenticated users can insert votazioni" 
ON public."Votazioni" 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update votazioni" 
ON public."Votazioni" 
FOR UPDATE 
TO authenticated
USING (true);

-- Crea una tabella per tracciare i voti degli utenti
CREATE TABLE IF NOT EXISTS public.user_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  votazione_id BIGINT NOT NULL REFERENCES public."Votazioni"(id) ON DELETE CASCADE,
  voto BOOLEAN NOT NULL, -- true per Si, false per No
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (id),
  UNIQUE(user_id, votazione_id) -- Un utente può votare solo una volta per votazione
);

-- Abilita RLS sulla tabella user_votes
ALTER TABLE public.user_votes ENABLE ROW LEVEL SECURITY;

-- Politiche per user_votes
CREATE POLICY "Users can view their own votes" 
ON public.user_votes 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own votes" 
ON public.user_votes 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Funzione per aggiornare updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger per aggiornare updated_at su profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Funzione per creare automaticamente un profilo quando un utente si registra
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, cognome, username)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'nome',
    NEW.raw_user_meta_data ->> 'cognome', 
    NEW.raw_user_meta_data ->> 'username'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger per creare profilo automaticamente
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();