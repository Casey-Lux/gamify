<script lang="ts">
  import { page } from '$app/state';
  import { supabase } from '$lib/supabase/client';

  const email = $derived(page.url.searchParams.get('email') ?? '');

  let resending = $state(false);
  let resent = $state(false);
  let error = $state<string | null>(null);

  async function resend() {
    if (!email) return;
    resending = true;
    resent = false;
    error = null;
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/` }
    });
    resending = false;
    if (resendError) error = resendError.message;
    else resent = true;
  }
</script>

<main class="check-email">
  <section class="card">
    <h1>Revisa tu correo</h1>
    <p>
      Te hemos enviado un enlace de verificación{#if email}
        a <strong>{email}</strong>{/if}. Ábrelo para confirmar tu cuenta y continuar.
    </p>
    <p class="hint">
      Si no lo ves en unos minutos, revisa la carpeta de spam. Después de verificarlo, inicia
      sesión.
    </p>

    {#if resent}<p class="ok" role="status">Correo reenviado.</p>{/if}
    {#if error}<p class="error" role="alert">{error}</p>{/if}

    <div class="actions">
      {#if email}
        <button type="button" class="secondary" disabled={resending} onclick={resend}>
          {resending ? 'Enviando…' : 'Reenviar correo'}
        </button>
      {/if}
      <a class="primary" href="/login">Ir a iniciar sesión</a>
    </div>
  </section>
</main>

<style>
  .check-email {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 1rem;
  }
  .card {
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
  p {
    margin: 0;
    overflow-wrap: anywhere;
  }
  .hint {
    font-size: 0.85rem;
    color: #a0a0b0;
  }
  .ok {
    font-size: 0.85rem;
    color: #5fbf7a;
  }
  .error {
    font-size: 0.85rem;
    color: #e0574f;
  }
  .actions {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .primary,
  .secondary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    border-radius: 0.5rem;
    font: inherit;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
  }
  .primary {
    border: none;
    background: #4c6ef5;
    color: white;
  }
  .secondary {
    border: 1px solid #2c2c3a;
    background: transparent;
    color: inherit;
  }
  .secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
