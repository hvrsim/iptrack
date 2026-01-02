export function Footer() {
    return (
        <footer className="border-t bg-background">
            <div className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
                <div className="flex flex-col items-center justify-between gap-4 text-center md:flex-row md:text-left">
                    <div>
                        <p className="text-sm font-semibold text-foreground">
                            IP Track
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Advanced analytics with geospatial intelligence.
                        </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        &copy; {new Date().getFullYear()} hvrsim. All rights
                        reserved.
                    </p>
                </div>
            </div>
        </footer>
    );
}
