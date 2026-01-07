# Mobile App Integration Guide

This guide covers integrating with The Product Report API from iOS/Android mobile apps.

## Base URL

```
Production: https://theproductreport.org/api
```

## Authentication

### Device Fingerprint (Anonymous Users)

Most mobile endpoints support anonymous access via device fingerprint:

```http
POST /api/scanner/lookup
x-fingerprint: <device-fingerprint-hash>
Content-Type: application/json
```

The fingerprint should be a stable identifier for the device (e.g., iOS `identifierForVendor`).

### JWT Token (Registered Users)

For authenticated endpoints:

```http
GET /api/my-contributor-stats
Authorization: Bearer <jwt-token>
```

## Core Endpoints

### Barcode Scanning

#### Lookup Product

```http
POST /api/scanner/lookup
Content-Type: application/json
x-fingerprint: <fingerprint>

{
  "barcode": "5000328657950",
  "fingerprintHash": "<fingerprint>",
  "saveIfFound": false
}
```

**Response (Found):**
```json
{
  "found": true,
  "product": {
    "id": 123,
    "barcode": "5000328657950",
    "name": "Product Name",
    "brand": "Brand Name",
    "description": "...",
    "imageUrl": "https://...",
    "ingredients": ["Ingredient 1", "Ingredient 2"],
    "categories": ["Category 1"],
    "source": "local",
    "confidence": 0.95
  }
}
```

**Response (Not Found):**
```json
{
  "found": false,
  "barcode": "5000328657950",
  "message": "Product not found in database",
  "suggestion": "Submit product photos to help build our database",
  "voteStats": {
    "totalVotes": 5,
    "requestedBy": ["user1", "user2"]
  }
}
```

#### Submit Product Photos

```http
POST /api/scanner/submit
Content-Type: multipart/form-data
x-fingerprint: <fingerprint>

barcode: 5000328657950
frontPhoto: <file>
backPhoto: <file>
ingredientsPhoto: <file>
```

**OCR Processing:**
Back label photos are processed using **Gemini 1.5 Flash** for ingredient extraction. The AI analyzes the ingredients panel and extracts:
- Full ingredient list
- Nutritional information
- Allergen warnings
- Product claims and certifications

### Contributor Profile

#### Get Public Profile

```http
GET /api/contributor-profile/{slug}
```

**Response:**
```json
{
  "slug": "eco-warrior-42",
  "displayName": "EcoWarrior",
  "bio": "Passionate about clean products",
  "totalScans": 150,
  "totalSubmissions": 25,
  "badges": ["Early Adopter", "Verified Contributor"],
  "rank": "Gold",
  "joinedAt": "2024-01-15T00:00:00Z"
}
```

#### Get My Stats (Authenticated)

```http
GET /api/my-contributor-stats
x-fingerprint: <fingerprint>
```

**Response:**
```json
{
  "totalScans": 150,
  "totalSubmissions": 25,
  "rank": "Gold",
  "points": 2500,
  "badges": ["Early Adopter", "Verified Contributor"],
  "recentActivity": [...]
}
```

#### Update Profile

```http
POST /api/contributor-profile/update
Content-Type: application/json
x-fingerprint: <fingerprint>

{
  "displayName": "EcoWarrior",
  "bio": "Updated bio"
}
```

#### Register Contribution

```http
POST /api/contributor-profile/register-contribution
Content-Type: application/json
x-fingerprint: <fingerprint>

{
  "type": "scan",
  "barcode": "5000328657950",
  "metadata": {}
}
```

**Response:**
```json
{
  "success": true,
  "pointsEarned": 10,
  "newTotal": 2510
}
```

### Product Report

#### Get Full Product Report

```http
GET /api/product-report/{barcode}
```

**Response:**
```json
{
  "product": {
    "id": 123,
    "name": "Product Name",
    "barcode": "5000328657950"
  },
  "scores": {
    "overall": 78,
    "health": 82,
    "environment": 71,
    "social": 80
  },
  "ingredients": [
    {
      "name": "Ingredient 1",
      "concern": "low",
      "notes": "Generally recognized as safe"
    }
  ],
  "alternatives": [
    {
      "id": 456,
      "name": "Better Alternative",
      "overallScore": 92
    }
  ]
}
```

### Smart Scan (AI Analysis)

```http
POST /api/smart-scan
Content-Type: multipart/form-data
x-fingerprint: <fingerprint>

photo: <file>
```

