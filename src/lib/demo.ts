// Demo accounts are fake addresses with sample data only. The demo password is NOT stored in this repository:
// set it as the VITE_DEMO_PASSWORD environment variable (same value you passed to public.seed_demo()).
export const DEMO_LANDLORD = 'demo.landlord@example.com'
export const DEMO_TENANT = 'demo.tenant@example.com'
export const DEMO_PASSWORD = (import.meta.env.VITE_DEMO_PASSWORD as string | undefined) ?? ''
export const demoConfigured = DEMO_PASSWORD.length > 0
export const isDemoEmail = (e?: string | null) => !!e && [DEMO_LANDLORD, DEMO_TENANT].includes(e.toLowerCase())
