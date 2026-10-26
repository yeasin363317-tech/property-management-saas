// Pending invitation code is kept in localStorage so it survives the email-confirmation step
// (the confirmation link usually opens in a new tab).
const KEY = 'rentora.invite'

export const getPendingInvite = (): string => { try { return localStorage.getItem(KEY) ?? '' } catch { return '' } }
export const setPendingInvite = (t: string) => { try { localStorage.setItem(KEY, t) } catch { /* storage unavailable */ } }
export const clearPendingInvite = () => { try { localStorage.removeItem(KEY) } catch { /* storage unavailable */ } }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isInviteToken = (t: string) => UUID.test(t.trim())

export function inviteLink(token: string, email: string) {
  return `${window.location.origin}/signup?invite=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`
}
export function inviteMessage(token: string, email: string) {
  return `You have been invited to Rentora. Open this link and sign up with ${email}: ${inviteLink(token, email)}\nInvitation code: ${token}`
}
