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
 * Wraps the NexGenData "Contact Info Scraper" Apify actor
 * (`4nDHYI1ez25zdhmwZ`).
 *
 * Crawls a list of websites and extracts emails + phone numbers, optionally
 * visiting /contact, /about, and /team pages for richer results. Designed
 * for bulk runs over many websites, so we use the async pattern to stay
 * outside the 5-minute `run-sync` cap.
 *
 * Note on field naming: the actor accepts snake_case input fields
 * (`crawl_contact_pages`, `max_pages_per_site`, `request_timeout_secs`).
 * We expose camelCase n8n params and translate at the boundary.
 */
const ACTOR_ID = '4nDHYI1ez25zdhmwZ';

export class NexGenDataContactInfoScraper implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'NexGenData Contact Info Scraper',
		name: 'nexGenDataContactInfoScraper',
		icon: 'file:nexGenDataContactInfoScraper.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description:
			'Crawl websites and extract emails + phone numbers, with optional /contact and /about deep-crawl',
		defaults: {
			name: 'NexGenData Contact Info Scraper',
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
						name: 'Scrape',
						value: 'scrape',
						description: 'Scrape contact info from one or more websites',
						action: 'Scrape contact info from one or more websites',
					},
				],
				default: 'scrape',
			},
			{
				displayName: 'URLs',
				name: 'urls',
				type: 'string',
				typeOptions: {
					multipleValues: true,
					multipleValueButtonText: 'Add URL',
				},
				default: [],
				required: true,
				placeholder: 'https://stripe.com',
				description:
					'Website URLs to scrape. Bare hostnames work too (e.g. stripe.com) — the scheme is auto-added.',
				displayOptions: {
					show: { operation: ['scrape'] },
				},
			},
			{
				displayName: 'Crawl Contact Pages',
				name: 'crawlContactPages',
				type: 'boolean',
				default: true,
				description:
					'Whether to also crawl /contact, /about, /team and similar pages for additional contact data',
				displayOptions: {
					show: { operation: ['scrape'] },
				},
			},
			{
				displayName: 'Max Pages per Site',
				name: 'maxPagesPerSite',
				type: 'number',
				default: 5,
				typeOptions: { minValue: 1 },
				description:
					'Maximum number of pages to visit per site (homepage + discovered contact pages)',
				displayOptions: {
					show: { operation: ['scrape'] },
				},
			},
			{
				displayName: 'Request Timeout (Seconds)',
				name: 'requestTimeoutSecs',
				type: 'number',
				default: 20,
				typeOptions: { minValue: 3, maxValue: 120 },
				description: 'Per-request HTTP timeout in seconds',
				displayOptions: {
					show: { operation: ['scrape'] },
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
							'Maximum time the node will poll for the run to complete. Defaults to 30 minutes.',
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
				const rawUrls = this.getNodeParameter('urls', i, []) as string[];
				const urls = rawUrls.map((u) => u?.trim()).filter((u): u is string => !!u);

				const crawlContactPages = this.getNodeParameter(
					'crawlContactPages',
					i,
					true,
				) as boolean;
				const maxPagesPerSite = this.getNodeParameter(
					'maxPagesPerSite',
					i,
					5,
				) as number;
				const requestTimeoutSecs = this.getNodeParameter(
					'requestTimeoutSecs',
					i,
					20,
				) as number;

				const additionalFields = this.getNodeParameter(
					'additionalFields',
					i,
					{},
				) as IDataObject;

				const input: IDataObject = {
					urls,
					crawl_contact_pages: crawlContactPages,
					max_pages_per_site: maxPagesPerSite,
					request_timeout_secs: requestTimeoutSecs,
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
