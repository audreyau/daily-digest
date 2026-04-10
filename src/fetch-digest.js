import { writeFileSync, mkdirSync, existsSync, write } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIGESTS_DIR = join(__dirname, '..', 'digests');
const WEATHER_CITY = process.env.WEATHER_CITY || 'Beaverton';
const WEATHER_COUNTRY = process.env.WEATHER_COUNTRY || 'US';

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
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status} for ${url}`);
        }
        return await res.json();
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

// Build markdown
function buildMarkdwon({ weather, hackerNews, quote}) {
    const lines = []

    lines.push(`# Daily Digest - ${prettyDate}\n`);
    lines.push('')

    // Quote
    if (quote) {
        lines.push(`> "${quote.text}" - ${quote.author}\n`);
        lines.push('')
    }

    lines.push('---');
    lines.push('')

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

    lines.push('---');
    lines.push('');
    lines.push(`*Generated automatically at ${today.toISOString()} by [daily-digest](https://github.com/audreyau/daily-digest)*`);

    return lines.join('\n');
}

async function main() {
    console.log(`Generating digest for ${dateStr}...`);

    const [weather, hackerNews, quote] = await Promise.all([
        getWeather(),
        getHackerNews(),
        getQuote()
    ]);

    const markdown = buildMarkdwon({ weather, hackerNews, quote });

    if (!existsSync(DIGESTS_DIR)) mkdirSync(DIGESTS_DIR, { recursive: true })
    
    const filePath = join(DIGESTS_DIR, `${dateStr}.md`);
    writeFileSync(filePath, markdown, 'utf-8');
    console.log(`Digest written to ${filePath}`);
}

main().catch((err) => {
    console.error('Failed to generate digest:', err);
    process.exit(1);
});
