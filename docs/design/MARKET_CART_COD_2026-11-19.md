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

## Implementation and before → after
- **Cart**: previously no cart → persistent account-backed cart with quantity, delivery choices, optional per-item notes, price refresh, and one-click removal.
- **Checkout**: previously one product request at a time → atomic multi-item transaction with one existing product request and chat per product; full rollback if a line fails, plus stable checkout UUID to retry network failures.
- **Payment**: product orders now explicitly `cash_on_delivery` in database, with no card collection or hosted checkout; seller can confirm actual cash receipt after a product is ready.
- **Buyer tracking**: dedicated outgoing orders tab with stage progress and order details; **seller**: incoming orders tab, accept, prepare and mark ready.
- **Delivery**: seller can save a scheduled delivery date and general notes on accepted/ready product orders; buyer can read them on order details. Precise addresses are not stored.
- **Communication**: each order still uses its existing Supabase private conversation, respecting neighbor privacy and messaging permissions.
- **Interface**: market and product cards link to cart/orders; Arabic RTL, device-responsive layout, 44px controls, clear empty/loading/errors and safe-area padding.
- **Existing billing**: separately paid marketplace subscriptions, service orders and sponsored ads remain untouched by this product COD change.

## Applied and verified backend
The additive schema was applied to the active Hayna project, `vkeuyompnddqfvulalkk`. SQL checks confirmed:
- 4 COD/delivery fields on product requests, 5 new RPCs and 2 cart RLS policies.
- Cart table RLS is enabled; anonymous cart reads and checkout execution are denied.
- Authenticated clients have cart SELECT but no direct INSERT permission: all writes require server RPC validations.

## Risks and verification
- Test the order lifecycle with two authorized real test accounts, including delivery scheduling and seller COD acknowledgment, before relying on a live transaction.
- Confirm full CI results for `tests/marketCart.test.cjs`, TypeScript and platform exports; no emulator or signed-in end-to-end run was available via the GitHub connector.
- Order stage tracking is progress/status, not live GPS courier tracking; no third-party driver assignment.
