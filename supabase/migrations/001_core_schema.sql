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
