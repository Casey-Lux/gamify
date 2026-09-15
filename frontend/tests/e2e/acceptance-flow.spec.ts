import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

/**
 * Fase 12 — spec sección 44 "E2E" (the full 21-step acceptance flow) +
 * section 55 "Criterios de aceptación".
 *
 * ⚠️ NOT RUNNABLE IN THE SANDBOX THIS WAS WRITTEN IN, AND NOT YET RUN
 * ANYWHERE. Documented honestly rather than claimed as passing — the same
 * caveat `auth-guard.spec.ts` (Fase 1) already carried, now spelled out in
 * full because it matters for the whole file, not just one test:
 *
 *   1. Running it needs a real, reachable Supabase project (Auth + Postgres
 *      + Storage) with the migrations applied — this sandbox's network
 *      egress is allowlisted to npm/GitHub/crates.io only, so it cannot
 *      reach `*.supabase.co` at all.
 *   2. Running it needs Playwright's own browser binaries, downloaded from
 *      Playwright's CDN at `npx playwright install` time — also outside
 *      this sandbox's allowlist.
 *
 * Steps 4-7 ("crear skill", "crear área", "crear misión", "crear
 * submisiones") now drive the real `/manage` and `/missions/new` screens —
 * the gap noted in README_FASE12.md ("falta la UI de creación de
 * skills/áreas/misiones") is closed. The service-role client below is only
 * used for two things neither the spec nor any phase asks for a creation
 * screen for: seeding one store item to purchase in steps 14-20 (spec
 * section 23's Store UI lists browsing/buying, never an "add item" form),
 * and teardown.
 *
 * Requires three env vars beyond Playwright's own PLAYWRIGHT_BASE_URL
 * (see playwright.config.ts): E2E_SUPABASE_URL, E2E_SUPABASE_ANON_KEY, and
 * E2E_SUPABASE_SERVICE_ROLE_KEY (service role only ever used here, in a
 * throwaway test project, to seed/tear down fixtures — never shipped to
 * the frontend, spec section 49).
 */

const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.E2E_SUPABASE_ANON_KEY ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ?? '';

test.skip(
  !SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY,
  'Requires E2E_SUPABASE_URL / E2E_SUPABASE_ANON_KEY / E2E_SUPABASE_SERVICE_ROLE_KEY ' +
    'pointing at a seeded, disposable Supabase project — see README_FASE12.md.'
);

