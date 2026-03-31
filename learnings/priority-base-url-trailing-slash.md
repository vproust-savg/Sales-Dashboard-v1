# Priority Base URL — Trailing Slash Trap

## The Bug
`buildODataUrl()` joined `${baseUrl}/${entity}`, but `PRIORITY_BASE_URL` from `.env` already ends with `/`. This produced a double-slash URL like:
```
https://us.priority-connect.online/odata/Priority/tabc8cae.ini/a012226//ORDERS
```
Priority's OData parser returned 404 for this URL.

## The Fix
Strip trailing slash before joining:
```typescript
const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
let url = `${base}/${entity}`;
```

## Sister Project Pattern
The Priority Reports project uses `${config.baseUrl}${entity}` (no separator), relying on the trailing slash already being present. Our approach is more defensive — works with or without trailing slash.

## Detection
If the dashboard shows `PRIORITY_404` but the health endpoint works, check the constructed URL for double slashes.
