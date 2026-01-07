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

**OCR Processing with Gemini 1.5 Flash:**

Back label photos are processed using **Google Gemini 1.5 Flash** for intelligent ingredient extraction. The OCR pipeline works as follows:

1. **Image Preprocessing** - Photos are validated for clarity and orientation
2. **Text Extraction** - Gemini 1.5 Flash performs OCR on the ingredients panel
3. **Structured Parsing** - The AI extracts and categorizes information into:
   - Full ingredient list (parsed and normalized)
   - Nutritional information (serving size, calories, macros)
   - Allergen warnings (highlighted separately)
   - Product claims and certifications (organic, non-GMO, etc.)
4. **Confidence Scoring** - Each extraction includes a confidence score (0-1)

**OCR Response Fields:**
```json
{
  "ocrResult": {
    "rawText": "Original extracted text...",
    "ingredients": ["Ingredient 1", "Ingredient 2"],
    "nutritionFacts": {
      "servingSize": "1 cup (240ml)",
      "calories": 120,
      "totalFat": "2g",
      "sodium": "140mg"
    },
    "allergens": ["milk", "soy"],
    "certifications": ["USDA Organic", "Non-GMO Project Verified"],
    "confidence": 0.94,
    "model": "gemini-1.5-flash"
  }
}
```

**Note:** For best OCR results, ensure photos are well-lit, in focus, and the ingredients panel is clearly visible.

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

Smart Scan uses **OpenAI GPT-4 Vision** to analyze product photos and provide instant ingredient insights without requiring a barcode.

```http
POST /api/smart-scan
Content-Type: multipart/form-data
x-fingerprint: <fingerprint>

photo: <file>
analysisType: "full"
```

**Request Fields:**
- `photo` (required) - Image file of the product (front, back, or ingredients panel)
- `analysisType` (optional) - "quick" for fast analysis, "full" for comprehensive (default: "full")

**GPT-4 Vision Analysis Pipeline:**
1. **Product Identification** - Identifies the product type, brand, and category from visual cues
2. **Text Extraction** - Reads visible text including ingredients, claims, and warnings
3. **Ingredient Analysis** - Cross-references extracted ingredients against our concern database
4. **Health Assessment** - Generates concern flags and an overall health score
5. **Recommendations** - Suggests cleaner alternatives when concerns are found

**Response:**
```json
{
  "success": true,
  "analysis": {
    "productName": "Detected Product",
    "brand": "Brand Name",
    "category": "Personal Care",
    "ingredients": ["Ingredient 1", "Ingredient 2"],
    "concerns": [
      {
        "ingredient": "Ingredient 2",
        "level": "moderate",
        "reason": "May cause sensitivity",
        "ewgScore": 4
      }
    ],
    "score": 75,
    "model": "gpt-4-vision-preview",
    "processingTime": 2.3
  },
  "creditsUsed": 1,
  "creditsRemaining": 4
}
```

**Smart Scan Credits:**
Smart Scan uses a credit system due to API costs:
- Free users: 5 scans per day
- Registered users: 10 scans per day
- Credits reset at midnight UTC

**Error Response (No Credits):**
```json
{
  "success": false,
  "error": "CREDITS_EXHAUSTED",
  "message": "Daily Smart Scan limit reached",
  "creditsRemaining": 0,
  "resetAt": "2024-01-16T00:00:00Z"
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

**GPC Header Detection:**
The API automatically detects GPC from standard headers:
```http
Sec-GPC: 1
```
When this header is present, the API treats the request as if `gpcEnabled: true` was set, even if not explicitly passed in the request body.

### Unlock Credits System

The unlock credits system allows users to earn additional Smart Scan credits through contributions.

**Earning Credits:**
| Action | Credits Earned |
|--------|---------------|
| Submit new product photos | +2 credits |
| Verify existing product data | +1 credit |
| Report data corrections | +1 credit |
| Complete weekly challenge | +5 credits |
| Refer new user | +3 credits |

**Check Credit Balance:**
```http
GET /api/fingerprint/check?hash=<fingerprint-hash>
```

The response includes credit information:
```json
{
  "registered": true,
  "credits": {
    "smartScan": {
      "available": 8,
      "dailyLimit": 10,
      "bonusCredits": 3,
      "resetAt": "2024-01-16T00:00:00Z"
    }
  },
  "stats": {
    "totalScans": 150,
    "totalSubmissions": 25
  }
}
```

**Credit Rules:**
- Daily credits reset at midnight UTC
- Bonus credits (earned through contributions) do not expire
- Bonus credits are used after daily credits are exhausted
- Maximum bonus credit balance: 100

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

## Product Voting System

The voting system allows users to request testing for products not yet in our database. It uses a weighted system based on "Proof of Possession."

### Vote Types and Weights

| Vote Type | Weight | Description |
|-----------|--------|-------------|
| `search` | 1x | User searched for the product (curiosity signal) |
| `scan` | 5x | User scanned the product barcode (proof of possession) |
| `member_scan` | 20x | Premium member scanned (verified possession) |

### Register a Vote

```http
POST /api/product-vote
Content-Type: application/json
x-fingerprint: <fingerprint>

