/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Handle audio worklet files
    config.module.rules.push({
      test: /\.worklet\.js$/,
      type: "asset/resource",
      generator: {
        filename: "static/[name][ext]",
      },
    });

    // Handle WASM files for opus-codec
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    return config;
  },
  // Ensure public files are accessible
  async headers() {
    return [
      {
        source: "/worklet.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
