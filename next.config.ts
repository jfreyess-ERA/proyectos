import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/viabilidad",
        destination: "/viabilidad/index.html",
        permanent: false,
      },
      {
        source: "/viabilidad/",
        destination: "/viabilidad/index.html",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
