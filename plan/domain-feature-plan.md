# Domain Registration Feature Plan for Wedding Website Builder

## Decision

Implement **v1 with `.com` only**.

Do **not** support `.es` in v1.

Reason:
- `.com` is straightforward and globally familiar.
- `.es` adds extra registrant data and ID-validation requirements, which increases implementation complexity and support burden.
- Keeping v1 to `.com` lets us ship faster and with fewer edge cases.

## Provider choice

Use:
- **OpenSRS** for domain search, pricing, registration, and renewals
- **Cloudflare** for DNS zone creation and DNS record management

Why this combo:
- We already use Cloudflare for DNS and customer sites.
- Cloudflare is good for DNS automation.
- OpenSRS is better suited for white-label domain registration inside our own product.
- This lets us bundle the domain cost into our own product pricing instead of sending customers to a third-party checkout.

---

# Scope of v1

The feature should allow a logged-in customer to:

1. Search for available `.com` domains
2. Select one domain
3. Enter the contact details required for registration
4. Register the domain under **their own name**
5. Automatically connect the domain to the website through Cloudflare

Business rules:
- Only one included domain per wedding website
- Only `.com`
- Only 1-year registration in v1
- No transfers-in
- No transfers-out UI in v1
- No premium domains in v1
- No IDN / punycode in v1

---

# Important ownership rule

The domain must be registered in the **customer's name**, not our company name.

That means we need to collect registrant/contact details from the customer before registration.

## Minimum customer details to collect

For v1 collect:
- first_name
- last_name
- email
- phone
- address1
- city
- state_or_region
- postal_code
- country_code
- organization (optional)

For simplicity in v1, use the same customer data for all registrar contact roles:
- owner
- admin
- billing
- tech

---

# Simplified architecture

The previous version was intentionally very structured, but **no, all those PHP files are not required**.

For a first implementation, this can be much smaller.

## Minimal file structure

```text
/public/index.php
/src/config.php
/src/db.php
/src/OpenSrsClient.php
/src/CloudflareClient.php
/src/DomainController.php
/src/DomainRepository.php
/src/worker.php
```

## What each file does

### `/public/index.php`
Single entry point for HTTP requests.

Responsibilities:
- route incoming requests
- call the controller
- return JSON

### `/src/config.php`
Loads environment variables and config constants.

Examples:
- DB credentials
- OpenSRS API credentials
- Cloudflare API token
- allowed TLDs = `['com']`
- pricing cap for included domains

### `/src/db.php`
Creates the PDO connection.

### `/src/OpenSrsClient.php`
Thin wrapper around OpenSRS API.

Methods:
- `lookupDomain(string $domain)`
- `suggestDomains(string $query)`
- `getPrice(string $domain)`
- `registerDomain(array $payload)`
- `getDomainInfo(string $domain)`
- `getRegistrantVerificationStatus(string $domain)`
- `updateNameservers(string $domain, array $nameservers)`

### `/src/CloudflareClient.php`
Thin wrapper around Cloudflare API.

Methods:
- `createZone(string $domain)`
- `createDnsRecord(string $zoneId, array $record)`
- `listZones(string $domain)`

### `/src/DomainController.php`
Handles the feature endpoints.

Endpoints:
- `GET /api/domains/search?q=alex-jamie`
- `POST /api/domains/register`
- `GET /api/domains/{id}`

### `/src/DomainRepository.php`
All DB reads/writes for the domain feature.

Methods:
- create contact
- create domain row
- update domain status
- insert job
- fetch pending jobs
- save errors

### `/src/worker.php`
CLI worker run by cron.

Responsibilities:
- process registration jobs
- retry failed steps
- finish provisioning after the HTTP request ends

---

# Why not do everything in one HTTP request?

From the outside this looks small, but there are several external steps:

1. Check availability
2. Check price
3. Register at registrar
4. Create Cloudflare zone
5. Get Cloudflare nameservers
6. Update nameservers at registrar
7. Create DNS records
8. Wait for verification / propagation

If one of those fails in the middle, we need a clean way to retry.

That is why I recommend a **small job table + worker**, even in v1.

Without that, you risk situations like:
- domain registered, but Cloudflare zone not created
- zone created, but nameservers not updated
- nameservers updated, but DNS records missing

A worker makes recovery much easier.

---

# Minimal database design

We can simplify the DB down to **3 tables** for v1.

## 1) `domain_contacts`
Stores the registrant/contact data that must be sent to the registrar.

### Why it exists
Because the domain must belong to the customer, and we need their contact details for registration.

### Suggested columns
- `id`
- `user_id`
- `first_name`
- `last_name`
- `email`
- `phone`
- `organization`
- `address1`
- `city`
- `state`
- `postal_code`
- `country`
- `created_at`
- `updated_at`

---

## 2) `domains`
Stores the domain purchase/provisioning lifecycle for each wedding site.

### Why it exists
This is the main table for the feature.
It tells us:
- which domain belongs to which website
- whether it is still being provisioned
- whether registration succeeded
- whether Cloudflare setup succeeded
- when it expires

### Suggested columns
- `id`
- `website_id`
- `user_id`
- `contact_id`
- `domain_name`
- `status`
- `provider` (default `opensrs`)
- `cloudflare_zone_id`
- `purchase_price_cents`
- `included_in_package`
- `auto_renew`
- `expires_at`
- `verification_status`
- `last_error_message`
- `created_at`
- `updated_at`

### Suggested statuses
- `selected`
- `registration_pending`
- `registered`
- `zone_created`
- `nameservers_updated`
- `dns_ready`
- `active`
- `failed`

---

## 3) `provisioning_jobs`
Queue of work that the background worker must process.

### Why it exists
This is the table you asked about.

