import { Component, type ReactNode } from 'react'
import { BootError } from './BootError'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  error: unknown
}

// catches render throws after mount, out of reach of main.tsx's try/catch
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: unknown): State {
    return { error }
  }

  render() {
    if (this.state.error) return this.props.fallback ?? <BootError error={this.state.error} />
    return this.props.children
  }
}
