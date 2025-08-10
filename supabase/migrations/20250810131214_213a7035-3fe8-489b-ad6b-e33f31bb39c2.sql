-- Fix security definer view by removing it and using RPC instead
DROP VIEW IF EXISTS v_votazioni_status;

-- Fix function search paths
CREATE OR REPLACE FUNCTION categoria_sync_num_utenti()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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

  RETURN NULL;
END;
$$;

-- Update dashboard RPC with proper search path
CREATE OR REPLACE FUNCTION rpc_dashboard_ballots()
RETURNS TABLE(ballot_id BIGINT, topic TEXT, categoria TEXT, conclusa BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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

-- Update results RPC with proper search path
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
SET search_path = 'public'
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