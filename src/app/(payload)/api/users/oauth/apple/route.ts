import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    const appleClientId = process.env.APPLE_CLIENT_ID

    if (!appleClientId) {
        return NextResponse.json(
            {
                error: 'Apple Sign-In not configured',
                message: 'Please set APPLE_CLIENT_ID environment variable in Vercel'
            },
            { status: 500 }
        )
    }

    const serverUrl = process.env.PAYLOAD_PUBLIC_SERVER_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'
    const redirectUri = `${serverUrl}/api/users/oauth/apple/callback`
    const scope = 'name email'

    const authUrl = new URL('https://appleid.apple.com/auth/authorize')
    authUrl.searchParams.set('client_id', appleClientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_type', 'code id_token')
    authUrl.searchParams.set('response_mode', 'form_post')
    authUrl.searchParams.set('scope', scope)

    return NextResponse.redirect(authUrl.toString())
}
