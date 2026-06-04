import {
	IExecuteFunctions,
	IHttpRequestOptions,
	IDataObject,
	JsonObject,
	NodeApiError,
	NodeOperationError,
	sleep,
} from 'n8n-workflow';

const APIFY_API_BASE = 'https://api.apify.com/v2';

/**
 * Default per-run timeout for sync invocations. Apify's `run-sync-*`
 * endpoints have a hard 5-minute cap (300 s); we default to 4 minutes to
 * leave headroom for network round-trip.
 */
const DEFAULT_SYNC_TIMEOUT_SECS = 240;

export interface RunSyncOptions {
	/** Apify actor ID (e.g. 'oU37pA5Kj63UeUUFl'). */
	actorId: string;
	/** Actor input JSON, posted as the request body. */
	input: IDataObject;
	/** Optional memory in MB. Apify default is the actor's configured default. */
	memoryMbytes?: number;
	/** Optional override of the per-run timeout in seconds. */
	timeoutSecs?: number;
}

/**
 * Read the user's Apify token off the shared NexGenData credential. We
 * fetch it here (rather than relying on the generic credential injector) so
 * that we have full control over the URL — `run-sync-get-dataset-items`
 * requires `?token=...` in the query string, not a Bearer header.
 */
async function getApifyToken(context: IExecuteFunctions): Promise<string> {
	const creds = await context.getCredentials('nexGenDataApi');
	const token = (creds?.apifyToken as string | undefined)?.trim();
	if (!token) {
		throw new NodeOperationError(
			context.getNode(),
			'No Apify API token configured. Set one in the NexGenData API credential.',
		);
	}
	return token;
}

/**
 * Invoke an Apify actor via the `run-sync-get-dataset-items` endpoint and
 * return the dataset items as a JSON array.
 *
 * This is the right tool for actors that finish quickly (under ~4 minutes).
 * For long-running actors, switch to `startActorRun` + polling instead.
 */
export async function runActorSync(
	context: IExecuteFunctions,
	opts: RunSyncOptions,
): Promise<IDataObject[]> {
	const token = await getApifyToken(context);

	const qs: IDataObject = {
		token,
		timeout: opts.timeoutSecs ?? DEFAULT_SYNC_TIMEOUT_SECS,
		format: 'json',
		clean: true,
	};
	if (opts.memoryMbytes) {
		qs.memory = opts.memoryMbytes;
	}

	const requestOptions: IHttpRequestOptions = {
		method: 'POST',
		url: `${APIFY_API_BASE}/acts/${opts.actorId}/run-sync-get-dataset-items`,
		qs,
		body: opts.input ?? {},
		json: true,
		// Give the HTTP client a little extra over the Apify-side timeout so
		// we surface Apify's own error rather than a local socket timeout.
		timeout: ((opts.timeoutSecs ?? DEFAULT_SYNC_TIMEOUT_SECS) + 30) * 1000,
	};

	try {
		const response = await context.helpers.httpRequest(requestOptions);
		// Apify returns the dataset as a top-level array when `format=json`.
		if (Array.isArray(response)) {
			return response as IDataObject[];
		}
		// Defensive — some actors may emit a single object.
		if (response && typeof response === 'object') {
			return [response as IDataObject];
		}
		return [];
	} catch (error) {
		throw new NodeApiError(context.getNode(), error as JsonObject, {
			message: `Apify actor ${opts.actorId} failed`,
		});
	}
}

/**
 * Start an async actor run and return the run metadata. Use this for
 * actors that may exceed the 5-minute sync cap.
 */
export async function startActorRun(
	context: IExecuteFunctions,
	opts: RunSyncOptions,
): Promise<IDataObject> {
	const token = await getApifyToken(context);
	const qs: IDataObject = { token };
	if (opts.memoryMbytes) qs.memory = opts.memoryMbytes;
	if (opts.timeoutSecs) qs.timeout = opts.timeoutSecs;

	const response = await context.helpers.httpRequest({
		method: 'POST',
		url: `${APIFY_API_BASE}/acts/${opts.actorId}/runs`,
		qs,
		body: opts.input ?? {},
		json: true,
	});
	return (response?.data ?? response) as IDataObject;
}

/**
 * Poll an Apify run until it reaches a terminal state, returning the final
 * run record. Times out after `maxWaitSecs`.
 */
export async function waitForRunCompletion(
	context: IExecuteFunctions,
	runId: string,
	maxWaitSecs = 600,
	pollIntervalMs = 2000,
): Promise<IDataObject> {
	const token = await getApifyToken(context);
	const deadline = Date.now() + maxWaitSecs * 1000;

	while (Date.now() < deadline) {
		const res = await context.helpers.httpRequest({
			method: 'GET',
			url: `${APIFY_API_BASE}/actor-runs/${runId}`,
			qs: { token },
			json: true,
		});
		const data = (res?.data ?? res) as IDataObject;
		const status = data?.status as string | undefined;
		if (
			status === 'SUCCEEDED' ||
			status === 'FAILED' ||
			status === 'ABORTED' ||
			status === 'TIMED-OUT'
		) {
			return data;
		}
		await sleep(pollIntervalMs);
	}
	throw new NodeOperationError(
		context.getNode(),
		`Apify run ${runId} did not finish within ${maxWaitSecs}s`,
	);
}

/**
 * Fetch all dataset items for a given dataset ID.
 */
export async function getDatasetItems(
	context: IExecuteFunctions,
	datasetId: string,
): Promise<IDataObject[]> {
	const token = await getApifyToken(context);
	const res = await context.helpers.httpRequest({
		method: 'GET',
		url: `${APIFY_API_BASE}/datasets/${datasetId}/items`,
		qs: { token, format: 'json', clean: true },
		json: true,
	});
	if (Array.isArray(res)) return res as IDataObject[];
	if (res && typeof res === 'object') return [res as IDataObject];
	return [];
}
