# Onecomm API - TODO

[x] Removed `updatedAt` from `system_sessions`; session lifecycle is represented by `createdAt`, `expiresAt`, and `revokedAt`.
[x] Connected generated codes to business settings. Each generator now reads the configured prefix first and falls back to the built-in prefix only when the setting is null.
[x] Added missing prefix fields for orders, invoices, payments, shipments, purchasing, inventory, finance, and catalog codes.
[x] Moved the shared business-access predicate into `BusinessAccessService` and reused it in business reads.
[x] Removed the extra password-reset verification record. Reset OTP verification now marks `system_password_resets.verifiedAt` and the final reset uses `resetRequestId`.
[x] Added website management and browse-only storefront foundation APIs.
[x] Added product/variant reviews and ratings with moderation status.
