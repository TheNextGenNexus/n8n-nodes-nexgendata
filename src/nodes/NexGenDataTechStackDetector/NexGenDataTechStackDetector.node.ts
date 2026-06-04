import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
} from 'n8n-workflow';

import { runActorSync } from '../../utils/apifyClient';

/**
 * Wraps the NexGenData "Wappalyzer Replacement / Tech Stack Detector" Apify
 * actor (`50jWiLblao5BU7e5c`).
 *
 * The actor takes a list of URLs and runs OSS Wappalyzer fingerprint rules
 * across the response headers + HTML + script tags to detect 6000+
 * technologies across 100+ categories. Detection is HTTP-only (no browser),
 * so it's fast — typically a few seconds per URL even with a longer list.
 * That fits well within the 5-minute `run-sync` cap.
 *
 * Implementation note: the actor accepts the URL list under several alias
 * field names (`urls`, `startUrls`, `domains`, `websites`, `targetUrls`).
 * We use `urls` as the canonical field. The optional `categories_filter`
 * lets users restrict detection to e.g. only `Ecommerce` or `Analytics`.
 */
const ACTOR_ID = '50jWiLblao5BU7e5c';

export class NexGenDataTechStackDetector implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'NexGenData Tech Stack Detector',
		name: 'nexGenDataTechStackDetector',
		icon: 'file:nexGenDataTechStackDetector.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description:
			'Detect web technologies (CMS, analytics, frameworks, CDN, etc.) on any URL — Wappalyzer-style',
		defaults: {
			name: 'NexGenData Tech Stack Detector',
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
						name: 'Detect',
						value: 'detect',
						description: 'Detect tech stack on one or more URLs',
						action: 'Detect tech stack on one or more urls',
					},
				],
				default: 'detect',
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
					'Website URLs to analyze. Bare hostnames work too (e.g. stripe.com) — the scheme is auto-added.',
				displayOptions: {
					show: { operation: ['detect'] },
				},
			},
			{
				displayName: 'Category Filter',
				name: 'categoriesFilter',
				type: 'string',
				typeOptions: {
					multipleValues: true,
					multipleValueButtonText: 'Add Category',
				},
				default: [],
				placeholder: 'CMS',
				description:
					'Optional — restrict detection to specific categories (e.g. CMS, Analytics, CDN, Ecommerce, JavaScript Frameworks, Payment Processors). Leave empty to return all categories.',
				displayOptions: {
					show: { operation: ['detect'] },
				},
			},
			{
				displayName: 'Include Confidence Scores',
				name: 'includeConfidence',
				type: 'boolean',
				default: true,
				description:
					'Whether each detected technology should include a 0–100 confidence score. Header matches score 100, script-src 90, HTML body 85, implied-only 60.',
				displayOptions: {
					show: { operation: ['detect'] },
				},
			},
			{
				displayName: 'Extract Version Numbers',
				name: 'includeVersions',
				type: 'boolean',
				default: true,
				description:
					'Whether to attempt to parse semantic version numbers from matched headers, script URLs, and HTML',
				displayOptions: {
					show: { operation: ['detect'] },
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
						displayName: 'HTTP Timeout (Seconds)',
						name: 'timeoutSeconds',
						type: 'number',
						default: 15,
						typeOptions: { minValue: 3, maxValue: 60 },
						description: 'Per-URL HTTP request timeout (3–60 seconds)',
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
				const rawUrls = this.getNodeParameter('urls', i, []) as string[];
				const urls = rawUrls.map((u) => u?.trim()).filter((u): u is string => !!u);

				const rawCats = this.getNodeParameter('categoriesFilter', i, []) as string[];
				const categoriesFilter = rawCats
					.map((c) => c?.trim())
					.filter((c): c is string => !!c);

				const includeConfidence = this.getNodeParameter(
					'includeConfidence',
					i,
					true,
				) as boolean;
				const includeVersions = this.getNodeParameter(
					'includeVersions',
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
					include_confidence: includeConfidence,
					include_versions: includeVersions,
				};
				if (categoriesFilter.length > 0) {
					input.categories_filter = categoriesFilter;
				}
				if (additionalFields.timeoutSeconds) {
					input.timeout_seconds = additionalFields.timeoutSeconds;
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
