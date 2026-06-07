import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

/**
 * NexGenData API credentials.
 *
 * All NexGenData nodes are thin wrappers around Apify actors maintained by
 * the NexGenData fleet. Authentication therefore re-uses the user's Apify
 * Personal API token. Tokens are obtained from
 * https://console.apify.com/account/integrations and are passed to Apify as a
 * `token` query parameter on every API call.
 *
 * We deliberately keep this as a single shared credential type rather than
 * a per-node credential so that users only configure it once and every
 * NexGenData node picks it up automatically.
 */
export class NexGenDataApi implements ICredentialType {
	name = 'nexGenDataApi';

	displayName = 'NexGenData API';

	// eslint-disable-next-line n8n-nodes-base/cred-class-field-documentation-url-miscased
	documentationUrl = 'https://apify.com/nexgendata';

	properties: INodeProperties[] = [
		{
			displayName: 'Apify API Token',
			name: 'apifyToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Your Apify Personal API token. Create one at https://console.apify.com/account/integrations. NexGenData nodes use this token to invoke the underlying Apify actors on your behalf - runs and storage are billed to your Apify account.',
		},
	];

	/**
	 * Apify accepts the token either as a `?token=...` query parameter (used by
	 * actor run endpoints) or as a `Bearer` header. We attach both so that
	 * generic credential tests and authenticated `httpRequest` calls work
	 * out of the box.
	 */
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			qs: {
				token: '={{$credentials.apifyToken}}',
			},
			headers: {
				Authorization: '=Bearer {{$credentials.apifyToken}}',
			},
		},
	};

	/**
	 * Hits the lightweight `users/me` endpoint to validate the token without
	 * incurring actor-run costs.
	 */
	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.apify.com/v2',
			url: '/users/me',
			method: 'GET',
		},
	};
}
