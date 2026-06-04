import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
} from 'n8n-workflow';

import { runActorSync } from '../../utils/apifyClient';

/**
 * Wraps the NexGenData "B2B Leads Finder" Apify actor
 * (`JBWyoiaG3eR7tqbaF`).
 *
 * Apollo-style B2B prospecting — find people by job title, company,
 * industry, and location, with generated/verified email candidates. Either
 * provide a free-form `searchQuery` (overrides everything) or compose a
 * structured search via the individual filter fields.
 *
 * Actor default timeout is 300 s — sync endpoint fits.
 */
const ACTOR_ID = 'JBWyoiaG3eR7tqbaF';

export class NexGenDataB2BLeadsFinder implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'NexGenData B2B Leads Finder',
		name: 'nexGenDataB2BLeadsFinder',
		icon: 'file:nexGenDataB2BLeadsFinder.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description:
			'Find B2B leads by job title, company, industry, location — Apollo-style prospecting with emails',
		defaults: {
			name: 'NexGenData B2B Leads Finder',
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
						name: 'Find',
						value: 'find',
						description: 'Find B2B leads matching the criteria',
						action: 'Find b2b leads matching the criteria',
					},
				],
				default: 'find',
			},
			{
				displayName: 'Search Query',
				name: 'searchQuery',
				type: 'string',
				default: '',
				placeholder: 'Marketing Manager at tech companies in San Francisco',
				description:
					'Optional free-form search query. When provided, overrides the structured filters below.',
				displayOptions: {
					show: { operation: ['find'] },
				},
			},
			{
				displayName: 'Job Title',
				name: 'jobTitle',
				type: 'string',
				default: 'Marketing Manager',
				placeholder: 'Marketing Manager',
				description: "Job title to search for. Example: 'Marketing Manager', 'Sales Engineer'.",
				displayOptions: {
					show: { operation: ['find'] },
				},
			},
			{
				displayName: 'Company',
				name: 'company',
				type: 'string',
				default: '',
				placeholder: 'Acme Corp',
				description: 'Optional — restrict to a specific company. Leave empty to search broadly.',
				displayOptions: {
					show: { operation: ['find'] },
				},
			},
			{
				displayName: 'Industry',
				name: 'industry',
				type: 'string',
				default: 'Technology',
				placeholder: 'Technology',
				description: "Industry filter. Example: 'Technology', 'Finance', 'Healthcare'.",
				displayOptions: {
					show: { operation: ['find'] },
				},
			},
			{
				displayName: 'Location',
				name: 'location',
				type: 'string',
				default: 'San Francisco',
				placeholder: 'San Francisco',
				description: "Geographic location filter. Example: 'San Francisco', 'New York', 'United States'.",
				displayOptions: {
					show: { operation: ['find'] },
				},
			},
			{
				displayName: 'Max Results',
				name: 'maxResults',
				type: 'number',
				default: 50,
				typeOptions: { minValue: 1, maxValue: 500 },
				description: 'Maximum number of leads to find (1–500)',
				displayOptions: {
					show: { operation: ['find'] },
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
				const searchQuery = (this.getNodeParameter('searchQuery', i, '') as string).trim();
				const jobTitle = (this.getNodeParameter('jobTitle', i, '') as string).trim();
				const company = (this.getNodeParameter('company', i, '') as string).trim();
				const industry = (this.getNodeParameter('industry', i, '') as string).trim();
				const location = (this.getNodeParameter('location', i, '') as string).trim();
				const maxResults = this.getNodeParameter('maxResults', i, 50) as number;

				const additionalFields = this.getNodeParameter(
					'additionalFields',
					i,
					{},
				) as IDataObject;

				const input: IDataObject = {
					searchQuery,
					jobTitle,
					company,
					industry,
					location,
					maxResults,
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
