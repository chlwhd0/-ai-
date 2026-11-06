# Security Specification: Lantern Route Pre-Registration

## 1. Data Invariants
- A registration must have a valid phone number (10-11 digits, Korean mobile format 010/011/016/017/018/019).
- A registration platform must be either "Android" or "iOS".
- A registration channel must be a positive integer between 1 and 10.
- Registrations are created by unauthenticated public visitors or admins.
- Modification and deletion of registrations are restricted to authenticated admins (`hitodays@gmail.com`) or public reads if needed for real-time count.
- Admin configuration in `/config/{configId}` can only be read publicly and written by admins.

## 2. The "Dirty Dozen" Threat Payloads
1. Injection of invalid phone numbers (letters, symbols, >11 characters).
2. Setting OS to an invalid platform (e.g. "Windows", "MacOS").
3. Assigning negative or >10 channel numbers.
4. Overwriting an existing registration without admin authorization.
5. Deleting an applicant registration without admin privileges.
6. Tampering with global server configurations by non-admin users.
7. Spoofed admin email with `email_verified: false`.
8. Massive payload injection into coupon or server fields.
9. Attempting to bypass strict field keys on registration creation.
10. Unbounded list queries without proper index.
11. Unauthorized write to arbitrary collections outside registrations and config.
12. Attempting to inject system fields or privilege escalation flags.

## 3. Security Assertions & Access Control Model
- `isAdmin()`: User is authenticated with verified email `hitodays@gmail.com`.
- Public visitors can `create` registrations that satisfy `isValidRegistration(incoming())`.
- Public visitors and admins can `get` and `list` registrations (to render real-time applicant tallies, channel occupancy, and admin roster).
- Only `isAdmin()` can `update` or `delete` registrations.
- Only `isAdmin()` can `write` to `/config/{configId}`.
