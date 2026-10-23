-- ===== generic helpers =====
create function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','organizations','properties','units','tenants','leases','rent_invoices','expenses','maintenance_requests','plans','support_tickets']
  loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.feature_flags where key = 'registration_open' and enabled = false) then
    raise exception 'Registration is currently closed';
  end if;
  insert into public.profiles (id, full_name) values (new.id, nullif(new.raw_user_meta_data->>'full_name', ''));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ===== authorization helpers =====
create function public.org_role(p_org uuid) returns text language sql stable security definer set search_path = '' as $$
  select m.role from public.organization_members m
  join public.organizations o on o.id = m.organization_id and o.status = 'active'
  join public.profiles p on p.id = m.user_id and p.status = 'active'
  where m.organization_id = p_org and m.user_id = auth.uid() and m.status = 'active'
$$;

create function public.has_org_role(p_org uuid, p_roles text[]) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.org_role(p_org) = any(p_roles), false)
$$;

create function public.platform_role() returns text language sql stable security definer set search_path = '' as $$
  select a.role from public.platform_admins a
  join public.profiles p on p.id = a.user_id and p.status = 'active'
  where a.user_id = auth.uid()
$$;

create function public.has_platform_role(p_roles text[]) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.platform_role() = any(p_roles), false)
$$;

create function public.org_plan(p_org uuid) returns public.plans language sql stable security definer set search_path = '' as $$
  select p.* from public.plans p
  where p.code = coalesce((select s.plan_code from public.subscriptions s where s.organization_id = p_org and s.status in ('active','trialing','past_due')), 'free')
$$;

