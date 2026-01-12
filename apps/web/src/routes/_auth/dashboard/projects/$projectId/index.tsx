import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createPortal } from "react-dom";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
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
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "@/components/ui/hover-card";
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
} from "@/core/functions/projects";
import { seo } from "@/utils/seo";

import "leaflet/dist/leaflet.css";

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
    type: "proxy" | "mobile" | "hosting";
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

type LocationPoint = {
    id: string;
    lat: number;
    lng: number;
    ipAddress: string;
    visitedAt: Date;
    mobile: boolean;
};

function MapMarkersOverlay({ points }: { points: LocationPoint[] }) {
    const map = useMap();
    const [version, setVersion] = React.useState(0);
    const containerRef = React.useRef<HTMLDivElement | null>(null);

    React.useEffect(() => {
        const container = document.createElement("div");
        container.className = "absolute inset-0 z-[500] overflow-hidden";
        map.getContainer().appendChild(container);
        containerRef.current = container;

        const bump = () => setVersion((value) => value + 1);
        map.on("move", bump);
        map.on("zoom", bump);
        map.on("resize", bump);

        return () => {
            map.off("move", bump);
            map.off("zoom", bump);
            map.off("resize", bump);
            container.remove();
            containerRef.current = null;
        };
    }, [map]);

    if (!containerRef.current) {
        return null;
    }

    return createPortal(
        <div className="absolute inset-0">
            {points.map((point) => {
                const position = map.latLngToContainerPoint([
                    point.lat,
                    point.lng,
                ]);
                if (
                    !Number.isFinite(position.x) ||
                    !Number.isFinite(position.y)
                ) {
                    return null;
                }
                return (
                    <div
                        key={`${point.id}-${version}`}
                        className="pointer-events-auto absolute"
                        style={{
                            left: position.x,
                            top: position.y,
                            transform: "translate(-50%, -50%)",
                        }}
                    >
                        <HoverCard openDelay={80} closeDelay={80}>
                            <HoverCardTrigger asChild>
                                <button
                                    type="button"
                                    className="h-2.5 w-2.5 rounded-full border border-background bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.35)]"
                                    aria-label={`Event ${point.ipAddress}`}
                                />
                            </HoverCardTrigger>
                            <HoverCardContent className="z-[1000] w-[22rem] max-w-[95vw]">
                                <div className="space-y-2 text-sm">
                                    <div className="font-medium text-foreground">
                                        {formatEventDate(point.visitedAt)}
                                    </div>
                                    <div className="text-muted-foreground">
                                        IP:{" "}
                                        <span className="block break-all text-foreground">
                                            {point.ipAddress}
                                        </span>
                                    </div>
                                    <div className="text-muted-foreground">
                                        Mobile:{" "}
                                        <span className="text-foreground">
                                            {point.mobile ? "Yes" : "No"}
                                        </span>
                                    </div>
                                </div>
                            </HoverCardContent>
                        </HoverCard>
                    </div>
                );
            })}
        </div>,
        containerRef.current,
    );
}

function MapPanel({ points }: { points: LocationPoint[] }) {
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
                Loading map...
            </div>
        );
    }

    return (
        <div className="relative h-[320px] w-full">
            <MapContainer
                center={[20, 0]}
                zoom={2}
                minZoom={2}
                maxZoom={6}
                scrollWheelZoom
                className="h-full w-full rounded-b-lg"
            >
                <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapMarkersOverlay points={points} />
            </MapContainer>
        </div>
    );
}

