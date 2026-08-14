'use client'

export interface Row {
    id: number
    marker: string
    text: string
}

/**
 * A Client Component, so its props are serialized into the Flight payload. That is where the
 * duplication shows: server-only markup would appear once in the HTML either way.
 */
export const Rows = ({ rows }: { rows: Row[] }) => (
    <ul>
        {rows.map((row) => (
            <li key={row.id}>{row.marker}</li>
        ))}
    </ul>
)