const unique = () => `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

test.describe('full acceptance flow (spec sections 44 + 55)', () => {
  const runId = unique();
  const email = `e2e-${runId}@example.com`;
  const password = 'correct horse battery staple';

  let userId: string;
  let workspaceId: string;

  test.afterAll(async () => {
    // Best-effort teardown of the throwaway user via the admin API — a
    // failure here must never fail the suite (spec section 27's own
    // "best-effort, never blocking" spirit applied to test hygiene).
    if (!userId) return;
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    await admin.auth.admin.deleteUser(userId).catch(() => {});
  });

  test('1-2. register + login', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Gamify' })).toBeVisible();

    await page.getByRole('button', { name: '¿No tienes cuenta? Regístrate' }).click();
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Contraseña').fill(password);
    await page.getByRole('button', { name: 'Registrarme' }).click();

    // A fresh Supabase project with "confirm email" off logs the user in
    // immediately after sign-up; the auth guard then redirects off /login.
    await expect(page).toHaveURL(/\/missions$/, { timeout: 15_000 });
  });

  test('3. profile is provisioned automatically (0018_auth_profile_provisioning)', async ({
    page
  }) => {
    await loginAs(page, email, password);
    await page.goto('/profile');
    // A brand-new user has 0 XP / level 1 / 0 coins — exactly the
    // `handle_new_user()` trigger's defaults, never anything the client
    // itself has to compute or insert.
    await expect(page.getByText(/Nivel 1/)).toBeVisible();

    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data } = await anon.auth.signInWithPassword({ email, password });
    userId = data.user!.id;
    await anon.auth.signOut();
  });

  test('4-5. create skill and area via the real UI (/manage)', async ({ page }) => {
    await loginAs(page, email, password);
    await page.goto('/manage');

    // The current user is OWNER of their own personal workspace
    // (auto-provisioned by 0018's handle_new_user() trigger — see
    // workspace_provisioning_test.sql), so /manage does not redirect away.
    await expect(page.getByRole('heading', { name: 'Skills' })).toBeVisible();

    await page.getByLabel('Nombre').first().fill(`E2E Skill ${runId}`);
    await page.getByRole('button', { name: 'Crear skill' }).click();
    await expect(page.getByText(`E2E Skill ${runId}`)).toBeVisible();

    await page.getByRole('heading', { name: 'Áreas' }).scrollIntoViewIfNeeded();
    await page.getByLabel('Nombre').last().fill(`E2E Area ${runId}`);
    await page.getByRole('button', { name: 'Crear área' }).click();
    await expect(page.getByText(`E2E Area ${runId}`)).toBeVisible();
  });

  test('6-7. create mission with subtasks via the real UI (/missions/new)', async ({ page }) => {
    await loginAs(page, email, password);
    await page.goto('/missions/new');

    await page.getByLabel('Título').fill(`E2E Mission ${runId}`);
    await page.getByLabel('Skill').selectOption({ label: `E2E Skill ${runId}` });
    await page.getByLabel('Área (opcional)').selectOption({ label: `E2E Area ${runId}` });
    await page.getByLabel('Dificultad').selectOption({ label: 'Media' });
    await page.getByLabel('Recompensa de XP').fill('100');
    await page.getByLabel('Recompensa de monedas').fill('30');

    await page.getByPlaceholder('Título de la submisión').first().fill('Subtask A');
    await page.getByRole('button', { name: '+ Añadir submisión' }).click();
    await page.getByPlaceholder('Título de la submisión').last().fill('Subtask B');

    await page.getByRole('button', { name: 'Crear misión' }).click();
    await expect(page).toHaveURL(/\/missions$/, { timeout: 10_000 });
    await expect(page.getByText(`E2E Mission ${runId}`)).toBeVisible();

    // The RPCs below (complete_mission, purchase_item) still need a
    // service-role lookup for workspaceId/missionId to seed the one thing
    // with no creation UI in this MVP by design (spec sections 14/23 never
    // describe an "add store item" screen — only "administra tienda" at
    // the OWNER-permissions level, section 4) — a store item to purchase
    // in steps 14-20.
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: membership } = await admin
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', userId)
      .eq('role', 'OWNER')
      .single();
    workspaceId = membership!.workspace_id;

    const { data: mission } = await admin
      .from('missions')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('title', `E2E Mission ${runId}`)
      .single();
    expect(mission?.id).toBeTruthy();

    await admin.from('store_items').insert({
      workspace_id: workspaceId,
      name: `E2E Item ${runId}`,
      price: 10,
      effect_type: 'XP_MULTIPLIER',
      effect_value: 1.5,
      duration_minutes: 15
    });
  });

  test('8-13. complete subtasks, complete mission, validate XP/skill/coins/level', async ({
    page
  }) => {
    await loginAs(page, email, password);
    await page.goto('/missions');

    const card = page.locator('.mission-card', { hasText: `E2E Mission ${runId}` });
    await expect(card).toBeVisible();

    const completeButton = card.getByRole('button', { name: /Completar misión/ });
    await expect(completeButton).toBeDisabled(); // spec section 10: subtasks still incomplete

    await card.getByLabel('Subtask A').check();
    await card.getByLabel('Subtask B').check();
    await expect(completeButton).toBeEnabled();

    await completeButton.click();
    await expect(card.getByText('Completada')).toBeVisible();

    // Reward toast/summary reflects the exact numbers the RPC returned —
    // never a client-recomputed guess (spec section 7/40).
    await expect(page.getByText('+100 XP')).toBeVisible();
    await expect(page.getByText(/30 monedas/)).toBeVisible();

    await page.goto('/profile');
    await expect(page.getByText(new RegExp(`E2E Skill ${runId}`))).toBeVisible();
    await expect(page.getByText(/30 monedas/)).toBeVisible();
  });

  test('14-16. open store, purchase item, validate stock', async ({ page }) => {
    await loginAs(page, email, password);
    await page.goto('/store');

    const item = page.locator('.store-item', { hasText: `E2E Item ${runId}` });
    await expect(item).toBeVisible();
    await expect(item.getByText('4/5')).not.toBeVisible(); // starts untouched at 5/5

    await item.getByRole('button', { name: 'Comprar' }).click();
    await expect(page.getByText(/Compraste "E2E Item/)).toBeVisible();
    await expect(item.getByText('4/5')).toBeVisible();
  });

  test('17. validate price increase after the fifth purchase', async ({ page }) => {
    await loginAs(page, email, password);
    await page.goto('/store');
    const item = page.locator('.store-item', { hasText: `E2E Item ${runId}` });

    // Already bought once in the previous test (stock 4/5); four more
    // purchases empty it out and trigger the reset-and-raise-price step
    // (spec section 19).
    for (let i = 0; i < 4; i++) {
      await item.getByRole('button', { name: 'Comprar' }).click();
      await expect(page.getByText(/Compraste "E2E Item/)).toBeVisible();
    }

    await expect(item.getByText('5/5')).toBeVisible(); // reset
    await expect(item.getByText('12 monedas')).toBeVisible(); // 10 + 2
  });

  test('18-20. validate active effect, effect replacement, expiration', async ({ page }) => {
    await loginAs(page, email, password);
    await page.goto('/store');

    const item = page.locator('.store-item', { hasText: `E2E Item ${runId}` });
    await item.getByRole('button', { name: 'Comprar' }).click(); // 6th purchase, activates the effect

    const activeEffects = page.locator('.active-effects, [data-active-effects]');
    await expect(activeEffects.getByText(`E2E Item ${runId}`)).toBeVisible();

    // Buying the SAME effect_type again replaces rather than stacks: still
    // exactly one entry in the active-effects list afterwards.
    await item.getByRole('button', { name: 'Comprar' }).click(); // 7th purchase
    await expect(activeEffects.getByText(`E2E Item ${runId}`)).toHaveCount(1);

    // Expiration itself (duration_minutes: 15) is a real-time wait this
    // suite does not sit through — covered instead, deterministically, by
    // supabase/tests/purchase_item_test.sql's expires_at assertions.
  });

  test('21. view statistics', async ({ page }) => {
    await loginAs(page, email, password);
    await page.goto('/statistics');
    await expect(page.getByRole('button', { name: 'Día' })).toBeVisible();
    // The one mission completed in this run shows up in today's bucket.
    await expect(page.getByText(/1 misión completada|Misiones completadas/)).toBeVisible();
  });
});

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/missions$/, { timeout: 15_000 });
}
