import { test, expect } from '@playwright/test';

// This is a deliberately small Fase-1 smoke test: it only exercises the
// client-side auth guard in +layout.svelte, which needs no live Supabase
// data (supabase-js's getSession() is a local, storage-only read when there
// is no cached session — no network call is required for this assertion to
// hold). The full acceptance-criteria E2E suite (login, create mission,
// complete mission, store, statistics, PWA install, etc. — spec sections 44
// and 54 Fase 12) is added once there's a seeded Supabase project to run
// against.
test('unauthenticated visitor is redirected to /login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Gamify' })).toBeVisible();
});

test('unknown routes redirect to / and then to /login when unauthenticated', async ({ page }) => {
  await page.goto('/esta-ruta-no-existe');
  await expect(page).toHaveURL(/\/login$/);
});

test('protected routes redirect to /login when unauthenticated', async ({ page }) => {
  await page.goto('/missions');
  await expect(page).toHaveURL(/\/login$/);
});

test('/check-email is reachable without a session', async ({ page }) => {
  await page.goto('/check-email?email=a%40b.com');
  await expect(page.getByRole('heading', { name: 'Revisa tu correo' })).toBeVisible();
});
