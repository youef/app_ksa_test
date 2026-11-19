# سوق حيّنا — السلة وطلبات الدفع عند الاستلام (19 نوفمبر 2026)

## Existing architecture inspected
- Product catalog: `public.marketplace_items`; separate subscriptions/promotions payment in `marketplace_orders`.
- Existing product ordering RPC: `hayna_create_product_request`; order tracking via `marketplace_product_requests` / `marketplace_product_request_events` / `order_status_history`.
- Existing order states: pending → accepted → ready → completed (or rejected/cancelled); existing private conversation ID per order and order reviews/disputes.
- Existing delivery choices are extracted from listing description; conversation is created per product through existing RPC.
- Product seller and neighbor access checked server-side, so preserve those safeguards.

## Scope and expected behavior
1. **Cart**: private account-based cart with quantity, seller, price snapshot, delivery choice, image and total. Persist across devices with RLS and prevent foreign-user access.
2. **Checkout**: atomic multi-item order submission, each product becomes one existing product request linked to its seller and chat. Each item's current price and delivery method are validated by existing server RPC. An all-or-nothing transaction prevents partial checkout if one line fails. Deduplicate retry with client request UUIDs.
3. **COD**: items have `cash_on_delivery` payment method only, no payment gateway or card data. No charge at checkout; physical cash collection can be recorded explicitly by seller when ready, without automatically claiming payment. Donations/loans show amount correctly.
4. **Tracking**: buyer/seller see the existing state machine and delivery date/instructions. Owner-only delivery scheduling RPC; avoid exposing precise addresses.
5. **Communication**: order details link to the existing private conversation, without exposing private phone/address.
6. **Access/UI**: cart CTA from market and product details; order list for both buyer/seller; accessible Arabic RTL, safe area, empty/loading/error states.

## Pre-release quality gates
- Schema migration + RLS check and function grants tested on the Hayna Supabase project only.
- CI TypeScript, web export and existing integration suite. Unit tests for cart price / fulfillment helpers.
- No release until PR tests pass; never change the business subscription payment system.

## Later enhancement
Opt-in delivery driver assignment and confirmation code after courier permissions/privacy workflows are designed; not part of this batch.
