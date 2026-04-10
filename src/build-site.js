import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, copyFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIGESTS_DIR = join(__dirname, '..', 'digests')
const SITE_DIR = join(__dirname, '..', 'site')

function markdownToHTML(md) {
  return md
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^---$/gm, '<hr>')
    .replace(/\*\*\[([^\]]+)\]\(([^)]+)\)\*\*/g, '<strong><a href="$2" target="_blank">$1</a></strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')
    .replace(/\n\|(.+)\|\n\|[-| ]+\|\n((?:\|.*\|\n?)+)/g, (_, header, body) => {
      const ths = header.split('|').map(h => h.trim()).filter(Boolean)
        .map(h => `<th>${h}</th>`).join('')
      const rows = body.trim().split('\n').map(row => {
        const tds = row.split('|').map(c => c.trim()).filter(Boolean)
          .map(c => `<td>${c}</td>`).join('')
        return `<tr>${tds}</tr>`
      }).join('')
      return `<table><thead><tr>${ths}</tr></thead><tbody>${rows}</tbody></table>`
    })
    .replace(/<!-- spotify:embed:(\w+) -->/g, (_, id) =>
      `<div class="spotify-embed"><iframe src="https://open.spotify.com/embed/track/${id}?theme=0" width="100%" height="152" frameBorder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe></div>`
    )
    .replace(/<!-- spotify:track:(\w+) -->/g, (_, id) =>
      `<button class="spotify-play-btn" onclick="this.nextElementSibling.classList.toggle('show');this.textContent=this.nextElementSibling.classList.contains('show')?'Hide':'Play'" title="Play preview">Play</button><div class="spotify-mini-embed"><iframe src="https://open.spotify.com/embed/track/${id}?theme=0" width="100%" height="80" frameBorder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe></div>`
    )
    .replace(/^(?!<[hublot]|<hr|<table|<thead|<tbody|<tr|<div|<button)(.+)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '')
}

function buildDigestPage(filename, content) {
  const date = filename.replace('.md', '')
  const html = markdownToHTML(content)

  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Digest — ${date}</title>
  <link rel="stylesheet" href="style.css">
  <link rel="icon" href="data:image/svg+xml, %3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='0.9em' font-size='90'%3E%F0%9F%A5%AA%3C/text%3E%3C/svg%3E">
</head>
<body>
  <nav>
    <a href="index.html" class="logo">daily digest</a>
    <button class="theme-toggle" onclick="toggleTheme()" aria-label="Toggle theme">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
    </button>
  </nav>
  <main>
    <a href="index.html" class="back">&larr; All digests</a>
    <article>${html}</article>
  </main>
  <script>
    function toggleTheme() {
      const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
      document.documentElement.dataset.theme = t
      localStorage.setItem('theme', t)
    }
    const saved = localStorage.getItem('theme')
    if (saved) document.documentElement.dataset.theme = saved
  </script>
</body>
</html>`
}

function buildIndexPage(files) {
  const entries = files
    .sort((a, b) => b.localeCompare(a))
    .map((f) => {
      const date = f.replace('.md', '')
      const content = readFileSync(join(DIGESTS_DIR, f), 'utf-8')
      const quoteLine = content.match(/^> "(.+?)"/)
      const preview = quoteLine ? quoteLine[1].slice(0, 80) + '...' : ''
      return `<a href="${date}.html" class="digest-card">
        <span class="digest-date">${date}</span>
        <span class="digest-preview">${preview}</span>
      </a>`
    })
    .join('\n')

  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Digest</title>
  <meta name="description" content="Automated daily digest — weather, top Hacker News stories, and a daily quote.">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <nav>
    <span class="logo">daily digest</span>
    <button class="theme-toggle" onclick="toggleTheme()" aria-label="Toggle theme">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
    </button>
  </nav>
  <main>
    <h1>Daily Digest</h1>
    <p class="subtitle">An automated snapshot of my day. Generated by a <a href="https://github.com/audreyau/daily-digest">GitHub Actions pipeline</a> every morning.</p>
    <div class="digest-list">
      ${entries || '<p class="empty">No digests yet. Check back tomorrow!</p>'}
    </div>
  </main>
  <script>
    function toggleTheme() {
      const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
      document.documentElement.dataset.theme = t
      localStorage.setItem('theme', t)
    }
    const saved = localStorage.getItem('theme')
    if (saved) document.documentElement.dataset.theme = saved
  </script>
</body>
</html>`
}

function main() {
  if (!existsSync(SITE_DIR)) mkdirSync(SITE_DIR, { recursive: true })

  const files = existsSync(DIGESTS_DIR)
    ? readdirSync(DIGESTS_DIR).filter((f) => f.endsWith('.md'))
    : []

  for (const f of files) {
    const content = readFileSync(join(DIGESTS_DIR, f), 'utf-8')
    const html = buildDigestPage(f, content)
    writeFileSync(join(SITE_DIR, f.replace('.md', '.html')), html, 'utf-8')
  }

  writeFileSync(join(SITE_DIR, 'index.html'), buildIndexPage(files), 'utf-8')
  writeFileSync(join(SITE_DIR, 'style.css'), readFileSync(join(__dirname, 'style.css'), 'utf-8'))

  console.log(`Built ${files.length} digest pages + index → site/`)
}

main()
