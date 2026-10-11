import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const isGitHubPages = process.env["GITHUB_PAGES"] === "true";
const routerBasePath = isGitHubPages ? "/aracoiaba-citizen-helper/" : "/";
// Use a relative Vite asset base for GitHub Pages project sites so lazy-loaded
// route chunks resolve beneath the repository path instead of the domain root.
const assetBasePath = isGitHubPages ? "./" : "/";

const config = {
  base: assetBasePath,
  nitro: isGitHubPages ? false : undefined,
  tanstackStart: {
    router: {
      basepath: routerBasePath,
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
