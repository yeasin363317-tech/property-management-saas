import type { OrgRole } from './types'

/** UI-level mirror of the database authorization (the database is the real enforcement). */
export const FIN: OrgRole[] = ['owner', 'property_manager', 'accountant']
export const MGR: OrgRole[] = ['owner', 'property_manager']

export const can = {
  manageProperties: (r?: OrgRole | null) => !!r && MGR.includes(r),
  manageTenants: (r?: OrgRole | null) => !!r && MGR.includes(r),
  manageLeases: (r?: OrgRole | null) => !!r && MGR.includes(r),
  seeFinance: (r?: OrgRole | null) => !!r && FIN.includes(r),
  recordPayments: (r?: OrgRole | null) => !!r && FIN.includes(r),
  correctFinance: (r?: OrgRole | null) => r === 'owner' || r === 'accountant',
  manageTeam: (r?: OrgRole | null) => r === 'owner',
  editOrg: (r?: OrgRole | null) => r === 'owner',
  seeDocuments: (r?: OrgRole | null) => !!r && r !== 'tenant',
}

export interface NavItem { to: string; label: string; roles: OrgRole[] }
export const NAV: NavItem[] = [
  { to: '/app', label: 'Dashboard', roles: FIN },
  { to: '/app/properties', label: 'Properties', roles: ['owner', 'property_manager', 'accountant', 'maintenance'] },
  { to: '/app/tenants', label: 'Tenants', roles: FIN },
  { to: '/app/leases', label: 'Leases', roles: FIN },
  { to: '/app/invoices', label: 'Rent & payments', roles: FIN },
  { to: '/app/expenses', label: 'Expenses', roles: FIN },
  { to: '/app/maintenance', label: 'Maintenance', roles: ['owner', 'property_manager', 'accountant', 'maintenance'] },
  { to: '/app/documents', label: 'Documents', roles: ['owner', 'property_manager', 'accountant', 'maintenance'] },
  { to: '/app/reports', label: 'Reports', roles: FIN },
  { to: '/app/team', label: 'Team', roles: ['owner'] },
  { to: '/app/notifications', label: 'Notifications', roles: ['owner', 'property_manager', 'accountant', 'maintenance'] },
  { to: '/app/support', label: 'Support', roles: ['owner', 'property_manager', 'accountant', 'maintenance'] },
  { to: '/app/settings', label: 'Settings', roles: ['owner', 'property_manager', 'accountant', 'maintenance'] },
]

export const ROLE_LABEL: Record<OrgRole, string> = {
  owner: 'Owner', property_manager: 'Property manager', accountant: 'Accountant', maintenance: 'Maintenance staff', tenant: 'Tenant',
}
