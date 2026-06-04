import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
	NodeOperationError,
} from 'n8n-workflow';

import {
	startActorRun,
	waitForRunCompletion,
	getDatasetItems,
} from '../../utils/apifyClient';

/**
 * Wraps the NexGenData "Yelp Business Scraper" Apify actor
 * (`v2ozARuYK12cev8J8`).
 *
 * Yelp lead scraping for any query × location pair — returns business
 * cards, can optionally visit detail pages, and (paid) follow the
 * extracted website to scrape emails. Actor default timeout is 600 s, so
 * we use the async pattern.
 *
 * Anti-bot note
 * -------------
 * Yelp aggressively rate-limits and challenge-pages scrapers. When the
 * actor is challenged it returns a *graceful placeholder* record of the
 * form `{ "_blocked": true, "url": "...", "reason": "..." }` instead of
 * crashing the run. Downstream nodes should filter these out — e.g. a
 * Filter node with `{{ !$json._blocked }}`. The placeholder pattern means
 * the workflow does NOT fail; you simply get fewer items than requested
 * during incidents.
 */
const ACTOR_ID = 'v2ozARuYK12cev8J8';

export class NexGenDataYelpBusinessScraper implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'NexGenData Yelp Business Scraper',
		name: 'nexGenDataYelpBusinessScraper',
		icon: 'file:nexGenDataYelpBusinessScraper.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description:
			'Scrape Yelp business listings for a query + location — names, ratings, websites, optional email scraping. Returns _blocked placeholder records (not errors) when Yelp challenges the scraper.',
		defaults: {
			name: 'NexGenData Yelp Business Scraper',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'nexGenDataApi',
				required: true,
			},
		],
		properties: [
			{
				displayName:
					'Yelp blocks scrapers aggressively. When challenged, the actor returns placeholder records with {"_blocked": true, ...} instead of failing — filter them out downstream with {{ !$json._blocked }}.',
				name: 'antiBotNotice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Search',
						value: 'search',
						description: 'Search Yelp for businesses matching the query',
						action: 'Search yelp for businesses matching the query',
					},
				],
				default: 'search',
			},
			{
				displayName: 'Query',
				name: 'query',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'pizza',
				description: 'Yelp search keyword (e.g. pizza, plumber, dentist)',
				displayOptions: {
					show: { operation: ['search'] },
				},
			},
			{
				displayName: 'Location',
				name: 'location',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'San Francisco, CA',
				description: 'Yelp location (city, state, ZIP) — e.g. "San Francisco, CA"',
				displayOptions: {
					show: { operation: ['search'] },
				},
			},
			{
				displayName: 'Max Results',
				name: 'maxResults',
				type: 'number',
				default: 20,
				typeOptions: { minValue: 1, maxValue: 100 },
				description: 'Maximum number of businesses to extract for this query (1–100)',
				displayOptions: {
					show: { operation: ['search'] },
				},
			},
			{
				displayName: 'Include Full Details',
				name: 'includeDetails',
				type: 'boolean',
				default: false,
				description:
					'Whether to visit each business page for detailed data (hours, website, etc.). Slower but more comprehensive.',
				displayOptions: {
					show: { operation: ['search'] },
				},
			},
			{
				displayName: 'Extract Business Emails',
				name: 'extractEmails',
				type: 'boolean',
				default: false,
				description:
					'Whether to follow each business website (extracted from its Yelp page) and scrape emails. Slower; increases yield for outbound.',
				displayOptions: {
					show: { operation: ['search'] },
				},
			},
			{
				displayName: 'Verify Emails (Paid Add-On)',
				name: 'verifyEmails',
				type: 'boolean',
				default: false,
				description:
					'Whether to perform SMTP verification on scraped emails. Paid add-on — Apify bills ~$0.05/email verified.',
				displayOptions: {
					show: { operation: ['search'] },
				},
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				options: [
					{
						displayName: 'Actor Memory (MB)',
						name: 'memoryMbytes',
						type: 'number',
						default: 1024,
						description: 'Memory in MB to allocate to the actor run. 1024 MB matches the actor default.',
					},
					{
						displayName: 'Max Wait (Seconds)',
						name: 'maxWaitSecs',
						type: 'number',
						default: 1800,
						description:
							'Maximum time the node will poll for the run to complete. Defaults to 30 minutes — Yelp can be slow under retry.',
					},
					{
						displayName: 'Poll Interval (Seconds)',
						name: 'pollIntervalSecs',
						type: 'number',
						default: 5,
						typeOptions: { minValue: 2 },
						description: 'How often to poll the run for completion',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const query = (this.getNodeParameter('query', i, '') as string).trim();
				const location = (this.getNodeParameter('location', i, '') as string).trim();
				const maxResults = this.getNodeParameter('maxResults', i, 20) as number;
				const includeDetails = this.getNodeParameter(
					'includeDetails',
					i,
					false,
				) as boolean;
				const extractEmails = this.getNodeParameter(
					'extractEmails',
					i,
					false,
				) as boolean;
				const verifyEmails = this.getNodeParameter(
					'verifyEmails',
					i,
					false,
				) as boolean;

				const additionalFields = this.getNodeParameter(
					'additionalFields',
					i,
					{},
				) as IDataObject;

				const input: IDataObject = {
					searchQueries: [{ query, location }],
					maxResults,
					includeDetails,
					extractEmails,
					verifyEmails,
				};

				const run = await startActorRun(this, {
					actorId: ACTOR_ID,
					input,
					memoryMbytes: additionalFields.memoryMbytes as number | undefined,
				});

				const runId = run.id as string | undefined;
				const defaultDatasetId = run.defaultDatasetId as string | undefined;
				if (!runId || !defaultDatasetId) {
					throw new NodeOperationError(
						this.getNode(),
						`Apify did not return a run id / dataset id (got ${JSON.stringify(run)})`,
					);
				}

				const maxWaitSecs =
					(additionalFields.maxWaitSecs as number | undefined) ?? 1800;
				const pollIntervalSecs =
					(additionalFields.pollIntervalSecs as number | undefined) ?? 5;

				const finalRun = await waitForRunCompletion(
					this,
					runId,
					maxWaitSecs,
					pollIntervalSecs * 1000,
				);

				if (finalRun.status !== 'SUCCEEDED') {
					throw new NodeOperationError(
						this.getNode(),
						`Apify run ${runId} ended with status ${finalRun.status}`,
					);
				}

				const results = await getDatasetItems(this, defaultDatasetId);

				for (const r of results) {
					// Annotate `_blocked` placeholder rows with an actionable
					// retry suggestion. The actor itself returns `_blocked` +
					// `url` + `reason` only; we add `Suggestion` here so users
					// have a clear next-step in the n8n UI without needing to
					// read our docs.
					if (r && (r as IDataObject)._blocked === true) {
						(r as IDataObject).Suggestion =
							'Yelp blocked this request. Retry the same query in 15–30 minutes; if it persists for more than a few hours, lower Max Results, run from a different region, or shift to off-peak hours (overnight US time). Use the n8n Filter node with {{ !$json._blocked }} to drop placeholders downstream.';
					}
					returnData.push({
						json: r,
						pairedItem: { item: i },
					});
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
