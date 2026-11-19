import createNextIntlPlugin from 'next-intl/plugin'

// next-intl: uses default i18n/request.ts (project root) when called with no args
const withNextIntl = createNextIntlPlugin()

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep proforma TTF fonts in the serverless bundle
  outputFileTracingIncludes: {
    '/api/**/*': ['./assets/fonts/**/*'],
  },
  // Optimizacije za production
  swcMinify: true,
  // Environment varijable koje trebaju biti dostupne u build procesu
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  // Ignoriraj Supabase Edge Functions (koriste Deno, ne Node.js)
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || []
      config.externals.push({
        'https://deno.land/std@0.168.0/http/server.ts': 'commonjs https://deno.land/std@0.168.0/http/server.ts',
      })
      // Resolve winston from node_modules at runtime instead of bundling (avoids missing vendor-chunks/winston.js)
      config.externals.push('winston')
    } else {
      // Exclude winston from client bundle
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
      }
    }
    return config
  },
  // Ignoriraj Supabase functions folder u build procesu
  pageExtensions: ['ts', 'tsx', 'js', 'jsx'],
}

export default withNextIntl(nextConfig)

