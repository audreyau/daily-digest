/**
 * One-time setup to get a Spotify refresh token.
 *
 * Steps:
 *   1. Go to https://developer.spotify.com/dashboard and create an app
 *   2. Set redirect URI to https://example.com/callback
 *   3. Copy your Client ID and Client Secret
 *   4. Run: SPOTIFY_CLIENT_ID=0259788fbed94b139daf6d4111ec341a SPOTIFY_CLIENT_SECRET=37e585e487294070987f93e8b91a6f87 node src/spotify-auth.js
 *   5. Follow the prompts
 */

import { createInterface } from 'readline'

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET
const REDIRECT_URI = 'https://example.com/callback'
const SCOPES = 'user-read-recently-played user-top-read user-read-currently-playing'

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET environment variables.')
  process.exit(1)
}

const rl = createInterface({ input: process.stdin, output: process.stdout })
const ask = (q) => new Promise((resolve) => rl.question(q, resolve))

const authUrl = `https://accounts.spotify.com/authorize?${new URLSearchParams({
  response_type: 'code',
  client_id: CLIENT_ID,
  scope: SCOPES,
  redirect_uri: REDIRECT_URI,
})}`

console.log('\n=== Spotify Auth Setup ===\n')
console.log('1. Open this URL in your browser:\n')
console.log(authUrl)
console.log('\n2. Log in and click "Agree"')
console.log('3. You\'ll be redirected to a page that won\'t load (that\'s expected!)')
console.log('4. Copy the FULL URL from your browser\'s address bar')
console.log('   It will look like: https://example.com/callback?code=AQD...\n')

const redirectUrl = await ask('Paste the full redirect URL here: ')

const url = new URL(redirectUrl)
const code = url.searchParams.get('code')

if (!code) {
  console.error('No code found in that URL. Make sure you copied the full URL.')
  process.exit(1)
}

const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`,
  },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
  }),
})

const data = await tokenRes.json()

if (data.refresh_token) {
  console.log('\nSuccess! Here is your refresh token:\n')
  console.log(data.refresh_token)
  console.log('\nSave this as a GitHub Actions secret named SPOTIFY_REFRESH_TOKEN')
} else {
  console.error('\nError from Spotify:', data)
}

rl.close()