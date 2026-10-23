import { Component } from 'react'
import type { ReactNode } from 'react'

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(err: unknown) { console.error('UI error', err) }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-slate-600">An unexpected error occurred. Reloading usually fixes it.</p>
        <button className="mt-4 rounded-md bg-brand-600 px-4 py-2 text-sm text-white" onClick={() => location.assign('/')}>Reload</button>
      </div>
    )
  }
}
