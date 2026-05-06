CREATE OR REPLACE FUNCTION public.compute_maturity_score(p_tenant_id uuid, p_answers jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_dim text;
  v_score int;
  v_assessment_id uuid;
  v_results jsonb := '[]'::jsonb;
  v_dimensions text[] := ARRAY['vision','okrs','rituals','team','financial'];
BEGIN
  IF NOT public.is_member(p_tenant_id, auth.uid()) THEN
    RAISE EXCEPTION 'Sem acesso ao tenant %', p_tenant_id;
  END IF;

  IF jsonb_typeof(p_answers) <> 'object' THEN
    RAISE EXCEPTION 'p_answers deve ser objeto JSON {dimensao: [valores]}';
  END IF;

  FOREACH v_dim IN ARRAY v_dimensions LOOP
    SELECT COALESCE(round(avg((val)::numeric))::int, 0) INTO v_score
      FROM jsonb_array_elements_text(COALESCE(p_answers->v_dim, '[]'::jsonb)) AS t(val)
      WHERE val ~ '^[0-9]+(\.[0-9]+)?$';

    v_score := LEAST(100, GREATEST(0, v_score));

    INSERT INTO public.maturity_assessments
      (tenant_id, dimension, score, answers_json)
    VALUES
      (p_tenant_id, v_dim::public.maturity_dimension, v_score,
       jsonb_build_object('values', COALESCE(p_answers->v_dim, '[]'::jsonb)))
    RETURNING id INTO v_assessment_id;

    IF v_score < 40 THEN
      INSERT INTO public.maturity_recommendations
        (tenant_id, assessment_id, dimension, recommendation_md, priority)
      VALUES
        (p_tenant_id, v_assessment_id, v_dim::public.maturity_dimension,
         '**' || v_dim || ' (' || v_score || '/100):** Estagio inicial. Comece pelos rituais basicos e estruture OKRs trimestrais.',
         3);
    ELSIF v_score < 70 THEN
      INSERT INTO public.maturity_recommendations
        (tenant_id, assessment_id, dimension, recommendation_md, priority)
      VALUES
        (p_tenant_id, v_assessment_id, v_dim::public.maturity_dimension,
         '**' || v_dim || ' (' || v_score || '/100):** Em desenvolvimento. Foque em consistencia de check-ins e cascateamento de objetivos.',
         2);
    ELSE
      INSERT INTO public.maturity_recommendations
        (tenant_id, assessment_id, dimension, recommendation_md, priority)
      VALUES
        (p_tenant_id, v_assessment_id, v_dim::public.maturity_dimension,
         '**' || v_dim || ' (' || v_score || '/100):** Maturo. Mantenha o ritual e busque otimizacao incremental.',
         1);
    END IF;

    v_results := v_results || jsonb_build_object('dimension', v_dim, 'score', v_score, 'assessment_id', v_assessment_id);
  END LOOP;

  RETURN jsonb_build_object(
    'tenant_id', p_tenant_id,
    'results', v_results,
    'overall',
      (SELECT round(avg((e->>'score')::int))::int
         FROM jsonb_array_elements(v_results) e)
  );
END;
$function$;