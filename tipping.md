the client is now looking at payment/tipping integration with stripe, they currently would like to          
  focus on getting tipping working but eventually would like to be able to have a store with merchanidise    
   carts and possibly membership subscriptions for exclusive content and early access. but for right now,     
   focusing on the tipping feature with building for more advanced features later on, what stripe             
  products would be most appropriate?                                                                         
                                                                                                              
⏺ Good question. Here's how the Stripe product lineup maps to Danny's roadmap:                                
                                                                                                            
  For Tipping Now                                                                                  

  Stripe Checkout Sessions API is the best starting point. It gives you:                                      
  - Server-created sessions with custom/variable tip amounts
  - Stripe-hosted payment page (handles card UI, 3D Secure, Apple Pay, Google Pay)                            
  - Minimal backend code — create a session, redirect the user, listen for a webhook                        
  - No PCI compliance burden since card details never touch your server                            

  You'd use mode: 'payment' with either preset tip amounts or a custom amount field.

  Why not Payment Links? You already have data-stripe-link placeholders in sheet-music.html, but Payment Links
   are static — they can't handle variable tip amounts dynamically and are harder to tie back to specific
  context (which sheet, which page, etc).

  Why Checkout Scales to Everything Later

  The same Checkout Sessions API handles all three future needs by changing the mode and line items:
  ┌───────────────────────┬────────────────────────────────────────────────────────────────────────────────┐
  │        Feature        │                                Checkout Config                                 │
  ├───────────────────────┼────────────────────────────────────────────────────────────────────────────────┤
  │ Tips (now)            │ mode: 'payment', single line item with dynamic amount                          │
  ├───────────────────────┼────────────────────────────────────────────────────────────────────────────────┤
  │ Merch store (later)   │ mode: 'payment', multiple line_items from Products & Prices API                │
  ├───────────────────────┼────────────────────────────────────────────────────────────────────────────────┤
  │ Subscriptions (later) │ mode: 'subscription', recurring Price objects + Customer Portal for management │
  └───────────────────────┴────────────────────────────────────────────────────────────────────────────────┘
  Stripe Products You'd Activate Over Time

  1. Now — Checkout Sessions + Webhooks (for confirming payments and recording donations)
  2. Merch phase — Products & Prices API (define SKUs), Checkout with cart line items
  3. Membership phase — Billing (subscription lifecycle), Customer Portal (self-service cancel/upgrade),
  Products with recurring prices

  Implementation Shape for Tipping

  The backend flow would be:

  1. POST /api/create-tip-session — creates a Checkout Session with the tip amount, returns the session URL
  2. Stripe redirects user to hosted checkout, user pays
  3. Stripe sends checkout.session.completed webhook to POST /api/stripe/webhook
  4. Webhook handler records the donation in your existing donations table

  This keeps the current codebase clean and avoids ripping anything out when you add merch or subscriptions
  later — you just add new session creation endpoints alongside the tip one.

---

## What the Client Needs to Do

### 1. Create a Stripe Account

Go to https://dashboard.stripe.com/register and complete account setup. Stripe will need:
- Business/individual information
- Bank account for payouts
- Identity verification

### 2. Get API Keys

From the Stripe Dashboard → Developers → API Keys:
- **Secret key** — starts with `sk_test_` (test mode) or `sk_live_` (production)
- Use **test mode** keys first to verify everything works before going live

### 3. Set Up the Webhook

In the Stripe Dashboard → Developers → Webhooks → Add endpoint:
- **Endpoint URL**: `https://dannyinfinity.com/api/webhook/stripe`
- **Events to listen for**: `checkout.session.completed`
- After creating, copy the **Signing secret** (starts with `whsec_`)

### 4. Add Secrets to Cloudflare Worker

Run these commands from the project directory:

```bash
# Stripe secret key (for creating checkout sessions)
npx wrangler secret put STRIPE_SECRET_KEY
# When prompted, paste: sk_test_... (testing) or sk_live_... (production)

# Webhook signing secret (for verifying incoming webhooks)
npx wrangler secret put STRIPE_WEBHOOK_SECRET
# When prompted, paste: whsec_...
```

### 5. Deploy

```bash
npx wrangler deploy
```

### 6. Test with Stripe Test Mode

1. Make sure Stripe API keys are in **test mode** (`sk_test_...`)
2. Visit the sheet music page and click **[LEAVE A TIP]**
3. Select an amount and click **[CONTINUE TO CHECKOUT]**
4. On the Stripe checkout page, use test card: `4242 4242 4242 4242` (any future expiry, any CVC)
5. After payment, you should redirect back with a "Thank you" banner
6. Check the admin panel **Donations** tab — the test donation should appear
7. When ready for real payments, switch to live keys (`sk_live_...`) and redeploy

### 7. Going Live Checklist

- [ ] Switch Stripe dashboard out of test mode
- [ ] Run `npx wrangler secret put STRIPE_SECRET_KEY` with the live key (`sk_live_...`)
- [ ] Create a new webhook endpoint in Stripe for production (or update the existing one)
- [ ] Run `npx wrangler secret put STRIPE_WEBHOOK_SECRET` with the new live signing secret
- [ ] Run `npx wrangler deploy`
- [ ] Make a small real donation to confirm end-to-end flow