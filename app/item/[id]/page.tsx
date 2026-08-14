import { ReactNode, Suspense } from 'react'
import { cacheLife } from 'next/cache'
import { Row, Rows } from './rows'

/**
 * Minimal reproduction of two behaviours around the runtime prefetch.
 *
 * Shape: a cached shell (`use cache`, `max`) with one request-time hole handed in as a prop. This is
 * the documented pass-through pattern, and it makes the route Partial Prerender.
 *
 * `prefetch = 'force-disabled'` is set below. Per `partialPrefetching.md`, "a segment that exports an
 * explicit `prefetch` value overrides the app-level default for that route". It does not.
 */
export const prefetch = 'force-disabled'

/** One countable token per row: `REPRO_MARKER` occurrences = copies of the shell in the response. */
const MARKER = 'REPRO_MARKER'

const getRows = async (): Promise<Row[]> => {
    'use cache'
    cacheLife('max')

    return Array.from({ length: 200 }, (_, id) => ({ id, marker: MARKER, text: 'x'.repeat(40) }))
}

const CachedShell = async ({ children }: { children: ReactNode }) => {
    'use cache'
    cacheLife('max')

    return (
        <>
            <Rows rows={await getRows()} />
            {children}
        </>
    )
}

/** Reads `searchParams`, so it cannot be prerendered. This is what makes the route dynamic. */
const Hole = async ({ searchParams }: Pick<PageProps<'/item/[id]'>, 'searchParams'>) => {
    const { q } = await searchParams

    return <p>q={typeof q === 'string' ? q : 'none'}</p>
}

const Page = ({ searchParams }: PageProps<'/item/[id]'>) => (
    <CachedShell>
        <Suspense fallback={<p>loading</p>}>
            <Hole searchParams={searchParams} />
        </Suspense>
    </CachedShell>
)

export const generateStaticParams = async () => [{ id: '1' }]

export default Page
