import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AccountDialog } from "@/components/auth/account-dialog";
import { Telescope } from "lucide-react";
import { authClient } from "@/lib/auth-client";

interface HeaderProps {
  className?: string;
}

export function Header({ className }: HeaderProps) {
  const { data: session } = authClient.useSession();
  
  const user = session?.user;
  const fallbackText = user?.name
    ? user.name.charAt(0).toUpperCase()
    : user?.email?.charAt(0).toUpperCase() || "U";

  return (
    <header
      className={cn(
        "flex h-14 items-center justify-between border-b border-border/60 bg-background/95 px-6 backdrop-blur",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--brand-emerald)] text-white">
          <Telescope className="h-5 w-5" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-tight">
            IP Track
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <AccountDialog>
          <button
            type="button"
            className="flex items-center gap-2 rounded-full px-2 py-1 text-sm font-medium text-foreground transition hover:bg-muted/40"
          >
            <Avatar className="h-8 w-8">
              <AvatarImage
                src={user?.image || undefined}
                alt={user?.name || "User"}
              />
              <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                {fallbackText}
              </AvatarFallback>
            </Avatar>
            <span className="hidden sm:inline">{user?.name || "User"}</span>
          </button>
        </AccountDialog>
      </div>
    </header>
  );
}
