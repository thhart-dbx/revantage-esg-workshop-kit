import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @databricks/sql loads native modules (lz4-napi, its kernel); Turbopack can't bundle them.
  serverExternalPackages: ["@databricks/sql"],
  cacheComponents: true,
  partialPrefetching: true,
  // create-next-app >= 16.4 wires Tailwind through this loader (there is no postcss.config.mjs).
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
