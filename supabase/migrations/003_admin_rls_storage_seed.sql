-- ===== ADMIN RPCs (all enforce platform roles server-side) =====
create function public.admin_stats() returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if public.platform_role() is null then raise exception 'Not authorized' using errcode = '42501'; end if;
  return jsonb_build_object(
    'users_total', (select count(*) from public.profiles),
    'users_active', (select count(*) from public.profiles where status = 'active'),
    'users_suspended', (select count(*) from public.profiles where status = 'suspended'),
    'orgs_total', (select count(*) from public.organizations),
    'orgs_active', (select count(*) from public.organizations where status = 'active'),
    'properties', (select count(*) from public.properties),
    'units', (select count(*) from public.units),
    'tenants', (select count(*) from public.tenants),
    'active_leases', (select count(*) from public.leases where status = 'active'),
    'subscriptions', (select coalesce(jsonb_agg(jsonb_build_object('plan', plan_code, 'status', status, 'count', c)), '[]'::jsonb) from (select plan_code, status, count(*) c from public.subscriptions group by 1, 2) s),
    'tickets', (select coalesce(jsonb_object_agg(status, c), '{}'::jsonb) from (select status, count(*) c from public.support_tickets group by 1) t),
    'failed_jobs_7d', (select count(*) from public.job_runs where status = 'failed' and started_at > now() - interval '7 days'),
    'revenue', null
  );
end $$;

create function public.admin_list_users(p_search text default null, p_limit int default 25, p_offset int default 0)
returns table (id uuid, email text, full_name text, status text, created_at timestamptz, last_sign_in_at timestamptz, org_count bigint, platform_role text, total_count bigint)
language plpgsql stable security definer set search_path = '' as $$
declare v_role text := public.platform_role();
begin
  if v_role is null then raise exception 'Not authorized' using errcode = '42501'; end if;
  return query
  select u.id,
    case when v_role = 'super_admin' then u.email::text else left(u.email, 2) || '***@' || split_part(u.email, '@', 2) end,
    p.full_name, p.status, u.created_at, u.last_sign_in_at,
    (select count(*) from public.organization_members m where m.user_id = u.id and m.status = 'active'),
    (select a.role from public.platform_admins a where a.user_id = u.id),
    count(*) over ()
  from auth.users u join public.profiles p on p.id = u.id
  where coalesce(p_search, '') = '' or p.full_name ilike '%' || p_search || '%' or (v_role = 'super_admin' and u.email ilike '%' || p_search || '%')
  order by u.created_at desc limit least(p_limit, 100) offset greatest(p_offset, 0);
end $$;

create function public.admin_list_orgs(p_search text default null, p_limit int default 25, p_offset int default 0)
returns table (id uuid, name text, status text, owner_email text, member_count bigint, property_count bigint, unit_count bigint, plan_code text, sub_status text, created_at timestamptz, total_count bigint)
language plpgsql stable security definer set search_path = '' as $$
declare v_role text := public.platform_role();
begin
  if v_role is null then raise exception 'Not authorized' using errcode = '42501'; end if;
  return query
  select o.id, o.name, o.status,
    (select case when v_role = 'super_admin' then u.email::text else left(u.email, 2) || '***@' || split_part(u.email, '@', 2) end from auth.users u where u.id = o.created_by),
    (select count(*) from public.organization_members m where m.organization_id = o.id and m.status = 'active'),
    (select count(*) from public.properties pr where pr.organization_id = o.id),
    (select count(*) from public.units un where un.organization_id = o.id),
    s.plan_code, s.status, o.created_at, count(*) over ()
  from public.organizations o left join public.subscriptions s on s.organization_id = o.id
  where coalesce(p_search, '') = '' or o.name ilike '%' || p_search || '%'
  order by o.created_at desc limit least(p_limit, 100) offset greatest(p_offset, 0);
end $$;

