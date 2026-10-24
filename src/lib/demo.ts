// Demo accounts are fake addresses with sample data only. The demo password is NOT stored in this repository:
// set it as the VITE_DEMO_PASSWORD environment variable (the same value you passed to public.seed_demo()).
export const DEMO_LANDLORD = 'demo.landlord@example.com'
export const DEMO_TENANT = 'demo.tenant@example.com'
export const MIN_DEMO_PASSWORD_LENGTH = 12

const raw = (import.meta.env.VITE_DEMO_PASSWORD as string | undefined) ?? ''
if (raw.length > 0 && raw.length < MIN_DEMO_PASSWORD_LENGTH) {
  console.warn(`VITE_DEMO_PASSWORD must be at least ${MIN_DEMO_PASSWORD_LENGTH} characters; demo buttons are disabled.`)
}

/** Demo buttons are shown only when a strong enough password is configured. */
export const demoConfigured = raw.length >= MIN_DEMO_PASSWORD_LENGTH
export const DEMO_PASSWORD = demoConfigured ? raw : ''
export const isDemoEmail = (e?: string | null) => !!e && [DEMO_LANDLORD, DEMO_TENANT].includes(e.toLowerCase())
