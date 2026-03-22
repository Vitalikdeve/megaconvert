import { ShieldCheck, UserPlus2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function RegisterPage({ error, isSubmitting, onSubmit }) {
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
              <ShieldCheck size={14} />
              Messenger platform
            </span>
            <h1 className="auth-headline">Create an account and launch your first chat.</h1>
            <p className="auth-copy">
              Registration is wired to the existing VPS backend. Once the account is
              created, you land directly inside the messenger and can discover users
              instantly.
            </p>
          </div>

          <div className="auth-metrics">
            <div className="auth-metric">
              <strong>Secure</strong>
              <span>Credential-based entry</span>
            </div>
            <div className="auth-metric">
              <strong>Responsive</strong>
              <span>Desktop and mobile chat shell</span>
            </div>
            <div className="auth-metric">
              <strong>Instant</strong>
              <span>Socket-driven delivery</span>
            </div>
          </div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div>
            <h1>Create account</h1>
            <p>Use a username and password that the existing backend accepts.</p>
          </div>

          <div className="auth-stack">
            <div className="auth-field">
              <label htmlFor="register-username">Username</label>
              <input
                id="register-username"
                onChange={handleChange('username')}
                placeholder="choose-a-handle"
                value={credentials.username}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="register-password">Password</label>
              <input
                id="register-password"
                onChange={handleChange('password')}
                placeholder="Create a strong password"
                type="password"
                value={credentials.password}
              />
            </div>
          </div>

          {error ? <div className="auth-error">{error}</div> : null}

          <button className="glass-button glass-button--primary" disabled={isSubmitting} type="submit">
            <UserPlus2 size={18} />
            {isSubmitting ? 'Creating account...' : 'Register'}
          </button>

          <div className="auth-footer">
            <span>Already have an account?</span>
            <Link className="auth-link" to="/login">
              Login
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}
