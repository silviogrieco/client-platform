-- Fix the handle_new_user trigger to properly set categoria in profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, cognome, username, categoria)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'nome',
    NEW.raw_user_meta_data ->> 'cognome', 
    NEW.raw_user_meta_data ->> 'username',
    NEW.raw_user_meta_data ->> 'categoria'
  );
  RETURN NEW;
END;
$$;