-- Drop existing foreign key if it exists and recreate tables with proper structure
DROP TABLE IF EXISTS user_votes CASCADE;
DROP TABLE IF EXISTS votes CASCADE;

-- Update categoria table structure
ALTER TABLE categoria 
DROP CONSTRAINT IF EXISTS categoria_pkey CASCADE,
DROP COLUMN IF EXISTS id CASCADE;

ALTER TABLE categoria 
ADD CONSTRAINT categoria_pkey PRIMARY KEY (nome);

-- Ensure num_utenti has proper default
ALTER TABLE categoria 
ALTER COLUMN num_utenti SET DEFAULT 0,
ALTER COLUMN num_utenti SET NOT NULL;

-- Update profiles table to reference categoria properly
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS profiles_categoria_fkey;

ALTER TABLE profiles 
ADD CONSTRAINT profiles_categoria_fkey 
FOREIGN KEY (categoria) REFERENCES categoria(nome);

-- Update Votazioni table structure
ALTER TABLE "Votazioni" 
ADD CONSTRAINT votazioni_categoria_fkey 
FOREIGN KEY (categoria) REFERENCES categoria(nome);

-- Rename and restructure Votazioni table to match requirements
ALTER TABLE "Votazioni" 
RENAME TO votazioni;

ALTER TABLE votazioni 
RENAME COLUMN "Topic" TO topic;
ALTER TABLE votazioni 
RENAME COLUMN "Si" TO si;
ALTER TABLE votazioni 
RENAME COLUMN "No" TO no;
ALTER TABLE votazioni 
RENAME COLUMN "Concluded" TO concluded;

-- Remove unused columns
ALTER TABLE votazioni 
DROP COLUMN IF EXISTS "Percentuale_si",
DROP COLUMN IF EXISTS "Percentuale_no",
DROP COLUMN IF EXISTS "Num_elettori";

-- Set proper defaults
ALTER TABLE votazioni 
ALTER COLUMN si SET DEFAULT 0,
ALTER COLUMN no SET DEFAULT 0,
ALTER COLUMN concluded SET DEFAULT FALSE;

-- Create votes table for tracking individual votes
CREATE TABLE votes (
  votazione_id BIGINT REFERENCES votazioni(id) NOT NULL,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (votazione_id, user_id)
);

-- Enable RLS on new table
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Create view for votazioni status
CREATE OR REPLACE VIEW v_votazioni_status AS
SELECT 
  v.id,
  v.topic,
  v.categoria,
  v.concluded,
  v.si,
  v.no,
  COALESCE(vote_counts.votes_count, 0) as votes_count,
  c.num_utenti as total_users,
  (COALESCE(vote_counts.votes_count, 0) = c.num_utenti) as is_concluded
FROM votazioni v
LEFT JOIN categoria c ON v.categoria = c.nome
LEFT JOIN (
  SELECT votazione_id, COUNT(*) as votes_count
  FROM votes 
  GROUP BY votazione_id
) vote_counts ON v.id = vote_counts.votazione_id;

-- Create trigger function to update categoria.num_utenti
CREATE OR REPLACE FUNCTION categoria_sync_num_utenti()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.categoria IS NOT NULL THEN
      UPDATE categoria c
         SET num_utenti = (SELECT COUNT(*) FROM profiles p WHERE p.categoria = NEW.categoria)
       WHERE c.nome = NEW.categoria;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Se è cambiata la categoria, ricalcola sia la vecchia sia la nuova
    IF NEW.categoria IS DISTINCT FROM OLD.categoria THEN
      IF OLD.categoria IS NOT NULL THEN
        UPDATE categoria c
           SET num_utenti = (SELECT COUNT(*) FROM profiles p WHERE p.categoria = OLD.categoria)
         WHERE c.nome = OLD.categoria;
      END IF;
      IF NEW.categoria IS NOT NULL THEN
        UPDATE categoria c
           SET num_utenti = (SELECT COUNT(*) FROM profiles p WHERE p.categoria = NEW.categoria)
         WHERE c.nome = NEW.categoria;
      END IF;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.categoria IS NOT NULL THEN
      UPDATE categoria c
         SET num_utenti = (SELECT COUNT(*) FROM profiles p WHERE p.categoria = OLD.categoria)
       WHERE c.nome = OLD.categoria;
    END IF;
  END IF;

  RETURN NULL; -- AFTER trigger: il return è ignorato
END;
$$ LANGUAGE plpgsql;

-- Create triggers on profiles table
DROP TRIGGER IF EXISTS categoria_sync_after_insert ON profiles;
DROP TRIGGER IF EXISTS categoria_sync_after_update ON profiles;
DROP TRIGGER IF EXISTS categoria_sync_after_delete ON profiles;

CREATE TRIGGER categoria_sync_after_insert
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION categoria_sync_num_utenti();

CREATE TRIGGER categoria_sync_after_update
  AFTER UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION categoria_sync_num_utenti();

CREATE TRIGGER categoria_sync_after_delete
  AFTER DELETE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION categoria_sync_num_utenti();

