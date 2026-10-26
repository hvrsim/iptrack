import * as React from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
    ArrowLeft,
    ChevronLeft,
    ChevronDown,
    ChevronUp,
    ChevronRight,
    Copy,
    Download,
    Globe2,
    Moon,
    Plus,
    Search,
    Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    addProjectDomain,
    deleteProject,
    deleteProjectDomain,
    getProjectOverview,
    listProjectDomains,
    listProjectEvents,
    listProjectLocations,
    renameProject,
    updateProjectDomain,
    updateRetention,
    deleteProjectEvents,
} from "@/core/functions/projects";
import { seo } from "@/utils/seo";


export const Route = createFileRoute("/_auth/dashboard/projects/$projectId/")({
    head: () => ({
        meta: [
            ...seo({
                title: "IP Track | Project",
                description: "Project analytics and event stream.",
            }),
        ],
    }),
    component: RouteComponent,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
});

function formatEventDate(value: Date) {
    const timeFormatter = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
    });
    return `${dateFormatter.format(value)} - ${timeFormatter.format(value)}`;
}

const HOSTNAME_REGEX =
    /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/i;
const WILDCARD_REGEX =
    /^\*\.(?=.{1,251}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/i;
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);

function parseDomainValue(value: string) {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) {
        return { valid: false, wildcard: false, hostname: "" };
    }
    if (LOCAL_HOSTNAMES.has(trimmed)) {
        return { valid: true, wildcard: false, hostname: trimmed };
    }
    if (WILDCARD_REGEX.test(trimmed)) {
        return {
            valid: true,
            wildcard: true,
            hostname: trimmed.replace(/^\*\./, ""),
        };
    }
    if (HOSTNAME_REGEX.test(trimmed)) {
        return { valid: true, wildcard: false, hostname: trimmed };
    }
    return { valid: false, wildcard: false, hostname: "" };
}

function normalizeDomainValue(value: string) {
    const parsed = parseDomainValue(value);
    if (!parsed.valid) {
        return value.trim().toLowerCase();
    }
    return parsed.wildcard ? `*.${parsed.hostname}` : parsed.hostname;
}

type EventRow = {
    id: string;
    timestamp: Date;
    ipAddress: string;
    type: string;
    proxy: boolean | null; mobile: boolean | null; hosting: boolean | null; enrichmentStatus: string;
    country: string | null;
    region: string | null;
    city: string | null;
    zip: string | null;
    isp: string | null;
    asName: string | null;
};

type DomainRow = {
    id: string;
    value: string;
};

const TrafficMap = React.lazy(() => import("@/components/projects/traffic-map"));
type LocationPoint = React.ComponentProps<typeof TrafficMap>["points"][number];
function MapPanel({ points }: { points: LocationPoint[] }) {
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => setMounted(true), []);
    return mounted ? <React.Suspense fallback={<p className="p-6">Loading map…</p>}><TrafficMap points={points} /></React.Suspense> : <p className="p-6">Loading map…</p>;
}

function QueryStatus({ loading, error, retry }: { loading: boolean; error: Error | null; retry: () => void }) {
    if (error) return <Alert role="alert"><AlertDescription>Unable to load data: {error.message} <Button variant="outline" onClick={retry}>Retry</Button></AlertDescription></Alert>;
    return loading ? <p role="status" className="p-4">Loading…</p> : null;
}

function WaitingForFirstEvent() {
    const [dots, setDots] = React.useState(1);

    React.useEffect(() => {
        const interval = window.setInterval(() => {
            setDots(value => (value + 1) % 4);
        }, 500);
        return () => window.clearInterval(interval);
    }, []);

    return (
        <p role="status">
            Waiting for the first event
            <span aria-hidden="true" className="inline-block w-4">
                {".".repeat(dots)}
            </span>
        </p>
    );
}

