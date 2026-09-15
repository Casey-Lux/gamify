<script lang="ts">
  import { auth } from '$lib/stores/auth';
  import { updateDisplayName, ProfileError } from '$lib/api/profile';
  import { uploadAvatar, AvatarError } from '$lib/api/avatar';
  import { installPrompt } from '$lib/pwa/install-prompt';
  import UserCard from '$lib/components/layout/UserCard.svelte';

  let displayName = $state($auth.profile?.display_name ?? '');
  let savingName = $state(false);
  let nameError = $state<string | null>(null);
  let nameSaved = $state(false);

  let uploading = $state(false);
  let avatarError = $state<string | null>(null);

  // Keeps the input in sync with the profile once it loads/refreshes,
  // without clobbering what the user is actively typing.
  $effect(() => {
    if ($auth.profile && !savingName) displayName = $auth.profile.display_name;
  });

  async function handleSaveName(e: SubmitEvent) {
    e.preventDefault();
    if (!$auth.session) return;
    savingName = true;
    nameError = null;
    nameSaved = false;
    try {
      await updateDisplayName($auth.session.user.id, displayName);
      await auth.refreshProfile();
      nameSaved = true;
    } catch (err) {
      nameError = err instanceof ProfileError ? err.message : 'No se pudo guardar el nombre.';
    } finally {
      savingName = false;
    }
  }

  async function handleAvatarChange(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !$auth.session) return;

    uploading = true;
    avatarError = null;
    try {
      await uploadAvatar($auth.session.user.id, file);
      await auth.refreshProfile();
    } catch (err) {
      avatarError = err instanceof AvatarError ? err.message : 'No se pudo subir el avatar.';
    } finally {
      uploading = false;
      input.value = '';
    }
  }
</script>

<main class="profile-page">
  <h1>Perfil</h1>

  <UserCard variant="full" />

  {#if $installPrompt}
    <section class="card">
      <h2>Instalar aplicación</h2>
      <p class="hint">
        Instala Gamify en este dispositivo para abrirla como una app, sin la barra del navegador, y
        con acceso a tus últimos datos aunque te quedes sin conexión.
      </p>
      <button type="button" class="install-cta" onclick={() => installPrompt.promptInstall()}>
        Instalar
      </button>
    </section>
  {/if}

  <section class="card">
    <h2>Avatar</h2>
    <p class="hint">JPG, PNG o WebP. Se recorta a cuadrado y se comprime automáticamente.</p>
    <input
      type="file"
      accept="image/png,image/jpeg,image/webp"
      onchange={handleAvatarChange}
      disabled={uploading}
    />
    {#if uploading}<p class="status">Subiendo…</p>{/if}
    {#if avatarError}<p class="error" role="alert">{avatarError}</p>{/if}
  </section>

  <form class="card" onsubmit={handleSaveName}>
    <h2>Nombre</h2>
    <label>
      Nombre visible
      <input type="text" bind:value={displayName} required maxlength="60" />
    </label>
    {#if nameError}<p class="error" role="alert">{nameError}</p>{/if}
    {#if nameSaved}<p class="status">Guardado.</p>{/if}
    <button type="submit" disabled={savingName}>
      {savingName ? 'Guardando…' : 'Guardar'}
    </button>
  </form>
</main>

<style>
  .profile-page {
    max-width: 560px;
    margin: 0 auto;
    padding: 1rem;
    padding-bottom: 5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .profile-page h1 {
    margin: 0;
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: 1rem;
    border-radius: 0.75rem;
    background: var(--surface, #1c1c28);
    border: 1px solid var(--border, #2c2c3a);
  }
  .card h2 {
    margin: 0;
    font-size: 1rem;
  }
  .hint {
    margin: 0;
    font-size: 0.8rem;
    color: var(--text-muted, #a0a0b0);
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.85rem;
  }
  input[type='text'] {
    min-height: 44px;
    padding: 0.5rem;
    border-radius: 0.4rem;
    border: 1px solid var(--border, #2c2c3a);
    background: var(--input-bg, #14141f);
    color: inherit;
  }
  input[type='file'] {
    min-height: 44px;
  }
  button[type='submit'],
  button.install-cta {
    align-self: flex-start;
    min-height: 44px;
    padding: 0.5rem 1.2rem;
    border-radius: 0.5rem;
    border: none;
    background: #4c6ef5;
    color: white;
    font-weight: 600;
    cursor: pointer;
  }
  button[type='submit']:disabled {
    background: #3a3a4a;
    cursor: not-allowed;
  }
  .status {
    margin: 0;
    font-size: 0.85rem;
    color: #6fa8ff;
  }
  .error {
    margin: 0;
    font-size: 0.85rem;
    color: #e0574f;
  }
</style>
