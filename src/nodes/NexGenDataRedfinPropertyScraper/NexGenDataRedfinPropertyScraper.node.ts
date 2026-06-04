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
 * Wraps the NexGenData "Redfin Property Scraper" Apify actor
 * (`CwHzig9rDc8gdy5NI`).
 *
 * Paste any Redfin search URL (city, neighborhood, ZIP) and the actor
 * scrapes listings — price, beds/baths, sqft, lot size, days-on-market,
 * coordinates. `Market Tracker` output mode adds price-per-sqft analysis,
 * neighborhood comparisons, and market-time distribution on top of the raw
 * listing records.
 *
 * Actor default timeout is 3600 s (1 h) — the sync endpoint can't fit, so
 * we use the async pattern.
 */
const ACTOR_ID = 'CwHzig9rDc8gdy5NI';

export class NexGenDataRedfinPropertyScraper implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'NexGenData Redfin Property Scraper',
		name: 'nexGenDataRedfinPropertyScraper',
		icon: 'file:nexGenDataRedfinPropertyScraper.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description:
			'Scrape Redfin listings for any city, neighborhood, or ZIP — prices, sqft, beds, comps, market analytics',
		defaults: {
			name: 'NexGenData Redfin Property Scraper',
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
						description: 'Scrape Redfin listings for a search URL',
						action: 'Scrape redfin listings for a search url',
					},
				],
				default: 'search',
			},
			{
				displayName: 'Redfin Search URL',
				name: 'searchUrl',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'https://www.redfin.com/city/16163/WA/Seattle',
				description:
					'Paste any Redfin search URL (city, neighborhood, ZIP, or filtered search)',
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
						name: 'Market Tracker (Analytics + Insights)',
						value: 'tracker',
						description:
							'Adds price-per-sqft analysis, neighborhood comparisons, and market-time distribution',
					},
					{
						name: 'Raw Data (Flat Listings)',
						value: 'raw',
						description: 'Flat listing records suitable for CSV / database import',
					},
				],
				default: 'tracker',
				displayOptions: {
					show: { operation: ['search'] },
				},
			},
			{
				displayName: 'Max Results',
				name: 'maxResults',
				type: 'number',
				default: 50,
				typeOptions: { minValue: 1 },
				description:
					'How many properties to extract. 50 gives a good market snapshot; higher values give more statistical depth.',
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
						default: 4096,
						description: 'Memory in MB to allocate to the actor run. 4096 MB matches the actor default.',
					},
					{
						displayName: 'Max Wait (Seconds)',
						name: 'maxWaitSecs',
						type: 'number',
						default: 3600,
						description:
							'Maximum time the node will poll for the run to complete. Defaults to 1 hour — matches the actor default.',
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
				const searchUrl = (this.getNodeParameter('searchUrl', i, '') as string).trim();
				const outputMode = this.getNodeParameter('outputMode', i, 'tracker') as string;
				const maxResults = this.getNodeParameter('maxResults', i, 50) as number;

				const additionalFields = this.getNodeParameter(
					'additionalFields',
					i,
					{},
				) as IDataObject;

				const input: IDataObject = {
					searchUrl,
					outputMode,
					maxResults,
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
					(additionalFields.maxWaitSecs as number | undefined) ?? 3600;
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
