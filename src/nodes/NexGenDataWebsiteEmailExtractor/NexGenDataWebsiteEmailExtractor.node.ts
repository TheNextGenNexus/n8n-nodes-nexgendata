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
 * Wraps the NexGenData "Website Email Extractor" Apify actor
 * (`pAS0RMQ3dthgOc3QO`).
 *
 * Bulk crawl websites and extract emails, phone numbers, and social
 * profiles. With deep crawl (`maxPagesPerSite > 1`) total run time can
 * easily exceed the 5-minute sync cap on larger lists, so we use the async
 * pattern.
 *
 * Implementation note: the actor accepts the URL list under multiple
 * aliases (`urls`, `startUrls`, `domains`, `websites`, `url`, `domain`).
 * We use `urls` as the canonical field.
 */
const ACTOR_ID = 'pAS0RMQ3dthgOc3QO';

export class NexGenDataWebsiteEmailExtractor implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'NexGenData Website Email Extractor',
		name: 'nexGenDataWebsiteEmailExtractor',
		icon: 'file:nexGenDataWebsiteEmailExtractor.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description:
			'Bulk extract emails, phones, and social profiles from a list of websites — multi-page deep crawl',
		defaults: {
			name: 'NexGenData Website Email Extractor',
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
						name: 'Extract',
						value: 'extract',
						description: 'Extract emails, phones, and socials from one or more websites',
						action: 'Extract emails phones and socials from one or more websites',
					},
				],
				default: 'extract',
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
				placeholder: 'https://example.com',
				description:
					'Website URLs to extract contact info from. Bare hostnames work (e.g. example.com) — scheme is auto-added.',
				displayOptions: {
					show: { operation: ['extract'] },
				},
			},
			{
				displayName: 'Max Pages per Site',
				name: 'maxPagesPerSite',
				type: 'number',
				default: 10,
				typeOptions: { minValue: 1 },
				description: 'Maximum number of pages to crawl per website',
				displayOptions: {
					show: { operation: ['extract'] },
				},
			},
			{
				displayName: 'Extract Emails',
				name: 'extractEmails',
				type: 'boolean',
				default: true,
				description: 'Whether to extract email addresses from the website',
				displayOptions: {
					show: { operation: ['extract'] },
				},
			},
			{
				displayName: 'Extract Phones',
				name: 'extractPhones',
				type: 'boolean',
				default: true,
				description: 'Whether to extract phone numbers from the website',
				displayOptions: {
					show: { operation: ['extract'] },
				},
			},
			{
				displayName: 'Extract Social Profiles',
				name: 'extractSocials',
				type: 'boolean',
				default: true,
				description:
					'Whether to extract social media profiles (LinkedIn, Twitter, Facebook, etc.)',
				displayOptions: {
					show: { operation: ['extract'] },
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

				const maxPagesPerSite = this.getNodeParameter(
					'maxPagesPerSite',
					i,
					10,
				) as number;
				const extractEmails = this.getNodeParameter(
					'extractEmails',
					i,
					true,
				) as boolean;
				const extractPhones = this.getNodeParameter(
					'extractPhones',
					i,
					true,
				) as boolean;
				const extractSocials = this.getNodeParameter(
					'extractSocials',
					i,
					true,
				) as boolean;

				const additionalFields = this.getNodeParameter(
					'additionalFields',
					i,
					{},
				) as IDataObject;

				const input: IDataObject = {
					urls,
					maxPagesPerSite,
					extractEmails,
					extractPhones,
					extractSocials,
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