{
  "barcode": "5000328657950",
  "voteType": "scan",
  "fingerprint": "<fingerprint-hash>",
  "productInfo": {
    "name": "Product Name",
    "brand": "Brand Name",
    "imageUrl": "https://..."
  },
  "notifyOnComplete": true
}
```

**Response:**
```json
{
  "success": true,
  "voteRegistered": true,
  "totalVotes": 15,
  "yourVoteRank": 8,
  "fundingProgress": 45,
  "fundingThreshold": 100,
  "productInfo": {
    "barcode": "5000328657950",
    "name": "Product Name",
    "brand": "Brand Name"
  },
  "message": "Vote registered! You're #8 in line."
}
```

### Check Vote Status

```http
GET /api/product-vote/status?barcode=5000328657950&fingerprint=<fingerprint>
```

**Response:**
```json
{
  "barcode": "5000328657950",
  "hasVoted": true,
  "yourVoteRank": 8,
  "totalVotes": 15,
  "fundingProgress": 45,
  "status": "waiting",
  "estimatedTestDate": null
}
```

### My Cases (User Investigations)

Get all products the user has voted for:

```http
GET /api/my-cases
x-fingerprint: <fingerprint>
```

**Response:**
```json
{
  "investigations": [
    {
      "barcode": "5000328657950",
      "productName": "Product Name",
      "brand": "Brand",
      "imageUrl": "https://...",
      "status": "waiting",
      "queuePosition": 12,
      "fundingProgress": 45,
      "yourScoutNumber": 8,
      "totalScouts": 15,
      "isFirstScout": false,
      "isTrending": true,
      "velocityChange24h": 5
    }
  ],
  "totalCases": 1
}
```

## User Subscription Status

Check if a user has premium access:

```http
GET /api/user-subscription?email=user@example.com
x-api-key: <internal-api-key>
```

**Response:**
```json
{
  "found": true,
  "email": "user@example.com",
  "userId": 123,
  "name": "User Name",
  "subscriptionStatus": "premium",
  "memberState": "member",
  "trialEndDate": null,
  "isPremium": true,
  "hasStripe": true,
  "hasRevenueCat": false
}
```

**Member States:**
- `virgin` - Never subscribed
- `trialist` - Active trial
- `member` - Active paid subscription
- `churned` - Previously subscribed, now cancelled

## Best Practices

1. **Cache responses** - Product data rarely changes, cache for 1 hour
2. **Batch lookups** - If scanning multiple products, batch them
3. **Handle offline** - Queue submissions when offline
4. **Compress images** - Resize photos before uploading (max 1024px)
5. **Retry with backoff** - Implement exponential backoff for failures
6. **Use fingerprint consistently** - Always send the same fingerprint hash for a device
7. **Handle 429 errors** - Respect `Retry-After` header for rate limiting
8. **Validate barcodes locally** - Check barcode format before API calls

## Error Handling Patterns

### Swift (iOS)

```swift
enum TPRError: Error {
    case invalidBarcode
    case productNotFound
    case rateLimited(retryAfter: Int)
    case authRequired
    case serverError(message: String)
}

func handleAPIError(_ response: HTTPURLResponse, data: Data) -> TPRError {
    switch response.statusCode {
    case 400:
        return .invalidBarcode
    case 404:
        return .productNotFound
    case 429:
        let retryAfter = Int(response.value(forHTTPHeaderField: "Retry-After") ?? "60") ?? 60
        return .rateLimited(retryAfter: retryAfter)
    case 401:
        return .authRequired
    default:
        let message = try? JSONDecoder().decode(ErrorResponse.self, from: data).message
        return .serverError(message: message ?? "Unknown error")
    }
}
```

### Kotlin (Android)

```kotlin
sealed class TPRResult<out T> {
    data class Success<T>(val data: T) : TPRResult<T>()
    data class Error(val code: String, val message: String) : TPRResult<Nothing>()
    object RateLimited : TPRResult<Nothing>()
    object ProductNotFound : TPRResult<Nothing>()
}

suspend fun <T> safeApiCall(call: suspend () -> Response<T>): TPRResult<T> {
    return try {
        val response = call()
        when (response.code()) {
            200 -> TPRResult.Success(response.body()!!)
            404 -> TPRResult.ProductNotFound
            429 -> TPRResult.RateLimited
            else -> {
                val error = response.errorBody()?.string()
                TPRResult.Error("HTTP_${response.code()}", error ?: "Unknown error")
            }
        }
    } catch (e: Exception) {
        TPRResult.Error("NETWORK", e.message ?: "Network error")
    }
}
```

## Webhooks for Server-Side Integration

If your mobile app has a backend server, you can receive webhooks for:

### Product Testing Complete

Configure webhook URL in our dashboard:

```http
POST https://your-server.com/webhooks/tpr
Content-Type: application/json
X-TPR-Signature: sha256=...

{
  "event": "product.tested",
  "barcode": "5000328657950",
  "productId": 123,
  "scores": {
    "overall": 78,
    "health": 82
  },
  "testedAt": "2024-01-15T12:00:00Z"
}
```

### Subscription Events

RevenueCat events are forwarded if you've configured webhook forwarding:

```json
{
  "event": "subscription.started",
  "userId": 123,
  "productId": "tpr_premium_annual",
  "purchasedAt": "2024-01-15T12:00:00Z"
}
```

## API Documentation

Full interactive API documentation is available at:

- **Swagger UI**: https://cms.theproductreport.org/api/docs
- **OpenAPI Spec**: https://cms.theproductreport.org/api/docs?format=json

## SDK (Coming Soon)

We're developing native SDKs for iOS and Android. Contact us for early access.
