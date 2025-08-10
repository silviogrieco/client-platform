-- Add foreign key constraint from profiles.categoria to categoria.nome
ALTER TABLE public.profiles 
ADD CONSTRAINT fk_profiles_categoria 
FOREIGN KEY (categoria) REFERENCES public.categoria(nome);

-- Create RPC function for dashboard ballots
CREATE OR REPLACE FUNCTION public.rpc_dashboard_ballots()
RETURNS TABLE (
  ballot_id public."votazioni"."id"%TYPE,
  topic     public."votazioni"."topic"%TYPE,
  categoria public."votazioni"."categoria"%TYPE,
  conclusa  public."votazioni"."concluded"%TYPE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_categoria public.profiles.categoria%TYPE;
  is_user_admin boolean;
BEGIN
  -- categoria utente
  SELECT p.categoria INTO user_categoria
  FROM public.profiles p
  WHERE p.id = auth.uid();

  -- ruolo admin?
  SELECT public.has_role(auth.uid(), 'admin'::app_role) INTO is_user_admin;

  IF is_user_admin THEN
    RETURN QUERY
    SELECT v.id, v."topic", v.categoria, v."concluded"
    FROM public."votazioni" v
    ORDER BY v.id DESC;
  ELSE
    RETURN QUERY
    SELECT v.id, v."topic", v.categoria, v."concluded"
    FROM public."votazioni" v
    WHERE v.categoria = user_categoria
      AND v."concluded" = false
    ORDER BY v.id DESC;
  END IF;
END;
$$;
-- Update RLS policies for Votazioni to respect categories
DROP POLICY IF EXISTS "Users can view concluded votazioni" ON public."votazioni";

CREATE POLICY "Users can view votazioni from their category"
ON public."votazioni"
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) 
  OR 
  (categoria = (SELECT categoria FROM public.profiles WHERE id = auth.uid()))
);