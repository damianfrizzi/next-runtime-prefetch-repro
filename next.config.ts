import type { NextConfig } from 'next'

/**
 * Both flags are read from the environment so one build tree can be measured in
 * every configuration. A real app would write the literals.
 */
const nextConfig: NextConfig = {
    cacheComponents: true,
    partialPrefetching: process.env.PARTIAL_PREFETCHING !== '0',
}

export default nextConfig
