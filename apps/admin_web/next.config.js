/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  webpack(config) {
    const svgLoader = {
      loader: '@svgr/webpack',
      options: {
        typescript: true,
        dimensions: false,
        svgoConfig: {
          plugins: [
            {
              name: 'preset-default',
              params: {
                overrides: {
                  removeViewBox: false,
                },
              },
            },
          ],
        },
      },
    };

    config.module.rules.unshift({
      test: /\.svg$/i,
      enforce: 'pre',
      use: [svgLoader],
    });

    return config;
  },
};

module.exports = nextConfig;
