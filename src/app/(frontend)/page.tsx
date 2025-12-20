import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// Redirect home page to admin since this CMS doesn't serve a frontend
export default function HomePage() {
    redirect('/admin')
}
