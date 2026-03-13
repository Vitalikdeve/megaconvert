import React from 'react';
import { withTranslation } from 'react-i18next';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message || ''
    };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    const { t } = this.props;

    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', padding: 24, background: '#020617', color: '#e2e8f0' }}>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>{t('errorBoundary.title')}</h1>
          <p style={{ marginTop: 12, opacity: 0.9 }}>
            {this.state.message || t('errorBoundary.unexpected')}
          </p>
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
            {t('errorBoundary.reload')}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const TranslatedErrorBoundary = withTranslation()(ErrorBoundary);

export default TranslatedErrorBoundary;
