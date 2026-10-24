-- Rentora: OPTIONAL demo data (2 demo accounts + sample properties, tenants, leases, invoices, payments, expenses, maintenance).
-- Run database/schema.sql first. Then run this file, then call the function with a password YOU choose:
--   select public.seed_demo('choose-a-demo-password-12+chars');
-- Use the same password as VITE_DEMO_PASSWORD on your host so the "Try demo" buttons work.
-- Never reuse a real password here: the demo password is shared with anyone who tries the demo.

create function public._demo_make_user(p_email text, p_name text, p_password text) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  select id into v_id from auth.users where email = p_email;
  if v_id is not null then return v_id; end if;
  v_id := gen_random_uuid();
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, reauthentication_token, phone_change, phone_change_token)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', p_email, extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', p_name), now(), now(), '', '', '', '', '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text, jsonb_build_object('sub', v_id::text, 'email', p_email, 'email_verified', true), 'email', now(), now(), now());
  return v_id;
end $$;

-- Creates (or fully resets) the demo accounts and their sample data. Run again any time to reset the demo:
--   select public.seed_demo('choose-a-demo-password-12+chars');
-- Uploaded demo files must be removed via the Storage API/dashboard (SQL deletes on storage.objects are blocked).
create function public.seed_demo(p_password text) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_pw text := p_password;
  v_owner uuid; v_tenant uuid; v_org uuid; v_inv uuid; v_due date; v_period date; v_pay numeric;
  v_p1 uuid; v_p2 uuid; v_a1 uuid; v_a2 uuid; v_b1 uuid; v_b2 uuid; v_v1 uuid; v_v2 uuid;
  v_t1 uuid; v_t2 uuid; v_t3 uuid; v_t4 uuid; r public.leases; k int;
