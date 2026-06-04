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
 * Wraps the NexGenData "Google Maps Lead Scraper" Apify actor
 * (`yaVwNMJVMMJ3kk3ue`).
 *
 * The actor runs Google Places searches across one or more queries and
 * returns business listings — name, phone, website, rating, reviews,
 * coordinates — optionally enriched with scraped emails + socials. Each
 * query can return up to 100 results and the actor visits each business
 * website for enrichment, so total run time can easily exceed Apify's
 * 5-minute `run-sync` cap. We therefore use the async pattern: start the
 * run, poll until it terminates, then pull the dataset.
 *
 * Implementation notes:
 *   - The actor accepts the search list under multiple aliases (`queries`,
 *     `searchQueries`, `urls`, `startUrls`, `searches`). We use `queries`.
 *   - A Google Cloud API key with Places API (New) enabled is required.
 *   - `outputMode = 'tracker'` produces lead-scored results + a summary
 *     report; `'raw'` produces flat business records suitable for CRM
 *     import.
 */
const ACTOR_ID = 'yaVwNMJVMMJ3kk3ue';

export class NexGenDataGoogleMapsLeadScraper implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'NexGenData Google Maps Lead Scraper',
		name: 'nexGenDataGoogleMapsLeadScraper',
		icon: 'file:nexGenDataGoogleMapsLeadScraper.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description:
			'Extract business leads from Google Maps — emails, phones, websites, ratings, reviews',
		defaults: {
			name: 'NexGenData Google Maps Lead Scraper',
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
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Search',
						value: 'search',
						description: 'Search Google Maps for business leads',
						action: 'Search google maps for business leads',
					},
				],
				default: 'search',
			},
			{
				displayName: 'Search Queries',
				name: 'queries',
				type: 'string',
				typeOptions: {
					multipleValues: true,
					multipleValueButtonText: 'Add Query',
				},
				default: [],
				required: true,
				placeholder: 'plumbers in Chicago',
				description:
					'Business searches — include the type and location. Examples: "plumbers in Chicago", "dentists Austin TX", "Italian restaurants Manhattan".',
				displayOptions: {
					show: { operation: ['search'] },
				},
			},
			{
				displayName: 'Google API Key',
				name: 'googleApiKey',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				required: true,
				description:
					'Your Google Cloud API key with Places API (New) enabled. Get one free at console.cloud.google.com — $200/month free credits cover ~6,000 searches.',
				displayOptions: {
					show: { operation: ['search'] },
				},
			},
			{
				displayName: 'Output Mode',
				name: 'outputMode',
				type: 'options',
				options: [
					{
						name: 'Lead Tracker (Scoring + Insights)',
						value: 'tracker',
						description: 'Adds lead quality scoring, market analysis, and summary report',
					},
					{
						name: 'Raw Data (Flat Records)',
						value: 'raw',
						description: 'Flat business records suitable for CRM / spreadsheet import',
					},
				],
				default: 'tracker',
				displayOptions: {
					show: { operation: ['search'] },
				},
			},
			{
				displayName: 'Max Results per Query',
				name: 'maxResults',
				type: 'number',
				default: 20,
				typeOptions: { minValue: 1, maxValue: 100 },
				description:
					'Maximum businesses returned per query. 20 for a quick scan, 100 for comprehensive local market coverage.',
				displayOptions: {
					show: { operation: ['search'] },
				},
			},
			{
				displayName: 'Enrich Contact Data',
				name: 'enrichContacts',
				type: 'boolean',
				default: true,
				description:
					'Whether to visit each business website to extract emails and social media links. Adds ~1–2 s per business but dramatically increases lead value.',
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
						displayName: 'Location Context',
						name: 'location',
						type: 'string',
						default: '',
						placeholder: 'San Francisco, CA',
						description:
							"Add location to all searches. Useful when your queries don't include a city name.",
					},
					{
						displayName: 'Actor Memory (MB)',
						name: 'memoryMbytes',
						type: 'number',
						default: 4096,
						description:
							'Memory in MB to allocate to the actor run. 4096 MB matches the actor default.',
					},
					{
						displayName: 'Max Wait (Seconds)',
						name: 'maxWaitSecs',
						type: 'number',
						default: 1800,
						description:
							'Maximum time the node will poll for the run to complete. Defaults to 30 minutes. Large queries with full enrichment can take a while.',
					},
					{
						displayName: 'Poll Interval (Seconds)',
						name: 'pollIntervalSecs',
						type: 'number',
						default: 5,
						typeOptions: { minValue: 2 },
						description:
							'How often to poll the run for completion. Lower values respond faster but use more API calls.',
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
				const rawQueries = this.getNodeParameter('queries', i, []) as string[];
				const queries = rawQueries
					.map((q) => q?.trim())
					.filter((q): q is string => !!q);

				const googleApiKey = (
					this.getNodeParameter('googleApiKey', i, '') as string
				).trim();
				const outputMode = this.getNodeParameter('outputMode', i, 'tracker') as string;
				const maxResults = this.getNodeParameter('maxResults', i, 20) as number;
				const enrichContacts = this.getNodeParameter(
					'enrichContacts',
					i,
					true,
				) as boolean;

				const additionalFields = this.getNodeParameter(
					'additionalFields',
					i,
					{},
				) as IDataObject;

				const input: IDataObject = {
					queries,
					google_api_key: googleApiKey,
					outputMode,
					max_results: maxResults,
					enrich_contacts: enrichContacts,
				};
				if (additionalFields.location) {
					input.location = additionalFields.location;
				}

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
