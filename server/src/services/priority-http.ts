// FILE: server/src/services/priority-http.ts
// PURPOSE: Priority ERP OData URL builder, error parser, and API error class
// USED BY: server/src/services/priority-client.ts
// EXPORTS: PriorityApiError, buildODataUrl, extractPriorityError

interface ODataUrlOptions {
  select: string;
  filter?: string;
  top?: number;
  skip?: number;
  orderby?: string;
  expand?: string;
}

export class PriorityApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public retryable: boolean,
  ) {
    super(message);
    this.name = 'PriorityApiError';
  }
}

/** Build OData URL — spec Section 17.8 (URL encoding trap) */
export function buildODataUrl(baseUrl: string, entity: string, opts: ODataUrlOptions): string {
  const params: string[] = [];
  if (opts.select) params.push(`$select=${opts.select}`);
  if (opts.filter) params.push(`$filter=${encodeURIComponent(opts.filter)}`);
  if (opts.top !== undefined) params.push(`$top=${opts.top}`);
  if (opts.skip !== undefined) params.push(`$skip=${opts.skip}`);
  if (opts.orderby) params.push(`$orderby=${encodeURIComponent(opts.orderby)}`);

  // WHY: baseUrl may or may not end with '/'. Strip trailing slash to avoid double-slash
  // (e.g., "…/a012226//ORDERS") which causes Priority to return 404.
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  let url = `${base}/${entity}`;
  if (params.length > 0) url += '?' + params.join('&');

  // WHY: $expand contains nested OData syntax with ( ) $ = characters.
  // URL.searchParams.set() would form-encode these, breaking Priority's parser.
  // Append raw instead — these chars are valid per RFC 3986.
  if (opts.expand) {
    url += (params.length > 0 ? '&' : '?') + `$expand=${opts.expand}`;
  }

  return url;
}

/** Parse both Priority error formats — spec Section 17.7
 *  Format 1: { "odata.error": { "message": { "value": "..." } } }
 *  Format 2: { "FORM": { "InterfaceErrors": { "text": "..." } } } */
export function extractPriorityError(body: unknown, response: Response): string {
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    // WHY: Key is "odata.error" (dot in key name), not obj.error
    const odataError = obj['odata.error'];
    if (odataError && typeof odataError === 'object') {
      const msg = (odataError as Record<string, unknown>).message;
      if (msg && typeof msg === 'object') {
        return (msg as Record<string, string>).value ?? `HTTP ${response.status}`;
      }
      if (typeof msg === 'string') return msg;
    }
    // Format 2: Priority InterfaceErrors
    if (obj.FORM && typeof obj.FORM === 'object') {
      const form = obj.FORM as Record<string, unknown>;
      if (form.InterfaceErrors && typeof form.InterfaceErrors === 'object') {
        return (form.InterfaceErrors as Record<string, string>).text ?? `HTTP ${response.status}`;
      }
    }
  }
  return `HTTP ${response.status}: ${response.statusText}`;
}
