-- Add foreign key constraint from profiles.categoria to categoria.nome
ALTER TABLE public.profiles 
ADD CONSTRAINT fk_profiles_categoria 
FOREIGN KEY (categoria) REFERENCES public.categoria(nome);

-- Create RPC function for dashboard ballots
CREATE OR REPLACE FUNCTION public.rpc_dashboard_ballots()
RETURNS TABLE (
  ballot_id bigint,
  topic text,
  categoria text,
  conclusa boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_categoria text;
  is_user_admin boolean;
BEGIN
  -- Get user's category and admin status
  SELECT p.categoria INTO user_categoria
  FROM public.profiles p
  WHERE p.id = auth.uid();
  
  SELECT public.has_role(auth.uid(), 'admin'::app_role) INTO is_user_admin;
  
  -- Return ballots based on user role and category
  IF is_user_admin THEN
    -- Admin sees all ballots
    RETURN QUERY
    SELECT v.id, v."Topic"::text, v.categoria::text, v."Concluded"
    FROM public."Votazioni" v
    ORDER BY v.id DESC;
  ELSE
    -- Regular users see only active ballots from their category
    RETURN QUERY
    SELECT v.id, v."Topic"::text, v.categoria::text, v."Concluded"
    FROM public."Votazioni" v
    WHERE v.categoria = user_categoria
      AND v."Concluded" = false
    ORDER BY v.id DESC;
  END IF;
END;
$$;

-- Update RLS policies for Votazioni to respect categories
DROP POLICY IF EXISTS "Users can view concluded votazioni" ON public."Votazioni";

CREATE POLICY "Users can view votazioni from their category"
ON public."Votazioni"
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) 
  OR 
  (categoria = (SELECT categoria FROM public.profiles WHERE id = auth.uid()))
);