It is **not** domain data.
It is a small internal queue used to safely run multi-step provisioning.

Example:
- user clicks “Register domain”
- app inserts a row in `domains`
- app inserts a row in `provisioning_jobs`
- worker picks up the job
- worker registers the domain
- worker creates the Cloudflare zone
- worker updates nameservers
- worker adds DNS records
- worker marks the job done

### Why it is useful
Because API calls can fail temporarily.

This table lets us:
- retry safely
- avoid duplicate registrations
- continue unfinished work
- inspect failures

### Suggested columns
- `id`
- `domain_id`
- `job_type` (`register_domain`)
- `status` (`pending`, `running`, `done`, `failed`)
- `attempts`
- `run_after`
- `last_error`
- `created_at`
- `updated_at`

---

# API endpoints

## 1) Search domains
`GET /api/domains/search?q=alexandjamie`

### Behavior
- sanitize input
- force `.com` only
- search exact match first if user entered a full domain
- otherwise request suggestions
- reject premium domains
- return only domains that fit our business rules

### Example response
```json
{
  "query": "alexandjamie",
  "results": [
    {
      "domain": "alexandjamie.com",
      "available": true,
      "premium": false,
      "included": true,
      "price_cents": 1299
    },
    {
      "domain": "alexandjamiewedding.com",
      "available": true,
      "premium": false,
      "included": true,
      "price_cents": 1299
    }
  ]
}
```

## 2) Register domain
`POST /api/domains/register`

### Request body
```json
{
  "website_id": 123,
  "domain_name": "alexandjamie.com",
  "contact": {
    "first_name": "Alex",
    "last_name": "Smith",
    "email": "alex@example.com",
    "phone": "+34600111222",
    "address1": "Gran Via 1",
    "city": "Madrid",
    "state": "Madrid",
    "postal_code": "28013",
    "country": "ES",
    "organization": ""
  }
}
```

### Behavior
- validate contact fields
- verify `.com`
- verify availability again
- verify price again
- create `domain_contacts` row
- create `domains` row with `registration_pending`
- insert `provisioning_jobs` row
- return success immediately

### Immediate response
```json
{
  "ok": true,
  "domain_status": "registration_pending"
}
```

---

# Worker flow

The worker should process one queued job at a time.

## Steps

### Step 1: register the domain in OpenSRS
- submit contact set
- set 1-year period
- set auto-renew according to product rule
- save registrar response
- update domain status to `registered`

### Step 2: create Cloudflare zone
- create zone for the domain
- save returned `zone_id`
- read Cloudflare nameservers
- update status to `zone_created`

### Step 3: update nameservers at registrar
- send Cloudflare nameservers to OpenSRS
- update status to `nameservers_updated`

### Step 4: create DNS records in Cloudflare
Create at least:
- apex `@` record to website origin
- `www` CNAME

Then update status to `dns_ready`.

### Step 5: final verification
- optionally check registrant verification state
- if all good, mark domain `active`

If any step fails:
- save `last_error_message`
- increment attempts
- retry later

---

# Cloudflare DNS records for v1

Minimum records:

## Apex
One of:
- `A @ -> your server IP`
- or `CNAME @ -> your canonical target` if your infrastructure supports that setup

## WWW
- `CNAME www -> @`

Optional later:
- redirect `www` -> apex or apex -> `www`
- TXT verification records
- email records

---

# Search behavior

For v1 keep search simple.

## If user types a full domain
Example:
- `alexandjamie.com`

Then:
- validate format
- exact lookup only

## If user types words
Example:
- `alex and jamie`

Then:
- normalize to `alexandjamie`
- request up to 10 `.com` suggestions
- exclude premium domains

Normalization rules:
- lowercase only
- remove accents if possible
- replace spaces with nothing
- keep only `a-z`, `0-9`, and hyphens
- reject leading/trailing hyphen

---

# Pricing rule

For the customer-facing product:

> Includes 1 custom `.com` domain for 1 year.

Internal rule:
- only include domains whose wholesale price is below our cap
- exclude premium domains

If a domain is not eligible:
- either do not show it
- or show “not included” and block checkout in v1

For the fastest v1, I recommend **hiding anything not included**.

---

# Renewal rule

Simplest v1:
- include 1 year only
- store expiry date
- do not implement customer renewal UI yet
- when expiry approaches, handle manually or via future subscription logic

If we want to keep the system very lean, renewal automation can wait until v2.

---

# Validation rules

- only `.com`
- ASCII only in v1
- no premium domains
- domain must be available at time of registration
- contact form required before registration
- one included domain per wedding website

---

# Error handling

The system must gracefully handle:
- domain becomes unavailable between search and checkout
- OpenSRS timeout
- Cloudflare zone creation error
- nameserver update failure
- DNS record creation failure

For every failure:
- save the error to `domains.last_error_message`
- save the error to `provisioning_jobs.last_error`
- retry if safe

---

# Suggested implementation order

## Phase 1
- create DB tables
- build OpenSRS search client
- build `GET /api/domains/search`

## Phase 2
- build contact validation
- build `POST /api/domains/register`
- save DB rows
- enqueue job

## Phase 3
- build worker
- register domain in OpenSRS
- create Cloudflare zone
- update nameservers
- create DNS records

## Phase 4
- add retries and failure handling
- add admin page to inspect failed provisioning

---

# Final recommendation

For **fastest real-world v1**, keep it to:
- `.com` only
- OpenSRS + Cloudflare
- 3 DB tables
- 8 PHP files total
- background worker included

This is still a moderate feature because it touches:
- search
- checkout
- registrar APIs
- DNS APIs
- ownership/compliance data
- retries and failure recovery

But it does **not** need a huge architecture.

The simplified version above is enough for a solid first release.
