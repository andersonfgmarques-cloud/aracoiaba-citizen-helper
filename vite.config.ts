import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const isGitHubPages = process.env.GITHUB_PAGES === "true";
const basePath = isGitHubPages ? "/aracoiaba-citizen-helper/" : "/";

export default defineConfig({
  base: basePath,
  tanstackStart: {
    router: {
      basepath: basePath,
    },
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
  },
});
