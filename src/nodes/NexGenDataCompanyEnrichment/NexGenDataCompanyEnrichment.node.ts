import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
} from 'n8n-workflow';

import { runActorSync } from '../../utils/apifyClient';

/**
 * Wraps the NexGenData "Company Enrichment" Apify actor (`0EC4liiWbpeRAV7qq`).
 *
 * The actor enriches a list of company names (or domains) with website,
 * emails, social profiles, description, employee count, and industry. The
 * actor exposes three boolean toggles for which enrichment passes to run,
 * which we surface here so the user can pay only for what they need.
 *
 * Implementation note: the actor accepts a number of alias field names for
 * the input list (`companies`, `companyNames`, `domains`, `urls`,
 * `targetCompanies`, `company`, `domain`). We use the canonical `companies`
 * field here for clarity.
 */
const ACTOR_ID = '0EC4liiWbpeRAV7qq';

export class NexGenDataCompanyEnrichment implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'NexGenData Company Enrichment',
		name: 'nexGenDataCompanyEnrichment',
		icon: 'file:nexGenDataCompanyEnrichment.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description:
			'Enrich a company name or domain with website, emails, socials, industry, and employee count',
		defaults: {
			name: 'NexGenData Company Enrichment',
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
						description: 'Enrich one or more company names with public data',
						action: 'Enrich one or more company names with public data',
					},
				],
				default: 'enrich',
			},
			{
				displayName: 'Companies',
				name: 'companies',
				type: 'string',
				typeOptions: {
					multipleValues: true,
					multipleValueButtonText: 'Add Company',
				},
				default: [],
				required: true,
				placeholder: 'Stripe',
				description: 'Company names or domains to enrich (e.g. Stripe, apple.com, "Acme Corp")',
				displayOptions: {
					show: { operation: ['enrich'] },
				},
			},
			{
				displayName: 'Enrich Emails',
				name: 'enrichEmails',
				type: 'boolean',
				default: true,
				description: 'Whether to generate common email patterns and verify with DNS MX records',
				displayOptions: {
					show: { operation: ['enrich'] },
				},
			},
			{
				displayName: 'Enrich Social Profiles',
				name: 'enrichSocials',
				type: 'boolean',
				default: true,
				description: 'Whether to search for social media profiles (LinkedIn, Twitter, GitHub)',
				displayOptions: {
					show: { operation: ['enrich'] },
				},
			},
			{
				displayName: 'Enrich Description',
				name: 'enrichDescription',
				type: 'boolean',
				default: true,
				description:
					'Whether to fetch company description, industry, and employee count estimates',
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
						default: 2048,
						description:
							'Memory in MB to allocate to the actor run. Enrichment is I/O-heavy; 2048 MB is a sane default.',
					},
					{
						displayName: 'Run Timeout (Seconds)',
						name: 'timeoutSecs',
						type: 'number',
						default: 240,
						description: 'Maximum time to wait for the actor run',
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
				const rawCompanies = this.getNodeParameter('companies', i, []) as string[];
				const companies = rawCompanies
					.map((c) => c?.trim())
					.filter((c): c is string => !!c);

				const enrichEmails = this.getNodeParameter('enrichEmails', i, true) as boolean;
				const enrichSocials = this.getNodeParameter('enrichSocials', i, true) as boolean;
				const enrichDescription = this.getNodeParameter(
					'enrichDescription',
					i,
					true,
				) as boolean;

				const additionalFields = this.getNodeParameter(
					'additionalFields',
					i,
					{},
				) as IDataObject;

				const input: IDataObject = {
					companies,
					enrichEmails,
					enrichSocials,
					enrichDescription,
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
