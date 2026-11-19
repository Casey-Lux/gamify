import { test, expect } from '@playwright/test';

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
