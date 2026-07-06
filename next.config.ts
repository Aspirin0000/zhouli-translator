import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  webpack: (config, { isServer, dev }) => {
    if (dev && !isServer) {
      const originalEntry = config.entry;
      config.entry = async () => {
        const entries = await (typeof originalEntry === "function"
          ? originalEntry()
          : originalEntry);
        if (entries["main.js"]) {
          entries["main.js"] = entries["main.js"].filter(
            (e: string) =>
              !e.includes("webpack-hot-middleware") &&
              !e.includes("_next/webpack-hmr"),
          );
        }
        return entries;
      };
    }
    return config;
  },
};

export default nextConfig;
