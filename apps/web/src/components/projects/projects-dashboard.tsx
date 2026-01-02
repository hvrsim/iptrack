import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
    Plus,
    FolderOpen,
    Trash2,
    ArrowUpRight,
    Sparkles,
    ChevronDown,
    SlidersHorizontal,
    Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    listProjects,
    createProject,
    deleteProject,
} from "@/core/functions/projects";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
});

function formatCreatedAt(value: Date | number | null) {
    if (!value) {
        return "Just now";
    }
    const date = value instanceof Date ? value : new Date(value);
    return dateFormatter.format(date);
}

function toTimestamp(value: Date | number | null) {
    if (!value) {
        return 0;
    }
    return value instanceof Date ? value.getTime() : value;
}

export function ProjectsDashboard() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [projectName, setProjectName] = React.useState("");
    const [formError, setFormError] = React.useState<string | null>(null);
    const [searchTerm, setSearchTerm] = React.useState("");
    const [sortBy, setSortBy] = React.useState<"newest" | "oldest" | "az">(
        "newest",
    );
    const [deleteTarget, setDeleteTarget] = React.useState<{
        id: string;
        name: string;
    } | null>(null);

    const projectsQuery = useQuery({
        queryKey: ["projects"],
        queryFn: () => listProjects(),
    });

    const createMutation = useMutation({
        mutationFn: createProject,
        onSuccess: (project) => {
            queryClient.invalidateQueries({ queryKey: ["projects"] });
            setIsDialogOpen(false);
            setProjectName("");
            setFormError(null);
            navigate({
                to: "/dashboard/projects/$projectId",
                params: { projectId: project.id },
            });
        },
        onError: (error) => {
            setFormError(
                error instanceof Error ? error.message : "Create failed.",
            );
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteProject,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["projects"] });
        },
    });

    const handleCreate = (event: React.FormEvent) => {
        event.preventDefault();
        const trimmedName = projectName.trim();
        if (!trimmedName) {
            setFormError("Project name is required.");
            return;
        }

        createMutation.mutate({ data: { name: trimmedName } });
    };

    const handleDelete = (projectId: string, projectNameValue: string) => {
        setDeleteTarget({ id: projectId, name: projectNameValue });
    };

    const projects = projectsQuery.data ?? [];
    const filteredProjects = React.useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        const filtered = term
            ? projects.filter((project) =>
                  project.name.toLowerCase().includes(term),
              )
            : projects;

        return [...filtered].sort((a, b) => {
            if (sortBy === "az") {
                return a.name.localeCompare(b.name);
            }
            const aTime = toTimestamp(a.createdAt ?? null);
            const bTime = toTimestamp(b.createdAt ?? null);
            return sortBy === "oldest" ? aTime - bTime : bTime - aTime;
        });
    }, [projects, searchTerm, sortBy]);

    return (
        <section className="relative">
            <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background via-background to-muted/30" />
            <div className="flex flex-col gap-6">
                <header className="flex flex-col gap-4">
                    <div className="space-y-2">
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Dashboard
                        </h1>
                        <p className="max-w-2xl text-sm text-muted-foreground">
                            Manage your analytics projects and gain valuable
                            insights in seconds.
                        </p>
                    </div>
                </header>

                <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background/70 p-4 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="relative w-full sm:w-72">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={searchTerm}
                                onChange={(event) =>
                                    setSearchTerm(event.target.value)
                                }
                                placeholder="Search projects"
                                className="h-9 rounded-lg border-border/60 bg-muted/30 pl-9"
                            />
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-9 justify-between gap-2"
                                >
                                    <SlidersHorizontal className="h-4 w-4" />
                                    {sortBy === "newest"
                                        ? "Newest"
                                        : sortBy === "oldest"
                                          ? "Oldest"
                                          : "A-Z"}
                                    <ChevronDown className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                                <DropdownMenuItem
                                    onClick={() => setSortBy("newest")}
                                >
                                    Newest
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => setSortBy("oldest")}
                                >
                                    Oldest
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => setSortBy("az")}
                                >
                                    A-Z
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <Button
                        onClick={() => setIsDialogOpen(true)}
                        className="gap-2"
                    >
                        <Plus className="h-4 w-4" />
                        Create project
                    </Button>
                </div>

                {projectsQuery.isLoading ? (
                    <Card className="border-border/60 bg-background/70">
                        <CardHeader>
                            <CardTitle className="text-base">
                                Loading projects
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {Array.from({ length: 4 }).map((_, index) => (
                                <div
                                    key={`skeleton-row-${index}`}
                                    className="h-12 w-full rounded-lg bg-muted/40"
                                />
                            ))}
                        </CardContent>
                    </Card>
                ) : projectsQuery.isError ? (
                    <Card className="border-border/60 bg-background/70">
                        <CardHeader>
                            <CardTitle className="text-base">
                                Unable to load projects
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                {projectsQuery.error instanceof Error
                                    ? projectsQuery.error.message
                                    : "Something went wrong. Please refresh."}
                            </p>
                        </CardContent>
                    </Card>
                ) : filteredProjects.length === 0 ? (
                    <Empty className="min-h-[260px] border border-border/60 bg-background/60">
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <FolderOpen className="h-5 w-5" />
                            </EmptyMedia>
                            <EmptyTitle>No projects yet</EmptyTitle>
                            <EmptyDescription>
                                Create a project to start collecting user data.
                            </EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                            <Button
                                onClick={() => setIsDialogOpen(true)}
                                className="gap-2"
                            >
                                <Plus className="h-4 w-4" />
                                Create project
                            </Button>
                        </EmptyContent>
                    </Empty>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {filteredProjects.map((project) => (
                            <Card
                                key={project.id}
                                className="group border-border/60 bg-background/80 shadow-sm transition hover:-translate-y-1 hover:border-border hover:shadow-md"
                            >
                                <CardHeader className="space-y-3">
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <span>
                                            {formatCreatedAt(
                                                project.createdAt ?? null,
                                            )}
                                        </span>
                                        <FolderOpen className="h-4 w-4" />
                                    </div>
                                    <CardTitle className="text-lg">
                                        {project.name}
                                    </CardTitle>
                                    <p className="text-xs text-muted-foreground">
                                        ID: {project.id.slice(0, 8)}
                                    </p>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-3">
                                    <Button
                                        asChild
                                        className="w-full justify-between"
                                    >
                                        <Link
                                            to="/dashboard/projects/$projectId"
                                            params={{
                                                projectId: project.id,
                                            }}
                                        >
                                            Open project
                                            <ArrowUpRight className="h-4 w-4" />
                                        </Link>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="w-full justify-between"
                                        onClick={() =>
                                            handleDelete(
                                                project.id,
                                                project.name,
                                            )
                                        }
                                        disabled={deleteMutation.isPending}
                                    >
                                        Delete project
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create a new project</DialogTitle>
                        <DialogDescription>
                            Give your tracking workspace a memorable name.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div className="space-y-3">
                            <label
                                htmlFor="project-name"
                                className="text-sm font-medium"
                            >
                                Project name
                            </label>
                            <Input
                                id="project-name"
                                className="mt-2"
                                value={projectName}
                                onChange={(event) =>
                                    setProjectName(event.target.value)
                                }
                                placeholder="e.g. Personal Blog Site"
                                autoFocus
                            />
                        </div>
                        {formError && (
                            <Alert>
                                <AlertDescription>{formError}</AlertDescription>
                            </Alert>
                        )}
                        <DialogFooter>
                            <Button
                                type="submit"
                                className="gap-2"
                                disabled={createMutation.isPending}
                            >
                                <Plus className="h-4 w-4" />
                                Create &amp; open
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
            <AlertDialog
                open={Boolean(deleteTarget)}
                onOpenChange={(open) => {
                    if (!open) {
                        setDeleteTarget(null);
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete project?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete{" "}
                            <span className="font-medium text-foreground">
                                {deleteTarget?.name}
                            </span>
                            . This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            onClick={() => {
                                if (!deleteTarget) {
                                    return;
                                }
                                deleteMutation.mutate({
                                    data: { id: deleteTarget.id },
                                });
                                setDeleteTarget(null);
                            }}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </section>
    );
}
