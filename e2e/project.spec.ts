import { test, expect } from '@playwright/test';
import { createHmac } from 'node:crypto';
const projectId = '11111111-1111-4111-8111-111111111111';
const session = 'local-browser-session';
const signed = encodeURIComponent(session + '.' + createHmac('sha256', 'local-browser-tests-only-never-deploy-this-key').update(session).digest('base64'));
test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: 'better-auth.session_token', value: signed, domain: 'localhost', path: '/', httpOnly: true },
    { name: '__Secure-better-auth.session_token', value: signed, domain: 'localhost', path: '/', secure: true, httpOnly: true },
  ]);
});
test('authenticated deep link, map, pagination, rename and export', async ({ page, browser }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`/dashboard/projects/${projectId}`);
  await expect(page.getByRole('heading', { name: 'Browser project' })).toBeVisible();
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await expect(page.getByText('Last event received:', { exact: false })).toBeVisible();
  await page.getByRole('tab', { name: 'Events', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Page 2 of 3')).toBeVisible();
  await expect(page.getByText('198.51.100.7', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('dialog').getByRole('button', { name: 'Export JSON', exact: true }).click();
  const download = await downloadEvent;
  expect(await download.failure()).toBeNull();
  const stream = await download.createReadStream();
  const chunks: Buffer[] = []; for await (const chunk of stream!) chunks.push(chunk);
  const rows = JSON.parse(Buffer.concat(chunks).toString());
  expect(rows).toHaveLength(15); expect(new Set(rows.map((row: {id:string}) => row.id)).size).toBe(15);
  await page.getByRole('tab', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Rename project', exact: true }).click();
  await page.getByRole('dialog').getByRole('textbox').fill('Renamed browser project');
  // Check the actual mutation request uses POST, and the same endpoint rejects GET.
  const mutationRequest = page.waitForRequest(request => request.url().includes('_serverFn') && request.method() === 'POST');
  await page.getByRole('button', { name: 'Save name', exact: true }).click();
  const request = await mutationRequest;
  await expect(page.getByRole('heading', { name: 'Renamed browser project' })).toBeVisible();
  const getUrl = new URL(request.url());
  getUrl.searchParams.set("payload", request.postData()!);
  const get = await page.request.get(getUrl.toString()); expect(get.status()).toBe(405);
  const crossOrigin = await page.request.post(request.url(), { headers: { Origin: 'https://evil.example' }, data: request.postDataJSON() });
  expect(crossOrigin.status()).toBe(403);
  // Replaying an otherwise valid mutation against another owner must not
  // change that project. Verify using that owner's independent session.
  await page.request.post(request.url(), { headers: { Origin: "http://localhost:4173", "content-type": "application/json" }, data: request.postData()!.replaceAll(projectId, "22222222-2222-4222-8222-222222222222") });
  const otherContext = await browser.newContext({ baseURL: "http://localhost:4173" });
  const otherToken = "local-other-session";
  const otherSigned = encodeURIComponent(otherToken + "." + createHmac("sha256", "local-browser-tests-only-never-deploy-this-key").update(otherToken).digest("base64"));
  await otherContext.addCookies([
    { name: "better-auth.session_token", value: otherSigned, domain: "localhost", path: "/" },
    { name: "__Secure-better-auth.session_token", value: otherSigned, domain: "localhost", path: "/", secure: true },
  ]);
  const otherPage = await otherContext.newPage();
  await otherPage.goto("/dashboard/projects/22222222-2222-4222-8222-222222222222");
  await expect(otherPage.getByRole("heading", { name: "Other project" })).toBeVisible();
  await otherContext.close();
  expect(errors).toEqual([]);
});
test('ownership and anonymous export access are enforced', async ({ page, playwright }) => {
  const other = await page.request.get('/api/projects/22222222-2222-4222-8222-222222222222/export?range=all');
  expect(other.status()).toBe(404);
  const anonymous = await playwright.request.newContext({ baseURL:'http://localhost:4173' });
  expect((await anonymous.get(`/api/projects/${projectId}/export?range=all`)).status()).toBe(401);
  await anonymous.dispose();
});

test('retention and explicit event deletion update the dashboard', async ({ page }) => {
  await page.goto(`/dashboard/projects/${projectId}`);
  await page.getByRole('tab', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Retention in days (1–365)').fill('7');
  await page.getByRole('button', { name: 'Save retention', exact: true }).click();
  await expect(page.getByText('Retention saved.', { exact: false })).toBeVisible();
  await page.reload();
  await page.getByRole('tab', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Retention in days (1–365)')).toHaveValue('7');
  await page.getByRole('button', { name: 'Delete all events', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete events', exact: true }).click();
  await page.getByRole('tab', { name: 'Events', exact: true }).click();
  await expect(page.getByText('No events yet', { exact: true })).toBeVisible();
});