begin
  if p_password is null or length(p_password) < 12 then raise exception 'Demo password must be at least 12 characters'; end if;
  perform set_config('app.demo_seeding', 'on', true);
  v_owner := public._demo_make_user('demo.landlord@example.com', 'Demo Landlord', v_pw);
  v_tenant := public._demo_make_user('demo.tenant@example.com', 'Nusrat Jahan (demo tenant)', v_pw);
  update public.profiles set status = 'active', suspended_reason = null where id in (v_owner, v_tenant);
  update auth.users set encrypted_password = extensions.crypt(v_pw, extensions.gen_salt('bf')) where id in (v_owner, v_tenant);

  select id into v_org from public.organizations where created_by = v_owner and name = 'Demo Properties (sample data)';
  if v_org is null then
    insert into public.organizations (name, currency, timezone, created_by) values ('Demo Properties (sample data)', 'BDT', 'Asia/Dhaka', v_owner) returning id into v_org;
    insert into public.organization_members (organization_id, user_id, role) values (v_org, v_owner, 'owner');
    insert into public.subscriptions (organization_id, plan_code, status, source) values (v_org, 'free', 'active', 'system');
    insert into public.subscription_events (organization_id, event_type, to_plan, to_status, source, actor_id) values (v_org, 'created', 'free', 'active', 'system', v_owner);
  else
    update public.organizations set status = 'active' where id = v_org;
    delete from public.payments where organization_id = v_org;
    delete from public.invoice_adjustments where organization_id = v_org;
    delete from public.rent_invoices where organization_id = v_org;
    delete from public.maintenance_updates where organization_id = v_org;
    delete from public.maintenance_requests where organization_id = v_org;
    delete from public.expenses where organization_id = v_org;
    delete from public.documents where organization_id = v_org;
    delete from public.leases where organization_id = v_org;
    delete from public.invitations where organization_id = v_org;
    delete from public.tenants where organization_id = v_org;
    delete from public.units where organization_id = v_org;
    delete from public.properties where organization_id = v_org;
    delete from public.notifications where organization_id = v_org;
    delete from public.organization_members where organization_id = v_org and user_id <> v_owner;
    delete from public.support_tickets where created_by in (v_owner, v_tenant);
  end if;
  insert into public.organization_members (organization_id, user_id, role) values (v_org, v_tenant, 'tenant');

  insert into public.properties (organization_id, name, address_line, city, property_type, description, created_by)
    values (v_org, 'Green View Apartments', 'House 12, Road 5, Dhanmondi', 'Dhaka', 'apartment_building', 'Sample 4-unit apartment building', v_owner) returning id into v_p1;
  insert into public.properties (organization_id, name, address_line, city, property_type, description, created_by)
    values (v_org, 'Lake Side Villa', 'Sector 7, Uttara', 'Dhaka', 'house', 'Sample two-floor villa', v_owner) returning id into v_p2;

  insert into public.units (organization_id, property_id, unit_number, floor, unit_type, bedrooms, bathrooms, size_sqft, expected_rent) values (v_org, v_p1, 'A1', '1', '2BR flat', 2, 2, 950, 15000) returning id into v_a1;
  insert into public.units (organization_id, property_id, unit_number, floor, unit_type, bedrooms, bathrooms, size_sqft, expected_rent) values (v_org, v_p1, 'A2', '2', '2BR flat', 2, 1, 900, 12000) returning id into v_a2;
  insert into public.units (organization_id, property_id, unit_number, floor, unit_type, bedrooms, bathrooms, size_sqft, expected_rent) values (v_org, v_p1, 'B1', '3', '3BR flat', 3, 2, 1200, 18000) returning id into v_b1;
  insert into public.units (organization_id, property_id, unit_number, floor, unit_type, bedrooms, bathrooms, size_sqft, expected_rent) values (v_org, v_p1, 'B2', '3', '2BR flat', 2, 2, 980, 14000) returning id into v_b2;
  insert into public.units (organization_id, property_id, unit_number, floor, unit_type, bedrooms, bathrooms, size_sqft, expected_rent) values (v_org, v_p2, 'V1', 'Ground', 'Villa floor', 4, 3, 2000, 25000) returning id into v_v1;
  insert into public.units (organization_id, property_id, unit_number, floor, unit_type, bedrooms, bathrooms, size_sqft, expected_rent) values (v_org, v_p2, 'V2', 'First', 'Villa floor', 3, 2, 1600, 22000) returning id into v_v2;

  insert into public.tenants (organization_id, user_id, full_name, email, phone) values (v_org, v_tenant, 'Nusrat Jahan', 'demo.tenant@example.com', '01700-000001') returning id into v_t1;
  insert into public.tenants (organization_id, full_name, email, phone) values (v_org, 'Rahim Uddin', null, '01700-000002') returning id into v_t2;
  insert into public.tenants (organization_id, full_name, email, phone) values (v_org, 'Karim Hossain', null, '01700-000003') returning id into v_t3;
  insert into public.tenants (organization_id, full_name, email, phone) values (v_org, 'Sadia Akter', null, '01700-000004') returning id into v_t4;

  insert into public.leases (organization_id, unit_id, tenant_id, start_date, end_date, monthly_rent, security_deposit, due_day, status) values
    (v_org, v_a1, v_t1, current_date - interval '5 months', current_date + interval '7 months', 15000, 30000, 5, 'active'),
    (v_org, v_a2, v_t2, current_date - interval '8 months', current_date + 40, 12000, 24000, 1, 'active'),
    (v_org, v_b1, v_t3, current_date - interval '3 months', null, 18000, 36000, 10, 'active'),
    (v_org, v_v1, v_t4, current_date - interval '2 months', current_date + interval '10 months', 25000, 50000, 1, 'active');

  for r in select * from public.leases where organization_id = v_org loop
    for k in 0..3 loop
      v_period := (date_trunc('month', current_date) - make_interval(months => k))::date;
      continue when v_period < date_trunc('month', r.start_date)::date;
      v_due := v_period + (r.due_day - 1);
      insert into public.rent_invoices (organization_id, lease_id, tenant_id, period_start, due_date, base_amount, amount_due)
        values (v_org, r.id, r.tenant_id, v_period, v_due, r.monthly_rent, r.monthly_rent) returning id into v_inv;
      v_pay := case
        when k >= 2 then r.monthly_rent
        when k = 1 then case when r.tenant_id = v_t2 then round(r.monthly_rent / 2, 2) when r.tenant_id = v_t3 then 0 else r.monthly_rent end
        else case when r.tenant_id in (v_t1, v_t4) and v_due <= current_date then r.monthly_rent else 0 end end;
      if v_pay > 0 then
        insert into public.payments (organization_id, invoice_id, amount, paid_on, method, reference, recorded_by)
          values (v_org, v_inv, v_pay, least(v_due + 1, current_date), case when k % 2 = 0 then 'bank_transfer' else 'mobile_banking' end, 'DEMO-' || substr(v_inv::text, 1, 6), v_owner);
        perform public.recompute_invoice(v_inv);
      end if;
    end loop;
  end loop;

  insert into public.expenses (organization_id, property_id, category, amount, expense_on, description, created_by) values
    (v_org, v_p1, 'repairs', 3500, current_date - 12, 'Plumber visit, A2 bathroom', v_owner),
    (v_org, v_p1, 'utilities', 8200, current_date - 20, 'Common area electricity', v_owner),
    (v_org, v_p1, 'cleaning', 2500, current_date - 5, 'Stairwell cleaning', v_owner),
    (v_org, v_p2, 'repairs', 12000, current_date - 33, 'Roof waterproofing', v_owner);

  insert into public.maintenance_requests (organization_id, property_id, unit_id, tenant_id, title, description, priority, status, estimated_cost, created_by) values
    (v_org, v_p1, v_a1, v_t1, 'Leaking kitchen tap', 'Water drips constantly from the kitchen tap.', 'medium', 'new', 800, v_tenant);
  insert into public.maintenance_requests (organization_id, property_id, title, description, priority, status, estimated_cost, created_by) values
    (v_org, v_p1, 'Broken main gate lock', 'Lock is stuck, gate cannot be secured at night.', 'high', 'in_progress', 2500, v_owner);
  insert into public.maintenance_requests (organization_id, property_id, unit_id, title, description, priority, status, actual_cost, completed_on, created_by) values
    (v_org, v_p2, v_v1, 'AC servicing', 'Yearly service for two split ACs.', 'low', 'completed', 4000, current_date - 10, v_owner);

  insert into public.notifications (organization_id, user_id, type, title, body, link, dedupe_key) values
    (v_org, v_owner, 'rent_overdue', 'Rent overdue', 'Karim Hossain has an unpaid invoice from last month.', '/app/invoices', 'demo:1'),
    (v_org, v_owner, 'lease_expiry', 'Lease expiring soon', 'Rahim Uddin''s lease ends in about 40 days.', '/app/leases', 'demo:2');
end $$;

revoke execute on function public._demo_make_user(text, text, text), public.seed_demo(text) from public, anon, authenticated;