create function public.admin_list_admins() returns table (user_id uuid, email text, full_name text, role text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_platform_role(array['super_admin']) then raise exception 'Not authorized' using errcode = '42501'; end if;
  return query select a.user_id, u.email::text, p.full_name, a.role, a.created_at from public.platform_admins a join auth.users u on u.id = a.user_id join public.profiles p on p.id = a.user_id order by a.created_at;
end $$;

create function public.admin_set_user_status(p_user uuid, p_status text, p_reason text, p_force boolean default false) returns void language plpgsql security definer set search_path = '' as $$
declare v_target_role text;
begin
  if not public.has_platform_role(array['super_admin','support_admin']) then raise exception 'Not authorized' using errcode = '42501'; end if;
  perform public.require_reason(p_reason);
  if p_status not in ('active','suspended') then raise exception 'Invalid status'; end if;
  if p_user = auth.uid() then raise exception 'You cannot change your own account status'; end if;
  select role into v_target_role from public.platform_admins where user_id = p_user;
  if v_target_role is not null then raise exception 'Platform administrators must have their admin role removed before their account can be suspended'; end if;
  if p_status = 'suspended' and not p_force and exists (
    select 1 from public.organization_members m where m.user_id = p_user and m.role = 'owner' and m.status = 'active'
    and not exists (select 1 from public.organization_members o where o.organization_id = m.organization_id and o.user_id <> p_user and o.role = 'owner' and o.status = 'active')
  ) then raise exception 'This user is the only owner of an organization. Confirm explicitly to proceed (force).'; end if;
  update public.profiles set status = p_status, suspended_reason = case when p_status = 'suspended' then p_reason end where id = p_user;
  if not found then raise exception 'User not found'; end if;
  perform public.write_audit('platform', null, 'user_' || p_status, 'user', p_user::text, p_reason, jsonb_build_object('forced', p_force));
end $$;

create function public.admin_set_org_status(p_org uuid, p_status text, p_reason text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_platform_role(array['super_admin']) then raise exception 'Not authorized' using errcode = '42501'; end if;
  perform public.require_reason(p_reason);
  if p_status not in ('active','suspended') then raise exception 'Invalid status'; end if;
  update public.organizations set status = p_status where id = p_org;
  if not found then raise exception 'Organization not found'; end if;
  perform public.write_audit('platform', p_org, 'org_' || p_status, 'organization', p_org::text, p_reason, null);
end $$;

create function public.admin_set_subscription(p_org uuid, p_plan text, p_status text, p_reason text) returns void language plpgsql security definer set search_path = '' as $$
declare v_old public.subscriptions;
begin
  if not public.has_platform_role(array['super_admin','billing_admin']) then raise exception 'Not authorized' using errcode = '42501'; end if;
  perform public.require_reason(p_reason);
  if p_status not in ('active','trialing','past_due','canceled') then raise exception 'Invalid status'; end if;
  if not exists (select 1 from public.plans where code = p_plan) then raise exception 'Unknown plan'; end if;
  select * into v_old from public.subscriptions where organization_id = p_org for update;
  if not found then raise exception 'Subscription not found'; end if;
  update public.subscriptions set plan_code = p_plan, status = p_status, source = 'manual_admin', updated_by = auth.uid() where organization_id = p_org;
  insert into public.subscription_events (organization_id, event_type, from_plan, to_plan, from_status, to_status, source, actor_id, reason)
  values (p_org, 'manual_adjustment', v_old.plan_code, p_plan, v_old.status, p_status, 'manual_admin', auth.uid(), p_reason);
  perform public.write_audit('platform', p_org, 'subscription_adjusted', 'subscription', p_org::text, p_reason, jsonb_build_object('plan', p_plan, 'status', p_status));
end $$;

create function public.admin_upsert_plan(p_code text, p_name text, p_price numeric, p_max_properties int, p_max_units int, p_max_members int, p_is_active boolean, p_reason text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_platform_role(array['super_admin','billing_admin']) then raise exception 'Not authorized' using errcode = '42501'; end if;
  perform public.require_reason(p_reason);
  if p_code = 'free' and not p_is_active then raise exception 'The free plan cannot be deactivated'; end if;
  insert into public.plans (code, name, price_monthly, max_properties, max_units, max_members, is_active)
  values (p_code, p_name, p_price, p_max_properties, p_max_units, p_max_members, p_is_active)
  on conflict (code) do update set name = excluded.name, price_monthly = excluded.price_monthly, max_properties = excluded.max_properties,
    max_units = excluded.max_units, max_members = excluded.max_members, is_active = excluded.is_active;
  perform public.write_audit('platform', null, 'plan_saved', 'plan', p_code, p_reason, null);
end $$;

create function public.admin_set_flag(p_key text, p_enabled boolean, p_reason text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_platform_role(array['super_admin']) then raise exception 'Not authorized' using errcode = '42501'; end if;
  perform public.require_reason(p_reason);
  update public.feature_flags set enabled = p_enabled, updated_by = auth.uid(), updated_at = now() where key = p_key;
  if not found then raise exception 'Unknown flag'; end if;
  perform public.write_audit('platform', null, 'flag_changed', 'feature_flag', p_key, p_reason, jsonb_build_object('enabled', p_enabled));
end $$;

create function public.admin_set_setting(p_key text, p_value jsonb, p_reason text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_platform_role(array['super_admin']) then raise exception 'Not authorized' using errcode = '42501'; end if;
  perform public.require_reason(p_reason);
  if p_key <> 'support_email' then raise exception 'Unknown setting'; end if;
  if jsonb_typeof(p_value) <> 'string' or length(p_value #>> '{}') > 200 then raise exception 'Invalid value'; end if;
  update public.platform_settings set value = p_value, updated_by = auth.uid(), updated_at = now() where key = p_key;
  perform public.write_audit('platform', null, 'setting_changed', 'platform_setting', p_key, p_reason, null);
end $$;

create function public.admin_set_platform_role(p_user uuid, p_role text, p_reason text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_platform_role(array['super_admin']) then raise exception 'Not authorized' using errcode = '42501'; end if;
  perform public.require_reason(p_reason);
  if p_user = auth.uid() then raise exception 'You cannot change your own platform role'; end if;
  if p_role is not null and p_role not in ('super_admin','support_admin','billing_admin') then raise exception 'Invalid role'; end if;
  if not exists (select 1 from public.profiles where id = p_user and status = 'active') then raise exception 'User not found or suspended'; end if;
  if p_role is null then
    delete from public.platform_admins where user_id = p_user;
  else
    insert into public.platform_admins (user_id, role, created_by) values (p_user, p_role, auth.uid())
    on conflict (user_id) do update set role = excluded.role;
  end if;
  perform public.write_audit('platform', null, 'platform_role_set', 'user', p_user::text, p_reason, jsonb_build_object('role', p_role));
end $$;

create function public.admin_find_user_by_email(p_email text) returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v uuid;
begin
  if not public.has_platform_role(array['super_admin']) then raise exception 'Not authorized' using errcode = '42501'; end if;
  select id into v from auth.users where lower(email) = lower(trim(p_email));
  return v;
end $$;

create function public.admin_update_ticket(p_ticket uuid, p_status text, p_priority text, p_assigned_to uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_platform_role(array['super_admin','support_admin']) then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_assigned_to is not null and not exists (select 1 from public.platform_admins where user_id = p_assigned_to) then raise exception 'Assignee must be a platform admin'; end if;
  update public.support_tickets set status = p_status, priority = p_priority, assigned_to = p_assigned_to where id = p_ticket;
  if not found then raise exception 'Ticket not found'; end if;
  perform public.write_audit('platform', null, 'ticket_updated', 'ticket', p_ticket::text, null, jsonb_build_object('status', p_status, 'priority', p_priority));
end $$;

create function public.admin_add_ticket_note(p_ticket uuid, p_body text, p_internal boolean) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_platform_role(array['super_admin','support_admin']) then raise exception 'Not authorized' using errcode = '42501'; end if;
  insert into public.ticket_notes (ticket_id, author_id, body, is_internal) values (p_ticket, auth.uid(), p_body, p_internal);
  perform public.write_audit('platform', null, 'ticket_note_added', 'ticket', p_ticket::text, null, jsonb_build_object('internal', p_internal));
end $$;

create function public.admin_run_daily_job() returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_platform_role(array['super_admin']) then raise exception 'Not authorized' using errcode = '42501'; end if;
  perform public.run_daily_job();
  perform public.write_audit('platform', null, 'daily_job_run', 'job', 'daily', null, null);
end $$;

create function public.storage_path_org(p_name text) returns uuid language sql immutable set search_path = '' as $$
  select case when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then split_part(p_name, '/', 1)::uuid end
$$;

-- ===== SEED =====
insert into public.plans (code, name, price_monthly, max_properties, max_units, max_members) values
  ('free', 'Free', 0, 2, 10, 3),
  ('pro', 'Pro', null, 10, 100, 10),
  ('business', 'Business', null, null, null, null);
insert into public.feature_flags (key, description, enabled) values
  ('registration_open', 'Allow new users to sign up', true),
  ('tenant_portal', 'Allow tenant portal invitations and access', true);
insert into public.platform_settings (key, value) values ('support_email', '""'::jsonb);

-- ===== RLS =====
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid() or exists (select 1 from public.organization_members m where m.user_id = profiles.id and public.has_org_role(m.organization_id, array['owner','property_manager'])));
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy platform_admins_self on public.platform_admins for select to authenticated using (user_id = auth.uid());

create policy orgs_select on public.organizations for select to authenticated using (id in (select organization_id from public.organization_members where user_id = auth.uid() and status = 'active'));
create policy orgs_update on public.organizations for update to authenticated using (public.has_org_role(id, array['owner'])) with check (public.has_org_role(id, array['owner']));

create policy members_select on public.organization_members for select to authenticated using (user_id = auth.uid() or public.has_org_role(organization_id, array['owner','property_manager']));
create policy members_update on public.organization_members for update to authenticated using (public.has_org_role(organization_id, array['owner'])) with check (public.has_org_role(organization_id, array['owner']));
create policy members_delete on public.organization_members for delete to authenticated using (public.has_org_role(organization_id, array['owner']));

create policy inv_select on public.invitations for select to authenticated using (public.has_org_role(organization_id, array['owner']));
create policy inv_insert on public.invitations for insert to authenticated with check (public.has_org_role(organization_id, array['owner']) and invited_by = auth.uid());
create policy inv_update on public.invitations for update to authenticated using (public.has_org_role(organization_id, array['owner'])) with check (status = 'revoked');

create policy props_select on public.properties for select to authenticated using (public.has_org_role(organization_id, array['owner','property_manager','accountant','maintenance']));
create policy props_insert on public.properties for insert to authenticated with check (public.has_org_role(organization_id, array['owner','property_manager']));
create policy props_update on public.properties for update to authenticated using (public.has_org_role(organization_id, array['owner','property_manager'])) with check (public.has_org_role(organization_id, array['owner','property_manager']));

create policy units_select on public.units for select to authenticated using (public.has_org_role(organization_id, array['owner','property_manager','accountant','maintenance']));
create policy units_insert on public.units for insert to authenticated with check (public.has_org_role(organization_id, array['owner','property_manager']));
create policy units_update on public.units for update to authenticated using (public.has_org_role(organization_id, array['owner','property_manager'])) with check (public.has_org_role(organization_id, array['owner','property_manager']));

create policy tenants_select on public.tenants for select to authenticated using (public.has_org_role(organization_id, array['owner','property_manager','accountant']) or (user_id = auth.uid() and public.has_org_role(organization_id, array['tenant'])));
create policy tenants_insert on public.tenants for insert to authenticated with check (public.has_org_role(organization_id, array['owner','property_manager']));
create policy tenants_update on public.tenants for update to authenticated using (public.has_org_role(organization_id, array['owner','property_manager'])) with check (public.has_org_role(organization_id, array['owner','property_manager']));

create policy leases_select on public.leases for select to authenticated using (public.has_org_role(organization_id, array['owner','property_manager','accountant']) or (public.has_org_role(organization_id, array['tenant']) and tenant_id in (select id from public.tenants where user_id = auth.uid())));
create policy leases_insert on public.leases for insert to authenticated with check (public.has_org_role(organization_id, array['owner','property_manager']));
create policy leases_update on public.leases for update to authenticated using (public.has_org_role(organization_id, array['owner','property_manager'])) with check (public.has_org_role(organization_id, array['owner','property_manager']));

create policy inv_sel on public.rent_invoices for select to authenticated using (public.has_org_role(organization_id, array['owner','property_manager','accountant']) or (public.has_org_role(organization_id, array['tenant']) and tenant_id in (select id from public.tenants where user_id = auth.uid())));
create policy adj_sel on public.invoice_adjustments for select to authenticated using (exists (select 1 from public.rent_invoices i where i.id = invoice_id));
create policy pay_sel on public.payments for select to authenticated using (exists (select 1 from public.rent_invoices i where i.id = invoice_id));

create policy exp_select on public.expenses for select to authenticated using (public.has_org_role(organization_id, array['owner','property_manager','accountant']));
create policy exp_insert on public.expenses for insert to authenticated with check (public.has_org_role(organization_id, array['owner','property_manager','accountant']) and created_by = auth.uid());
create policy exp_update on public.expenses for update to authenticated using (public.has_org_role(organization_id, array['owner','accountant'])) with check (public.has_org_role(organization_id, array['owner','accountant']));
create policy exp_delete on public.expenses for delete to authenticated using (public.has_org_role(organization_id, array['owner']));

create policy mr_select on public.maintenance_requests for select to authenticated using (
  public.has_org_role(organization_id, array['owner','property_manager','accountant'])
  or (public.has_org_role(organization_id, array['maintenance']) and assigned_to = auth.uid())
  or (public.has_org_role(organization_id, array['tenant']) and tenant_id in (select id from public.tenants where user_id = auth.uid())));
create policy mr_insert on public.maintenance_requests for insert to authenticated with check (
  created_by = auth.uid() and (
    public.has_org_role(organization_id, array['owner','property_manager','maintenance'])
    or (public.has_org_role(organization_id, array['tenant']) and status = 'new' and tenant_id in (select id from public.tenants where user_id = auth.uid()))));
create policy mr_update on public.maintenance_requests for update to authenticated
  using (public.has_org_role(organization_id, array['owner','property_manager']) or (public.has_org_role(organization_id, array['maintenance']) and assigned_to = auth.uid()))
  with check (public.has_org_role(organization_id, array['owner','property_manager']) or (public.has_org_role(organization_id, array['maintenance']) and assigned_to = auth.uid()));

create policy mu_select on public.maintenance_updates for select to authenticated using (exists (select 1 from public.maintenance_requests r where r.id = request_id));
create policy mu_insert on public.maintenance_updates for insert to authenticated with check (author_id = auth.uid() and exists (select 1 from public.maintenance_requests r where r.id = request_id and r.organization_id = maintenance_updates.organization_id));

create policy docs_select on public.documents for select to authenticated using (public.has_org_role(organization_id, array['owner','property_manager','accountant','maintenance']));
create policy docs_insert on public.documents for insert to authenticated with check (public.has_org_role(organization_id, array['owner','property_manager','accountant','maintenance']) and uploaded_by = auth.uid());
create policy docs_delete on public.documents for delete to authenticated using (public.has_org_role(organization_id, array['owner','property_manager']));

create policy notif_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notif_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy audit_select on public.audit_logs for select to authenticated using (
  (scope = 'org' and public.has_org_role(organization_id, array['owner'])) or (scope = 'platform' and public.has_platform_role(array['super_admin'])));

create policy plans_select on public.plans for select to anon, authenticated using (is_active or public.platform_role() is not null);
create policy subs_select on public.subscriptions for select to authenticated using (public.has_org_role(organization_id, array['owner','property_manager']) or public.platform_role() is not null);
create policy subev_select on public.subscription_events for select to authenticated using (public.has_org_role(organization_id, array['owner']) or public.platform_role() is not null);

create policy tickets_select on public.support_tickets for select to authenticated using (created_by = auth.uid() or public.has_platform_role(array['super_admin','support_admin']));
create policy tickets_insert on public.support_tickets for insert to authenticated with check (created_by = auth.uid() and (organization_id is null or public.org_role(organization_id) is not null));
create policy tnotes_select on public.ticket_notes for select to authenticated using (
  public.has_platform_role(array['super_admin','support_admin'])
  or (not is_internal and exists (select 1 from public.support_tickets t where t.id = ticket_id and t.created_by = auth.uid())));
create policy tnotes_insert on public.ticket_notes for insert to authenticated with check (
  author_id = auth.uid() and not is_internal and exists (select 1 from public.support_tickets t where t.id = ticket_id and t.created_by = auth.uid()));

create policy flags_select on public.feature_flags for select to authenticated using (true);
create policy settings_select on public.platform_settings for select to anon, authenticated using (key = 'support_email' or public.platform_role() is not null);
create policy jobs_select on public.job_runs for select to authenticated using (public.has_platform_role(array['super_admin']));

-- ===== GRANTS =====
revoke all on all tables in schema public from anon, authenticated;
grant select on public.plans, public.platform_settings to anon;
grant select on public.profiles, public.platform_admins, public.organizations, public.organization_members, public.invitations, public.properties, public.units,
  public.tenants, public.leases, public.rent_invoices, public.invoice_adjustments, public.payments, public.expenses, public.maintenance_requests,
  public.maintenance_updates, public.documents, public.notifications, public.audit_logs, public.plans, public.subscriptions, public.subscription_events,
  public.support_tickets, public.ticket_notes, public.feature_flags, public.platform_settings, public.job_runs to authenticated;
grant update (full_name, phone, notify_in_app) on public.profiles to authenticated;
grant update (name, currency, timezone) on public.organizations to authenticated;
grant update (role, status) on public.organization_members to authenticated;
grant delete on public.organization_members to authenticated;
grant insert (organization_id, email, role, tenant_id, invited_by) on public.invitations to authenticated;
grant update (status) on public.invitations to authenticated;
grant insert, update on public.properties, public.units, public.tenants, public.leases to authenticated;
grant insert, update, delete on public.expenses to authenticated;
grant insert, update on public.maintenance_requests to authenticated;
grant insert (organization_id, request_id, author_id, comment) on public.maintenance_updates to authenticated;
grant insert, delete on public.documents to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant insert (organization_id, created_by, subject, description) on public.support_tickets to authenticated;
grant insert (ticket_id, author_id, body, is_internal) on public.ticket_notes to authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on function public.write_audit(text, uuid, text, text, text, text, jsonb), public.require_reason(text), public.recompute_invoice(uuid),
  public.run_daily_job(), public.handle_new_user(), public.audit_row(), public.enforce_plan_limit(), public.protect_last_owner(), public.guard_unit_status(),
  public.sync_unit_status(), public.maintenance_guard(), public.maintenance_log_status(), public.set_updated_at(), public.org_plan(uuid),
  public.is_active_user_internal() from authenticated;

-- ===== STORAGE (private bucket) =====
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 10485760, array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy documents_read on storage.objects for select to authenticated using (bucket_id = 'documents' and public.has_org_role(public.storage_path_org(name), array['owner','property_manager','accountant','maintenance']));
create policy documents_write on storage.objects for insert to authenticated with check (bucket_id = 'documents' and public.has_org_role(public.storage_path_org(name), array['owner','property_manager','accountant','maintenance']));
create policy documents_remove on storage.objects for delete to authenticated using (bucket_id = 'documents' and public.has_org_role(public.storage_path_org(name), array['owner','property_manager']));
