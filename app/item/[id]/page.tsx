import { ReactNode, Suspense } from 'react'
import { cacheLife } from 'next/cache'
import { Row, Rows } from './rows'

/**
 * A cached shell with one request-time child, given as a prop. The `use cache` reference calls this
 * the pass-through pattern. The child reads `searchParams`, so the route builds as Partial
 * Prerender.
 *
 * `partialPrefetching.md` says that an explicit `prefetch` export overrides the application default
 * for the route. The export below does not change the response. See the README.
 */
export const prefetch = 'force-disabled'

/** Each row holds this token. The count of the token gives the number of copies of the shell. */
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

/** This component reads `searchParams`. Next.js therefore cannot prerender it. */
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
