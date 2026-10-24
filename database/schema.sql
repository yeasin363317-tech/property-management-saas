-- Rentora: full database schema, creates everything from scratch on a NEW, empty Supabase project.
-- Run this whole file once in the Supabase SQL editor. Then optionally run database/seed.sql for demo accounts.
-- Generated from supabase/migrations (001-007). Do not run the migrations AND this file on the same database.

-- ===================== 001_core_schema =====================
create extension if not exists btree_gist with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text check (full_name is null or length(full_name) <= 120),
  phone text check (phone is null or length(phone) <= 30),
  status text not null default 'active' check (status in ('active','suspended')),
  suspended_reason text,
  notify_in_app boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('super_admin','support_admin','billing_admin')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  currency text not null default 'BDT' check (currency ~ '^[A-Z]{3}$'),
  timezone text not null default 'Asia/Dhaka',
  status text not null default 'active' check (status in ('active','suspended')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','property_manager','accountant','maintenance','tenant')),
  status text not null default 'active' check (status in ('active','removed')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index on public.organization_members (user_id);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null check (length(trim(name)) between 1 and 120),
  address_line text not null check (length(trim(address_line)) between 1 and 250),
  city text,
  property_type text not null default 'apartment_building' check (property_type in ('apartment_building','house','condo','townhouse','commercial_mixed','other')),
  description text,
  status text not null default 'active' check (status in ('active','archived')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);
create index on public.properties (organization_id);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  property_id uuid not null,
  unit_number text not null check (length(trim(unit_number)) between 1 and 40),
  floor text,
  unit_type text,
  size_sqft numeric(10,2) check (size_sqft is null or size_sqft > 0),
  bedrooms int check (bedrooms is null or bedrooms between 0 and 50),
  bathrooms numeric(3,1) check (bathrooms is null or bathrooms between 0 and 50),
  expected_rent numeric(14,2) not null default 0 check (expected_rent >= 0),
  status text not null default 'vacant' check (status in ('vacant','occupied','reserved','unavailable')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (property_id, organization_id) references public.properties(id, organization_id),
  unique (id, organization_id),
  unique (property_id, unit_number)
);
create index on public.units (organization_id);
create index on public.units (property_id);

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  user_id uuid references auth.users(id),
  full_name text not null check (length(trim(full_name)) between 1 and 120),
  email text,
  phone text,
  emergency_contact_name text,
  emergency_contact_phone text,
  notes text,
  status text not null default 'active' check (status in ('active','former','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);
create index on public.tenants (organization_id);
create index on public.tenants (user_id);

create table public.leases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  unit_id uuid not null,
  tenant_id uuid not null,
  start_date date not null,
  end_date date,
  monthly_rent numeric(14,2) not null check (monthly_rent >= 0),
  security_deposit numeric(14,2) not null default 0 check (security_deposit >= 0),
  due_day int not null default 1 check (due_day between 1 and 28),
  status text not null default 'upcoming' check (status in ('upcoming','active','ended','terminated')),
  terminated_at date,
  termination_reason text,
  renewed_from uuid references public.leases(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (unit_id, organization_id) references public.units(id, organization_id),
  foreign key (tenant_id, organization_id) references public.tenants(id, organization_id),
  unique (id, organization_id),
  check (end_date is null or end_date > start_date),
  constraint leases_no_overlap exclude using gist (
    unit_id with =,
    daterange(start_date, coalesce(end_date + 1, 'infinity'::date), '[)') with &&
  ) where (status in ('upcoming','active'))
);
create index on public.leases (organization_id);
create index on public.leases (tenant_id);

create table public.rent_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  lease_id uuid not null,
  tenant_id uuid not null,
  period_start date not null,
  due_date date not null,
  base_amount numeric(14,2) not null check (base_amount >= 0),
  adjustment_total numeric(14,2) not null default 0,
  amount_due numeric(14,2) not null check (amount_due >= 0),
  amount_paid numeric(14,2) not null default 0 check (amount_paid >= 0),
  status text not null default 'open' check (status in ('open','paid','void')),
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (lease_id, organization_id) references public.leases(id, organization_id),
  foreign key (tenant_id, organization_id) references public.tenants(id, organization_id),
  unique (id, organization_id),
  check (period_start = date_trunc('month', period_start)::date)
);
create unique index rent_invoices_one_per_period on public.rent_invoices (lease_id, period_start) where status <> 'void';
create index on public.rent_invoices (organization_id, due_date);
create index on public.rent_invoices (tenant_id);

create table public.invoice_adjustments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  invoice_id uuid not null,
  amount numeric(14,2) not null check (amount <> 0),
  reason text not null check (length(trim(reason)) >= 3),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (invoice_id, organization_id) references public.rent_invoices(id, organization_id)
);
create index on public.invoice_adjustments (invoice_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  invoice_id uuid not null,
  amount numeric(14,2) not null check (amount > 0),
  paid_on date not null,
  method text not null check (method in ('cash','bank_transfer','mobile_banking','cheque','other')),
  reference text,
  status text not null default 'valid' check (status in ('valid','reversed')),
  reversed_at timestamptz,
  reversed_by uuid references auth.users(id),
  reversal_reason text,
  idempotency_key text,
  recorded_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (invoice_id, organization_id) references public.rent_invoices(id, organization_id)
);
create unique index payments_idem on public.payments (organization_id, idempotency_key) where idempotency_key is not null;
create index on public.payments (invoice_id);
create index on public.payments (organization_id, paid_on);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  property_id uuid not null,
  unit_id uuid,
  category text not null check (category in ('repairs','utilities','taxes','insurance','cleaning','salaries','supplies','other')),
  amount numeric(14,2) not null check (amount > 0),
  expense_on date not null,
  description text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (property_id, organization_id) references public.properties(id, organization_id),
  foreign key (unit_id, organization_id) references public.units(id, organization_id)
);
create index on public.expenses (organization_id, expense_on);

create table public.maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  property_id uuid not null,
  unit_id uuid,
  tenant_id uuid,
  title text not null check (length(trim(title)) between 3 and 150),
  description text,
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  status text not null default 'new' check (status in ('new','acknowledged','in_progress','waiting','completed','cancelled')),
  assigned_to uuid references auth.users(id),
  estimated_cost numeric(14,2) check (estimated_cost is null or estimated_cost >= 0),
  actual_cost numeric(14,2) check (actual_cost is null or actual_cost >= 0),
  completed_on date,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (property_id, organization_id) references public.properties(id, organization_id),
  foreign key (unit_id, organization_id) references public.units(id, organization_id),
  foreign key (tenant_id, organization_id) references public.tenants(id, organization_id),
  unique (id, organization_id)
);
create index on public.maintenance_requests (organization_id, status);