-- Update RLS policies for votazioni
DROP POLICY IF EXISTS "Admins can insert votazioni" ON votazioni;
DROP POLICY IF EXISTS "Admins can update votazioni" ON votazioni;
DROP POLICY IF EXISTS "Admins can view all votazioni" ON votazioni;
DROP POLICY IF EXISTS "Users can view votazioni from their category" ON votazioni;

CREATE POLICY "Admins can manage votazioni" 
ON votazioni 
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view votazioni from their category" 
ON votazioni 
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  categoria = (SELECT p.categoria FROM profiles p WHERE p.id = auth.uid())
);

-- RLS policies for votes table
CREATE POLICY "Users can insert their own votes" 
ON votes 
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own votes" 
ON votes 
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all votes" 
ON votes 
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Update RLS policies for categoria table
ALTER TABLE categoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view categories" 
ON categoria 
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage categories" 
ON categoria 
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create function to get number of users in a category
CREATE OR REPLACE FUNCTION get_num_utenti_categoria(cat_nome TEXT)
RETURNS INTEGER
LANGUAGE SQL
SECURITY DEFINER
SET search_path = 'public'
AS $$
  select num_utenti
  from categoria
  where nome = cat_nome;
$$;

-- Update the dashboard RPC to use new table names
CREATE OR REPLACE FUNCTION rpc_dashboard_ballots()
RETURNS TABLE(ballot_id BIGINT, topic TEXT, categoria TEXT, conclusa BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_categoria TEXT;
  is_user_admin BOOLEAN;
BEGIN
  -- Get user's category and admin status
  SELECT p.categoria INTO user_categoria
  FROM profiles p
  WHERE p.id = auth.uid();
  
  SELECT has_role(auth.uid(), 'admin'::app_role) INTO is_user_admin;
  
  -- Return ballots based on user role and category
  IF is_user_admin THEN
    -- Admin sees all ballots
    RETURN QUERY
    SELECT v.id, v.topic, v.categoria, v.concluded
    FROM votazioni v
    ORDER BY v.id DESC;
  ELSE
    -- Regular users see only active ballots from their category
    RETURN QUERY
    SELECT v.id, v.topic, v.categoria, v.concluded
    FROM votazioni v
    WHERE v.categoria = user_categoria
      AND v.concluded = false
    ORDER BY v.id DESC;
  END IF;
END;
$$;

-- Create RPC for results list
CREATE OR REPLACE FUNCTION rpc_results_list()
RETURNS TABLE(
  ballot_id BIGINT, 
  topic TEXT, 
  categoria TEXT, 
  si INTEGER, 
  no INTEGER, 
  total_voters INTEGER,
  si_percentage NUMERIC,
  no_percentage NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_categoria TEXT;
  is_user_admin BOOLEAN;
BEGIN
  -- Get user's category and admin status
  SELECT p.categoria INTO user_categoria
  FROM profiles p
  WHERE p.id = auth.uid();
  
  SELECT has_role(auth.uid(), 'admin'::app_role) INTO is_user_admin;
  
  -- Return concluded ballots with results
  IF is_user_admin THEN
    -- Admin sees all concluded ballots
    RETURN QUERY
    SELECT 
      v.id, 
      v.topic, 
      v.categoria, 
      v.si, 
      v.no,
      v.si + v.no as total_voters,
      CASE WHEN (v.si + v.no) > 0 THEN ROUND((v.si::NUMERIC / (v.si + v.no)) * 100, 1) ELSE 0 END as si_percentage,
      CASE WHEN (v.si + v.no) > 0 THEN ROUND((v.no::NUMERIC / (v.si + v.no)) * 100, 1) ELSE 0 END as no_percentage
    FROM votazioni v
    WHERE v.concluded = true
    ORDER BY v.topic;
  ELSE
    -- Regular users see only concluded ballots from their category
    RETURN QUERY
    SELECT 
      v.id, 
      v.topic, 
      v.categoria, 
      v.si, 
      v.no,
      v.si + v.no as total_voters,
      CASE WHEN (v.si + v.no) > 0 THEN ROUND((v.si::NUMERIC / (v.si + v.no)) * 100, 1) ELSE 0 END as si_percentage,
      CASE WHEN (v.si + v.no) > 0 THEN ROUND((v.no::NUMERIC / (v.si + v.no)) * 100, 1) ELSE 0 END as no_percentage
    FROM votazioni v
    WHERE v.categoria = user_categoria
      AND v.concluded = true
    ORDER BY v.topic;
  END IF;
END;
$$;

-- Create indices for performance
CREATE INDEX IF NOT EXISTS idx_profiles_categoria ON profiles(categoria);
CREATE INDEX IF NOT EXISTS idx_votazioni_categoria ON votazioni(categoria);
CREATE INDEX IF NOT EXISTS idx_votes_votazione_id ON votes(votazione_id);
CREATE INDEX IF NOT EXISTS idx_votes_user_id ON votes(user_id);