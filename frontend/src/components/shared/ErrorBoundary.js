import React from 'react';
import { T } from '../../utils/helpers';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // In production, send to error tracking (Sentry, etc.)
    if (process.env.NODE_ENV === 'production') {
      console.error('[ErrorBoundary]', error.message, errorInfo?.componentStack?.split('\n').slice(0,3).join(' '));
    } else {
      console.error('[ErrorBoundary]', error, errorInfo);
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const isDev = process.env.NODE_ENV !== 'production';
    return (
      <div style={{
        minHeight: this.props.fullPage ? '100vh' : '200px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: T.bg0, padding: 32,
      }}>
        <div style={{ maxWidth: 520, textAlign: 'center' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: T.redDim, border: `2px solid ${T.red}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px', fontSize: 32,
          }}>⚠️</div>

          <div style={{ fontFamily: T.display, fontWeight: 900, fontSize: 22, marginBottom: 8 }}>
            Something went wrong
          </div>
          <div style={{ color: T.sub, fontSize: 13, lineHeight: 1.7, marginBottom: 24 }}>
            This page crashed unexpectedly. Your data is safe.
          </div>

          {isDev && this.state.error && (
            <div style={{
              background: T.bg1, border: `1px solid ${T.red}33`, borderRadius: 6,
              padding: 16, marginBottom: 20, textAlign: 'left',
            }}>
              <div style={{ fontFamily: T.mono, fontSize: 11, color: T.red, marginBottom: 6 }}>
                {this.state.error.toString()}
              </div>
              <div style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, whiteSpace: 'pre-wrap', maxHeight: 120, overflow: 'auto' }}>
                {this.state.errorInfo?.componentStack?.trim()}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
              style={{
                background: T.accent, color: '#fff', border: 'none',
                padding: '10px 22px', borderRadius: 4, fontFamily: T.display,
                fontWeight: 700, fontSize: 13, letterSpacing: '0.06em',
                textTransform: 'uppercase', cursor: 'pointer',
              }}>
              Try Again
            </button>
            <button
              onClick={() => window.location.href = '/dashboard'}
              style={{
                background: T.bg2, color: T.sub, border: `1px solid ${T.border}`,
                padding: '10px 22px', borderRadius: 4, fontFamily: T.display,
                fontWeight: 700, fontSize: 13, letterSpacing: '0.06em',
                textTransform: 'uppercase', cursor: 'pointer',
              }}>
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }
}

// HOC for wrapping individual pages
export const withErrorBoundary = (Component, props = {}) =>
  function WrappedComponent(componentProps) {
    return (
      <ErrorBoundary {...props}>
        <Component {...componentProps} />
      </ErrorBoundary>
    );
  };

export default ErrorBoundary;