create table public.maintenance_updates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  request_id uuid not null,
  author_id uuid references auth.users(id),
  comment text,
  status_from text,
  status_to text,
  created_at timestamptz not null default now(),
  foreign key (request_id, organization_id) references public.maintenance_requests(id, organization_id)
);
create index on public.maintenance_updates (request_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  email text not null check (email = lower(email)),
  role text not null check (role in ('property_manager','accountant','maintenance','tenant')),
  tenant_id uuid,
  token uuid not null unique default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  expires_at timestamptz not null default now() + interval '7 days',
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, organization_id) references public.tenants(id, organization_id)
);
create index on public.invitations (organization_id);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png','image/webp')),
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  entity_type text not null check (entity_type in ('property','lease','tenant','expense','maintenance')),
  entity_id uuid not null,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index on public.documents (organization_id, entity_type, entity_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index on public.notifications (user_id, created_at desc);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  scope text not null check (scope in ('org','platform')),
  organization_id uuid,
  actor_id uuid,
  action text not null,
  target_type text,
  target_id text,
  outcome text not null default 'success',
  reason text,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index on public.audit_logs (scope, created_at desc);
create index on public.audit_logs (organization_id, created_at desc);

create table public.plans (
  code text primary key check (code ~ '^[a-z0-9_]{2,30}$'),
  name text not null,
  price_monthly numeric(12,2) check (price_monthly is null or price_monthly >= 0),
  max_properties int check (max_properties is null or max_properties >= 0),
  max_units int check (max_units is null or max_units >= 0),
  max_members int check (max_members is null or max_members >= 0),
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  organization_id uuid primary key references public.organizations(id),
  plan_code text not null references public.plans(code),
  status text not null default 'active' check (status in ('active','trialing','past_due','canceled')),
  source text not null default 'system' check (source in ('system','manual_admin','payment_provider')),
  current_period_end date,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create table public.subscription_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id),
  event_type text not null,
  from_plan text,
  to_plan text,
  from_status text,
  to_status text,
  source text not null check (source in ('system','manual_admin','payment_provider')),
  actor_id uuid,
  reason text,
  created_at timestamptz not null default now()
);
create index on public.subscription_events (organization_id, created_at desc);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  created_by uuid not null references auth.users(id),
  subject text not null check (length(trim(subject)) between 3 and 200),
  description text not null check (length(trim(description)) >= 3),
  status text not null default 'open' check (status in ('open','pending','resolved','closed')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  assigned_to uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.support_tickets (status, created_at desc);

create table public.ticket_notes (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  body text not null check (length(trim(body)) >= 1),
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.ticket_notes (ticket_id);

create table public.feature_flags (
  key text primary key,
  description text,
  enabled boolean not null default false,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create table public.platform_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create table public.job_runs (
  id bigint generated always as identity primary key,
  job_name text not null,
  status text not null check (status in ('running','succeeded','failed')),
  detail text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

-- ===================== 002_functions_triggers =====================
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

-- ===================== 003_admin_rls_storage_seed =====================
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

-- ===================== 004_tenant_portal =====================
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

-- ===================== 005_cleanup =====================
-- Removes a no-op constraint that 001 originally created by mistake.
alter table public.invoice_adjustments drop constraint if exists invoice_adjustments_no_blank;

-- ===================== 007_foreign_key_indexes =====================
create index if not exists idx_maintenance_requests_assigned_to on public.maintenance_requests (assigned_to);
create index if not exists idx_maintenance_requests_tenant on public.maintenance_requests (tenant_id);
create index if not exists idx_maintenance_requests_property on public.maintenance_requests (property_id);
create index if not exists idx_documents_uploaded_by on public.documents (uploaded_by);
create index if not exists idx_support_tickets_created_by on public.support_tickets (created_by);
create index if not exists idx_support_tickets_assigned_to on public.support_tickets (assigned_to);
create index if not exists idx_support_tickets_org on public.support_tickets (organization_id);
create index if not exists idx_audit_logs_actor on public.audit_logs (actor_id);
create index if not exists idx_leases_unit on public.leases (unit_id);
create index if not exists idx_rent_invoices_lease on public.rent_invoices (lease_id);
create index if not exists idx_expenses_property on public.expenses (property_id);
create index if not exists idx_invitations_tenant on public.invitations (tenant_id);

-- ===================== 006 demo guard (credentials of demo accounts cannot be changed) =====================
create function public.is_demo_email(p_email text) returns boolean language sql immutable set search_path = '' as $$
  select lower(coalesce(p_email, '')) in ('demo.landlord@example.com', 'demo.tenant@example.com')
$$;

-- Demo credentials are public by design, so nobody may change them.
create function public.block_demo_credential_change() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if lower(coalesce(old.email, '')) in ('demo.landlord@example.com', 'demo.tenant@example.com')
     and (new.encrypted_password is distinct from old.encrypted_password or new.email is distinct from old.email)
     and coalesce(current_setting('app.demo_seeding', true), '') <> 'on' then
    raise exception 'Demo account credentials cannot be changed';
  end if;
  return new;
end $$;

create trigger block_demo_credential_change before update on auth.users for each row execute function public.block_demo_credential_change();

-- Demo users cannot create extra organizations (keeps the demo tidy and prevents abuse).
create or replace function public.create_organization(p_name text, p_currency text default 'BDT', p_timezone text default 'Asia/Dhaka') returns uuid language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  if auth.uid() is null or not public.is_active_user_internal() then raise exception 'Not authorized' using errcode = '42501'; end if;
  if public.is_demo_email((select email from auth.users where id = auth.uid())) then raise exception 'Demo accounts cannot create organizations'; end if;
  if (select count(*) from public.organization_members where user_id = auth.uid() and role = 'owner' and status = 'active') >= 5 then raise exception 'Organization limit reached'; end if;
  insert into public.organizations (name, currency, timezone, created_by) values (trim(p_name), upper(p_currency), p_timezone, auth.uid()) returning id into v_org;
  insert into public.organization_members (organization_id, user_id, role) values (v_org, auth.uid(), 'owner');
  insert into public.subscriptions (organization_id, plan_code, status, source) values (v_org, 'free', 'active', 'system');
  insert into public.subscription_events (organization_id, event_type, to_plan, to_status, source, actor_id) values (v_org, 'created', 'free', 'active', 'system', auth.uid());
  return v_org;
end $$;

revoke execute on function public.is_demo_email(text), public.block_demo_credential_change() from public, anon, authenticated;
