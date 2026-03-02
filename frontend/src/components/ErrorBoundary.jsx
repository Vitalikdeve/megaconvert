import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message || 'Unexpected error'
    };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', padding: 24, background: '#020617', color: '#e2e8f0' }}>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Something went wrong</h1>
          <p style={{ marginTop: 12, opacity: 0.9 }}>{this.state.message}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: 16,
              border: '1px solid #334155',
              borderRadius: 10,
              padding: '10px 14px',
              background: '#0f172a',
              color: '#e2e8f0',
              cursor: 'pointer'
            }}
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

