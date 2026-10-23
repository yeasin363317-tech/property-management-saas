// Public demo credentials. Safe to expose: the demo accounts only see sample data and cannot change their own credentials.
export const DEMO_PASSWORD = 'RentoraDemo#2026'
export const DEMO_LANDLORD = 'demo.landlord@example.com'
export const DEMO_TENANT = 'demo.tenant@example.com'
export const isDemoEmail = (e?: string | null) => !!e && [DEMO_LANDLORD, DEMO_TENANT].includes(e.toLowerCase())
