create function public.portal_overview() returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Not authorized' using errcode = '42501'; end if;
  if exists (select 1 from public.feature_flags where key = 'tenant_portal' and enabled = false) then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'tenant_id', t.id, 'organization_id', t.organization_id, 'tenant_name', t.full_name,
      'organization_name', o.name, 'currency', o.currency,
      'leases', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', l.id, 'status', l.status, 'start_date', l.start_date, 'end_date', l.end_date, 'monthly_rent', l.monthly_rent,
          'security_deposit', l.security_deposit, 'due_day', l.due_day, 'unit_id', u.id, 'unit_number', u.unit_number,
          'property_id', p.id, 'property_name', p.name, 'address', p.address_line) order by l.start_date desc)
        from public.leases l join public.units u on u.id = l.unit_id join public.properties p on p.id = u.property_id
        where l.tenant_id = t.id), '[]'::jsonb)
    ))
    from public.tenants t
    join public.organizations o on o.id = t.organization_id and o.status = 'active'
    where t.user_id = auth.uid() and public.has_org_role(t.organization_id, array['tenant'])
  ), '[]'::jsonb);
end $$;

create function public.tenant_has_unit(p_tenant uuid, p_unit uuid, p_property uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tenants t
    join public.leases l on l.tenant_id = t.id and l.status = 'active'
    join public.units u on u.id = l.unit_id
    where t.id = p_tenant and t.user_id = auth.uid() and u.id = p_unit and u.property_id = p_property
  )
$$;

revoke execute on function public.portal_overview(), public.tenant_has_unit(uuid, uuid, uuid) from public, anon;
grant execute on function public.portal_overview(), public.tenant_has_unit(uuid, uuid, uuid) to authenticated;

drop policy mr_insert on public.maintenance_requests;
create policy mr_insert on public.maintenance_requests for insert to authenticated with check (
  created_by = auth.uid() and (
    public.has_org_role(organization_id, array['owner','property_manager','maintenance'])
    or (public.has_org_role(organization_id, array['tenant']) and status = 'new' and unit_id is not null
        and public.tenant_has_unit(tenant_id, unit_id, property_id))));
