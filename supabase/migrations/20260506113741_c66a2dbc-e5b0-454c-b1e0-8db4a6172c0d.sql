ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS phone text;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_tenant uuid;
  v_full_name text;
  v_company_name text;
  v_phone text;
BEGIN
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );
  v_company_name := COALESCE(
    NEW.raw_user_meta_data->>'company_name',
    'Meu Workspace'
  );
  v_phone := NEW.raw_user_meta_data->>'phone';

  BEGIN
    INSERT INTO public.user_profiles (id, full_name, phone)
      VALUES (NEW.id, v_full_name, v_phone)
      ON CONFLICT (id) DO UPDATE SET
        full_name = COALESCE(EXCLUDED.full_name, public.user_profiles.full_name),
        phone = COALESCE(EXCLUDED.phone, public.user_profiles.phone);

    INSERT INTO public.tenants (name, created_by)
      VALUES (v_company_name, NEW.id)
      RETURNING id INTO new_tenant;

    INSERT INTO public.memberships (tenant_id, user_id, role)
      VALUES (new_tenant, NEW.id, 'owner')
      ON CONFLICT (tenant_id, user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user falhou para user %: % - %',
      NEW.id, SQLSTATE, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;