import { createSignal, Show, onMount } from "solid-js";
import { createAsync, useNavigate } from "@solidjs/router";
import { isAuthenticated } from "../lib/auth";

export default function Login() {
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const navigate = useNavigate();

  // Check if already authenticated
  onMount(() => {
    if (isAuthenticated()) {
      navigate('/');
    }
  });

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

    </div>
  );
}