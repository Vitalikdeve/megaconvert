import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  transpilePackages: ["@messenger/shared", "@messenger/ui", "@messenger/crypto"],
  outputFileTracingRoot: path.join(currentDirectory, "../../"),
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "libsodium-wrappers$": path.join(
        currentDirectory,
        "../../node_modules/libsodium-wrappers/dist/modules/libsodium-wrappers.js"
      ),
      "libsodium$": path.join(
        currentDirectory,
        "../../node_modules/libsodium/dist/modules/libsodium.js"
      )
    };

    return config;
  }
};

export default nextConfig;
