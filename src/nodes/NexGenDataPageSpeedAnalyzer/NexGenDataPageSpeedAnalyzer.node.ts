import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
} from 'n8n-workflow';

import { runActorSync } from '../../utils/apifyClient';

/**
 * Wraps the NexGenData "Page Speed Analyzer" Apify actor (`dkywu9gtcLuG7Q1s4`).
 *
 * The actor wraps Google PageSpeed Insights / Lighthouse so you can run
 * audits at scale without burning through the public 25k/day quota. Each
 * actor invocation analyses a single URL, so we iterate the upstream items
 * one at a time — this mirrors how PSI itself works (one URL per call) and
 * keeps results trivially pairable back to the input item.
 *
 * Audits typically finish in 10–60 s per URL, well inside the 5-minute
 * `run-sync` cap.
 */
const ACTOR_ID = 'dkywu9gtcLuG7Q1s4';

export class NexGenDataPageSpeedAnalyzer implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'NexGenData Page Speed Analyzer',
		name: 'nexGenDataPageSpeedAnalyzer',
		icon: 'file:nexGenDataPageSpeedAnalyzer.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description:
			'Run Google Lighthouse audits — performance scores, Core Web Vitals, SEO — on any URL',
		defaults: {
			name: 'NexGenData Page Speed Analyzer',
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
						name: 'Analyze',
						value: 'analyze',
						description: 'Run a Lighthouse audit on a single URL',
						action: 'Run a lighthouse audit on a single URL',
					},
				],
				default: 'analyze',
			},
			{
				displayName: 'URL',
				name: 'url',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'https://www.example.com',
				description: 'Full URL to audit (e.g. https://example.com or https://stripe.com/pricing)',
				displayOptions: {
					show: { operation: ['analyze'] },
				},
			},
			{
				displayName: 'Strategy',
				name: 'strategy',
				type: 'options',
				options: [
					{ name: 'Mobile', value: 'mobile' },
					{ name: 'Desktop', value: 'desktop' },
				],
				default: 'mobile',
				description:
					'Whether to audit on a mobile (slower 4G + low-end CPU) or desktop hardware profile',
				displayOptions: {
					show: { operation: ['analyze'] },
				},
			},
			{
				displayName: 'Categories',
				name: 'categories',
				type: 'string',
				default: 'PERFORMANCE',
				placeholder: 'PERFORMANCE,SEO,ACCESSIBILITY',
				description:
					'Comma-separated Lighthouse categories to audit. Options: PERFORMANCE, ACCESSIBILITY, BEST_PRACTICES, SEO, PWA. Defaults to PERFORMANCE only (faster).',
				displayOptions: {
					show: { operation: ['analyze'] },
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
						displayName: 'Google PageSpeed API Key',
						name: 'googleApiKey',
						type: 'string',
						typeOptions: { password: true },
						default: '',
						description:
							'Your own Google API key for the PageSpeed Insights API. Without one, runs share a tiny anonymous quota and frequently rate-limit. Free tier: 25,000 queries/day at https://developers.google.com/speed/docs/insights/v5/get-started.',
					},
					{
						displayName: 'Actor Memory (MB)',
						name: 'memoryMbytes',
						type: 'number',
						default: 1024,
						description:
							'Memory in MB to allocate to the actor run. 1024 MB matches the actor default.',
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
				const url = (this.getNodeParameter('url', i, '') as string).trim();
				const strategy = this.getNodeParameter('strategy', i, 'mobile') as string;
				const categories = (this.getNodeParameter('categories', i, 'PERFORMANCE') as string).trim();

				const additionalFields = this.getNodeParameter(
					'additionalFields',
					i,
					{},
				) as IDataObject;

				const input: IDataObject = {
					url,
					strategy,
					categories,
				};
				if (additionalFields.googleApiKey) {
					input.googleApiKey = additionalFields.googleApiKey;
				}

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
