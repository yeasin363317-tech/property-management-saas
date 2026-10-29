-- 009: add a supporting index for every foreign key that has none (idempotent).
do $$
declare r record; idx text;
begin
  for r in
    select k.conrelid::regclass::text as tbl, k.conname,
           (select string_agg(quote_ident(a.attname), ', ' order by u.ord)
              from unnest(k.conkey) with ordinality u(attnum, ord)
              join pg_attribute a on a.attrelid = k.conrelid and a.attnum = u.attnum) as cols
    from pg_constraint k
    where k.contype = 'f' and k.connamespace = 'public'::regnamespace
      and not exists (
        select 1 from pg_index i
        where i.indrelid = k.conrelid
          and (i.indkey::int2[])[0:array_length(k.conkey,1)-1] = k.conkey)
  loop
    idx := left('idx_' || regexp_replace(r.conname, '[^a-zA-Z0-9_]', '_', 'g'), 63);
    execute format('create index if not exists %I on %s (%s)', idx, r.tbl, r.cols);
  end loop;
end $$;
