import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
} from 'n8n-workflow';

import { runActorSync } from '../../utils/apifyClient';

/**
 * Wraps the NexGenData "Email Verification Tool — Deliverability Checker"
 * Apify actor (`DTgFaAOv0V6JgWdLK`).
 *
 * Verifies email deliverability: syntax, MX-record lookup, SMTP RCPT probe,
 * catch-all detection, disposable/temp-mail flag, and role-account flag.
 * A pay-per-use alternative to ZeroBounce / NeverBounce / Kickbox. This is
 * the verification step at the end of a find -> enrich -> verify lead pipeline.
 *
 * Input mirrors the actor: either `singleEmail` (one address) or `emails`
 * (newline/comma-separated bulk list).
 */
const ACTOR_ID = 'DTgFaAOv0V6JgWdLK';

export class NexGenDataEmailVerification implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'NexGenData Email Verification',
		name: 'nexGenDataEmailVerification',
		icon: 'file:nexGenDataEmailVerification.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["mode"]}}',
		description:
			'Verify email deliverability — SMTP, MX, catch-all, disposable & role-account checks (ZeroBounce/NeverBounce alternative)',
		defaults: {
			name: 'NexGenData Email Verification',
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
						description: 'Verify one email address per incoming item',
					},
					{
						name: 'Bulk',
						value: 'bulk',
						description: 'Verify many email addresses in a single actor run',
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
				description: 'A single email address to verify',
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
				description: 'Email addresses to verify. One per line, or comma-separated.',
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
