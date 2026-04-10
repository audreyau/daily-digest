import { writeFileSync, mkdirSync, existsSync, write } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIGESTS_DIR = join(__dirname, '..', 'digests');
const WEATHER_CITY = process.env.WEATHER_CITY || 'Beaverton';
const WEATHER_COUNTRY = process.env.WEATHER_COUNTRY || 'US';
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || ''; 
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';
const SPOTIFY_REFRESH_TOKEN = process.env.SPOTIFY_REFRESH_TOKEN || '';

const today = new Date();
const dateStr = today.toISOString().slice(0, 10);
const prettyDate = today.toLocaleDateString('en-US', { 
    weekday: 'long',
    month: 'long', 
    day: 'numeric', 
    year: 'numeric'
});


async function fetchJSON(url, headers = {}) {
    try {
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error(`HTTP ${res.status} - ${res.statusText}`)
        const text = await res.text();
        if (!text) return null;
        return JSON.parse(text);
    } catch (err) {
        console.warn(`Failed to fetch ${url}: ${err.message}`);
        return null;
    }
}

// Weather API
async function getWeather() {
    const data = await fetchJSON(
        `https://wttr.in/${WEATHER_CITY},${WEATHER_COUNTRY}?format=j1`
    )
    if (!data) return null;

    const current = data.current_condition[0];
    if (!current) return null;

    return {
        temp_f: current.temp_F,
        temp_c: current.temp_C,
        description: current.weatherDesc?.[0]?.value || 'Unknown',
        humidity: current.humidity,
        feelsLike_f: current.FeelsLikeF,
        windSpeed: current.windspeedMiles,
        city: WEATHER_CITY
    };
}

// Hacker News API
async function getHackerNews() {
    const ids = await fetchJSON(
        'https://hacker-news.firebaseio.com/v0/topstories.json'
    )
    if (!ids) return null;

    const stories = await Promise.all(
        ids.slice(0, 5).map((id) =>
            fetchJSON(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
        )
    )

    return stories.filter(Boolean).map((s) => ({
        title: s.title,
        url: s.url || `https://news.ycombinator.com/item?id=${s.id}`,
        score: s.score,
        author: s.by,
        comments: s.descendants || 0,
    }));
}

// Quote API
async function getQuote() {
    const data = await fetchJSON('https://zenquotes.io/api/random');
    if (!data || !Array.isArray(data) || !data[0]) return null;
    return { text: data[0].q, author: data[0].a };
}

// Spotify
async function getSpotifyAccessToken() {
    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REFRESH_TOKEN) {
        console.warn('Spotify credentials not fully set. Skipping Spotify data.',
            !SPOTIFY_CLIENT_ID ? 'Missing SPOTIFY_CLIENT_ID.' : '',
            !SPOTIFY_CLIENT_SECRET ? 'Missing SPOTIFY_CLIENT_SECRET.' : '',
            !SPOTIFY_REFRESH_TOKEN ? 'Missing SPOTIFY_REFRESH_TOKEN.' : ''
        );
        return null;
    }
    
    try {
        const res = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: SPOTIFY_REFRESH_TOKEN,
            }),
        });

        const data = await res.json();
        if (!data.access_token) {
            console.warn('Spotify: token refresh failed - ', data.error || data)
            return null
        }
        console.log('Spotify access token refreshed successfully.');
        return data.access_token;

    } catch (err) {
        console.warn(`Spotify: failed to refresh token - ${err.message}`);
        return null;
    }
}

