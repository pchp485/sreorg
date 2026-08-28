/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Workspace packages ship TypeScript source, so Next compiles them itself.
  transpilePackages: ["@sreorg/core", "@sreorg/tax-india", "@sreorg/growth", "@sreorg/ui"],
};
export default nextConfig;
