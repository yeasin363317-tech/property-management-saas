-- Run in a development Supabase project after all migrations.
-- The intentional exception rolls the transaction back and prints the RESULT payload.
-- Every value must be true.
do $t$
declare
  missing_count int;
  res jsonb;
begin
  select count(*) into missing_count
  from pg_constraint fk
  where fk.contype = 'f'
    and fk.connamespace = 'public'::regnamespace
    and not exists (
      select 1
      from pg_index i
      where i.indrelid = fk.conrelid
        and (i.indkey::int2[])[0:array_length(fk.conkey, 1)-1] = fk.conkey
    );

  res := jsonb_build_object(
    'public_foreign_keys_have_covering_indexes', missing_count = 0,
    'missing_foreign_key_index_count', missing_count
  );
  raise exception 'RESULT: %', res::text;
end $t$;
