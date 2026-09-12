import type { NextConfig } from "next";
import { resolve } from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  webpack(config, { webpack }) {
    config.plugins.push(new webpack.NormalModuleReplacementPlugin(
      /^@\/lib\/runtime$/,
      resolve("deployment/runtime-node.ts"),
    ));
    config.plugins.push(new webpack.NormalModuleReplacementPlugin(
      /^@\/lib\/image-optimizer$/,
      resolve("deployment/image-optimizer.mjs"),
    ));
    return config;
  },
};
export default nextConfig;
