import Link from 'next/link'

export default function Home() {
    return (
        <ul>
            <li>
                <Link href="/item/1">Item 1</Link>
            </li>
        </ul>
    )
}