function RouteComponent() {
    const { projectId } = Route.useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [copied, setCopied] = React.useState(false);
    const [searchTerm, setSearchTerm] = React.useState("");
    const [sortConfig, setSortConfig] = React.useState<{
        key: "timestamp" | "ipAddress" | "type" | "country" | "region" | "city" | "zip" | "isp" | "asName";
        direction: "asc" | "desc";
    }>({ key: "timestamp", direction: "desc" });
    const [page, setPage] = React.useState(1);
    const [visibleColumns, setVisibleColumns] = React.useState({
        timestamp: true,
        ipAddress: true,
        type: true,
        country: false,
        region: false,
        city: true,
        zip: false,
        isp: true,
        asName: false,
    });
    const [renameValue, setRenameValue] = React.useState("");
    const [renameError, setRenameError] = React.useState<string | null>(null);
    const [renameDialogOpen, setRenameDialogOpen] = React.useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
    const [exportDialogOpen, setExportDialogOpen] = React.useState(false);
    const [exportRange, setExportRange] = React.useState<
        "day" | "week" | "month" | "all"
    >("month");
    const [exportError, setExportError] = React.useState<string | null>(null);
    const [purgeDialogOpen, setPurgeDialogOpen] = React.useState(false);
    const [domainError, setDomainError] = React.useState<string | null>(null);
    const [retentionDays, setRetentionDays] = React.useState(30);
    const [newDomainError, setNewDomainError] = React.useState<string | null>(
        null,
    );
    const [domains, setDomains] = React.useState<DomainRow[]>([]);
    const [newDomain, setNewDomain] = React.useState("");

    const pageSize = 6;

    const overviewQuery = useQuery({
        queryKey: ["project-overview", projectId],
        queryFn: () => getProjectOverview({ data: { projectId } }),
        refetchInterval: 10000,
    });

    const eventsQuery = useQuery({
        queryKey: ["project-events", projectId, page, searchTerm, sortConfig],
        queryFn: () =>
            listProjectEvents({
                data: {
                    projectId,
                    page,
                    pageSize,
                    search: searchTerm || undefined,
                    sortBy: sortConfig.key,
                    sortDir: sortConfig.direction,
                },
            }),
        refetchInterval: 10000,
        placeholderData: keepPreviousData,
    });

    const locationsQuery = useQuery({
        queryKey: ["project-locations", projectId],
        queryFn: () => listProjectLocations({ data: { projectId, limit: 30 } }),
        refetchInterval: 10000,
    });

    const domainsQuery = useQuery({
        queryKey: ["project-domains", projectId],
        queryFn: () => listProjectDomains({ data: { projectId } }),
    });

    React.useEffect(() => {
        if (domainsQuery.data) {
            setDomains(domainsQuery.data);
        }
    }, [domainsQuery.data]);

    React.useEffect(() => { if (overviewQuery.data) setRetentionDays(overviewQuery.data.retentionDays); }, [overviewQuery.data?.retentionDays]);
    const refreshAnalytics = async () => { await Promise.all(["project-overview", "project-events", "project-locations"].map(key => queryClient.invalidateQueries({ queryKey: [key, projectId] }))); };
    const retentionMutation = useMutation({ mutationFn: updateRetention, onSuccess: refreshAnalytics });
    const purgeMutation = useMutation({ mutationFn: deleteProjectEvents, onSuccess: async () => { setPurgeDialogOpen(false); await refreshAnalytics(); } });
    const deleteMutation = useMutation({
        mutationFn: deleteProject,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["projects"] });
            navigate({ to: "/dashboard" });
        },
    });

    const renameMutation = useMutation({
        mutationFn: renameProject,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["project-overview", projectId] });
            setRenameValue("");
            setRenameError(null);
            queryClient.invalidateQueries({ queryKey: ["projects"] });
        },
        onError: (error) => {
            setRenameError(
                error instanceof Error ? error.message : "Rename failed.",
            );
        },
    });

    const addDomainMutation = useMutation({
        mutationFn: addProjectDomain,
        onError: error => setDomainError(error.message),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["project-domains", projectId],
            });
            queryClient.invalidateQueries({ queryKey: ["project-overview", projectId] });
            setDomainError(null);
        },
    });

    const updateDomainMutation = useMutation({
        mutationFn: updateProjectDomain,
        onError: error => { setDomainError(error.message); setDomains(domainsQuery.data ?? []); },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["project-domains", projectId],
            });
            queryClient.invalidateQueries({ queryKey: ["project-overview", projectId] });
            setDomainError(null);
        },
    });

    const deleteDomainMutation = useMutation({
        mutationFn: deleteProjectDomain,
        onError: error => setDomainError(error.message),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["project-domains", projectId],
            });
            queryClient.invalidateQueries({ queryKey: ["project-overview", projectId] });
            setDomainError(null);
        },
    });

    const events = React.useMemo(() => {
        return (eventsQuery.data?.items ?? []).map((event) => ({
            ...event,
            timestamp:
                event.timestamp instanceof Date
                    ? event.timestamp
                    : new Date(event.timestamp),
        }));
    }, [eventsQuery.data]);

    const columns = React.useMemo(
        () => [
            {
                key: "timestamp" as const,
                label: "Time",
                render: (event: EventRow) => formatEventDate(event.timestamp),
                sortValue: (event: EventRow) => event.timestamp.getTime(),
            },
            {
                key: "ipAddress" as const,
                label: "IP",
                render: (event: EventRow) => event.ipAddress,
                sortValue: (event: EventRow) => event.ipAddress.toLowerCase(),
            },
            {
                key: "type" as const,
                label: "Type",
                render: (event: EventRow) => (
                    <span><Badge variant="outline">{event.type}</Badge><span className="block text-xs text-muted-foreground">Proxy: {event.proxy === null ? "unknown" : event.proxy ? "yes" : "no"} · Mobile: {event.mobile === null ? "unknown" : event.mobile ? "yes" : "no"} · Hosting: {event.hosting === null ? "unknown" : event.hosting ? "yes" : "no"} · {event.enrichmentStatus}</span></span>
                ),
                sortValue: (event: EventRow) => event.type,
            },
            {
                key: "country" as const,
                label: "Country",
                render: (event: EventRow) => event.country ?? "-",
                sortValue: (event: EventRow) =>
                    (event.country ?? "").toLowerCase(),
            },
            {
                key: "region" as const,
                label: "Region",
                render: (event: EventRow) => event.region ?? "-",
                sortValue: (event: EventRow) =>
                    (event.region ?? "").toLowerCase(),
            },
            {
                key: "city" as const,
                label: "City",
                render: (event: EventRow) => event.city ?? "-",
                sortValue: (event: EventRow) =>
                    (event.city ?? "").toLowerCase(),
            },
            {
                key: "zip" as const,
                label: "Zip",
                render: (event: EventRow) => event.zip ?? "-",
                sortValue: (event: EventRow) => (event.zip ?? "").toLowerCase(),
            },
            {
                key: "isp" as const,
                label: "ISP",
                render: (event: EventRow) => event.isp ?? "-",
                sortValue: (event: EventRow) => (event.isp ?? "").toLowerCase(),
            },
            {
                key: "asName" as const,
                label: "AS name",
                render: (event: EventRow) => event.asName ?? "-",
                sortValue: (event: EventRow) =>
                    (event.asName ?? "").toLowerCase(),
            },
        ],
        [],
    );

    const totalEvents = eventsQuery.data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalEvents / pageSize));
    const currentPage = Math.min(page, totalPages);
    const startIndex = (currentPage - 1) * pageSize;
    const pagedEvents = events;

    React.useEffect(() => {
        setPage(1);
    }, [searchTerm, sortConfig]);

    React.useEffect(() => {
        if (eventsQuery.isSuccess && !eventsQuery.isPlaceholderData && page > totalPages) {
            setPage(totalPages);
        }
    }, [page, totalPages, eventsQuery.isSuccess, eventsQuery.isPlaceholderData]);

    const locations: LocationPoint[] =
        locationsQuery.data
            ?.filter(
                (item) =>
                    Number.isFinite(item.lat) && Number.isFinite(item.lon),
            )
            .map((item) => ({
                id: item.id,
                lat: item.lat,
                lng: item.lon,
                ipAddress: item.ipAddress,
                visitedAt: new Date(item.visitedAt),
                mobile: item.mobile,
            })) ?? [];

    const collectorOrigin = overviewQuery.data?.collectorOrigin ?? "";
    const embedCode = collectorOrigin
        ? `<script src="${collectorOrigin}/main.js" data-project-id="${projectId}"></script>`
        : "";

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(embedCode);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        } catch {
            setCopied(false);
        }
    };

    const handleExport = () => {
        setExportDialogOpen(true);
    };

    const exportRanges = [
        { value: "day", label: "Past day", description: "Last 24 hours" },
        { value: "week", label: "Past week", description: "Last 7 days" },
        { value: "month", label: "Past month", description: "Last 30 days" },
        { value: "all", label: "All time", description: "Full history" },
    ] as const;

    const handleExportConfirm = (range: "day" | "week" | "month" | "all") => {
        const enabledColumns = columns.filter(column => visibleColumns[column.key]).map(column => column.key);
        if (!enabledColumns.length) { setExportError("Choose at least one column."); return; }
        const params = new URLSearchParams({ range, columns: enabledColumns.join(",") });
        if (searchTerm) params.set("search", searchTerm);
        const anchor = document.createElement("a");
        anchor.href = `/api/projects/${encodeURIComponent(projectId)}/export?${params}`;
        anchor.download = `${projectId}-${range}.json`;
        document.body.appendChild(anchor); anchor.click(); anchor.remove();
        setExportDialogOpen(false);
    };

    const handleAddDomain = () => {
        const normalized = normalizeDomainValue(newDomain);
        const parsed = parseDomainValue(normalized);
        if (!parsed.valid) {
            setNewDomainError(
                "Enter a valid hostname (example.com) or wildcard (*.example.com).",
            );
            return;
        }
        setNewDomainError(null);
        setDomainError(null);
        addDomainMutation.mutate({ data: { projectId, value: normalized } }, { onSuccess: () => setNewDomain("") });
    };

    const updateDomain = (id: string, updates: Partial<DomainRow>) => {
        setDomains((prev) =>
            prev.map((domain) =>
                domain.id === id ? { ...domain, ...updates } : domain,
            ),
        );
    };

    const removeDomain = (id: string) => {
        deleteDomainMutation.mutate({ data: { projectId, id } });
    };

    const projectName =
        overviewQuery.data?.name ?? `Project ${projectId.slice(0, 6)}`;
    const stats = [
        {
            label: "Total events",
            value: overviewQuery.data?.totalEvents ?? 0,
            badge: "Last 30 days",
        },
        {
            label: "Known mobile events",
            value: overviewQuery.data?.classifiedEvents ? overviewQuery.data.mobileEvents : null,
            badge: "Last 30 days",
        },
        {
            label: "Unique IPs",
            value: overviewQuery.data?.uniqueIps ?? 0,
            badge: "Last 30 days",
        },
    ];
    const numberFormatter = new Intl.NumberFormat("en-US");

    return (
        <div className="space-y-6">
            {deleteMutation.isError && <Alert role="alert"><AlertDescription>{deleteMutation.error.message}</AlertDescription></Alert>}

            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-2xl font-semibold tracking-tight">
                        {projectName}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Analyze traffic and manage project resources.
                    </p>
                </div>
                <Button variant="outline" onClick={() => navigate({ to: "/dashboard" })}>
                    <ArrowLeft className="h-4 w-4" />
                    Back to projects
                </Button>
            </div>

            <Tabs defaultValue="overview" className="space-y-6">
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="events">Events</TabsTrigger>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                    <QueryStatus loading={overviewQuery.isPending} error={overviewQuery.error} retry={() => overviewQuery.refetch()} />
                    {overviewQuery.isSuccess && <Card><CardHeader><CardTitle>Get Started</CardTitle></CardHeader><CardContent className="space-y-3">
                      <ol className="list-decimal pl-6 space-y-2">
                        <li>Configure your domain in the Settings tab.</li>
                        <li>Copy the script from Settings and add it once to your site's HTML.</li>
                        <li>Open a page on that site. This check refreshes every 10 seconds.</li>
                      </ol>
                      {overviewQuery.data.lastEventAt ? <p role="status">Last event received: {new Date(overviewQuery.data.lastEventAt).toLocaleString()}</p> : <WaitingForFirstEvent />}
                      {overviewQuery.data.diagnostics.length > 0 && <div><p>Rejected events today and yesterday:</p><ul>{overviewQuery.data.diagnostics.map(item => <li key={`${item.day}-${item.reason}`}>{item.reason}: {item.count}</li>)}</ul></div>}
                    </CardContent></Card>}

                    <div className="grid gap-4 md:grid-cols-3">
                        {overviewQuery.isSuccess && stats.map((stat) => (
                            <Card key={stat.label} className="border-border/60">
                                <CardHeader className="space-y-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">
                                        {stat.label}
                                    </CardTitle>
                                    <div className="flex items-center justify-between">
                                        <span className="text-2xl font-semibold">
                                            {stat.value === null ? "Unknown" : numberFormatter.format(stat.value)}
                                        </span>
                                        <Badge variant="secondary">
                                            {stat.badge}
                                        </Badge>
                                    </div>
                                </CardHeader>
                            </Card>
                        ))}
                    </div>

                    <Card className="overflow-hidden border-border/60">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-base">
                                    Geographic distribution
                                </CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    Latest 30 geolocated document loads. Refreshes every 10 seconds while this tab is active.
                                </p>
                            </div>
                            <Badge variant="outline" className="gap-1">
                                <Globe2 className="h-3.5 w-3.5" />
                                OpenStreetMap
                            </Badge>
                        </CardHeader>
                        <CardContent className="p-0">
                            <QueryStatus loading={locationsQuery.isPending} error={locationsQuery.error} retry={() => locationsQuery.refetch()} />
                            {locationsQuery.isSuccess && (locations.length ? <MapPanel points={locations} /> : <p className="p-6">No geolocated events yet.</p>)}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="events" className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-semibold">
                                Event stream
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                One event per initial document load. SPA route changes and sessions are not tracked.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={searchTerm}
                                    onChange={(event) =>
                                        setSearchTerm(event.target.value)
                                    }
                                    placeholder="Search IP"
                                    className="pl-9"
                                />
                            </div>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="gap-2">
                                        Columns
                                        <ChevronDown className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>
                                        Toggle columns
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {columns.map((column) => (
                                        <DropdownMenuCheckboxItem
                                            key={column.key}
                                            checked={visibleColumns[column.key]}
                                            onCheckedChange={(checked) =>
                                                setVisibleColumns((prev) => ({
                                                    ...prev,
                                                    [column.key]:
                                                        Boolean(checked),
                                                }))
                                            }
                                        >
                                            {column.label}
                                        </DropdownMenuCheckboxItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <Button variant="outline" onClick={handleExport}>
                                <Download className="h-4 w-4" />
                                Export JSON
                            </Button>
                        </div>
                    </div>

                    <Card className="border-border/60">
                        <CardContent className="p-0">
                            <QueryStatus loading={eventsQuery.isPending} error={eventsQuery.error} retry={() => eventsQuery.refetch()} />
                            {eventsQuery.isSuccess && pagedEvents.length === 0 ? (
                                <Empty className="min-h-[240px] border-0">
                                    <EmptyHeader>
                                        <EmptyMedia variant="icon">
                                            <Moon className="h-5 w-5" />
                                        </EmptyMedia>
                                        <EmptyTitle>No events yet</EmptyTitle>
                                        <EmptyDescription>
                                            Tracking data will appear here as
                                            it arrives.
                                        </EmptyDescription>
                                    </EmptyHeader>
                                </Empty>
                            ) : eventsQuery.isSuccess ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            {columns.map((column) =>
                                                visibleColumns[column.key] ? (
                                                    <TableHead
                                                        key={column.key}
                                                    >
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-auto px-0 py-0 text-xs font-medium"
                                                            onClick={() =>
                                                                setSortConfig(
                                                                    (
                                                                        current,
                                                                    ) => {
                                                                        if (
                                                                            current.key ===
                                                                            column.key
                                                                        ) {
                                                                            return {
                                                                                key: column.key,
                                                                                direction:
                                                                                    current.direction ===
                                                                                    "asc"
                                                                                        ? "desc"
                                                                                        : "asc",
                                                                            };
                                                                        }
                                                                        return {
                                                                            key: column.key,
                                                                            direction:
                                                                                "asc",
                                                                        };
                                                                    },
                                                                )
                                                            }
                                                        >
                                                            <span className="flex items-center gap-1">
                                                                {column.label}
                                                                {sortConfig.key ===
                                                                column.key ? (
                                                                    sortConfig.direction ===
                                                                    "asc" ? (
                                                                        <ChevronUp className="h-3 w-3" />
                                                                    ) : (
                                                                        <ChevronDown className="h-3 w-3" />
                                                                    )
                                                                ) : (
                                                                    <ChevronDown className="h-3 w-3 opacity-40" />
                                                                )}
                                                            </span>
                                                        </Button>
                                                    </TableHead>
                                                ) : null,
                                            )}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {pagedEvents.map((event) => (
                                            <TableRow key={event.id}>
                                                {columns.map((column) =>
                                                    visibleColumns[column.key] ? (
                                                        <TableCell
                                                            key={`${event.id}-${column.key}`}
                                                            className={
                                                                column.key ===
                                                                "timestamp"
                                                                    ? "font-medium"
                                                                    : ""
                                                            }
                                                        >
                                                            {column.render(
                                                                event,
                                                            )}
                                                        </TableCell>
                                                    ) : null,
                                                )}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : null}
                        </CardContent>
                    </Card>

                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                        <span>
                            {totalEvents === 0
                                ? "No results"
                                : `Showing ${startIndex + 1}-${Math.min(
                                      startIndex + pageSize,
                                      totalEvents,
                                  )} of ${totalEvents}`}
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    setPage((prev) => Math.max(1, prev - 1))
                                }
                                disabled={currentPage === 1 || eventsQuery.isFetching}
                            >
                                <ChevronLeft className="h-4 w-4" />
                                Prev
                            </Button>
                            <span className="text-xs text-muted-foreground">
                                Page {currentPage} of {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    setPage((prev) =>
                                        Math.min(totalPages, prev + 1),
                                    )
                                }
                                disabled={currentPage === totalPages || eventsQuery.isFetching || eventsQuery.isPlaceholderData}
                            >
                                Next
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="settings" className="space-y-6">
                    <Card className="border-border/60">
                        <CardHeader>
                            <CardTitle className="text-base">
                                Embed script
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                                Paste this script tag into your site to start
                                collecting events.
                            </p>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-sm">
                                <code className="break-all">{embedCode}</code>
                            </div>
                            <Button variant="outline" onClick={handleCopy} disabled={!embedCode}>
                                <Copy className="h-4 w-4" />
                                {copied ? "Copied" : "Copy script"}
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="border-border/60">
                        <CardHeader>
                            <CardTitle className="text-base">
                                Allowed domains
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                                Add or remove hostnames that can send tracking
                                events.
                            </p>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <QueryStatus loading={domainsQuery.isPending} error={domainsQuery.error} retry={() => domainsQuery.refetch()} />
                            {domainError && <Alert role="alert"><AlertDescription>{domainError}</AlertDescription></Alert>}
                            {(addDomainMutation.isPending || updateDomainMutation.isPending || deleteDomainMutation.isPending) && <p role="status">Saving domains…</p>}
                            <form
                                className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    handleAddDomain();
                                }}
                            >
                                <div className="space-y-2">
                                    <label
                                        htmlFor="new-domain"
                                        className="text-sm font-medium"
                                    >
                                        Add domain
                                    </label>
                                    <Input
                                        id="new-domain"
                                        value={newDomain}
                                        onChange={(event) => {
                                            setNewDomain(event.target.value);
                                            if (newDomainError) {
                                                setNewDomainError(null);
                                            }
                                        }}
                                        placeholder="example.com"
                                        className={
                                            newDomainError
                                                ? "border-destructive focus-visible:ring-destructive mt-2"
                                                : "mt-2"
                                        }
                                    />
                                </div>
                                <Button type="submit" className="gap-2" disabled={addDomainMutation.isPending || domainsQuery.isPending || domainsQuery.isError}>
                                    <Plus className="h-4 w-4" />
                                    Add
                                </Button>
                                {newDomainError && (
                                    <p className="text-xs text-destructive md:col-span-2">
                                        {newDomainError}
                                    </p>
                                )}
                            </form>

                            <div className="space-y-3">
                                {domains.map((domain) => {
                                    const parsed = parseDomainValue(
                                        domain.value,
                                    );
                                    return (
                                        <div
                                            key={domain.id}
                                            className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-background/60 p-3"
                                        >
                                            <Input
                                                aria-label="Allowed domain"
                                                disabled={updateDomainMutation.isPending || deleteDomainMutation.isPending}
                                                value={domain.value}
                                                onChange={(event) =>
                                                    updateDomain(domain.id, {
                                                        value: event.target
                                                            .value,
                                                    })
                                                }
                                                onBlur={() => {
                                                    const normalized =
                                                        normalizeDomainValue(
                                                            domain.value,
                                                        );
                                                    const parsedValue =
                                                        parseDomainValue(
                                                            normalized,
                                                        );
                                                    if (normalized === domainsQuery.data?.find(item => item.id === domain.id)?.value) return;
                                                    if (!parsedValue.valid) {
                                                        return;
                                                    }
                                                    updateDomainMutation.mutate(
                                                        {
                                                            data: {
                                                                projectId,
                                                                id: domain.id,
                                                                value: normalized,
                                                            },
                                                        },
                                                    );
                                                }}
                                                className={`max-w-xs ${
                                                    parsed.valid
                                                        ? ""
                                                        : "border-destructive focus-visible:ring-destructive"
                                                }`}
                                            />
                                            <Badge variant="secondary">
                                                {parsed.valid
                                                    ? parsed.wildcard
                                                        ? "Wildcard"
                                                        : "Hostname"
                                                    : "Invalid"}
                                            </Badge>
                                            <Button
                                                disabled={updateDomainMutation.isPending || deleteDomainMutation.isPending}
                                                variant="ghost"
                                                size="sm"
                                                onClick={() =>
                                                    removeDomain(domain.id)
                                                }
                                            >
                                                <Trash2 className="h-4 w-4" />
                                                Remove
                                            </Button>
                                            {!parsed.valid && (
                                                <span className="text-xs text-destructive">
                                                    Use example.com or
                                                    *.example.com
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border/60">
                        <CardHeader>
                            <CardTitle className="text-base">
                                Data retention and deletion
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                                Choose how long to keep events.
                            </p>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="max-w-xs space-y-2">
                                <label
                                    htmlFor="retention-days"
                                    className="text-sm font-medium"
                                >
                                    Retention in days (1–365)
                                </label>
                                <Input
                                    id="retention-days"
                                    className="mt-2"
                                    disabled={overviewQuery.isPending || overviewQuery.isError || retentionMutation.isPending}
                                    type="number"
                                    min={1}
                                    max={365}
                                    value={retentionDays}
                                    onChange={event => setRetentionDays(Number(event.target.value))}
                                />
                            </div>
                            <div className="flex flex-wrap gap-3">
                                <Button
                                    variant="outline"
                                    disabled={retentionMutation.isPending || overviewQuery.isPending || overviewQuery.isError || !Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 365}
                                    onClick={() => retentionMutation.mutate({ data: { projectId, retentionDays } })}
                                >
                                    Save retention
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={() => setPurgeDialogOpen(true)}
                                >
                                    Delete all events
                                </Button>
                            </div>
                            {retentionMutation.isSuccess && (
                                <p role="status" className="text-sm text-muted-foreground">
                                    Retention saved. Expired events are hidden
                                    immediately and removed during scheduled cleanup.
                                </p>
                            )}
                            {retentionMutation.isError && (
                                <p role="alert" className="text-sm text-destructive">
                                    {retentionMutation.error.message}
                                </p>
                            )}
                            {purgeMutation.isError && (
                                <p role="alert" className="text-sm text-destructive">
                                    {purgeMutation.error.message}
                                </p>
                            )}
                        </CardContent>
                    </Card>
                    <Card className="border-border/60">
                        <CardHeader>
                            <CardTitle className="text-base">
                                Project actions
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                                Rename or permanently delete this project.
                            </p>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex flex-wrap gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => setRenameDialogOpen(true)}
                                >
                                    Rename project
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={() => setDeleteDialogOpen(true)}
                                >
                                    Delete project
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
            <Dialog
                open={renameDialogOpen}
                onOpenChange={(open) => {
                    setRenameDialogOpen(open);
                    if (open) {
                        setRenameValue(overviewQuery.data?.name ?? "");
                        setRenameError(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Rename project</DialogTitle>
                        <DialogDescription>
                            Update the display name for this project.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <label
                            className="text-sm font-medium"
                            htmlFor="rename-project"
                        >
                            Project name
                        </label>
                        <Input
                            id="rename-project"
                            value={renameValue}
                            onChange={(event) =>
                                setRenameValue(event.target.value)
                            }
                            placeholder="New project name"
                            className="mt-2"
                            autoFocus
                        />
                        {renameError && (
                            <Alert>
                                <AlertDescription>
                                    {renameError}
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            onClick={() => {
                                const trimmed = renameValue.trim();
                                if (!trimmed) {
                                    setRenameError("Project name is required.");
                                    return;
                                }
                                renameMutation.mutate(
                                    { data: { id: projectId, name: trimmed } },
                                    {
                                        onSuccess: () => {
                                            setRenameDialogOpen(false);
                                        },
                                    },
                                );
                            }}
                            disabled={renameMutation.isPending}
                        >
                            Save name
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog
                open={exportDialogOpen}
                onOpenChange={(open) => {
                    setExportDialogOpen(open);
                    if (!open) {
                        setExportError(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Export events</DialogTitle>
                        <DialogDescription>
                            Choose the time range to export as JSON.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="grid gap-2">
                            {exportRanges.map((range) => (
                                <Button
                                    key={range.value}
                                    type="button"
                                    variant={
                                        exportRange === range.value
                                            ? "default"
                                            : "outline"
                                    }
                                    className="justify-between"
                                    onClick={() =>
                                        setExportRange(range.value)
                                    }
                                >
                                    <span>{range.label}</span>
                                    <span className="text-xs text-muted-foreground">
                                        {range.description}
                                    </span>
                                </Button>
                            ))}
                        </div>
                        {exportError && (
                            <Alert>
                                <AlertDescription>
                                    {exportError}
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setExportDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => handleExportConfirm(exportRange)}
                        >
                            Export JSON
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <AlertDialog open={purgeDialogOpen} onOpenChange={setPurgeDialogOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete all events?</AlertDialogTitle><AlertDialogDescription>This permanently deletes this project's events and diagnostics. The project and allowed domains remain.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction disabled={purgeMutation.isPending} onClick={() => purgeMutation.mutate({ data: { projectId } })}>Delete events</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
            <AlertDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Delete this project?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the project and all of
                            its events.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            onClick={() =>
                                deleteMutation.mutate({
                                    data: { id: projectId },
                                })
                            }
                            disabled={deleteMutation.isPending}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
