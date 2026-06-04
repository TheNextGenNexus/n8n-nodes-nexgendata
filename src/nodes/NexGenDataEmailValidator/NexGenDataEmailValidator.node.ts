import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
} from 'n8n-workflow';

import { runActorSync } from '../../utils/apifyClient';

/**
 * Wraps the NexGenData "Email Validator" Apify actor (`Sp6MNdZNfA4qgQeS9`).
 *
 * The actor accepts either a bulk newline/comma-separated string of emails
 * (`emails`) or a single email (`singleEmail`). We expose a single-mode
 * options selector and route the value into the right field — that mirrors
 * how most n8n users will want to use this: either "validate this one"
 * against an upstream item, or "validate this list" as a one-shot.
 */
const ACTOR_ID = 'Sp6MNdZNfA4qgQeS9';

export class NexGenDataEmailValidator implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'NexGenData Email Validator',
		name: 'nexGenDataEmailValidator',
		icon: 'file:nexGenDataEmailValidator.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["mode"]}}',
		description: 'Validate one or many email addresses (syntax, MX, deliverability)',
		defaults: {
			name: 'NexGenData Email Validator',
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
				displayName: 'Mode',
				name: 'mode',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Single Email',
						value: 'single',
						description: 'Validate one email address per incoming item',
					},
					{
						name: 'Bulk',
						value: 'bulk',
						description: 'Validate many email addresses in a single actor run',
					},
				],
				default: 'single',
			},
			{
				displayName: 'Email',
				name: 'singleEmail',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'user@example.com',
				description: 'A single email address to validate',
				displayOptions: {
					show: { mode: ['single'] },
				},
			},
			{
				displayName: 'Emails',
				name: 'emails',
				type: 'string',
				typeOptions: { rows: 5 },
				default: '',
				required: true,
				placeholder: 'one@example.com\ntwo@example.com',
				description: 'Email addresses to validate. One per line, or comma-separated.',
				displayOptions: {
					show: { mode: ['bulk'] },
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
						default: 512,
						description: 'Memory in MB to allocate to the actor run',
					},
					{
						displayName: 'Run Timeout (Seconds)',
						name: 'timeoutSecs',
						type: 'number',
						default: 120,
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
				const mode = this.getNodeParameter('mode', i) as 'single' | 'bulk';

				const input: IDataObject = {};
				if (mode === 'single') {
					input.singleEmail = (this.getNodeParameter('singleEmail', i, '') as string).trim();
				} else {
					input.emails = (this.getNodeParameter('emails', i, '') as string).trim();
				}

				const additionalFields = this.getNodeParameter(
					'additionalFields',
					i,
					{},
				) as IDataObject;

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
