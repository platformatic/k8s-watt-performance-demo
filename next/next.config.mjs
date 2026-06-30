/** @type {import('next').NextConfig} */
// Clean same-version A/B: experimental.useNodeStreams is toggled via the
// NEXT_USE_NODE_STREAMS env (baked at build time by the Dockerfile). This
// requires a Next version that still supports the flag, i.e. <= 16.3.0-canary.45
// (from canary.46 the flag was removed and node streams are permanently on).
const useNodeStreams = process.env.NEXT_USE_NODE_STREAMS === '1';

const nextConfig = {
  compress: false,
  experimental: {
    ...(useNodeStreams ? { useNodeStreams: true } : {}),
  },
};

console.log(`[next.config] useNodeStreams=${useNodeStreams}`);

export default nextConfig;
