import { createSignal, Show } from "solid-js";
import { createAsync, useNavigate } from "@solidjs/router";

export default function Login() {
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const navigate = useNavigate();

  const handleLogin = async (e: Event) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username(),
          password: password()
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Store authentication token
        localStorage.setItem('github-feed-auth', data.token);
        navigate('/');
      } else {
        setError(data.error || 'Invalid credentials');
      }
    } catch (error) {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="login-container">
      <div class="login-form">
        <h1>GitHub Feed Login</h1>
        <form onSubmit={handleLogin}>
          <div class="form-group">
            <label for="username">Username:</label>
            <input
              type="text"
              id="username"
              required
              value={username()}
              onInput={(e) => setUsername(e.target.value)}
              disabled={loading()}
            />
          </div>
          
          <div class="form-group">
            <label for="password">Password:</label>
            <input
              type="password"
              id="password"
              required
              value={password()}
              onInput={(e) => setPassword(e.target.value)}
              disabled={loading()}
            />
          </div>

          <Show when={error()}>
            <div class="error-message">{error()}</div>
          </Show>

          <button type="submit" disabled={loading()}>
            {loading() ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>

      <style>{`
        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #0d1117;
          color: #f0f6fc;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Noto Sans, Helvetica, Arial, sans-serif;
        }

        .login-form {
          background-color: #21262d;
          padding: 2rem;
          border-radius: 8px;
          border: 1px solid #30363d;
          min-width: 300px;
          max-width: 400px;
          width: 100%;
        }

        .login-form h1 {
          text-align: center;
          margin-bottom: 1.5rem;
          color: #f0f6fc;
        }

        .form-group {
          margin-bottom: 1rem;
        }

        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 600;
        }

        .form-group input {
          width: 100%;
          padding: 0.75rem;
          background-color: #0d1117;
          border: 1px solid #30363d;
          border-radius: 4px;
          color: #f0f6fc;
          font-size: 1rem;
          box-sizing: border-box;
        }

        .form-group input:focus {
          outline: none;
          border-color: #58a6ff;
          box-shadow: 0 0 0 2px rgba(88, 166, 255, 0.3);
        }

        .form-group input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .error-message {
          color: #f85149;
          background-color: #490202;
          border: 1px solid #f85149;
          padding: 0.5rem;
          border-radius: 4px;
          margin-bottom: 1rem;
          text-align: center;
        }

        button {
          width: 100%;
          padding: 0.75rem;
          background-color: #238636;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        button:hover:not(:disabled) {
          background-color: #2ea043;
        }

        button:disabled {
          background-color: #484f58;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}