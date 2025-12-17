import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    const googleClientId = process.env.GOOGLE_CLIENT_ID

    if (!googleClientId) {
        return NextResponse.json(
            {
                error: 'Google OAuth not configured',
                message: 'Please set GOOGLE_CLIENT_ID environment variable in Vercel'
            },
            { status: 500 }
        )
    }

    // Use stable production URL - MUST match what's configured in Google Cloud Console
    const serverUrl = process.env.PAYLOAD_PUBLIC_SERVER_URL || 'https://payload-website-starter-smoky-sigma.vercel.app'
    const redirectUri = `${serverUrl}/api/users/oauth/google/callback`
    const scope = 'openid email profile'

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authUrl.searchParams.set('client_id', googleClientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', scope)
    authUrl.searchParams.set('access_type', 'offline')
    authUrl.searchParams.set('prompt', 'consent')

    return NextResponse.redirect(authUrl.toString())
}
