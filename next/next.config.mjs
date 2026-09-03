/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: false,
  experimental: {
    // Keep the control build on the same SSRT Next package without enabling templates.
    ssrTemplates: process.env.TEMPLATES === '1',
  },
};

export default nextConfig;
