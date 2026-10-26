import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: object) => ({ options, useParams: () => ({ projectId: "test-project" }) }),
  useNavigate: () => vi.fn(),
}));
vi.mock("@/components/projects/traffic-map", () => ({ default: () => <div>Map ready</div> }));
vi.mock("@/core/functions/projects", () => ({
  getProjectOverview: vi.fn(), listProjectEvents: vi.fn(), listProjectLocations: vi.fn(), listProjectDomains: vi.fn(),
  addProjectDomain: vi.fn(), updateProjectDomain: vi.fn(), deleteProjectDomain: vi.fn(),
  renameProject: vi.fn(), deleteProject: vi.fn(), updateRetention: vi.fn(), deleteProjectEvents: vi.fn(),
}));
import * as api from "@/core/functions/projects";
import { Route } from "@/routes/_auth/dashboard/projects/$projectId/index";

const row = { id: "event-1", timestamp: new Date(), ipAddress: "198.51.100.1", type: "unknown", proxy: null, mobile: null, hosting: null,
  enrichmentStatus: "edge", country: "US", region: null, city: null, zip: null, isp: null, asName: null };
let client: QueryClient;
beforeEach(() => {
  vi.resetAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  vi.mocked(api.getProjectOverview).mockResolvedValue({ projectId: "test-project", name: "Test project", retentionDays: 30,
    totalEvents: 12, mobileEvents: 0, classifiedEvents: 0, uniqueIps: 1, lastEventAt: null, diagnostics: [], domainCount: 1,
    collectorOrigin: "https://collector.example", since: new Date() });
  vi.mocked(api.listProjectEvents).mockImplementation(async ({ data }) => ({ items: [row], total: 12, page: data.page, pageSize: 6 }));
  vi.mocked(api.listProjectLocations).mockResolvedValue([]);
  vi.mocked(api.listProjectDomains).mockResolvedValue([]);
});
afterEach(() => { cleanup(); client.clear(); vi.useRealTimers(); });
function mount() {
  // The route object is supplied by the router mock; the real component and
  // React Query behavior are exercised together.
  const Component = Route.options.component as React.ComponentType;
  return render(<QueryClientProvider client={client}><Component /></QueryClientProvider>);
}
async function tab(name: string) {
  const trigger = await screen.findByRole("tab", { name });
  fireEvent.mouseDown(trigger, { button: 0, ctrlKey: false });
  fireEvent.click(trigger);
}

describe("project dashboard", () => {
  it("keeps page 2 selected while its uncached result loads", async () => {
    let resolvePage: (value: Awaited<ReturnType<typeof api.listProjectEvents>>) => void = () => {};
    vi.mocked(api.listProjectEvents).mockImplementation(({ data }) => data.page === 2 ? new Promise(resolve => { resolvePage = resolve; }) : Promise.resolve({ items: [row], total: 12, page: 1, pageSize: 6 }));
    mount(); await tab("Events");
    await waitFor(() => expect((screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(api.listProjectEvents).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ page: 2 }) })));
    expect(screen.getByText("Page 2 of 2")).toBeTruthy();
    await act(async () => resolvePage({ items: [{ ...row, id: "page-2", ipAddress: "203.0.113.2" }], total: 12, page: 2, pageSize: 6 }));
    expect(await screen.findByText("203.0.113.2")).toBeTruthy();
    expect(screen.getByText("Page 2 of 2")).toBeTruthy();
  });
  it("shows failed event queries as errors with retry", async () => {
    vi.mocked(api.listProjectEvents).mockRejectedValue(new Error("Database unavailable"));
    mount(); await tab("Events");
    expect(await screen.findByText(/Unable to load data: Database unavailable/)).toBeTruthy();
    expect(screen.queryByText("No events yet")).toBeNull();
    vi.mocked(api.listProjectEvents).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 6 });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("No events yet")).toBeTruthy();
  });
  it("retains a new domain and displays a failed save", async () => {
    vi.mocked(api.addProjectDomain).mockRejectedValue(new Error("Save failed"));
    mount(); await tab("Settings");
    const input = await screen.findByLabelText("Add domain") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "example.com" } });
    await waitFor(() => expect((screen.getByRole("button", { name: /^Add$/ }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }));
    expect(await screen.findByText("Save failed")).toBeTruthy();
    expect(input.value).toBe("example.com");
  });
  it("refreshes summary, map and events together", async () => {
    vi.useFakeTimers(); mount();
    await act(async () => { await Promise.resolve(); });
    const before = [api.getProjectOverview, api.listProjectLocations, api.listProjectEvents].map(fn => vi.mocked(fn).mock.calls.length);
    await act(async () => { await vi.advanceTimersByTimeAsync(10001); });
    [api.getProjectOverview, api.listProjectLocations, api.listProjectEvents].forEach((fn, i) => expect(vi.mocked(fn).mock.calls.length).toBeGreaterThan(before[i]!));
  });
  it("loops waiting dots until the first event arrives", async () => {
    vi.useFakeTimers(); mount();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(screen.getByText("Get Started")).toBeTruthy();
    expect(screen.getByText("Configure your domain in the Settings tab.")).toBeTruthy();
    const waiting = () => screen.getByText(/^Waiting for the first event/).textContent;
    expect(waiting()).toBe("Waiting for the first event.");
    for (const dots of ["..", "...", "", "."]) {
      await act(async () => { await vi.advanceTimersByTimeAsync(500); });
      expect(waiting()).toBe(`Waiting for the first event${dots}`);
    }
    await act(async () => {
      client.setQueryData<Awaited<ReturnType<typeof api.getProjectOverview>>>(["project-overview", "test-project"], previous => previous && ({ ...previous, lastEventAt: new Date() }));
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.queryByText(/^Waiting for the first event/)).toBeNull();
    expect(screen.getByText(/^Last event received:/)).toBeTruthy();
    expect(screen.queryByText(/^Location is approximate\./)).toBeNull();
  });
});
