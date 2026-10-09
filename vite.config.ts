import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const isGitHubPages = process.env["GITHUB_PAGES"] === "true";
const basePath = isGitHubPages ? "/aracoiaba-citizen-helper/" : "/";

const config = {
  base: basePath,
  nitro: isGitHubPages ? false : undefined,
  tanstackStart: {
    router: {
      basepath: basePath,
    },
    ...(isGitHubPages
      ? {
          spa: {
            enabled: true,
            prerender: {
              outputPath: "/index.html",
              crawlLinks: false,
            },
          },
        }
      : {
          server: {
            entry: "server",
          },
          prerender: {
            enabled: true,
            autoSubfolderIndex: true,
            autoStaticPathsDiscovery: false,
            crawlLinks: false,
            failOnError: true,
            routes: ["/"],
          },
        }),
  },
};

export default defineConfig(config as unknown as Parameters<typeof defineConfig>[0]);
