# NexGenData — n8n Workflow Templates (importable)

Ready-made n8n workflows that run a NexGenData Apify actor on a schedule and route the results
into a destination. **Built from n8n CORE nodes only** (Schedule Trigger, HTTP Request, Split Out,
plus one destination node), so they import on any n8n — cloud or self-hosted — with **nothing to install**.

> Verified against n8n's official docs + node source (June 2026): workflow-JSON shape, node types,
> current typeVersions (Schedule 1.3, HTTP Request 4.4, Code 2, Google Sheets 4.7, Slack 2.5, Gmail 2.2),
> and param names all confirmed. Still treat as a starting point — import, set your token + credentials,
> run once — since I haven't round-tripped them through a live n8n.
>
> Key behavior (verified): n8n's HTTP Request v4.x **auto-splits a top-level JSON array** (which Apify's
> `run-sync-get-dataset-items` returns) into **one item per dataset row**, so the workflows process every
> row, not just the first. The Code node normalizes/filters/formats and guards the wrapped-array case too.

## How to import
1. n8n → **Workflows → Import from File** (⋯ menu) → choose the `.json`.
2. Open the **HTTP Request** node → in the query parameter `token`, replace `YOUR_APIFY_TOKEN`
   with your own Apify API token (Apify Console → Settings → Integrations). *(Or convert it to an
   n8n Query-Auth credential so the token isn't stored in the workflow.)*
3. Open the **destination** node (Google Sheets / Slack / Gmail) → connect your account and pick
   the spreadsheet / channel / recipient.
4. Adjust the **Schedule Trigger** cadence and the actor **input JSON** (queries / tickers / vendors).
5. Activate.

## How it works
`Schedule Trigger → HTTP Request (POST Apify run-sync-get-dataset-items) → Split Out items → destination`.
The HTTP call runs the actor and returns its dataset rows in one step (sync; best for fast actors —
for long runs, switch to the verified **Apify** node's async Run-Actor + Get-Dataset-Items, as the
workflow pages describe). Pay-per-use Apify charges hit your own account.

## Adapting to any other actor
Swap two things in the HTTP Request node:
- the **actor slug** in the URL: `…/acts/nexgendata~ACTOR-SLUG/run-sync-get-dataset-items`
- the **input JSON** body (e.g. `{ "tickers": ["AAPL"] }`, `{ "vendors": ["fortinet"] }`).

Then point the destination node wherever you want. Same skeleton works for all NexGenData actors.

## Files
- `n8n-google-shopping-to-sheets.json` — price monitor → Google Sheets (append rows)
- `n8n-cve-kev-to-slack.json` — CVE/KEV monitor → Slack message (filtered to KEV=true / CVSS≥9)
- `n8n-sec-form4-to-email.json` — SEC Form 4 monitor → email digest (Gmail)

## Publishing to n8n.io/workflows (optional)
The public template gallery is submitted through n8n's **Creator hub / Creator Program** (title,
description, categories, nodes-used metadata — not a bare file upload). These templates use **placeholder
values only** (`YOUR_APIFY_TOKEN`, `YOUR_EMAIL`) and reference no saved credentials, so they're clean to
publish as-is — nothing to anonymize.

Affiliate note: these template files contain **no affiliate links** (they're functional workflows).
Affiliate `?fpr=2ayu9b` links live only on the owned workflow pages at thenextgennexus.com.