create function public.write_audit(p_scope text, p_org uuid, p_action text, p_target_type text, p_target_id text, p_reason text, p_meta jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_logs (scope, organization_id, actor_id, action, target_type, target_id, reason, metadata)
  values (p_scope, p_org, auth.uid(), p_action, p_target_type, p_target_id, p_reason, p_meta)
$$;

create function public.require_reason(p_reason text) returns void language plpgsql set search_path = '' as $$
begin
  if p_reason is null or length(trim(p_reason)) < 5 then
    raise exception 'A reason of at least 5 characters is required';
  end if;
end $$;

create function public.audit_row() returns trigger language plpgsql security definer set search_path = '' as $$
declare v jsonb := to_jsonb(coalesce(new, old)); v_org uuid;
begin
  v_org := case when tg_table_name = 'organizations' then (v->>'id')::uuid else nullif(v->>'organization_id','')::uuid end;
  insert into public.audit_logs (scope, organization_id, actor_id, action, target_type, target_id)
  values ('org', v_org, auth.uid(), lower(tg_op), tg_table_name, v->>'id');
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['organizations','organization_members','invitations','properties','units','tenants','leases','expenses']
  loop
    execute format('create trigger audit_row after insert or update or delete on public.%I for each row execute function public.audit_row()', t);
  end loop;
end $$;

-- ===== plan limits (server-side entitlements) =====
create function public.enforce_plan_limit() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_plan public.plans; v_count int;
begin
  v_plan := public.org_plan(new.organization_id);
  if tg_table_name = 'properties' and v_plan.max_properties is not null then
    select count(*) into v_count from public.properties where organization_id = new.organization_id and status = 'active';
    if v_count >= v_plan.max_properties then
      raise exception 'Plan limit reached: your plan allows % active properties', v_plan.max_properties;
    end if;
  elsif tg_table_name = 'units' and v_plan.max_units is not null then
    select count(*) into v_count from public.units where organization_id = new.organization_id;
    if v_count >= v_plan.max_units then
      raise exception 'Plan limit reached: your plan allows % units', v_plan.max_units;
    end if;
  elsif tg_table_name = 'invitations' and v_plan.max_members is not null then
    select count(*) into v_count from public.organization_members where organization_id = new.organization_id and status = 'active' and role <> 'tenant';
    if new.role <> 'tenant' and v_count >= v_plan.max_members then
      raise exception 'Plan limit reached: your plan allows % team members', v_plan.max_members;
    end if;
  end if;
  return new;
end $$;
create trigger plan_limit before insert on public.properties for each row execute function public.enforce_plan_limit();
create trigger plan_limit before insert on public.units for each row execute function public.enforce_plan_limit();
create trigger plan_limit before insert on public.invitations for each row execute function public.enforce_plan_limit();

-- ===== org membership protections =====
create function public.protect_last_owner() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'owner' and old.status = 'active'
     and (tg_op = 'DELETE' or new.role <> 'owner' or new.status <> 'active')
     and not exists (select 1 from public.organization_members m where m.organization_id = old.organization_id and m.id <> old.id and m.role = 'owner' and m.status = 'active') then
    raise exception 'An organization must keep at least one active owner';
  end if;
  return coalesce(new, old);
end $$;
create trigger protect_last_owner before update or delete on public.organization_members for each row execute function public.protect_last_owner();

-- ===== unit status rules =====
create function public.guard_unit_status() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_active boolean;
begin
  select exists (select 1 from public.leases where unit_id = new.id and status = 'active') into v_active;
  if new.status = 'occupied' and not v_active then
    raise exception 'A unit can only be occupied when it has an active lease';
  elsif new.status <> 'occupied' and v_active then
    raise exception 'A unit with an active lease must be occupied';
  end if;
  return new;
end $$;
create trigger guard_unit_status before update of status on public.units for each row when (old.status is distinct from new.status) execute function public.guard_unit_status();

create function public.sync_unit_status() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'active' then
    update public.units set status = 'occupied' where id = new.unit_id;
    update public.tenants set status = 'active' where id = new.tenant_id and status <> 'active';
  elsif new.status = 'upcoming' then
    update public.units set status = 'reserved' where id = new.unit_id and status = 'vacant';
  elsif new.status in ('ended','terminated') then
    if not exists (select 1 from public.leases l where l.unit_id = new.unit_id and l.status in ('active','upcoming') and l.id <> new.id) then
      update public.units set status = 'vacant' where id = new.unit_id and status in ('occupied','reserved');
    elsif not exists (select 1 from public.leases l where l.unit_id = new.unit_id and l.status = 'active' and l.id <> new.id) then
      update public.units set status = 'reserved' where id = new.unit_id and status = 'occupied';
    end if;
  end if;
  return new;
end $$;
create trigger sync_unit_status after insert or update of status on public.leases for each row execute function public.sync_unit_status();

-- ===== maintenance workflow =====
create function public.maintenance_guard() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_role text := public.org_role(new.organization_id);
begin
  if tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      if not (
        (old.status = 'new' and new.status in ('acknowledged','in_progress','cancelled')) or
        (old.status = 'acknowledged' and new.status in ('in_progress','waiting','cancelled')) or
        (old.status = 'in_progress' and new.status in ('waiting','completed','cancelled')) or
        (old.status = 'waiting' and new.status in ('in_progress','cancelled'))
      ) then
        raise exception 'Invalid status change: % to %', old.status, new.status;
      end if;
      if new.status = 'completed' then new.completed_on := coalesce(new.completed_on, current_date); end if;
    end if;
    if v_role = 'maintenance' and (new.assigned_to is distinct from old.assigned_to or new.priority is distinct from old.priority
       or new.property_id <> old.property_id or new.unit_id is distinct from old.unit_id or new.title <> old.title) then
      raise exception 'Maintenance staff can only update status, costs and notes';
    end if;
  elsif tg_op = 'INSERT' and v_role = 'tenant' and (new.status <> 'new' or new.assigned_to is not null) then
    raise exception 'Invalid new request';
  end if;
  return new;
end $$;
create trigger maintenance_guard before insert or update on public.maintenance_requests for each row execute function public.maintenance_guard();

create function public.maintenance_log_status() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    insert into public.maintenance_updates (organization_id, request_id, author_id, status_from, status_to)
    values (new.organization_id, new.id, auth.uid(), old.status, new.status);
  end if;
  return new;
end $$;
create trigger maintenance_log_status after update on public.maintenance_requests for each row execute function public.maintenance_log_status();

-- ===== invoice / payment core =====
create function public.recompute_invoice(p_invoice uuid) returns void language plpgsql security definer set search_path = '' as $$
declare v_paid numeric(14,2); v_adj numeric(14,2); v_base numeric(14,2);
begin
  select base_amount into v_base from public.rent_invoices where id = p_invoice;
  select coalesce(sum(amount), 0) into v_paid from public.payments where invoice_id = p_invoice and status = 'valid';
  select coalesce(sum(amount), 0) into v_adj from public.invoice_adjustments where invoice_id = p_invoice;
  update public.rent_invoices set
    adjustment_total = v_adj, amount_paid = v_paid, amount_due = v_base + v_adj,
    status = case when status = 'void' then 'void' when v_paid >= v_base + v_adj then 'paid' else 'open' end
  where id = p_invoice;
end $$;

create function public.generate_invoices(p_org uuid, p_month date) returns int language plpgsql security definer set search_path = '' as $$
declare v_first date := date_trunc('month', p_month)::date; v_count int;
begin
  if not public.has_org_role(p_org, array['owner','property_manager','accountant']) then raise exception 'Not authorized' using errcode = '42501'; end if;
  if v_first > (date_trunc('month', current_date) + interval '1 month')::date then raise exception 'Cannot generate invoices more than one month ahead'; end if;
  insert into public.rent_invoices (organization_id, lease_id, tenant_id, period_start, due_date, base_amount, amount_due)
  select l.organization_id, l.id, l.tenant_id, v_first, v_first + (l.due_day - 1), l.monthly_rent, l.monthly_rent
  from public.leases l
  where l.organization_id = p_org and l.status = 'active'
    and l.start_date <= (v_first + interval '1 month' - interval '1 day')::date
    and coalesce(l.end_date, 'infinity'::date) >= v_first
  on conflict (lease_id, period_start) where status <> 'void' do nothing;
  get diagnostics v_count = row_count;
  perform public.write_audit('org', p_org, 'invoices_generated', 'rent_invoices', to_char(v_first, 'YYYY-MM'), null, jsonb_build_object('created', v_count));
  return v_count;
end $$;

create function public.record_payment(p_invoice uuid, p_amount numeric, p_paid_on date, p_method text, p_reference text default null, p_idempotency_key text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_inv public.rent_invoices; v_id uuid; v_amt numeric(14,2) := round(p_amount, 2);
begin
  select * into v_inv from public.rent_invoices where id = p_invoice for update;
  if not found then raise exception 'Invoice not found'; end if;
  if not public.has_org_role(v_inv.organization_id, array['owner','property_manager','accountant']) then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_idempotency_key is not null then
    select id into v_id from public.payments where organization_id = v_inv.organization_id and idempotency_key = p_idempotency_key;
    if found then return v_id; end if;
  end if;
  if v_inv.status = 'void' then raise exception 'Cannot record a payment on a void invoice'; end if;
  if v_amt is null or v_amt <= 0 then raise exception 'Payment amount must be greater than zero'; end if;
  if v_amt > v_inv.amount_due - v_inv.amount_paid then raise exception 'Payment exceeds the outstanding balance of %', v_inv.amount_due - v_inv.amount_paid; end if;
  if p_paid_on is null or p_paid_on > current_date then raise exception 'Payment date cannot be in the future'; end if;
  insert into public.payments (organization_id, invoice_id, amount, paid_on, method, reference, idempotency_key, recorded_by)
  values (v_inv.organization_id, p_invoice, v_amt, p_paid_on, p_method, nullif(trim(p_reference), ''), p_idempotency_key, auth.uid())
  returning id into v_id;
  perform public.recompute_invoice(p_invoice);
  perform public.write_audit('org', v_inv.organization_id, 'payment_recorded', 'payments', v_id::text, null, jsonb_build_object('invoice', p_invoice, 'amount', v_amt));
  return v_id;
end $$;

create function public.reverse_payment(p_payment uuid, p_reason text) returns void language plpgsql security definer set search_path = '' as $$
declare v_pay public.payments;
begin
  perform public.require_reason(p_reason);
  select * into v_pay from public.payments where id = p_payment;
  if not found then raise exception 'Payment not found'; end if;
  perform 1 from public.rent_invoices where id = v_pay.invoice_id for update;
  if not public.has_org_role(v_pay.organization_id, array['owner','accountant']) then raise exception 'Not authorized' using errcode = '42501'; end if;
  if v_pay.status = 'reversed' then raise exception 'Payment is already reversed'; end if;
  update public.payments set status = 'reversed', reversed_at = now(), reversed_by = auth.uid(), reversal_reason = p_reason where id = p_payment;
  perform public.recompute_invoice(v_pay.invoice_id);
  perform public.write_audit('org', v_pay.organization_id, 'payment_reversed', 'payments', p_payment::text, p_reason, null);
end $$;

create function public.add_invoice_adjustment(p_invoice uuid, p_amount numeric, p_reason text) returns void language plpgsql security definer set search_path = '' as $$
declare v_inv public.rent_invoices;
begin
  perform public.require_reason(p_reason);
  select * into v_inv from public.rent_invoices where id = p_invoice for update;
  if not found then raise exception 'Invoice not found'; end if;
  if not public.has_org_role(v_inv.organization_id, array['owner','accountant']) then raise exception 'Not authorized' using errcode = '42501'; end if;
  if v_inv.status = 'void' then raise exception 'Invoice is void'; end if;
  if v_inv.amount_due + round(p_amount, 2) < v_inv.amount_paid then raise exception 'Adjustment would reduce the amount due below what is already paid; reverse a payment first'; end if;
  insert into public.invoice_adjustments (organization_id, invoice_id, amount, reason, created_by) values (v_inv.organization_id, p_invoice, round(p_amount, 2), p_reason, auth.uid());
  perform public.recompute_invoice(p_invoice);
  perform public.write_audit('org', v_inv.organization_id, 'invoice_adjusted', 'rent_invoices', p_invoice::text, p_reason, jsonb_build_object('amount', p_amount));
end $$;

create function public.void_invoice(p_invoice uuid, p_reason text) returns void language plpgsql security definer set search_path = '' as $$
declare v_inv public.rent_invoices;
begin
  perform public.require_reason(p_reason);
  select * into v_inv from public.rent_invoices where id = p_invoice for update;
  if not found then raise exception 'Invoice not found'; end if;
  if not public.has_org_role(v_inv.organization_id, array['owner','accountant']) then raise exception 'Not authorized' using errcode = '42501'; end if;
  if exists (select 1 from public.payments where invoice_id = p_invoice and status = 'valid') then raise exception 'Reverse all payments before voiding this invoice'; end if;
  update public.rent_invoices set status = 'void', void_reason = p_reason where id = p_invoice;
  perform public.write_audit('org', v_inv.organization_id, 'invoice_voided', 'rent_invoices', p_invoice::text, p_reason, null);
end $$;

-- ===== lease workflow =====
create function public.end_lease(p_lease uuid, p_status text, p_end date, p_reason text) returns void language plpgsql security definer set search_path = '' as $$
declare v_l public.leases;
begin
  select * into v_l from public.leases where id = p_lease for update;
  if not found then raise exception 'Lease not found'; end if;
  if not public.has_org_role(v_l.organization_id, array['owner','property_manager']) then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_status not in ('ended','terminated') then raise exception 'Invalid status'; end if;
  if v_l.status not in ('upcoming','active') then raise exception 'Lease is already closed'; end if;
  if p_end <= v_l.start_date then raise exception 'End date must be after the start date'; end if;
  update public.leases set status = p_status, end_date = p_end, terminated_at = case when p_status = 'terminated' then current_date end, termination_reason = p_reason where id = p_lease;
  perform public.write_audit('org', v_l.organization_id, 'lease_' || p_status, 'leases', p_lease::text, p_reason, null);
end $$;

create function public.renew_lease(p_lease uuid, p_new_end date, p_new_rent numeric) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_l public.leases; v_new uuid;
begin
  select * into v_l from public.leases where id = p_lease for update;
  if not found then raise exception 'Lease not found'; end if;
  if not public.has_org_role(v_l.organization_id, array['owner','property_manager']) then raise exception 'Not authorized' using errcode = '42501'; end if;
  if v_l.status <> 'active' or v_l.end_date is null then raise exception 'Only active leases with an end date can be renewed'; end if;
  if p_new_end <= v_l.end_date + 1 then raise exception 'New end date must be after the new start date'; end if;
  insert into public.leases (organization_id, unit_id, tenant_id, start_date, end_date, monthly_rent, security_deposit, due_day, status, renewed_from)
  values (v_l.organization_id, v_l.unit_id, v_l.tenant_id, v_l.end_date + 1, p_new_end, coalesce(p_new_rent, v_l.monthly_rent), v_l.security_deposit, v_l.due_day, 'upcoming', v_l.id)
  returning id into v_new;
  perform public.write_audit('org', v_l.organization_id, 'lease_renewed', 'leases', v_new::text, null, jsonb_build_object('from', p_lease));
  return v_new;
end $$;

-- ===== organizations & invitations =====
create function public.is_active_user_internal() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'active')
$$;

create function public.create_organization(p_name text, p_currency text default 'BDT', p_timezone text default 'Asia/Dhaka') returns uuid language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  if auth.uid() is null or not public.is_active_user_internal() then raise exception 'Not authorized' using errcode = '42501'; end if;
  if (select count(*) from public.organization_members where user_id = auth.uid() and role = 'owner' and status = 'active') >= 5 then raise exception 'Organization limit reached'; end if;
  insert into public.organizations (name, currency, timezone, created_by) values (trim(p_name), upper(p_currency), p_timezone, auth.uid()) returning id into v_org;
  insert into public.organization_members (organization_id, user_id, role) values (v_org, auth.uid(), 'owner');
  insert into public.subscriptions (organization_id, plan_code, status, source) values (v_org, 'free', 'active', 'system');
  insert into public.subscription_events (organization_id, event_type, to_plan, to_status, source, actor_id) values (v_org, 'created', 'free', 'active', 'system', auth.uid());
  return v_org;
end $$;

create function public.accept_invitation(p_token uuid) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_inv public.invitations; v_email text;
begin
  if auth.uid() is null or not public.is_active_user_internal() then raise exception 'Not authorized' using errcode = '42501'; end if;
  select lower(email) into v_email from auth.users where id = auth.uid();
  select * into v_inv from public.invitations where token = p_token and status = 'pending' and expires_at > now() for update;
  if not found then raise exception 'Invitation is invalid or expired'; end if;
  if v_inv.email <> v_email then raise exception 'This invitation was sent to a different email address'; end if;
  if v_inv.role = 'tenant' and exists (select 1 from public.feature_flags where key = 'tenant_portal' and enabled = false) then raise exception 'The tenant portal is not enabled'; end if;
  insert into public.organization_members (organization_id, user_id, role) values (v_inv.organization_id, auth.uid(), v_inv.role)
  on conflict (organization_id, user_id) do update set role = excluded.role, status = 'active';
  if v_inv.tenant_id is not null then update public.tenants set user_id = auth.uid() where id = v_inv.tenant_id and user_id is null; end if;
  update public.invitations set status = 'accepted' where id = v_inv.id;
  return v_inv.organization_id;
end $$;

-- ===== dashboards =====
create function public.org_dashboard(p_org uuid, p_from date, p_to date) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  if not public.has_org_role(p_org, array['owner','property_manager','accountant']) then raise exception 'Not authorized' using errcode = '42501'; end if;
  select jsonb_build_object(
    'properties', (select count(*) from public.properties where organization_id = p_org and status = 'active'),
    'units', (select count(*) from public.units where organization_id = p_org),
    'occupied_units', (select count(*) from public.units where organization_id = p_org and status = 'occupied'),
    'vacant_units', (select count(*) from public.units where organization_id = p_org and status = 'vacant'),
    'active_tenants', (select count(distinct tenant_id) from public.leases where organization_id = p_org and status = 'active'),
    'expected_monthly_rent', (select coalesce(sum(monthly_rent), 0) from public.leases where organization_id = p_org and status = 'active'),
    'invoiced', (select coalesce(sum(amount_due), 0) from public.rent_invoices where organization_id = p_org and status <> 'void' and due_date between p_from and p_to),
    'collected', (select coalesce(sum(amount), 0) from public.payments where organization_id = p_org and status = 'valid' and paid_on between p_from and p_to),
    'outstanding', (select coalesce(sum(amount_due - amount_paid), 0) from public.rent_invoices where organization_id = p_org and status = 'open'),
    'overdue_count', (select count(*) from public.rent_invoices where organization_id = p_org and status = 'open' and due_date < current_date),
    'overdue_amount', (select coalesce(sum(amount_due - amount_paid), 0) from public.rent_invoices where organization_id = p_org and status = 'open' and due_date < current_date),
    'expenses', (select coalesce(sum(amount), 0) from public.expenses where organization_id = p_org and expense_on between p_from and p_to),
    'open_maintenance', (select count(*) from public.maintenance_requests where organization_id = p_org and status not in ('completed','cancelled')),
    'expiring_leases', (select count(*) from public.leases where organization_id = p_org and status = 'active' and end_date between current_date and current_date + 60),
    'trend', (
      select coalesce(jsonb_agg(jsonb_build_object('month', to_char(m, 'YYYY-MM'),
        'invoiced', (select coalesce(sum(amount_due), 0) from public.rent_invoices i where i.organization_id = p_org and i.status <> 'void' and i.period_start = m),
        'collected', (select coalesce(sum(amount), 0) from public.payments p where p.organization_id = p_org and p.status = 'valid' and date_trunc('month', p.paid_on) = m),
        'expenses', (select coalesce(sum(amount), 0) from public.expenses e where e.organization_id = p_org and date_trunc('month', e.expense_on) = m)
      ) order by m), '[]'::jsonb)
      from generate_series(date_trunc('month', current_date) - interval '5 months', date_trunc('month', current_date), interval '1 month') m
    )
  ) into r;
  return r;
end $$;

-- ===== daily job (leases + notifications) =====
create function public.run_daily_job() returns void language plpgsql security definer set search_path = '' as $$
declare v_id bigint; v_act int; v_end int;
begin
  insert into public.job_runs (job_name, status) values ('daily', 'running') returning id into v_id;
  begin
    update public.leases set status = 'active' where status = 'upcoming' and start_date <= current_date and (end_date is null or end_date >= current_date);
    get diagnostics v_act = row_count;
    update public.leases set status = 'ended' where status = 'active' and end_date < current_date;
    get diagnostics v_end = row_count;

    insert into public.notifications (organization_id, user_id, type, title, body, link, dedupe_key)
    select i.organization_id, m.user_id, 'rent_due', 'Rent due soon', 'An invoice is due on ' || i.due_date, '/app/invoices', 'due:' || i.id || ':' || i.due_date
    from public.rent_invoices i
    join public.organization_members m on m.organization_id = i.organization_id and m.status = 'active' and m.role in ('owner','property_manager','accountant')
    join public.profiles p on p.id = m.user_id and p.notify_in_app
    where i.status = 'open' and i.due_date between current_date and current_date + 3
    on conflict (user_id, dedupe_key) do nothing;

    insert into public.notifications (organization_id, user_id, type, title, body, link, dedupe_key)
    select i.organization_id, m.user_id, 'rent_overdue', 'Rent overdue', 'An invoice was due on ' || i.due_date || ' and is unpaid', '/app/invoices', 'overdue:' || i.id || ':' || to_char(current_date, 'IYYY-IW')
    from public.rent_invoices i
    join public.organization_members m on m.organization_id = i.organization_id and m.status = 'active' and m.role in ('owner','property_manager','accountant')
    join public.profiles p on p.id = m.user_id and p.notify_in_app
    where i.status = 'open' and i.due_date < current_date
    on conflict (user_id, dedupe_key) do nothing;

    insert into public.notifications (organization_id, user_id, type, title, body, link, dedupe_key)
    select l.organization_id, m.user_id, 'lease_expiry', 'Lease expiring soon', 'A lease ends on ' || l.end_date, '/app/leases', 'lease_exp:' || l.id || ':' || l.end_date
    from public.leases l
    join public.organization_members m on m.organization_id = l.organization_id and m.status = 'active' and m.role in ('owner','property_manager')
    join public.profiles p on p.id = m.user_id and p.notify_in_app
    where l.status = 'active' and l.end_date between current_date and current_date + 30
    on conflict (user_id, dedupe_key) do nothing;

    update public.job_runs set status = 'succeeded', finished_at = now(), detail = 'leases activated: ' || v_act || ', leases ended: ' || v_end where id = v_id;
  exception when others then
    update public.job_runs set status = 'failed', finished_at = now(), detail = sqlerrm where id = v_id;
  end;
end $$;
