'use client'

export interface Row {
    id: number
    marker: string
    text: string
}

/**
 * A Client Component. Next.js serializes its props into the Flight payload. The second copy of the
 * shell appears there.
 */
export const Rows = ({ rows }: { rows: Row[] }) => (
    <ul>
        {rows.map((row) => (
            <li key={row.id}>{row.marker}</li>
        ))}
    </ul>
)
