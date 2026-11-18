import { test, expect } from '@playwright/test';

// These run offline: the real database is never touched.
test.beforeEach(async ({ page }) => {
  await page.route(/supabase\.co/, (route) => route.abort());
  page.on('pageerror', (error) => {
    throw error;
  });
});

async function startSession(page, names = 'Ana, Ben, Cy, Dee, Eli, Fay') {
  await page.goto('/openplay');
  await page.getByLabel('Session name').fill('Test night');
  await page.getByRole('button', { name: 'Open session' }).click();
  await page.getByLabel('Names').fill(names);
  await page.getByLabel('Names').press('Enter');
  await expect(page.getByLabel('Names')).toHaveValue('');
  await expect(page.getByLabel('Names')).toBeFocused();
}

const sendGame = (page) => page.getByRole('button', { name: 'Send next game here' }).first().click();

async function finishGame(page, a, b) {
  const court = page.locator('.court.playing').first();
  await court.getByPlaceholder('Score').nth(0).fill(String(a));
  await court.getByPlaceholder('Score').nth(1).fill(String(b));
  await court.getByRole('button', { name: 'Finish game' }).click();
}

async function endOpenPlay(page) {
  await page.getByRole('button', { name: 'End', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /end/i }).last().click();
}

test('home page opens', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Keep score');
  await expect(page.getByRole('link', { name: 'Terms and privacy' })).toBeVisible();
});

test('unknown address shows the not found page', async ({ page }) => {
  await page.goto('/no-such-page');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});

test('a full open play: game, correction, end, standings', async ({ page }) => {
  await startSession(page);
  await sendGame(page);
  await finishGame(page, 11, 5);
  await page.getByText('Recent results').click();
  await page.getByRole('button', { name: 'Correct' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('Score').first().fill('4');
  await dialog.getByPlaceholder('Score').last().fill('11');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.res-score').first()).toContainText('4–11');

  await endOpenPlay(page);
  await expect(page.getByRole('heading', { name: 'Test night' })).toBeVisible();
  await expect(page.locator('.podium')).toBeVisible();
});

test('a game can be changed: replace a player, then cancel', async ({ page }) => {
  await startSession(page);
  await sendGame(page);
  const court = page.locator('.court.playing').first();
  const dialog = page.getByRole('dialog');
  await court.getByRole('button', { name: 'Change players or cancel' }).click();
  const out = await dialog.getByLabel('Going off').locator('option').nth(1).innerText();
  await dialog.getByLabel('Going off').selectOption(out);
  await dialog.getByLabel('Coming on').selectOption({ index: 1 });
  await dialog.getByRole('button', { name: 'Replace player' }).click();
  await expect(page.locator('.queue-item.away')).toContainText(out);

  await court.getByRole('button', { name: 'Change players or cancel' }).click();
  await dialog.getByRole('button', { name: 'Cancel this game' }).click();
  await expect(page.locator('.court.playing')).toHaveCount(0);
});

test('a free court can be removed', async ({ page }) => {
  await startSession(page);
  await page.getByRole('button', { name: 'Remove this court' }).first().click();
  await expect(page.locator('.court')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Remove this court' })).toHaveCount(0);
});

test('past players are suggested in the next session', async ({ page }) => {
  await startSession(page);
  await sendGame(page);
  await finishGame(page, 11, 5);
  await page.getByText('Recent results').click();
  const played = await page.locator('.res-team').first().innerText();
  const name = played.split('&')[0].trim();
  await endOpenPlay(page);
  await page.getByRole('button', { name: 'Start new open play' }).click();
  await page.getByLabel('Session name').fill('Second');
  await page.getByRole('button', { name: 'Open session' }).click();
  await page.getByLabel('Names').fill(name.slice(0, 2));
  await page.locator('.suggestions').getByRole('button', { name }).click();
  await expect(page.locator('.queue-item')).toContainText(name);
});

test('rally scoring on the scoreboard', async ({ page }) => {
  await page.goto('/scoreboard');
  await page.getByLabel('Side A').fill('Red');
  await page.getByLabel('Side B').fill('Blue');
  await page.getByLabel('Scoring').selectOption('rally');
  await page.getByRole('button', { name: 'Start match' }).click();
  await page.getByRole('button', { name: /^Blue/ }).click();
  await expect(page.locator('.side.b .score')).toHaveText('1');
});
