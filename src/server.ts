import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerFetch = (
  request: Request,
  env: unknown,
  ctx: unknown,
) => Promise<Response> | Response;

type ServerEntryModule = {
  default?: unknown;
  fetch?: ServerFetch;
};

let serverFetchPromise: Promise<ServerFetch> | undefined;

async function getServerFetch(): Promise<ServerFetch> {
  if (!serverFetchPromise) {
    serverFetchPromise = import("@tanstack/react-start/server-entry").then((module) => {
      const candidates: unknown[] = [module.default, module];

      for (const candidate of candidates) {
        if (typeof candidate === "function") {
          return candidate as ServerFetch;
        }

        if (
          candidate &&
          typeof candidate === "object" &&
          "fetch" in candidate &&
          typeof (candidate as ServerEntryModule).fetch === "function"
        ) {
          return (candidate as ServerEntryModule).fetch!.bind(candidate) as ServerFetch;
        }
      }

      throw new TypeError(
        "TanStack Start server entry does not expose a callable fetch handler.",
      );
    });
  }

  return serverFetchPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const fetchServer = await getServerFetch();
      const response = await fetchServer(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
