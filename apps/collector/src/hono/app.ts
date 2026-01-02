import { Hono } from "hono";
import { cors } from "hono/cors";
import { eq } from "drizzle-orm";
import { initDatabase } from "@repo/data-ops/database/setup";
import {
    events,
    projectDomains,
    projects,
} from "@repo/data-ops/drizzle/schema";
import { CollectorEventRequestSchema } from "@repo/data-ops/zod-schema/collector";

export const app = new Hono<{ Bindings: Env }>();

app.use(
    "/events",
    cors({
        origin: "*",
        allowMethods: ["POST", "OPTIONS"],
        allowHeaders: ["content-type"],
    }),
);

app.get("/main.js", (c) => {
    const script = `
(() => {
  try {
    const current = document.currentScript;
    if (!current) return;
    const projectId = current.getAttribute("data-project-id");
    if (!projectId) return;
    const payload = {
      projectId,
      timestamp: Date.now(),
    };
    const endpoint = new URL("/events", current.src).toString();
    fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {
    // Swallow errors to avoid breaking host pages.
  }
})();
`.trim();

    return c.text(script, 200, {
        "content-type": "application/javascript; charset=utf-8",
        "cache-control": "no-cache",
    });
});

type IpApiResponse = {
    status: "success" | "fail";
    message?: string;
    country?: string;
    regionName?: string;
    city?: string;
    zip?: string;
    isp?: string;
    as?: string;
    lat?: number;
    lon?: number;
    proxy?: boolean;
    mobile?: boolean;
    hosting?: boolean;
};

const IP_API_FIELDS =
    "status,message,country,regionName,city,zip,isp,as,lat,lon,proxy,mobile,hosting";

const IPV4_REGEX =
    /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const IPV6_REGEX =
    /^((?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:(?:(?::[0-9a-fA-F]{1,4}){1,6})|:(?:(?::[0-9a-fA-F]{1,4}){1,7}|:))$/;

function isValidIpAddress(value: string) {
    return IPV4_REGEX.test(value) || IPV6_REGEX.test(value);
}

function getClientIp(request: Request) {
    const cfIpv4 = request.headers.get("CF-Connecting-IPV4");
    if (cfIpv4 && IPV4_REGEX.test(cfIpv4)) {
        return cfIpv4;
    }
    const cfIpv6 = request.headers.get("CF-Connecting-IPV6");
    if (cfIpv6 && IPV6_REGEX.test(cfIpv6)) {
        return cfIpv6;
    }

    const header =
        request.headers.get("CF-Connecting-IP") ??
        request.headers.get("X-Forwarded-For");

    if (!header) {
        return;
    }

    const first = header.split(",")[0]?.trim() ?? "";
    if (first.startsWith("::ffff:")) {
        const mapped = first.replace("::ffff:", "");
        if (IPV4_REGEX.test(mapped)) {
            return mapped;
        }
    }

    return isValidIpAddress(first) ? first : undefined;
}

function getRequestHostname(request: Request) {
    const origin = request.headers.get("Origin");
    if (origin) {
        try {
            return new URL(origin).hostname;
        } catch {
            return;
        }
    }

    const referer = request.headers.get("Referer");
    if (referer) {
        try {
            return new URL(referer).hostname;
        } catch {
            return;
        }
    }

    try {
        return new URL(request.url).hostname;
    } catch {
        return;
    }
}

function matchesDomain(hostname: string, domain: string, wildcard: boolean) {
    const normalizedHost = hostname.trim().toLowerCase();
    const normalizedDomain = domain.trim().toLowerCase().replace(/^\*\./, "");

    if (!normalizedHost || !normalizedDomain) {
        return false;
    }

    if (wildcard) {
        return (
            normalizedHost === normalizedDomain ||
            normalizedHost.endsWith(`.${normalizedDomain}`)
        );
    }

    return normalizedHost === normalizedDomain;
}

function getEventType(ipInfo: IpApiResponse) {
    if (ipInfo.proxy) {
        return "proxy";
    }
    if (ipInfo.mobile) {
        return "mobile";
    }
    return "hosting";
}

app.post("/events", async (c) => {
    let payload: unknown;
    try {
        payload = await c.req.json();
    } catch {
        return c.json({ error: "Invalid JSON payload" }, 400);
    }

    const parsedPayload = CollectorEventRequestSchema.safeParse(payload);
    if (!parsedPayload.success) {
        const issues = parsedPayload.error.issues;
        const hasProjectIdIssue = issues.some(
            (issue) => issue.path[0] === "projectId",
        );
        const hasTimestampIssue = issues.some(
            (issue) => issue.path[0] === "timestamp",
        );

        if (hasProjectIdIssue) {
            return c.json({ error: "projectId is required" }, 400);
        }
        if (hasTimestampIssue) {
            return c.json({ error: "timestamp must be a number" }, 400);
        }

        return c.json({ error: "Invalid payload" }, 400);
    }

    const { projectId, timestamp: timestampMs } = parsedPayload.data;

    const ipAddress = getClientIp(c.req.raw);
    if (!ipAddress) {
        return c.json({ error: "IP address required" }, 400);
    }

    const db = initDatabase(c.env.DB);
    const project = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, projectId))
        .get();

    if (!project) {
        return c.json({ error: "Project not found" }, 404);
    }

    const requestHostname = getRequestHostname(c.req.raw);
    if (!requestHostname) {
        return c.json({ error: "Unable to determine request hostname" }, 400);
    }

    const domains = await db
        .select({
            hostname: projectDomains.hostname,
            wildcard: projectDomains.wildcard,
        })
        .from(projectDomains)
        .where(eq(projectDomains.projectId, projectId));

    const isAllowedDomain = domains.some((domain) =>
        matchesDomain(requestHostname, domain.hostname, domain.wildcard),
    );

    if (!isAllowedDomain) {
        return c.json({ error: "Hostname not allowed for project" }, 403);
    }

    const ipApiUrl = `http://ip-api.com/json/${encodeURIComponent(
        ipAddress,
    )}?fields=${IP_API_FIELDS}`;
    let ipInfo: IpApiResponse | null = null;
    try {
        const ipResponse = await fetch(ipApiUrl);
        if (ipResponse.ok) {
            const parsed = (await ipResponse.json()) as IpApiResponse;
            ipInfo = parsed.status === "success" ? parsed : null;
        }
    } catch {
        ipInfo = null;
    }

    const eventId = crypto.randomUUID();
    const eventRecord = {
        id: eventId,
        projectId,
        timestamp: new Date(timestampMs),
        ipAddress,
        type: ipInfo ? getEventType(ipInfo) : "hosting",
        lat: ipInfo?.lat ?? null,
        lon: ipInfo?.lon ?? null,
        country: ipInfo?.country ?? null,
        region: ipInfo?.regionName ?? null,
        city: ipInfo?.city ?? null,
        zip: ipInfo?.zip ?? null,
        isp: ipInfo?.isp ?? null,
        asName: ipInfo?.as ?? null,
    };

    await db.insert(events).values(eventRecord);

    return c.json({ id: eventId }, 201);
});
