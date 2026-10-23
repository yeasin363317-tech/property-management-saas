-- Run in the Supabase SQL editor (development project only). Rolls back at the end via an exception;
-- read the RESULT line in the error message. Every value must be true.
do $t$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); ud uuid := gen_random_uuid();
  oa uuid; ob uuid; pa uuid; un uuid; tn uuid; ls uuid; inv uuid; res jsonb := '[]'::jsonb; n int; bal numeric; v text;
begin
  insert into auth.users (id, email, aud, role) values
    (ua, 'a@test.dev', 'authenticated', 'authenticated'), (ub, 'b@test.dev', 'authenticated', 'authenticated'), (ud, 'd@test.dev', 'authenticated', 'authenticated');
  insert into public.platform_admins (user_id, role) values (ud, 'support_admin');

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  oa := public.create_organization('Org A');
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  ob := public.create_organization('Org B');

  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  insert into public.properties (organization_id, name, address_line, created_by) values (oa, 'P1', 'Addr 1', ua) returning id into pa;
  insert into public.units (organization_id, property_id, unit_number, expected_rent) values (oa, pa, '1A', 15000) returning id into un;
  insert into public.tenants (organization_id, full_name) values (oa, 'Tenant One') returning id into tn;
  insert into public.leases (organization_id, unit_id, tenant_id, start_date, monthly_rent, status) values (oa, un, tn, current_date - 30, 15000, 'active') returning id into ls;
  select count(*) into n from public.units where id = un and status = 'occupied';
  res := res || jsonb_build_object('unit_occupied_after_active_lease', n = 1);

  begin insert into public.leases (organization_id, unit_id, tenant_id, start_date, monthly_rent, status) values (oa, un, tn, current_date, 100, 'active');
    res := res || jsonb_build_object('overlap_rejected', false);
  exception when others then res := res || jsonb_build_object('overlap_rejected', true); end;

  begin insert into public.properties (organization_id, name, address_line) values (ob, 'Hack', 'x');
    res := res || jsonb_build_object('cross_org_insert_blocked', false);
  exception when others then res := res || jsonb_build_object('cross_org_insert_blocked', true); end;

  n := public.generate_invoices(oa, current_date);
  res := res || jsonb_build_object('invoice_generated', n = 1);
  n := public.generate_invoices(oa, current_date);
  res := res || jsonb_build_object('duplicate_invoice_prevented', n = 0);
  select id into inv from public.rent_invoices where organization_id = oa limit 1;

  perform public.record_payment(inv, 10000, current_date, 'cash', 'r1', 'k1');
  perform public.record_payment(inv, 10000, current_date, 'cash', 'r1', 'k1');
  select amount_due - amount_paid into bal from public.rent_invoices where id = inv;
  res := res || jsonb_build_object('partial_payment_balance_5000_and_idempotent', bal = 5000);

  begin perform public.record_payment(inv, 6000, current_date, 'cash'); res := res || jsonb_build_object('overpayment_rejected', false);
  exception when others then res := res || jsonb_build_object('overpayment_rejected', true); end;

  perform public.record_payment(inv, 5000, current_date, 'cash');
  select status into v from public.rent_invoices where id = inv;
  res := res || jsonb_build_object('fully_paid_status', v = 'paid');

  begin update public.rent_invoices set amount_paid = 0 where id = inv; res := res || jsonb_build_object('direct_invoice_update_blocked', false);
  exception when others then res := res || jsonb_build_object('direct_invoice_update_blocked', true); end;

  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  select count(*) into n from public.properties where organization_id = oa;
  res := res || jsonb_build_object('B_cannot_read_A_properties', n = 0);
  select count(*) into n from public.rent_invoices;
  res := res || jsonb_build_object('B_cannot_read_A_invoices', n = 0);
  begin perform public.record_payment(inv, 1, current_date, 'cash'); res := res || jsonb_build_object('B_cannot_pay_A_invoice', false);
  exception when others then res := res || jsonb_build_object('B_cannot_pay_A_invoice', true); end;
  begin perform public.admin_stats(); res := res || jsonb_build_object('landlord_blocked_from_admin_api', false);
  exception when others then res := res || jsonb_build_object('landlord_blocked_from_admin_api', true); end;
  begin insert into public.platform_admins (user_id, role) values (ub, 'super_admin'); res := res || jsonb_build_object('self_grant_admin_blocked', false);
  exception when others then res := res || jsonb_build_object('self_grant_admin_blocked', true); end;

  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  perform public.reverse_payment((select id from public.payments where invoice_id = inv and amount = 5000 limit 1), 'entered by mistake');
  select status into v from public.rent_invoices where id = inv;
  res := res || jsonb_build_object('reversal_reopens_invoice', v = 'open');

  perform set_config('request.jwt.claims', json_build_object('sub', ud, 'role', 'authenticated')::text, true);
  res := res || jsonb_build_object('support_sees_stats', (public.admin_stats() ->> 'users_total')::int >= 3);
  begin perform public.admin_set_flag('tenant_portal', false, 'testing flag'); res := res || jsonb_build_object('support_blocked_flags', false);
  exception when others then res := res || jsonb_build_object('support_blocked_flags', true); end;
  begin perform public.admin_set_subscription(oa, 'pro', 'active', 'testing billing'); res := res || jsonb_build_object('support_blocked_billing', false);
  exception when others then res := res || jsonb_build_object('support_blocked_billing', true); end;
  begin perform public.admin_set_user_status(ud, 'suspended', 'suspend myself'); res := res || jsonb_build_object('admin_cannot_suspend_self', false);
  exception when others then res := res || jsonb_build_object('admin_cannot_suspend_self', true); end;
  begin perform public.admin_set_user_status(ua, 'suspended', 'abuse report'); res := res || jsonb_build_object('sole_owner_needs_force', false);
  exception when others then res := res || jsonb_build_object('sole_owner_needs_force', true); end;
  perform public.admin_set_user_status(ua, 'suspended', 'abuse report', true);
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  select count(*) into n from public.properties;
  res := res || jsonb_build_object('suspended_user_loses_access', n = 0);

  reset role;
  raise exception 'RESULT: %', res::text;
end $t$;
