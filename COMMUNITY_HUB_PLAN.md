# Community hub and safety centre — implementation plan

## 1. Feature scope
- Safety center section exposed in "More".
- Contact-us tickets that reach platform admins.
- Account type selection (standard, merchant, freelance, provider, idea) and verification by uploading a certificate URL.
- Favorites / wishlist.
- Followers / following lists.
- App experience rating.

## 2. Database schema additions (migration: 202610150003_account_types_and_community.sql)
- profiles.account_type (text enum), freelance_trade (text), is_verified_merchant (bool).
- verification_requests extended with verification_type, subject, attachment_url.
- favorite_items (user_id, target_type, target_id, unique).
- support_tickets (requester fields, subject, message, status, timestamps).
- app_reviews (user_id unique, rating 1..5, body, published).
- user_follow_stats view counting followers/following.

## 3. Relationships
- profiles 1:M verification_requests.
- profiles 1:M support_tickets (set null on user delete).
- profiles 1:M favorite_items.
- profiles 1:1 app_reviews.
- profiles M:M follows (existing relation).

## 4. Admin access
- support_tickets: owners can read own; admins (profiles.role = 'admin') can read and update.
- verification_requests: admins review and set approved/rejected; account_type reflects verification.
- app_reviews: visible to authenticated users when published=true.

## 5. Routes/pages
- /safety-center, /contact-us, /account-type, /favorites, /connected-social, /rate-app.

## 6. Future work for stores and producing families
- Mark stores/merchants via is_verified_merchant.
- Filter marketplace by verified accounts only.
- Business/freelance certificate renewal expiry.
- Follower-driven notifications for new listings.
- User experience awards based on ratings.
