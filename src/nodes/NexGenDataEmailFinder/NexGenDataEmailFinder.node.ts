import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
} from 'n8n-workflow';

import { runActorSync } from '../../utils/apifyClient';

/**
 * Wraps the NexGenData "Company Email Finder" Apify actor (`oU37pA5Kj63UeUUFl`).
 *
 * The actor accepts a list of company domains/URLs and returns discovered
 * email addresses (pattern-generated + scraped) plus DNS MX validation
 * metadata. We expose a single "Domains" string-list input plus an optional
 * "Additional Fields" collection for forward-compatibility with new actor
 * options without needing a node release.
 */
const ACTOR_ID = 'oU37pA5Kj63UeUUFl';

export class NexGenDataEmailFinder implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'NexGenData Email Finder',
		name: 'nexGenDataEmailFinder',
		icon: 'file:nexGenDataEmailFinder.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Discover email addresses associated with a company domain',
		defaults: {
			name: 'NexGenData Email Finder',
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
						name: 'Find Emails',
						value: 'find',
						description: 'Find emails for one or more company domains',
						action: 'Find emails for one or more company domains',
					},
				],
				default: 'find',
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
				placeholder: 'stripe.com',
				description:
					'Company domains or URLs to find emails for (e.g. apple.com, https://stripe.com)',
				displayOptions: {
					show: {
						operation: ['find'],
					},
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
						description:
							'Memory in megabytes to allocate to the actor run. Higher memory generally means faster execution but slightly higher compute cost.',
					},
					{
						displayName: 'Run Timeout (Seconds)',
						name: 'timeoutSecs',
						type: 'number',
						default: 240,
						description:
							'Maximum time to wait for the actor run to complete. Apify caps sync runs at 300 seconds.',
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
				// Filter out empties that the user may have inadvertently added by
				// clicking the "Add Domain" button.
				const domains = rawDomains.map((d) => d?.trim()).filter((d): d is string => !!d);

				const additionalFields = this.getNodeParameter(
					'additionalFields',
					i,
					{},
				) as IDataObject;

				const input: IDataObject = { domains };

				const results = await runActorSync(this, {
					actorId: ACTOR_ID,
					input,
					memoryMbytes: additionalFields.memoryMbytes as number | undefined,
					timeoutSecs: additionalFields.timeoutSecs as number | undefined,
				});

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
