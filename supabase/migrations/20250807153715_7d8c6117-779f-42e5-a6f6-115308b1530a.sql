-- Create roles enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

-- Policies for user_roles
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view their roles" ON public.user_roles;
EXCEPTION WHEN undefined_object THEN NULL; END $$;
CREATE POLICY "Users can view their roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
EXCEPTION WHEN undefined_object THEN NULL; END $$;
CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add concluded column to Votazioni
DO $$ BEGIN
  ALTER TABLE public."Votazioni"
  ADD COLUMN "Concluded" boolean NOT NULL DEFAULT false;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- Index for faster queries on concluded
CREATE INDEX IF NOT EXISTS idx_votazioni_concluded ON public."Votazioni" ("Concluded");

-- Adjust RLS policies on Votazioni
DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated users can insert votazioni" ON public."Votazioni";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated users can update votazioni" ON public."Votazioni";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated users can view votazioni" ON public."Votazioni";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- Admins can insert
CREATE POLICY "Admins can insert votazioni"
ON public."Votazioni"
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admins can update
CREATE POLICY "Admins can update votazioni"
ON public."Votazioni"
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- All users can view concluded votazioni
CREATE POLICY "Users can view concluded votazioni"
ON public."Votazioni"
FOR SELECT
TO authenticated
USING ("Concluded" = true);

-- Admins can view all votazioni
CREATE POLICY "Admins can view all votazioni"
ON public."Votazioni"
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
