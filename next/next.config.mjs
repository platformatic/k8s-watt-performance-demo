/** @type {import('next').NextConfig} */
// Version comparison sweep: behavior is determined entirely by the Next.js
// version baked into each image (16.2.9 = web streams; 16.3.0-canary.72 = node
// streams, permanently on). No experimental toggle is involved.
const nextConfig = {
  compress: false,
};

export default nextConfig;
