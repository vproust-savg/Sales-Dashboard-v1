# Priority API: Two Different Error Response Formats

## The Problem

Priority ERP returns errors in two different formats depending on the error type. Your error parser must handle both.

## Format 1: OData JSON Error

```json
{
  "odata.error": {
    "code": "",
    "message": {
      "lang": "en-US",
      "value": "The entity 'INVALID' does not exist."
    }
  }
}
```

Returned for: invalid entity names, bad query syntax, field not found.

## Format 2: Plain Text Error

```
Request timed out after 180000ms
```

Returned for: timeouts, rate limit exceeded (HTTP 429), server errors (HTTP 500/503).

## The Fix

Check `Content-Type` header first. If `application/json`, parse as JSON and extract `odata.error.message.value`. Otherwise, read the response body as plain text.

## Discovered

2026-03-30 — during spec research (Section 17.7)
