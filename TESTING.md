# Testing n8n-nodes-nexgendata Locally

This guide describes how to wire this package into a local n8n instance for
manual testing before publishing.

## Prerequisites

- Node.js 18.10+ (n8n's minimum supported version)
- npm 9+ (or pnpm 9+)
- A working n8n install — either:
  - Global: `npm install -g n8n` (then `n8n` to start), or
  - Docker: `docker run -p 5678:5678 n8nio/n8n`
- An Apify Personal API token (see README → Credentials)

## 1. Build the package

From this directory:

```bash
npm install
npm run build
```

`npm run build` runs `tsc` (TypeScript compile) and `gulp build:icons`
(copies SVG icons next to the compiled .js files in `dist/`).

If the build succeeds you should see:

```
dist/
├── credentials/
│   └── NexGenDataApi.credentials.js
├── nodes/
│   ├── NexGenDataEmailFinder/
│   │   ├── NexGenDataEmailFinder.node.js
│   │   └── nexGenDataEmailFinder.svg
│   ├── NexGenDataEmailValidator/
│   │   ├── NexGenDataEmailValidator.node.js
│   │   └── nexGenDataEmailValidator.svg
│   ├── NexGenDataCompanyEnrichment/
│   │   ├── NexGenDataCompanyEnrichment.node.js
│   │   └── nexGenDataCompanyEnrichment.svg
│   ├── NexGenDataPageSpeedAnalyzer/
│   │   ├── NexGenDataPageSpeedAnalyzer.node.js
│   │   └── nexGenDataPageSpeedAnalyzer.svg
│   ├── NexGenDataTechStackDetector/
│   │   ├── NexGenDataTechStackDetector.node.js
│   │   └── nexGenDataTechStackDetector.svg
│   ├── NexGenDataGoogleMapsLeadScraper/
│   │   ├── NexGenDataGoogleMapsLeadScraper.node.js
│   │   └── nexGenDataGoogleMapsLeadScraper.svg
│   ├── NexGenDataLinkedInJobsScraper/
│   │   ├── NexGenDataLinkedInJobsScraper.node.js
│   │   └── nexGenDataLinkedInJobsScraper.svg
│   ├── NexGenDataB2BLeadsFinder/
│   │   ├── NexGenDataB2BLeadsFinder.node.js
│   │   └── nexGenDataB2BLeadsFinder.svg
│   ├── NexGenDataLeadListEnricher/
│   │   ├── NexGenDataLeadListEnricher.node.js
│   │   └── nexGenDataLeadListEnricher.svg
│   ├── NexGenDataContactInfoScraper/
│   │   ├── NexGenDataContactInfoScraper.node.js
│   │   └── nexGenDataContactInfoScraper.svg
│   ├── NexGenDataYelpBusinessScraper/
│   │   ├── NexGenDataYelpBusinessScraper.node.js
│   │   └── nexGenDataYelpBusinessScraper.svg
│   ├── NexGenDataGoogleSearchScraper/
│   │   ├── NexGenDataGoogleSearchScraper.node.js
│   │   └── nexGenDataGoogleSearchScraper.svg
│   ├── NexGenDataRedfinPropertyScraper/
│   │   ├── NexGenDataRedfinPropertyScraper.node.js
│   │   └── nexGenDataRedfinPropertyScraper.svg
│   └── NexGenDataWebsiteEmailExtractor/
│       ├── NexGenDataWebsiteEmailExtractor.node.js
│       └── nexGenDataWebsiteEmailExtractor.svg
└── utils/
    └── apifyClient.js
```

## 2. Link the package into n8n

### Option A: npm link (recommended for iterative development)

```bash
# Inside this package
npm link

# Inside your n8n custom-nodes directory
mkdir -p ~/.n8n/custom
cd ~/.n8n/custom
npm init -y          # only needed the first time
npm link n8n-nodes-nexgendata
```

Restart n8n. The NexGenData nodes should appear in the node picker.

### Option B: npm pack + install (closer to a real publish)

```bash
# Inside this package
npm pack
# → produces n8n-nodes-nexgendata-0.1.0.tgz

# In your n8n custom dir
cd ~/.n8n/custom
npm install /path/to/n8n-nodes-nexgendata-0.1.0.tgz
```

Restart n8n.

### Option C: Docker

Mount the built package into the container's custom-nodes folder:

```bash
docker run -it --rm \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  -v $(pwd)/dist:/home/node/.n8n/custom/node_modules/n8n-nodes-nexgendata/dist \
  -v $(pwd)/package.json:/home/node/.n8n/custom/node_modules/n8n-nodes-nexgendata/package.json \
  n8nio/n8n
```

## 3. Smoke test in n8n

1. Open `http://localhost:5678/`.
2. Create a new workflow.
3. Add **Credentials → NexGenData API** and paste your Apify token. Hit
   **Save** — n8n will run the credential test (`GET /users/me`). It
   should report **Connection tested successfully**.
4. Add each node in turn and run with sample data:

   | Node                                | Sample input                                                                                          |
   | ----------------------------------- | ----------------------------------------------------------------------------------------------------- |
   | NexGenData Email Finder             | Domains: `stripe.com`                                                                                 |
   | NexGenData Email Validator          | Mode: Single, Email: `steve@nexgendata.com`                                                           |
   | NexGenData Company Enrichment       | Companies: `Stripe`, all enrich toggles ON                                                            |
   | NexGenData Page Speed Analyzer      | URL: `https://www.example.com`, Strategy: mobile, Categories: `PERFORMANCE`                           |
   | NexGenData Tech Stack Detector      | URLs: `stripe.com`, `shopify.com`                                                                     |
   | NexGenData Google Maps Lead Scraper | Queries: `coffee shops in Brooklyn`, Google API Key set, Max Results: 5, Enrich Contacts: off         |
   | NexGenData LinkedIn Jobs Scraper    | Keywords: `python developer`, Location: `Remote`, Max Jobs: 10, Fetch Descriptions: off               |
   | NexGenData B2B Leads Finder         | Job Title: `Head of Marketing`, Industry: `SaaS`, Location: `Austin`, Max Results: 10                 |
   | NexGenData Lead List Enricher       | Domains: `stripe.com`, `shopify.com`, Max Contacts per Domain: 5                                      |
   | NexGenData Contact Info Scraper     | URLs: `stripe.com`, Crawl Contact Pages: on, Max Pages per Site: 3                                    |
   | NexGenData Yelp Business Scraper    | Query: `pizza`, Location: `San Francisco, CA`, Max Results: 5, Extract Emails: off                    |
   | NexGenData Google Search Scraper    | Queries: `best CRM for small business`, Country: US, Max Results: 5                                   |
   | NexGenData Redfin Property Scraper  | Search URL: `https://www.redfin.com/city/16163/WA/Seattle`, Output Mode: Market Tracker, Max: 25      |
   | NexGenData Website Email Extractor  | URLs: `stripe.com`, Max Pages per Site: 3, Extract Emails: on, Extract Phones: on                     |

   > **Yelp note** — Yelp aggressively blocks scrapers. The actor returns
   > placeholder records like `{ "_blocked": true, ... }` instead of
   > failing the run when challenged. Filter them out downstream with
   > `{{ !$json._blocked }}`. This is expected behavior, not a bug.

   Each node should return one or more items with structured JSON. Failures
   will surface as red NodeApiError boxes with the Apify response body.

## 4. Watch mode

For tight iteration:

```bash
npm run dev
```

This runs `tsc --watch`. Combined with `npm link` (Option A), n8n picks
up TS changes after each rebuild — restart n8n to reload the node
registry (n8n caches node definitions at boot).

> **Note:** icons are NOT copied by `npm run dev`. Re-run `npx gulp build:icons`
> after touching an SVG.

## 5. Publishing (Steve's step — DO NOT auto-run)

When tested:

```bash
npm login
npm run lint    # must pass — n8n-nodes-base plugin enforces strict conventions
npm run build
npm publish --access public
```

Then submit the package URL to the n8n community nodes registry if you
want it to appear in the in-app installer search.