function RouteComponent() {
    const { projectId } = Route.useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [copied, setCopied] = React.useState(false);
    const [searchTerm, setSearchTerm] = React.useState("");
    const [sortConfig, setSortConfig] = React.useState<{
        key: keyof EventRow;
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
    const [exporting, setExporting] = React.useState(false);
    const [newDomainError, setNewDomainError] = React.useState<string | null>(
        null,
    );
    const [domains, setDomains] = React.useState<DomainRow[]>([]);
    const [newDomain, setNewDomain] = React.useState("");

    const pageSize = 6;

    const overviewQuery = useQuery({
        queryKey: ["project-overview", projectId],
        queryFn: () => getProjectOverview({ data: { projectId } }),
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
        refetchIntervalInBackground: true,
    });

    const locationsQuery = useQuery({
        queryKey: ["project-locations", projectId],
        queryFn: () => listProjectLocations({ data: { projectId, limit: 30 } }),
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
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["project-domains", projectId],
            });
        },
    });

    const updateDomainMutation = useMutation({
        mutationFn: updateProjectDomain,
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["project-domains", projectId],
            });
        },
    });

    const deleteDomainMutation = useMutation({
        mutationFn: deleteProjectDomain,
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["project-domains", projectId],
            });
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
                    <Badge variant="outline">{event.type}</Badge>
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
        if (page > totalPages) {
            setPage(totalPages);
        }
    }, [page, totalPages]);

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

    const fetchEventsForExport = async () => {
        const exportPageSize = 100;
        let pageToFetch = 1;
        let total = 0;
        const allEvents: EventRow[] = [];

        do {
            const response = await listProjectEvents({
                data: {
                    projectId,
                    page: pageToFetch,
                    pageSize: exportPageSize,
                    search: searchTerm || undefined,
                    sortBy: "timestamp",
                    sortDir: "desc",
                },
            });
            total = response.total ?? 0;
            const mapped = response.items.map((event) => ({
                ...event,
                timestamp:
                    event.timestamp instanceof Date
                        ? event.timestamp
                        : new Date(event.timestamp),
            }));
            allEvents.push(...mapped);
            pageToFetch += 1;
        } while (allEvents.length < total);

        return allEvents;
    };

    const handleExportConfirm = async (
        range: "day" | "week" | "month" | "all",
    ) => {
        setExporting(true);
        setExportError(null);
        try {
            const allEvents = await fetchEventsForExport();
            const now = Date.now();
            const cutoff = {
                day: now - 24 * 60 * 60 * 1000,
                week: now - 7 * 24 * 60 * 60 * 1000,
                month: now - 30 * 24 * 60 * 60 * 1000,
                all: null,
            }[range];
            const filteredEvents =
                cutoff === null
                    ? allEvents
                    : allEvents.filter(
                          (event) => event.timestamp.getTime() >= cutoff,
                      );

            const enabledColumns = columns
                .filter((column) => visibleColumns[column.key])
                .map((column) => column.key);

            const exportRows = filteredEvents.map((event, index) => {
                const row: Record<string, unknown> = { id: index + 1 };
                enabledColumns.forEach((key) => {
                    row[key] =
                        key === "timestamp"
                            ? event.timestamp.toISOString()
                            : event[key];
                });
                return row;
            });

            const rangeSuffix = range;
            const blob = new Blob([JSON.stringify(exportRows, null, 2)], {
                type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = `${projectId}-${rangeSuffix}.json`;
            anchor.click();
            URL.revokeObjectURL(url);
            setExportDialogOpen(false);
        } catch (error) {
            setExportError(
                error instanceof Error
                    ? error.message
                    : "Unable to export events right now.",
            );
        } finally {
            setExporting(false);
        }
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
        addDomainMutation.mutate({
            data: { projectId, value: normalized },
        });
        setNewDomain("");
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
            label: "Mobile traffic",
            value: overviewQuery.data?.mobileEvents ?? 0,
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
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-2xl font-semibold tracking-tight">
                        {projectName}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Analyze traffic and manage project resources.
                    </p>
                </div>
                <Button variant="outline" onClick={() => window.history.back()}>
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
                    <div className="grid gap-4 md:grid-cols-3">
                        {stats.map((stat) => (
                            <Card key={stat.label} className="border-border/60">
                                <CardHeader className="space-y-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">
                                        {stat.label}
                                    </CardTitle>
                                    <div className="flex items-center justify-between">
                                        <span className="text-2xl font-semibold">
                                            {numberFormatter.format(stat.value)}
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
                                    Live view of incoming traffic by region.
                                </p>
                            </div>
                            <Badge variant="outline" className="gap-1">
                                <Globe2 className="h-3.5 w-3.5" />
                                OpenStreetMap
                            </Badge>
                        </CardHeader>
                        <CardContent className="p-0">
                            <MapPanel points={locations} />
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
                                Raw tracking events captured for this project.
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
                            {pagedEvents.length === 0 ? (
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
                            ) : (
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
                            )}
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
                                disabled={currentPage === 1}
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
                                disabled={currentPage === totalPages}
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
                            <Button variant="outline" onClick={handleCopy}>
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
                                <Button type="submit" className="gap-2">
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
                            disabled={exporting}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => handleExportConfirm(exportRange)}
                            disabled={exporting}
                        >
                            {exporting ? "Exporting..." : "Export JSON"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
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
