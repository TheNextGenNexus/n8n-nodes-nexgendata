# n8n-nodes-nexgendata

This is an [n8n](https://n8n.io/) community node package that wraps the
[NexGenData](https://apify.com/nexgendata) fleet of [Apify](https://apify.com/) actors as
first-class n8n nodes. Install once, get all the nodes — drop them into a
workflow and run web-scale lead generation and data enrichment without
writing HTTP boilerplate.

[Installation](#installation)
[Credentials](#credentials)
[Nodes](#nodes)
[Usage](#usage)
[Pricing](#pricing)
[Support](#support)

## Installation

Install via the n8n Community Nodes UI:

1. Open your n8n instance.
2. Go to **Settings → Community Nodes**.
3. Click **Install**.
4. Enter `n8n-nodes-nexgendata` and click **Install**.

Or install manually inside your n8n custom-nodes directory:

```bash
cd ~/.n8n/custom
npm install n8n-nodes-nexgendata
```

Restart n8n. The NexGenData nodes will appear in the node picker.

## Credentials

All NexGenData nodes share a single credential type — **NexGenData API** —
which wraps your Apify Personal API token.

1. Create or sign in to your [Apify account](https://console.apify.com/sign-up?fpr=2ayu9b).
2. Open [console.apify.com/account/integrations](https://console.apify.com/account/integrations).
3. Copy your **Personal API token**.
4. In n8n: **Credentials → New → NexGenData API** and paste the token.

> **Why Apify?** NexGenData actors run on the Apify platform. The token
> authorises n8n to invoke actors on your behalf. Actor compute and storage
> are billed directly to your Apify account at the rates shown on each
> actor's page — n8n-nodes-nexgendata does not add any markup or
> intermediary layer.

## Nodes

### NexGenData Email Finder
> Apify actor: [`nexgendata/company-email-finder`](https://apify.com/nexgendata/company-email-finder?fpr=2ayu9b) (`oU37pA5Kj63UeUUFl`)

Find email addresses for one or more company domains. Combines:

- Common-pattern generation (`info@`, `contact@`, `sales@`, ...)
- Live scraping of contact/about/imprint pages
- DNS MX-record validation

**Inputs**
- `Domains` (string list, required) — `apple.com`, `stripe.com`, `https://shopify.com`, ...

**Output** — one item per discovered email, with the source domain,
discovery method, and MX validation block.

### NexGenData Email Validator
> Apify actor: [`nexgendata/email-validator`](https://apify.com/nexgendata/email-validator?fpr=2ayu9b) (`Sp6MNdZNfA4qgQeS9`)

Validate one or many email addresses. Checks syntax, MX records, common
disposable-domain lists, and basic deliverability heuristics.

**Inputs**
- `Mode` — `single` (one email per workflow item) or `bulk` (many emails per run).
- `Email` / `Emails` — the address(es) to validate.

**Output** — one item per validated address with validity flags and a
human-readable reason.

### NexGenData Email Verification
> Apify actor: [`nexgendata/email-verification-tool`](https://apify.com/nexgendata/email-verification-tool?fpr=2ayu9b) (`DTgFaAOv0V6JgWdLK`)

Verify deliverability of one or many email addresses — syntax, MX-record
lookup, SMTP RCPT probe, catch-all detection, disposable/temp-mail flag, and
role-account flag. A pay-per-use alternative to ZeroBounce / NeverBounce /
Kickbox, and the final **verify** step of a find → enrich → verify pipeline.

**Inputs**
- `Mode` — `single` (one email per workflow item) or `bulk` (many per run).
- `Email` / `Emails` — the address(es) to verify.

**Output** — one item per address with `status` (`valid`/`invalid`/`risky`/
`unknown`), `reason`, MX records, and disposable/role/catch-all flags.

### NexGenData Company Enrichment
> Apify actor: [`nexgendata/company-enrichment`](https://apify.com/nexgendata/company-enrichment?fpr=2ayu9b) (`0EC4liiWbpeRAV7qq`)

Enrich a company name or domain with website, emails, social profiles,
description, industry, and employee-count estimates. Each enrichment pass
is toggleable so you pay only for what you need.

**Inputs**
- `Companies` (string list, required) — `Stripe`, `apple.com`, `Acme Corp`, ...
- `Enrich Emails` (boolean)
- `Enrich Social Profiles` (boolean)
- `Enrich Description` (boolean)

**Output** — one item per enriched company with all requested fields.

### NexGenData Page Speed Analyzer
> Apify actor: [`nexgendata/page-speed-analyzer`](https://apify.com/nexgendata/page-speed-analyzer?fpr=2ayu9b) (`dkywu9gtcLuG7Q1s4`)

Run Google Lighthouse / PageSpeed Insights audits at scale — performance
scores, Core Web Vitals (LCP, CLS, INP, TBT, FCP), SEO, accessibility, and
best-practices ranking on any URL. Drop-in alternative to the rate-limited
public PageSpeed Insights API.

Each invocation analyses a single URL — wire it after any list-producing
node to audit a batch (one item per URL).

**Inputs**
- `URL` (string, required) — `https://stripe.com/pricing`
- `Strategy` — `mobile` or `desktop` hardware profile
- `Categories` (comma-separated) — `PERFORMANCE`, `ACCESSIBILITY`,
  `BEST_PRACTICES`, `SEO`, `PWA`. Defaults to `PERFORMANCE`.
- *Optional* `Google PageSpeed API Key` — passing your own key avoids the
  shared anonymous quota (free tier: 25k queries/day).

**Output** — one item per audit containing Lighthouse scores, Core Web
Vital metrics, and the ranked optimization-opportunity list.

### NexGenData Tech Stack Detector
> Apify actor: [`nexgendata/wappalyzer-replacement`](https://apify.com/nexgendata/wappalyzer-replacement?fpr=2ayu9b) (`50jWiLblao5BU7e5c`)

Detect the technology stack of any website — CMS, analytics, JavaScript
frameworks, payment processors, CDNs, and 6000+ more — using OSS
Wappalyzer fingerprint rules over HTTP analysis (headers + HTML + script
tags). Replaces the paywalled Wappalyzer API.

**Inputs**
- `URLs` (string list, required) — `https://stripe.com`, `shopify.com`, ...
  (scheme auto-added if missing)
- `Category Filter` (string list, optional) — restrict to specific
  categories (`CMS`, `Analytics`, `CDN`, `Ecommerce`, `JavaScript Frameworks`, ...)
- `Include Confidence Scores` (boolean) — 0–100 score per detection
- `Extract Version Numbers` (boolean) — parse `react@18.2.0`-style version strings

**Output** — one item per URL with the detected technologies, their
categories, confidence scores, and versions.

### NexGenData Google Maps Lead Scraper
> Apify actor: [`nexgendata/google-maps-scraper`](https://apify.com/nexgendata/google-maps-scraper?fpr=2ayu9b) (`yaVwNMJVMMJ3kk3ue`)

Extract business leads from Google Maps for any query and location —
names, phones, websites, ratings, reviews, opening hours, coordinates —
optionally enriched with scraped emails and social profiles from each
business website.

Because large queries with full enrichment can run for minutes, this node
uses the async-poll pattern: it starts the actor, polls until it
terminates, then returns the dataset.

**Inputs**
- `Search Queries` (string list, required) — `plumbers in Chicago`,
  `dentists Austin TX`, `Italian restaurants Manhattan`
- `Google API Key` (string, required) — Google Cloud key with Places API
  (New) enabled. Free $200/month credit covers ~6,000 searches.
- `Output Mode` — `Lead Tracker` (with scoring + market insights) or
  `Raw Data` (flat records for CRM import)
- `Max Results per Query` — 1–100
- `Enrich Contact Data` (boolean) — scrape emails + socials from each
  business website (slower, much higher lead value)
- *Optional* `Location Context` — applied to all queries
- *Optional* `Max Wait (Seconds)` and `Poll Interval (Seconds)` for tuning

**Output** — one item per business (or summary report when in
Lead-Tracker mode).

### NexGenData LinkedIn Jobs Scraper
> Apify actor: [`nexgendata/linkedin-jobs-scraper`](https://apify.com/nexgendata/linkedin-jobs-scraper?fpr=2ayu9b) (`64s5SdVsr1eb5xyit`)

Scrape public LinkedIn job postings for a keyword + location pair. Designed
for recruiter and sales-intel use cases — a hiring signal is a strong
proxy for outbound timing.

**Inputs**
- `Keywords` (string, required) — `python developer`, `data scientist`
- `Location` — `New York`, `Remote`, `United States` (empty = all)
- `Max Jobs` — cap (0 for all)
- `Job Type` — Any, Full-Time, Part-Time, Contract, Internship
- `Fetch Full Descriptions` (boolean) — slower but much more complete

**Output** — one item per job posting.

### NexGenData B2B Leads Finder
> Apify actor: [`nexgendata/b2b-leads-finder`](https://apify.com/nexgendata/b2b-leads-finder?fpr=2ayu9b) (`JBWyoiaG3eR7tqbaF`)

Apollo-style prospecting: find people by job title, company, industry,
and location, with email candidates. Either supply a free-form
`Search Query` that overrides everything, or compose a structured search
from the individual filter fields.

**Inputs**
- `Search Query` (optional free-form, overrides the filters below)
- `Job Title`, `Company`, `Industry`, `Location`
- `Max Results` — 1–500

**Output** — one item per discovered lead.

### NexGenData Lead List Enricher
> Apify actor: [`nexgendata/lead-list-enricher`](https://apify.com/nexgendata/lead-list-enricher?fpr=2ayu9b) (`KYd910fyOnKVzNq0a`)

Bulk-enrich a list of domains with emails, phone numbers, and social
profiles per domain. Uses the async-poll pattern (start run, poll,
fetch dataset) to handle large batches outside the 5-minute sync cap.

**Inputs**
- `Domains` (string list, required) — one enriched record per domain
- `Max Contacts per Domain` — cap (default 5)
- `Crawl Contact Pages` (boolean) — also visit /contact, /about, /team

**Output** — one enriched record per input domain.

### NexGenData Contact Info Scraper
> Apify actor: [`nexgendata/contact-info-scraper`](https://apify.com/nexgendata/contact-info-scraper?fpr=2ayu9b) (`4nDHYI1ez25zdhmwZ`)

Crawl a list of websites and extract emails + phone numbers, optionally
visiting /contact, /about, and /team pages for richer results. Async
pattern (start run → poll → fetch dataset).

**Inputs**
- `URLs` (string list, required) — bare hostnames accepted
- `Crawl Contact Pages` (boolean)
- `Max Pages per Site` (default 5)
- `Request Timeout (Seconds)` (default 20)

**Output** — one item per URL with the discovered emails and phones.

### NexGenData Yelp Business Scraper
> Apify actor: [`nexgendata/yelp-business-scraper`](https://apify.com/nexgendata/yelp-business-scraper?fpr=2ayu9b) (`v2ozARuYK12cev8J8`)

Scrape Yelp business listings for any query × location pair — names,
ratings, websites, and (optionally) emails scraped from each business's
website. Async pattern.

> **Anti-bot note** — Yelp aggressively rate-limits and challenge-pages
> scrapers. When the actor is challenged it returns a graceful placeholder
> record `{ "_blocked": true, "url": "...", "reason": "..." }` instead of
> failing the run. The node decorates each placeholder with a `Suggestion`
> field that explains retry timing (typically 15–30 minutes; shift to
> off-peak hours if persistent). Filter the placeholders out downstream
> with a Filter node using `{{ !$json._blocked }}`. **This is expected
> behavior, not a node bug.**

**Inputs**
- `Query` (string, required) — `pizza`, `plumber`, `dentist`
- `Location` (string, required) — `San Francisco, CA`
- `Max Results` — 1–100
- `Include Full Details` (boolean) — visit each business page (slower)
- `Extract Business Emails` (boolean) — follow website link (slower)
- `Verify Emails (Paid Add-On)` — SMTP probe, ~$0.05/email

**Output** — one item per business (or `_blocked` placeholder on challenge).

### NexGenData Google Search Scraper
> Apify actor: [`nexgendata/google-search-scraper`](https://apify.com/nexgendata/google-search-scraper?fpr=2ayu9b) (`aep8V9fPChl0zQuLA`)

Scrape Google organic search results for one or more queries — SERP
analysis, keyword rank tracking, competitor intelligence. Each query is
executed separately.

**Inputs**
- `Queries` (string list, required) — `best CRM for small business`, ...
- `Max Results per Query` — 1–100
- `Country` — US, UK, CA, AU, DE, FR, JP, BR, IN, MX
- `Language` — `en`, `de`, `fr`, `es`, `ja`, `pt`, ...

**Output** — one item per organic result (title, URL, snippet, rank).

### NexGenData Redfin Property Scraper
> Apify actor: [`nexgendata/redfin-real-estate-scraper`](https://apify.com/nexgendata/redfin-real-estate-scraper?fpr=2ayu9b) (`CwHzig9rDc8gdy5NI`)

Paste any Redfin search URL (city, neighborhood, ZIP, or filtered search)
and scrape the listings — price, beds/baths, sqft, lot size, days on
market, coordinates. `Market Tracker` mode adds price-per-sqft analysis,
neighborhood comparisons, and market-time distribution on top.

Uses the async pattern; the actor's default timeout is 1 hour, which
matches large neighborhood scans.

**Inputs**
- `Redfin Search URL` (string, required) — e.g. `https://www.redfin.com/city/16163/WA/Seattle`
- `Output Mode` — `Market Tracker` (analytics + insights) or `Raw Data`
- `Max Results` — listing cap (default 50)

**Output** — one item per property (plus market-tracker summary in tracker mode).

### NexGenData Website Email Extractor
> Apify actor: [`nexgendata/website-email-extractor`](https://apify.com/nexgendata/website-email-extractor?fpr=2ayu9b) (`pAS0RMQ3dthgOc3QO`)

Bulk crawl websites and extract emails, phone numbers, and social
profiles. Designed for prospect-list enrichment at scale; uses the async
pattern so multi-page deep crawls don't run into the 5-minute sync cap.

**Inputs**
- `URLs` (string list, required) — bare hostnames accepted
- `Max Pages per Site` (default 10)
- `Extract Emails` / `Extract Phones` / `Extract Social Profiles` (booleans)

**Output** — one item per URL with the extracted contact data.

## Usage

Every node returns standard n8n items. Chain them together for a complete
prospecting pipeline:

```
HTTP Trigger → Company Enrichment → Email Finder → Email Validator → CRM
```

A typical pattern:

1. **Company Enrichment** turns a list of brand names into structured
   company profiles (domain, industry, size).
2. **Email Finder** discovers candidate emails for each enriched domain.
3. **Email Validator** filters the candidates down to deliverable
   addresses before push-to-CRM