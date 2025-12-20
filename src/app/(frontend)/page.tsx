import { redirect } from 'next/navigation'

// Redirect home page to admin since this CMS doesn't serve a frontend
export default function HomePage() {
    redirect('/admin')
}