**Response:**
```json
{
  "success": true,
  "analysis": {
    "productName": "Detected Product",
    "ingredients": ["Ingredient 1", "Ingredient 2"],
    "concerns": [
      {
        "ingredient": "Ingredient 2",
        "level": "moderate",
        "reason": "May cause sensitivity"
      }
    ],
    "score": 75
  }
}
```

### Feedback

```http
POST /api/feedback
Content-Type: application/json
x-fingerprint: <fingerprint>

{
  "message": "Feature request: Add comparison mode",
  "type": "feature_request",
  "platform": "ios",
  "appVersion": "2.1.0"
}
```

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| Scanner Lookup | 30/min |
| Photo Upload | 10/min |
| Smart Scan | 5/min |
| Profile Update | 5/min |
| Search | 60/min |
| Feedback | 5/min |

Rate limit headers:
```
X-RateLimit-Remaining: 28
X-RateLimit-Reset: 1699999999
Retry-After: 60
```

## Error Handling

### Standard Error Response

```json
{
  "error": "Error description",
  "code": "ERROR_CODE",
  "message": "User-friendly message"
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_BARCODE` | 400 | Barcode format invalid |
| `PRODUCT_NOT_FOUND` | 404 | Product not in database |
| `RATE_LIMITED` | 429 | Too many requests |
| `AUTH_REQUIRED` | 401 | Authentication needed |
| `UPLOAD_FAILED` | 500 | File upload error |

## Device Fingerprint Registration

### Register Device

Register a new device with optional referral code for attribution tracking.

```http
POST /api/fingerprint/register
Content-Type: application/json

{
  "fingerprintHash": "<device-fingerprint-hash>",
  "referralCode": "ABC123",
  "platform": "ios",
  "appVersion": "2.1.0",
  "gpcEnabled": false
}
```

**Request Fields:**
- `fingerprintHash` (required) - Stable device identifier
- `referralCode` (optional) - Referral code for attribution
- `platform` (required) - "ios" or "android"
- `appVersion` (required) - App version string
- `gpcEnabled` (optional) - Whether Global Privacy Control is enabled on the device

**Response:**
```json
{
  "success": true,
  "isNew": true,
  "referralApplied": true,
  "deviceId": "dev_abc123"
}
```

### Check Device Status

```http
GET /api/fingerprint/check
x-fingerprint: <fingerprint>
```

**Response:**
```json
{
  "registered": true,
  "createdAt": "2024-01-15T00:00:00Z",
  "referralCode": "ABC123",
  "gpcEnabled": false,
  "stats": {
    "totalScans": 150,
    "totalSubmissions": 25
  }
}
```

**Global Privacy Control (GPC) Support:**
The API respects the GPC signal. When `gpcEnabled: true` is sent during registration or detected via the `Sec-GPC` header:
- Analytics data collection is minimized
- Device data is not shared with third parties
- Personalization features may be limited

## Push Notifications

### Register Token

```http
POST /api/push-tokens/register
Content-Type: application/json
x-fingerprint: <fingerprint>

{
  "token": "<apns-or-fcm-token>",
  "platform": "ios",
  "deviceId": "<device-id>"
}
```

### Subscribe to Topics

```http
POST /api/push-tokens/subscribe
Content-Type: application/json
x-fingerprint: <fingerprint>

{
  "topics": ["product_updates", "weekly_digest", "badge_alerts"]
}
```

**Response:**
```json
{
  "success": true,
  "subscribedTopics": ["product_updates", "weekly_digest", "badge_alerts"]
}
```

### Unsubscribe from Topics

```http
POST /api/push-tokens/unsubscribe
Content-Type: application/json
x-fingerprint: <fingerprint>

{
  "topics": ["weekly_digest"]
}
```

**Response:**
```json
{
  "success": true,
  "remainingTopics": ["product_updates", "badge_alerts"]
}
```

### Notification Types

- `product_retested` - Product score updated
- `badge_unlocked` - New badge earned
- `trending_alert` - Product trending in your area
- `weekly_digest` - Weekly summary

## Best Practices

1. **Cache responses** - Product data rarely changes, cache for 1 hour
2. **Batch lookups** - If scanning multiple products, batch them
3. **Handle offline** - Queue submissions when offline
4. **Compress images** - Resize photos before uploading (max 1024px)
5. **Retry with backoff** - Implement exponential backoff for failures

## SDK (Coming Soon)

We're developing native SDKs for iOS and Android. Contact us for early access.
