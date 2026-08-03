-- Signup: bootstrap account with school name + optional slug from
-- auth.users.raw_user_meta_data (set by the multi-step signup form).
-- Keys: school_name, account_slug, full_name.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT;
  v_school_name TEXT;
  v_slug TEXT;
  v_account_id UUID;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  v_school_name := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'school_name', '')), '');
  v_slug := NULLIF(lower(trim(COALESCE(NEW.raw_user_meta_data->>'account_slug', ''))), '');

  IF v_slug IS NOT NULL THEN
    -- Soft-validate; invalid / reserved / taken → leave NULL so bootstrap
    -- still creates the account (UI should have blocked these).
    IF v_slug !~ '^[a-z0-9]([a-z0-9-]{1,46}[a-z0-9])$'
       OR v_slug IN ('app', 'www', 'admin', 'api', 'mail')
       OR EXISTS (SELECT 1 FROM public.accounts a WHERE a.slug = v_slug)
    THEN
      v_slug := NULL;
    END IF;
  END IF;

  INSERT INTO public.accounts (name, owner_user_id, slug)
  VALUES (
    COALESCE(
      v_school_name,
      NULLIF(v_full_name, ''),
      NEW.email,
      'Minha escola'
    ),
    NEW.id,
    v_slug
  )
  RETURNING id INTO v_account_id;

  INSERT INTO public.profiles (user_id, full_name, email, account_id, account_role)
  VALUES (NEW.id, v_full_name, NEW.email, v_account_id, 'owner');

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to bootstrap account/profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
