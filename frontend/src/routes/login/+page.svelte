<script lang="ts">
  import { supabase } from '$lib/supabase/client';

  let email = $state('');
  let password = $state('');
  let mode: 'signin' | 'signup' = $state('signin');
  let error = $state<string | null>(null);
  let loading = $state(false);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    error = null;
    loading = true;

    const { error: authError } =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    loading = false;
    if (authError) error = authError.message;
  }
</script>

<main class="login">
  <form onsubmit={submit}>
    <h1>Gamify</h1>
    <p class="subtitle">{mode === 'signin' ? 'Inicia sesión' : 'Crea tu cuenta'}</p>

    <label>
      Email
      <input type="email" bind:value={email} required autocomplete="email" />
    </label>
    <label>
      Contraseña
      <input
        type="password"
        bind:value={password}
        required
        autocomplete="current-password"
        minlength="8"
      />
    </label>

    {#if error}
      <p class="error" role="alert">{error}</p>
    {/if}

    <button type="submit" disabled={loading}>
      {loading ? 'Un momento…' : mode === 'signin' ? 'Entrar' : 'Registrarme'}
    </button>

    <button
      type="button"
      class="link"
      onclick={() => (mode = mode === 'signin' ? 'signup' : 'signin')}
    >
      {mode === 'signin' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
    </button>
  </form>
</main>

<style>
  .login {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 1rem;
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
    max-width: 360px;
    padding: 1.5rem;
    border-radius: 0.75rem;
    background: #1c1c28;
    border: 1px solid #2c2c3a;
  }
  h1 {
    margin: 0;
  }
  .subtitle {
    margin: 0 0 0.5rem 0;
    color: #a0a0b0;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.85rem;
  }
  input {
    min-height: 44px;
    padding: 0.5rem;
    border-radius: 0.4rem;
    border: 1px solid #2c2c3a;
    background: #14141f;
    color: inherit;
  }
  button[type='submit'] {
    min-height: 44px;
    border: none;
    border-radius: 0.5rem;
    background: #4c6ef5;
    color: white;
    font-weight: 600;
    cursor: pointer;
  }
  .link {
    background: none;
    border: none;
    color: #6fa8ff;
    cursor: pointer;
    font-size: 0.85rem;
  }
  .error {
    color: #e0574f;
    font-size: 0.85rem;
    margin: 0;
  }
</style>
