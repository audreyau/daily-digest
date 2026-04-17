# Daily Digest

**Wondering how my Git history is so consistent?** 👀  
It’s automation!

Daily Digest is an automated dashboard that runs every day, pulls in fresh data from multiple APIs, generates a clean markdown summary, and deploys it to a static site, all without manual intervention.

Live at: https://audreyau.github.io/daily-digest/

## What It Does

Each day, a scheduled workflow:
- Fetches data from various sources (e.g. tech news, Spotify, etc.)
- Processes and formats it into a readable markdown digest
- Commits the updated content back to the repo
- Deploys the latest version to a static site

The result: a continuously updating “daily snapshot” of interesting content and a very active commit history!

## How It Works

The project is structured around a simple pipeline:

- **Data Fetching**  
  Scripts call external APIs to gather daily content.

- **Processing & Formatting**  
  The data is cleaned and transformed into a consistent markdown format.

- **Automation (GitHub Actions)**  
  A scheduled workflow runs daily to:
  - execute scripts  
  - generate the digest  
  - commit & push updates  

- **Deployment**  
  The site is automatically rebuilt and deployed as a static page.

## Project Structure
```
.github/workflows
├── daily-digest.yml      # Automation pipeline (runs daily)  
digests/                  # Source daily markdown files
site/                     # Output static website  
src/                           
├── build-site.js         # Generates the static site (markdown → HTML pages + index)
├── fetch-site.js         # Fetches external data and generates daily markdown digests
├── style.css             # Global styles and CSS variables
```

## Purpose

I wanted a low-effort way to stay updated on things I care about while also experimenting with automation, APIs, and CI/CD pipelines. It turned into a fun way to build something useful *and* keep my GitHub contributions graph looking very alive!
