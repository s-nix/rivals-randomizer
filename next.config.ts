import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  output: "export",
  // Set basePath for GitHub Pages (repo name). Update if your repo name differs.
  basePath: isProd ? "/rivals-randomizer" : "",
  assetPrefix: isProd ? "/rivals-randomizer/" : "",
};

export default nextConfig;
