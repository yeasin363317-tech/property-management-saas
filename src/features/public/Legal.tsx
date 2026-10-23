import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link to="/" className="text-sm text-brand-600 underline">← Back to Rentora</Link>
      <h1 className="mt-4 text-3xl font-bold">{title}</h1>
      <p className="mt-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
        This is a starting template. Have it reviewed by a qualified lawyer and adapt it to your business and country before launching to real customers.
      </p>
      <div className="prose mt-6 space-y-4 text-sm leading-6 text-slate-700">{children}</div>
    </div>
  )
}

export function Terms() {
  return (
    <Page title="Terms of Service">
      <h2 className="text-lg font-semibold text-slate-900">1. The service</h2>
      <p>Rentora provides software for recording and organising property, tenant, lease, rent and maintenance information. Rentora does not collect rent on your behalf and does not provide legal, tax or accounting advice.</p>
      <h2 className="text-lg font-semibold text-slate-900">2. Your account</h2>
      <p>You are responsible for the accuracy of the information you enter, for keeping your login credentials secure, and for the activity of people you invite to your workspace.</p>
      <h2 className="text-lg font-semibold text-slate-900">3. Acceptable use</h2>
      <p>You must not use the service to break the law, to store data you have no right to hold, or to attempt to access another customer's data.</p>
      <h2 className="text-lg font-semibold text-slate-900">4. Plans and billing</h2>
      <p>Plan limits apply as shown on the pricing section. Paid plan terms are agreed with you directly until automated billing is available.</p>
      <h2 className="text-lg font-semibold text-slate-900">5. Suspension</h2>
      <p>We may suspend an account that breaches these terms or threatens the security of the service. Business records are not silently deleted.</p>
      <h2 className="text-lg font-semibold text-slate-900">6. Liability</h2>
      <p>The service is provided as available. To the extent permitted by law, liability is limited. Your local consumer law may give you additional rights.</p>
    </Page>
  )
}

export function Privacy() {
  return (
    <Page title="Privacy Policy">
      <h2 className="text-lg font-semibold text-slate-900">What we collect</h2>
      <p>Account details (name, email), and the property, tenant, lease, payment, expense, maintenance and document information that you or your team enter. Landlords are responsible for having a lawful basis to record their tenants' information.</p>
      <h2 className="text-lg font-semibold text-slate-900">How it is used</h2>
      <p>Only to provide the service: showing your data to you and the people you authorise, sending account emails such as confirmation and password reset, and keeping the service secure.</p>
      <h2 className="text-lg font-semibold text-slate-900">Who can see it</h2>
      <p>Your data is isolated per workspace and shown only to members according to their role. Platform administrators have limited access for support and operations, and their actions are logged.</p>
      <h2 className="text-lg font-semibold text-slate-900">Storage and security</h2>
      <p>Data is stored with Supabase. Uploaded documents are kept in private storage and are served only through short-lived signed links to authorised members.</p>
      <h2 className="text-lg font-semibold text-slate-900">Your choices</h2>
      <p>You can update your profile in Settings. To request deletion or export of your data, create a support ticket.</p>
    </Page>
  )
}
