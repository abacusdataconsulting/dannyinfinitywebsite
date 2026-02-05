# Membership Tiers Implementation Guide

This document outlines how to implement a tiered membership system for the Danny Infinity website, including content access control, database changes, and payment integration.

---

## Table of Contents

1. [Overview](#overview)
2. [Membership Tier Structure](#membership-tier-structure)
3. [Database Schema Changes](#database-schema-changes)
4. [Content Access Control](#content-access-control)
5. [Payment Integration](#payment-integration)
6. [Implementation Steps](#implementation-steps)
7. [Security Considerations](#security-considerations)

---

## Overview

The membership system will allow Danny Infinity to offer different levels of access to content based on user subscription tiers. This integrates with the existing user authentication system while adding subscription management and payment processing through external vendors.

### Current Infrastructure

- **Database**: Cloudflare D1 (SQLite-compatible)
- **API**: Cloudflare Workers
- **Authentication**: Session-based with SHA-256 password hashing
- **User Types**: Guest, Member, Admin

### Proposed Additions

- Membership tier system
- Subscription management
- Payment processing via Stripe/Square
- Content access control per media item

---

## Membership Tier Structure

### Recommended Tiers

| Tier | Name | Price | Access Level |
|------|------|-------|--------------|
| 0 | Guest | Free | Public content only |
| 1 | Free Member | Free | Basic member content, account features |
| 2 | Supporter | $5/mo | Extended content library |
| 3 | VIP | $15/mo | Full content access, early releases |
| 4 | Platinum | $30/mo | Everything + exclusive content, direct access |

### Content Categories by Tier

```
Guest (Tier 0):
├── Public photos
├── Public videos (trailers/previews)
└── Basic track listings

Free Member (Tier 1):
├── All Guest content
├── Behind-the-scenes photos
├── Extended track previews
└── Community access

Supporter (Tier 2):
├── All Free Member content
├── Full music videos
├── Live performance recordings
└── Studio session content

VIP (Tier 3):
├── All Supporter content
├── Unreleased tracks
├── Stems and samples
├── Early access to new releases
└── Monthly exclusive content

Platinum (Tier 4):
├── All VIP content
├── Private Discord/community access
├── Production tutorials
├── Direct messaging with Danny
└── Merchandise discounts
```

---

## Database Schema Changes

### New Tables Required

```sql
-- Membership tiers configuration
CREATE TABLE membership_tiers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,           -- 'guest', 'free', 'supporter', 'vip', 'platinum'
    tier_level INTEGER NOT NULL DEFAULT 0,
    price_monthly DECIMAL(10,2) DEFAULT 0,
    price_yearly DECIMAL(10,2) DEFAULT 0,
    description TEXT,
    features TEXT,                        -- JSON array of features
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User subscriptions
CREATE TABLE user_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    tier_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',  -- 'active', 'cancelled', 'expired', 'past_due'
    payment_provider TEXT,                   -- 'stripe', 'square', 'manual'
    external_subscription_id TEXT,           -- Stripe/Square subscription ID
    external_customer_id TEXT,               -- Stripe/Square customer ID
    current_period_start DATETIME,
    current_period_end DATETIME,
    cancel_at_period_end INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (tier_id) REFERENCES membership_tiers(id)
);

-- Payment history
CREATE TABLE payment_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    subscription_id INTEGER,
    payment_provider TEXT NOT NULL,
    external_payment_id TEXT,               -- Stripe/Square payment ID
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT NOT NULL,                   -- 'succeeded', 'failed', 'pending', 'refunded'
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (subscription_id) REFERENCES user_subscriptions(id)
);

-- Content access requirements
CREATE TABLE content_access (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content_type TEXT NOT NULL,             -- 'photo', 'video', 'track', 'download'
    content_id TEXT NOT NULL,               -- Reference to specific content
    min_tier_level INTEGER NOT NULL DEFAULT 0,
    is_premium INTEGER DEFAULT 0,           -- Special premium content flag
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(content_type, content_id)
);
```

### Modifications to Existing Tables

```sql
-- Add tier reference to users table
ALTER TABLE users ADD COLUMN current_tier_id INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;

-- Add tier tracking to visits
ALTER TABLE visits ADD COLUMN tier_level INTEGER;
```

### Sample Tier Data

```sql
INSERT INTO membership_tiers (name, slug, tier_level, price_monthly, price_yearly, description) VALUES
('Guest', 'guest', 0, 0, 0, 'Browse public content'),
('Free Member', 'free', 1, 0, 0, 'Basic member access'),
('Supporter', 'supporter', 2, 5.00, 50.00, 'Extended content library'),
('VIP', 'vip', 3, 15.00, 150.00, 'Full access + early releases'),
('Platinum', 'platinum', 4, 30.00, 300.00, 'Everything + exclusive perks');
```

---

## Content Access Control

### Client-Side Implementation

Add data attributes to content elements:

```html
<!-- Photo with tier requirement -->
<div class="gallery-item"
     data-category="studio"
     data-min-tier="2"
     data-content-id="photo_123">
    <img src="path/to/photo.jpg" alt="Studio session">
    <div class="tier-badge">SUPPORTER+</div>
</div>

<!-- Video with tier requirement -->
<div class="video-item"
     data-category="music-video"
     data-min-tier="3"
     data-content-id="video_456">
    <!-- content -->
    <div class="tier-lock">
        <span class="lock-icon">🔒</span>
        <span class="lock-text">VIP Content</span>
    </div>
</div>
```

### JavaScript Access Control

```javascript
// content-access.js
class ContentAccessControl {
    constructor() {
        this.userTier = this.getUserTier();
    }

    getUserTier() {
        const user = JSON.parse(sessionStorage.getItem('user') || '{}');
        return user.tierLevel || 0;
    }

    canAccess(requiredTier) {
        return this.userTier >= requiredTier;
    }

    initializeContent() {
        document.querySelectorAll('[data-min-tier]').forEach(item => {
            const requiredTier = parseInt(item.dataset.minTier);

            if (!this.canAccess(requiredTier)) {
                item.classList.add('locked');
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.showUpgradePrompt(requiredTier);
                });
            }
        });
    }

    showUpgradePrompt(requiredTier) {
        // Show modal prompting user to upgrade
        const tierNames = ['Guest', 'Free', 'Supporter', 'VIP', 'Platinum'];
        alert(`This content requires ${tierNames[requiredTier]} membership or higher.`);
    }
}
```

### API-Side Access Control

```javascript
// In API worker - middleware for content access
async function checkContentAccess(request, env, contentType, contentId) {
    const token = getAuthToken(request);
    if (!token) return { allowed: false, reason: 'Not authenticated' };

    const session = await getSession(env, token);
    if (!session) return { allowed: false, reason: 'Invalid session' };

    const user = await env.DB.prepare(
        'SELECT u.*, t.tier_level FROM users u JOIN membership_tiers t ON u.current_tier_id = t.id WHERE u.id = ?'
    ).bind(session.user_id).first();

    const contentAccess = await env.DB.prepare(
        'SELECT min_tier_level FROM content_access WHERE content_type = ? AND content_id = ?'
    ).bind(contentType, contentId).first();

    const requiredTier = contentAccess?.min_tier_level || 0;

    return {
        allowed: user.tier_level >= requiredTier,
        userTier: user.tier_level,
        requiredTier: requiredTier
    };
}
```

---

## Payment Integration

### Recommended: Stripe

Stripe is recommended for subscription management due to:
- Excellent API documentation
- Built-in subscription lifecycle management
- Webhook support for real-time updates
- PCI DSS compliance (no card data touches your servers)
- Support for multiple currencies

### Stripe Integration Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│  Cloudflare     │────▶│     Stripe      │
│   (Browser)     │     │  Worker API     │     │     API         │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Stripe.js      │     │   D1 Database   │     │  Stripe         │
│  (Card Input)   │     │   (User Data)   │     │  Webhooks       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Environment Variables Required

```toml
# wrangler.toml
[vars]
STRIPE_PUBLISHABLE_KEY = "pk_live_..."

# Use wrangler secret for sensitive keys
# wrangler secret put STRIPE_SECRET_KEY
# wrangler secret put STRIPE_WEBHOOK_SECRET
```

### API Endpoints for Subscriptions

```javascript
// POST /api/subscription/create-checkout
async function createCheckoutSession(request, env) {
    const { tierId, userId } = await request.json();

    const tier = await env.DB.prepare(
        'SELECT * FROM membership_tiers WHERE id = ?'
    ).bind(tierId).first();

    const user = await env.DB.prepare(
        'SELECT * FROM users WHERE id = ?'
    ).bind(userId).first();

    // Create or get Stripe customer
    let stripeCustomerId = user.stripe_customer_id;
    if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
            email: user.email,
            metadata: { user_id: user.id }
        });
        stripeCustomerId = customer.id;

        await env.DB.prepare(
            'UPDATE users SET stripe_customer_id = ? WHERE id = ?'
        ).bind(stripeCustomerId, userId).run();
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        mode: 'subscription',
        line_items: [{
            price: tier.stripe_price_id,
            quantity: 1,
        }],
        success_url: `${env.SITE_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${env.SITE_URL}/subscription/cancelled`,
        metadata: {
            user_id: userId,
            tier_id: tierId
        }
    });

    return jsonResponse({ sessionId: session.id, url: session.url });
}

// POST /api/webhooks/stripe
async function handleStripeWebhook(request, env) {
    const signature = request.headers.get('stripe-signature');
    const body = await request.text();

    let event;
    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        return errorResponse('Webhook signature verification failed', 400);
    }

    switch (event.type) {
        case 'checkout.session.completed':
            await handleCheckoutComplete(env, event.data.object);
            break;
        case 'customer.subscription.updated':
            await handleSubscriptionUpdate(env, event.data.object);
            break;
        case 'customer.subscription.deleted':
            await handleSubscriptionCancelled(env, event.data.object);
            break;
        case 'invoice.payment_failed':
            await handlePaymentFailed(env, event.data.object);
            break;
    }

    return jsonResponse({ received: true });
}

async function handleCheckoutComplete(env, session) {
    const userId = session.metadata.user_id;
    const tierId = session.metadata.tier_id;
    const subscriptionId = session.subscription;

    // Get subscription details from Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    // Create subscription record
    await env.DB.prepare(`
        INSERT INTO user_subscriptions
        (user_id, tier_id, status, payment_provider, external_subscription_id,
         external_customer_id, current_period_start, current_period_end)
        VALUES (?, ?, 'active', 'stripe', ?, ?, ?, ?)
    `).bind(
        userId,
        tierId,
        subscriptionId,
        session.customer,
        new Date(subscription.current_period_start * 1000).toISOString(),
        new Date(subscription.current_period_end * 1000).toISOString()
    ).run();

    // Update user's current tier
    await env.DB.prepare(
        'UPDATE users SET current_tier_id = ? WHERE id = ?'
    ).bind(tierId, userId).run();
}
```

### Frontend Checkout Flow

```javascript
// subscription.js
async function startCheckout(tierId) {
    const response = await fetch('/api/subscription/create-checkout', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ tierId })
    });

    const { url } = await response.json();

    // Redirect to Stripe Checkout
    window.location.href = url;
}
```

### Alternative: Square Integration

If preferring Square over Stripe:

```javascript
// Square uses similar patterns but with different API structure
const squareClient = new Client({
    accessToken: env.SQUARE_ACCESS_TOKEN,
    environment: Environment.Production
});

// Create subscription
const response = await squareClient.subscriptionsApi.createSubscription({
    idempotencyKey: crypto.randomUUID(),
    locationId: env.SQUARE_LOCATION_ID,
    customerId: squareCustomerId,
    planId: tier.square_plan_id,
});
```

---

## Implementation Steps

### Phase 1: Database & Backend (Week 1-2)

1. **Create new database tables**
   - Run migration scripts to add membership tables
   - Seed initial tier data

2. **Update API endpoints**
   - Add tier information to user login response
   - Create subscription management endpoints
   - Add content access checking middleware

3. **Set up Stripe account**
   - Create Stripe account and configure products
   - Set up webhook endpoint
   - Configure test environment

### Phase 2: Frontend Integration (Week 2-3)

4. **Add subscription pages**
   - Create pricing/plans page
   - Build checkout flow integration
   - Add subscription management in user profile

5. **Implement content gating**
   - Add tier badges to locked content
   - Create upgrade prompts
   - Build preview/teaser system for locked content

### Phase 3: Admin Tools (Week 3-4)

6. **Extend admin dashboard**
   - Add subscription management view
   - Create revenue reporting
   - Build manual subscription controls

7. **Testing & refinement**
   - Test complete subscription lifecycle
   - Verify webhook handling
   - Load testing

---

## Security Considerations

### Payment Security

1. **Never store card data**
   - Use Stripe.js/Elements for card input
   - Cards are tokenized on Stripe's servers
   - Only store Stripe customer/subscription IDs

2. **Webhook verification**
   - Always verify webhook signatures
   - Use HTTPS endpoints only
   - Implement idempotency for webhook handlers

3. **API authentication**
   - All subscription endpoints require valid auth token
   - Validate user owns the subscription being modified

### User Data Protection

```javascript
// Example: Secure subscription endpoint
async function cancelSubscription(request, env) {
    const token = getAuthToken(request);
    const session = await verifySession(env, token);

    if (!session) {
        return errorResponse('Unauthorized', 401);
    }

    const { subscriptionId } = await request.json();

    // Verify user owns this subscription
    const subscription = await env.DB.prepare(
        'SELECT * FROM user_subscriptions WHERE id = ? AND user_id = ?'
    ).bind(subscriptionId, session.user_id).first();

    if (!subscription) {
        return errorResponse('Subscription not found', 404);
    }

    // Cancel on Stripe
    await stripe.subscriptions.update(subscription.external_subscription_id, {
        cancel_at_period_end: true
    });

    // Update local record
    await env.DB.prepare(
        'UPDATE user_subscriptions SET cancel_at_period_end = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(subscriptionId).run();

    return jsonResponse({ success: true });
}
```

### Access Control Best Practices

1. **Server-side verification**
   - Always verify access on API side, not just frontend
   - Frontend hiding is UX only, not security

2. **Audit logging**
   - Log subscription changes
   - Track content access attempts
   - Monitor for abuse patterns

3. **Rate limiting**
   - Limit API calls per user
   - Prevent subscription manipulation attempts

---

## Cost Considerations

### Stripe Fees
- 2.9% + 30¢ per successful card charge
- No monthly fees for basic usage
- Additional fees for premium features (Stripe Radar, etc.)

### Square Fees
- 2.9% + 30¢ for online transactions
- No monthly fees for basic usage

### Estimated Revenue Example

| Tier | Members | Monthly Revenue | After Fees (~3%) |
|------|---------|-----------------|------------------|
| Supporter ($5) | 100 | $500 | $485 |
| VIP ($15) | 50 | $750 | $727 |
| Platinum ($30) | 20 | $600 | $582 |
| **Total** | **170** | **$1,850** | **$1,794** |

---

## Files to Create/Modify

### New Files
- `/api/src/subscriptions.js` - Subscription API handlers
- `/api/src/webhooks.js` - Payment webhook handlers
- `/js/subscription.js` - Frontend subscription logic
- `/js/content-access.js` - Content gating logic
- `/css/subscription.css` - Subscription page styles
- `/pricing.html` - Pricing/plans page
- `/account.html` - User account/subscription management

### Modified Files
- `/api/src/index.js` - Add new routes
- `/api/schema.sql` - Add new tables
- `/js/photos.js` - Add access control
- `/js/videos.js` - Add access control
- `/home.html` - Add tier badge display

---

## Questions for Client

Before implementation, clarify:

1. **Tier pricing** - Confirm pricing for each tier
2. **Content mapping** - Which specific content belongs to which tier?
3. **Grace period** - How long after failed payment before access is revoked?
4. **Refund policy** - Under what conditions are refunds issued?
5. **Annual discounts** - What discount for yearly subscriptions?
6. **Free trial** - Offer trial period for paid tiers?
7. **Grandfathering** - Lock in prices for early subscribers?
