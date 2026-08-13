/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/youth",
        destination:
          "https://portal.icomd.org/nx/portal/neonevents/events?path=%2Fportal%2Fevents%2F54606",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
