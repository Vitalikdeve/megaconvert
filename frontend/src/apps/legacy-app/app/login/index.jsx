import { LockKeyhole, MessageSquareText } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function LoginPage({ error, isSubmitting, onSubmit }) {
  const [credentials, setCredentials] = useState({
    username: '',
    password: '',
  });

  const handleChange = (field) => (event) => {
    setCredentials((currentState) => ({
      ...currentState,
      [field]: event.target.value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await onSubmit(credentials);
  };

  return (
    <div className="auth-shell">
      <section className="glass-panel auth-card">
        <div className="auth-hero">
          <div>
            <span className="auth-kicker">
              <MessageSquareText size={14} />
              Realtime workspace
            </span>
            <h1 className="auth-headline">Secure conversations with instant delivery.</h1>
            <p className="auth-copy">
              A premium messenger with a local-first dev stack: sign in, discover
              users, and start live chats with a polished glass interface.
            </p>
          </div>

            <div className="auth-metrics">
              <div className="auth-metric">
                <strong>3000</strong>
                <span>Local API server</span>
              </div>
              <div className="auth-metric">
                <strong>4000</strong>
                <span>Socket.io realtime</span>
              </div>
            <div className="auth-metric">
              <strong>Live</strong>
              <span>Optimistic message updates</span>
            </div>
          </div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div>
            <h1>Welcome back</h1>
            <p>Sign in with your existing messenger credentials.</p>
          </div>

          <div className="auth-stack">
            <div className="auth-field">
              <label htmlFor="login-username">Username</label>
              <input
                id="login-username"
                onChange={handleChange('username')}
                placeholder="signal-style-handle"
                value={credentials.username}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                onChange={handleChange('password')}
                placeholder="Enter your password"
                type="password"
                value={credentials.password}
              />
            </div>
          </div>

          {error ? <div className="auth-error">{error}</div> : null}

          <button className="glass-button glass-button--primary" disabled={isSubmitting} type="submit">
            <LockKeyhole size={18} />
            {isSubmitting ? 'Signing in...' : 'Login'}
          </button>

          <div className="auth-footer">
            <span>Need a new account?</span>
            <Link className="auth-link" to="/register">
              Register
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}
