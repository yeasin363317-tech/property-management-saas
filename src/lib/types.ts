export type OrgRole = 'owner' | 'property_manager' | 'accountant' | 'maintenance' | 'tenant'
export type PlatformRole = 'super_admin' | 'support_admin' | 'billing_admin'

export interface Organization { id: string; name: string; currency: string; timezone: string; status: string }
export interface Membership { role: OrgRole; organization: Organization }
export interface Profile { id: string; full_name: string | null; phone: string | null; status: 'active' | 'suspended'; notify_in_app: boolean }

export interface Property { id: string; organization_id: string; name: string; address_line: string; city: string | null; property_type: string; description: string | null; status: string }
export interface Unit { id: string; organization_id: string; property_id: string; unit_number: string; floor: string | null; unit_type: string | null; size_sqft: number | null; bedrooms: number | null; bathrooms: number | null; expected_rent: number; status: string }
export interface Tenant { id: string; organization_id: string; user_id: string | null; full_name: string; email: string | null; phone: string | null; emergency_contact_name: string | null; emergency_contact_phone: string | null; notes: string | null; status: string }
export interface Lease { id: string; organization_id: string; unit_id: string; tenant_id: string; start_date: string; end_date: string | null; monthly_rent: number; security_deposit: number; due_day: number; status: string; termination_reason: string | null }
export interface Invoice { id: string; organization_id: string; lease_id: string; tenant_id: string; period_start: string; due_date: string; base_amount: number; adjustment_total: number; amount_due: number; amount_paid: number; status: string; void_reason: string | null }
export interface Payment { id: string; invoice_id: string; amount: number; paid_on: string; method: string; reference: string | null; status: string; reversal_reason: string | null; created_at: string }
export interface Expense { id: string; property_id: string; unit_id: string | null; category: string; amount: number; expense_on: string; description: string | null }
export interface MaintenanceRequest { id: string; organization_id: string; property_id: string; unit_id: string | null; tenant_id: string | null; title: string; description: string | null; priority: string; status: string; assigned_to: string | null; estimated_cost: number | null; actual_cost: number | null; completed_on: string | null; created_at: string }
export interface DocumentRow { id: string; storage_path: string; file_name: string; mime_type: string; size_bytes: number; entity_type: string; entity_id: string; created_at: string }
export interface Notification { id: string; type: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string }
export interface Plan { code: string; name: string; price_monthly: number | null; max_properties: number | null; max_units: number | null; max_members: number | null; is_active: boolean }
