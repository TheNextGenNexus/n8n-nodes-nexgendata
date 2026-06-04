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
 * Wraps the NexGenData "Lead List Enricher" Apify actor
 * (`KYd910fyOnKVzNq0a`).
 *
 * Takes a list of domains and returns one enriched record per domain —
 * contact emails, phone numbers, and social profiles. Designed for the bulk
 * "I have a CSV of domains, enrich them all" use case, so we use the async
 * pattern: start the run, poll until done, then pull the dataset. This
 * avoids the 5-minute `run-sync` cap on larger lists.
 */
const ACTOR_ID = 'KYd910fyOnKVzNq0a';

export class NexGenDataLeadListEnricher implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'NexGenData Lead List Enricher',
		name: 'nexGenDataLeadListEnricher',
		icon: 'file:nexGenDataLeadListEnricher.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description:
			'Bulk-enrich a list of domains with emails, phones, and social profiles per domain',
		defaults: {
			name: 'NexGenData Lead List Enricher',
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
						name: 'Enrich',
						value: 'enrich',
						description: 'Enrich a list of domains with contact data',
						action: 'Enrich a list of domains with contact data',
					},
				],
				default: 'enrich',
			},
			{
				displayName: 'Domains',
				name: 'domains',
				type: 'string',
				typeOptions: {
					multipleValues: true,
					multipleValueButtonText: 'Add Domain',
				},
				default: [],
				required: true,
				placeholder: 'apple.com',
				description: 'Domains to enrich (e.g. apple.com, stripe.com). One enriched record returned per domain.',
				displayOptions: {
					show: { operation: ['enrich'] },
				},
			},
			{
				displayName: 'Max Contacts per Domain',
				name: 'maxContactsPerDomain',
				type: 'number',
				default: 5,
				typeOptions: { minValue: 1 },
				description: 'Cap on the number of contacts returned per domain',
				displayOptions: {
					show: { operation: ['enrich'] },
				},
			},
			{
				displayName: 'Crawl Contact Pages',
				name: 'crawlContactPages',
				type: 'boolean',
				default: true,
				description:
					'Whether to visit /contact, /about, and similar pages for richer enrichment. Slower but more accurate.',
				displayOptions: {
					show: { operation: ['enrich'] },
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
							'Maximum time the node will poll for the run to complete. Defaults to 30 minutes — fits large enrichment batches.',
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
				const rawDomains = this.getNodeParameter('domains', i, []) as string[];
				const domains = rawDomains
					.map((d) => d?.trim())
					.filter((d): d is string => !!d);

				const maxContactsPerDomain = this.getNodeParameter(
					'maxContactsPerDomain',
					i,
					5,
				) as number;
				const crawlContactPages = this.getNodeParameter(
					'crawlContactPages',
					i,
					true,
				) as boolean;

				const additionalFields = this.getNodeParameter(
					'additionalFields',
					i,
					{},
				) as IDataObject;

				const input: IDataObject = {
					domains,
					maxContactsPerDomain,
					crawlContactPages,
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
