import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
} from 'n8n-workflow';

import { runActorSync } from '../../utils/apifyClient';

/**
 * Wraps the NexGenData "Google Search Scraper" Apify actor
 * (`aep8V9fPChl0zQuLA`).
 *
 * Pulls organic search results from Google for one or more queries —
 * useful for SERP analysis, keyword rank tracking, and competitor
 * intelligence. Each query is executed separately.
 *
 * Default actor timeout is 300 s; sync endpoint fits.
 */
const ACTOR_ID = 'aep8V9fPChl0zQuLA';

export class NexGenDataGoogleSearchScraper implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'NexGenData Google Search Scraper',
		name: 'nexGenDataGoogleSearchScraper',
		icon: 'file:nexGenDataGoogleSearchScraper.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description:
			'Scrape Google search results (SERPs) for keyword rankings, competitor analysis, and intel',
		defaults: {
			name: 'NexGenData Google Search Scraper',
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
						description: 'Run one or more Google search queries',
						action: 'Run one or more google search queries',
					},
				],
				default: 'search',
			},
			{
				displayName: 'Queries',
				name: 'queries',
				type: 'string',
				typeOptions: {
					multipleValues: true,
					multipleValueButtonText: 'Add Query',
				},
				default: [],
				required: true,
				placeholder: 'best CRM for small business',
				description: 'Google search queries — each query is executed separately',
				displayOptions: {
					show: { operation: ['search'] },
				},
			},
			{
				displayName: 'Max Results per Query',
				name: 'maxResults',
				type: 'number',
				default: 10,
				typeOptions: { minValue: 1, maxValue: 100 },
				description: 'Maximum number of search results to extract per query (1–100)',
				displayOptions: {
					show: { operation: ['search'] },
				},
			},
			{
				displayName: 'Country',
				name: 'country',
				type: 'options',
				options: [
					{ name: 'Australia (AU)', value: 'AU' },
					{ name: 'Brazil (BR)', value: 'BR' },
					{ name: 'Canada (CA)', value: 'CA' },
					{ name: 'France (FR)', value: 'FR' },
					{ name: 'Germany (DE)', value: 'DE' },
					{ name: 'India (IN)', value: 'IN' },
					{ name: 'Japan (JP)', value: 'JP' },
					{ name: 'Mexico (MX)', value: 'MX' },
					{ name: 'United Kingdom (UK)', value: 'UK' },
					{ name: 'United States (US)', value: 'US' },
				],
				default: 'US',
				description: 'Country code for Google search localization',
				displayOptions: {
					show: { operation: ['search'] },
				},
			},
			{
				displayName: 'Language',
				name: 'language',
				type: 'string',
				default: 'en',
				placeholder: 'en',
				description: 'Language code for search results (en, de, fr, es, ja, pt, …)',
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
						displayName: 'Run Timeout (Seconds)',
						name: 'timeoutSecs',
						type: 'number',
						default: 240,
						description: 'Maximum time to wait for the actor run. Apify caps sync runs at 300 seconds.',
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

				const maxResults = this.getNodeParameter('maxResults', i, 10) as number;
				const country = this.getNodeParameter('country', i, 'US') as string;
				const language = (this.getNodeParameter('language', i, 'en') as string).trim();

				const additionalFields = this.getNodeParameter(
					'additionalFields',
					i,
					{},
				) as IDataObject;

				const input: IDataObject = {
					queries,
					maxResults,
					country,
					language,
				};

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
