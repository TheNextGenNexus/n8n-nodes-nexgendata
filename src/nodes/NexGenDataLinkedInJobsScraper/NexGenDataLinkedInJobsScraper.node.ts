import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
} from 'n8n-workflow';

import { runActorSync } from '../../utils/apifyClient';

/**
 * Wraps the NexGenData "LinkedIn Jobs Scraper" Apify actor
 * (`64s5SdVsr1eb5xyit`).
 *
 * The actor runs a LinkedIn-public job search for a keyword/location pair
 * and returns the listings — title, company, location, posted-at, and
 * (optionally) the full description body. It's designed for recruiter and
 * sales-intel use cases (hiring signal as a lead-gen proxy).
 *
 * Default actor timeout is 300 s, well inside the `run-sync` cap, so this
 * node uses the synchronous endpoint.
 */
const ACTOR_ID = '64s5SdVsr1eb5xyit';

export class NexGenDataLinkedInJobsScraper implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'NexGenData LinkedIn Jobs Scraper',
		name: 'nexGenDataLinkedInJobsScraper',
		icon: 'file:nexGenDataLinkedInJobsScraper.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description:
			'Scrape public LinkedIn job postings for keyword + location — recruiter and sales intel',
		defaults: {
			name: 'NexGenData LinkedIn Jobs Scraper',
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
						description: 'Search LinkedIn for job postings',
						action: 'Search linkedin for job postings',
					},
				],
				default: 'search',
			},
			{
				displayName: 'Keywords',
				name: 'keywords',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'python developer',
				description: "Job search keywords (e.g. 'python developer', 'data scientist')",
				displayOptions: {
					show: { operation: ['search'] },
				},
			},
			{
				displayName: 'Location',
				name: 'location',
				type: 'string',
				default: '',
				placeholder: 'United States',
				description: "Job location filter (e.g. 'New York', 'Remote', 'United States'). Leave empty for all locations.",
				displayOptions: {
					show: { operation: ['search'] },
				},
			},
			{
				displayName: 'Max Jobs',
				name: 'maxJobs',
				type: 'number',
				default: 50,
				typeOptions: { minValue: 0 },
				description: 'Maximum number of job listings to scrape. Set to 0 for all available.',
				displayOptions: {
					show: { operation: ['search'] },
				},
			},
			{
				displayName: 'Job Type',
				name: 'jobType',
				type: 'options',
				options: [
					{ name: 'Any', value: '' },
					{ name: 'Contract', value: 'contract' },
					{ name: 'Full-Time', value: 'full-time' },
					{ name: 'Internship', value: 'internship' },
					{ name: 'Part-Time', value: 'part-time' },
				],
				default: '',
				description: 'Filter by job type. "Any" returns all types.',
				displayOptions: {
					show: { operation: ['search'] },
				},
			},
			{
				displayName: 'Fetch Full Descriptions',
				name: 'fetchDescriptions',
				type: 'boolean',
				default: true,
				description:
					'Whether to fetch the full job description for each listing. Slower but much more complete.',
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
				const keywords = (this.getNodeParameter('keywords', i, '') as string).trim();
				const location = (this.getNodeParameter('location', i, '') as string).trim();
				const maxJobs = this.getNodeParameter('maxJobs', i, 50) as number;
				const jobType = this.getNodeParameter('jobType', i, '') as string;
				const fetchDescriptions = this.getNodeParameter(
					'fetchDescriptions',
					i,
					true,
				) as boolean;

				const additionalFields = this.getNodeParameter(
					'additionalFields',
					i,
					{},
				) as IDataObject;

				const input: IDataObject = {
					keywords,
					location,
					maxJobs,
					jobType,
					fetchDescriptions,
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