async function getSpotifyData() {
    const token = await getSpotifyAccessToken();
    if (!token) return null;

    const headers = { Authorization: `Bearer ${token}` };

    console.log('Spotify: fetching recently played, top tracks, and now playing data...');

    const [recentlyPlayed, topTracks, nowPlaying] = await Promise.all([
        fetchJSON('https://api.spotify.com/v1/me/player/recently-played?limit=5', headers),
        fetchJSON('https://api.spotify.com/v1/me/top/tracks?time_range=short_term&limit=5', headers),
        fetchJSON('https://api.spotify.com/v1/me/player/currently-playing', headers),
    ]);

    const recent = recentlyPlayed?.items?.map((item) => ({
        name: item.track.name,
        artist: item.track.artists.map((a) => a.name).join(', '),
        album: item.track.album.name,
        url: item.track.external_urls.spotify,
        id: item.track.id,
        albumArt: item.track.album.images?.[1]?.url || item.track.album.images?.[0]?.url || null,
        playedAt: item.played_at,
    })) || [];

    const top = topTracks?.items?.map((t) => ({
        name: t.name,
        artist: t.artists.map((a) => a.name).join(', '),
        url: t.external_urls.spotify,
        id: t.id,
        albumArt: t.album.images?.[1]?.url || t.album.images?.[0]?.url || null,
    })) || [];

    const current = nowPlaying && nowPlaying.item ? {
        name: nowPlaying.item.name,
        artists: nowPlaying.item.artists.map((a) => a.name),        
        url: nowPlaying.item.external_urls.spotify,
        id: nowPlaying.item.id,
        isPlaying: nowPlaying.is_playing,
    } : null;

    return { recent, top, current };
}

// Build markdown
function buildMarkdown({ weather, hackerNews, quote, spotify }) {
    const lines = []

    lines.push(`# Daily Digest - ${prettyDate}\n`);
    lines.push('');

    // Quote
    if (quote) {
        lines.push(`> "${quote.text}" - ${quote.author}\n`);
        lines.push('');
    }

    lines.push('---');
    lines.push('');

    // Weather
    if (weather) {
        lines.push(`## Weather in ${weather.city}`);
        lines.push('');
        lines.push(`| | |`);
        lines.push(`|---|---|`);
        lines.push(`| **Condition** | ${weather.description} |`);
        lines.push(`| **Temperature** | ${weather.temp_f}°F / ${weather.temp_c}°C (feels like ${weather.feelsLike_f}°F) |`);
        lines.push(`| **Humidity** | ${weather.humidity}% |`);
        lines.push(`| **Wind** | ${weather.windSpeed} mph |`);
        lines.push('');
    }

    // Hacker News
    if (hackerNews && hackerNews.length > 0) {
        lines.push('## Hacker News Top 5');
        lines.push('');
        for (const [i, s] of hackerNews.entries()) {
            lines.push(
                `${i + 1}. **[${s.title}](${s.url})** - ${s.score} points by ${s.author} (${s.comments} comments)`
            )
        }
        lines.push('');
    }

    // Spotify
    if (spotify) {
        lines.push('## What Audrey\'s Listening To');
        lines.push('');

        if (spotify.current) {
            const status = spotify.current.isPlaying ? 'Now Playing' : 'Last Played';
            lines.push(`**${status}:** [${spotify.current.name}](${spotify.current.url}) by ${spotify.current.artists.join(', ')}`);
            lines.push('');
            lines.push(`<!-- spotify:embed:${spotify.current.id} -->`);
            lines.push('');
        }

        if (spotify.recent.length > 0) {
            lines.push(`### Recently Played`);
            lines.push('');
            for (const t of spotify.recent) {
                lines.push(`- [${t.name}](${t.url}) - ${t.artist} <!-- spotify:track:${t.id} -->`)
            }
            lines.push('');
        }

        if (spotify.top.length > 0) {
            lines.push(`### Top Tracks This Month`);
            lines.push('');
            for (const [i, t] of spotify.top.entries()) {
                lines.push(`${i + 1}. [${t.name}](${t.url}) - ${t.artist} <!-- spotify:track:${t.id} -->`);
            }
            lines.push('');
        };
    }

    lines.push('---');
    lines.push('');
    lines.push(`*Generated automatically at ${today.toISOString()} by [daily-digest](https://github.com/audreyau/daily-digest)*`);

    return lines.join('\n');
}

async function main() {
    console.log(`Generating digest for ${dateStr}...`);

    const [weather, hackerNews, quote, spotify] = await Promise.all([
        getWeather(),
        getHackerNews(),
        getQuote(),
        getSpotifyData()
    ]);

    const markdown = buildMarkdown({ weather, hackerNews, quote, spotify });

    if (!existsSync(DIGESTS_DIR)) mkdirSync(DIGESTS_DIR, { recursive: true })
    
    const filePath = join(DIGESTS_DIR, `${dateStr}.md`);
    writeFileSync(filePath, markdown, 'utf-8');
    console.log(`Digest written to ${filePath}`);
}

main().catch((err) => {
    console.error('Failed to generate digest:', err);
    process.exit(1);
});
