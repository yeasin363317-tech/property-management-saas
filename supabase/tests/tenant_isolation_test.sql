-- Run in the Supabase SQL editor (development project only). It raises an exception at the end
-- so everything is rolled back; read the RESULT line in the error message. All values must be true.
do $t$
declare
  ua uuid := gen_random_uuid(); ut1 uuid := gen_random_uuid(); ut2 uuid := gen_random_uuid();
  oa uuid; pa uuid; u1 uuid; u2 uuid; t1 uuid; t2 uuid; l1 uuid; l2 uuid; tok uuid; res jsonb := '[]'::jsonb; n int; ov jsonb;
begin
  insert into auth.users (id, email, aud, role) values
    (ua, 'owner@test.dev', 'authenticated', 'authenticated'),
    (ut1, 'tenant1@test.dev', 'authenticated', 'authenticated'),
    (ut2, 'tenant2@test.dev', 'authenticated', 'authenticated');
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  oa := public.create_organization('Tenant Test Org');
  insert into public.properties (organization_id, name, address_line, created_by) values (oa, 'P', 'A', ua) returning id into pa;
  insert into public.units (organization_id, property_id, unit_number) values (oa, pa, '1') returning id into u1;
  insert into public.units (organization_id, property_id, unit_number) values (oa, pa, '2') returning id into u2;
  insert into public.tenants (organization_id, full_name, email) values (oa, 'T1', 'tenant1@test.dev') returning id into t1;
  insert into public.tenants (organization_id, full_name, email) values (oa, 'T2', 'tenant2@test.dev') returning id into t2;
  insert into public.leases (organization_id, unit_id, tenant_id, start_date, monthly_rent, status) values (oa, u1, t1, current_date - 5, 1000, 'active') returning id into l1;
  insert into public.leases (organization_id, unit_id, tenant_id, start_date, monthly_rent, status) values (oa, u2, t2, current_date - 5, 2000, 'active') returning id into l2;
  perform public.generate_invoices(oa, current_date);
  insert into public.invitations (organization_id, email, role, tenant_id, invited_by) values (oa, 'tenant1@test.dev', 'tenant', t1, ua) returning token into tok;

  -- wrong user cannot accept
  perform set_config('request.jwt.claims', json_build_object('sub', ut2, 'role', 'authenticated')::text, true);
  begin perform public.accept_invitation(tok); res := res || jsonb_build_object('wrong_email_cannot_accept_invite', false);
  exception when others then res := res || jsonb_build_object('wrong_email_cannot_accept_invite', true); end;

  -- right user accepts
  perform set_config('request.jwt.claims', json_build_object('sub', ut1, 'role', 'authenticated')::text, true);
  perform public.accept_invitation(tok);
  select count(*) into n from public.rent_invoices;
  res := res || jsonb_build_object('tenant1_sees_only_own_invoice', n = 1);
  select count(*) into n from public.rent_invoices where tenant_id = t2;
  res := res || jsonb_build_object('tenant1_cannot_see_tenant2_invoice', n = 0);
  select count(*) into n from public.leases;
  res := res || jsonb_build_object('tenant1_sees_only_own_lease', n = 1);
  select count(*) into n from public.tenants;
  res := res || jsonb_build_object('tenant1_sees_only_self', n = 1);
  select count(*) into n from public.properties;
  res := res || jsonb_build_object('tenant_cannot_read_properties', n = 0);
  select count(*) into n from public.expenses;
  res := res || jsonb_build_object('tenant_cannot_read_expenses', n = 0);
  begin perform public.generate_invoices(oa, current_date); res := res || jsonb_build_object('tenant_cannot_generate_invoices', false);
  exception when others then res := res || jsonb_build_object('tenant_cannot_generate_invoices', true); end;
  ov := public.portal_overview();
  res := res || jsonb_build_object('portal_overview_shows_one_tenant_record', jsonb_array_length(ov) = 1);

  -- maintenance requests
  begin insert into public.maintenance_requests (organization_id, property_id, unit_id, tenant_id, title, created_by) values (oa, pa, u1, t1, 'Leaking tap', ut1);
    res := res || jsonb_build_object('tenant_can_request_for_own_unit', true);
  exception when others then res := res || jsonb_build_object('tenant_can_request_for_own_unit', false); end;
  begin insert into public.maintenance_requests (organization_id, property_id, unit_id, tenant_id, title, created_by) values (oa, pa, u2, t1, 'Other unit', ut1);
    res := res || jsonb_build_object('tenant_blocked_from_other_unit_request', false);
  exception when others then res := res || jsonb_build_object('tenant_blocked_from_other_unit_request', true); end;
  begin insert into public.maintenance_requests (organization_id, property_id, unit_id, tenant_id, title, created_by) values (oa, pa, u2, t2, 'As other tenant', ut1);
    res := res || jsonb_build_object('tenant_blocked_from_other_tenant_request', false);
  exception when others then res := res || jsonb_build_object('tenant_blocked_from_other_tenant_request', true); end;

  reset role;
  raise exception 'RESULT: %', res::text;
end $t$;
