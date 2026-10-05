## ADDED Requirements

### Requirement: Contact Form Submits to a Real Endpoint

The Contact page SHALL submit the quote request as JSON to `POST /api/contact` on the site's own origin,
SHALL disable the submit button while a request is in flight, and SHALL no longer display the "demo
form" disclaimer. Client-side validation for name, email, service and message SHALL remain.

#### Scenario: Successful submission

- **WHEN** a visitor completes the required fields and submits
- **THEN** the form sends one request, shows the "Thanks — we got it!" confirmation, and the button was
  disabled during the request

#### Scenario: Double click

- **WHEN** a visitor activates submit twice quickly
- **THEN** only one request is sent

#### Scenario: Server rejects a field

- **WHEN** the endpoint returns 400 naming an invalid field
- **THEN** the form stays open, input is preserved, and the field shows its error

#### Scenario: Delivery failure

- **WHEN** the endpoint returns 502 or the network fails
- **THEN** the form stays open with the visitor's input preserved and an error message that includes the shop phone number (314) 921-7075 as a tap-to-call link

### Requirement: Request Validation Is Shared and Enforced Server-Side

The request shape and field limits SHALL be defined once and used by both the form and the handler. The
handler SHALL require `name`, `email`, `service` (one of the form's options) and `message`, accept optional
`phone` and `qty`, enforce a maximum length on every field, reject bodies over a size cap and any
`Content-Type` other than `application/json`, and answer invalid requests with 400 and a JSON body naming
the offending fields.

#### Scenario: Invalid email

- **WHEN** a request has `email` of `not-an-email`
- **THEN** the handler returns 400 naming `email` and sends no mail

#### Scenario: Oversized body

- **WHEN** a request body exceeds the size cap
- **THEN** the handler returns 413 or 400 and sends no mail

#### Scenario: Unknown service

- **WHEN** `service` is not one of the allowed options
- **THEN** the handler returns 400 naming `service`

#### Scenario: Client and server agree

- **WHEN** the same sample inputs are given to the form validator and the handler validator
- **THEN** both accept and reject the same set

### Requirement: Abuse Controls Run Before Any Email Is Sent

The handler SHALL verify the Cloudflare Turnstile token server-side and reject a missing or invalid token
with 400 before sending anything. A request whose hidden honeypot field is non-empty SHALL receive a 200
success response and send no mail. API Gateway stage throttling SHALL bound request volume. The function SHALL also have a
reserved-concurrency cap whenever the account's Lambda quota allows one.

#### Scenario: Missing Turnstile token

- **WHEN** a request has no Turnstile token
- **THEN** the handler returns 400 and sends no mail

#### Scenario: Failed Turnstile verification

- **WHEN** Cloudflare reports the token invalid
- **THEN** the handler returns 400 and sends no mail

#### Scenario: Honeypot filled

- **WHEN** the honeypot field contains text
- **THEN** the response is 200 and no mail is sent

#### Scenario: Turnstile secret is not in state

- **WHEN** Terraform state is inspected
- **THEN** it contains no Turnstile secret value, and the SSM parameter's value is set out of band

### Requirement: The Shop Receives Every Valid Quote Request

For a valid request, the handler SHALL send an owner notification from `quotes@stitchesncolorstudio.com`
(display name "Stitches-n-Color Studio") to the configured recipient list, with `Reply-To` set to the
customer's address, a subject containing the service and customer name, and all submitted fields in the
body as multipart text and HTML.

#### Scenario: Owner notification content

- **WHEN** a valid request is processed
- **THEN** the recipients are the configured owner addresses, `Reply-To` is the customer, and the body contains name, email, phone, service, quantity and message

#### Scenario: Reply goes to the customer

- **WHEN** the owner replies to the notification
- **THEN** the reply is addressed to the customer's email

### Requirement: The Customer Receives an Auto-Reply Without Free Text

After the owner notification succeeds, the handler SHALL send the customer an auto-reply from
`quotes@stitchesncolorstudio.com` with `Reply-To` set to the shop inbox. It SHALL use a fixed template
that thanks the customer, states the hours and phone number, and echoes only the service and quantity.
It SHALL NOT include the free-text `message`.

#### Scenario: Auto-reply content

- **WHEN** a valid request is processed
- **THEN** the customer receives a message containing the service and quantity, the shop hours and phone, and none of the submitted message text

#### Scenario: Attacker-chosen prose

- **WHEN** the message field contains a hostile or promotional text
- **THEN** that text appears in the owner notification only and never in the auto-reply

### Requirement: Failure Semantics Protect the Lead

If the owner notification fails, the handler SHALL return 502 and SHALL NOT send an auto-reply. If the
owner notification succeeds and the auto-reply fails, the handler SHALL return 200 and log the failure.

#### Scenario: Owner send fails

- **WHEN** SES rejects the owner notification
- **THEN** the response is 502 and no auto-reply is attempted

#### Scenario: Auto-reply send fails

- **WHEN** the owner notification succeeds and the auto-reply is rejected
- **THEN** the response is 200 and the failure is logged

### Requirement: Mail Content Is Safe Against Injection

Control characters, including CR and LF, SHALL be removed from every value used in a header (subject,
display names, addresses), and every value interpolated into an HTML body SHALL be escaped.

#### Scenario: Header injection attempt

- **WHEN** `name` contains `Bob\r\nBcc: victim@example.com`
- **THEN** the composed message has no `Bcc` header and the subject is a single line

#### Scenario: HTML in a field

- **WHEN** `message` contains `<script>alert(1)</script>`
- **THEN** the HTML body contains the escaped text, not an executable tag

### Requirement: Personal Data Is Not Logged or Stored

The handler SHALL NOT persist submissions and SHALL NOT log the message body, phone number or full
email address. Logs SHALL contain the request id, service, outcome and error class.

#### Scenario: Log inspection

- **WHEN** logs for a successful submission are read
- **THEN** they contain the request id and outcome and none of the submitted free text, phone or full email

### Requirement: The Domain Is a Verified SES Sender Without Disturbing Existing Mail

`stitchesncolorstudio.com` SHALL be verified as an SES domain identity with Easy DKIM and a custom MAIL
FROM subdomain `bounce.stitchesncolorstudio.com` that carries its own MX and SPF records. The DKIM and MAIL
FROM records SHALL be created by Terraform in the Cloudflare zone. The sender address SHALL be configured
separately from the verified identity. An SES configuration set SHALL record bounces and complaints.

#### Scenario: DKIM verifies

- **WHEN** the records have propagated
- **THEN** the identity reports DKIM status SUCCESS and the MAIL FROM status SUCCESS

#### Scenario: Existing mailboxes keep working

- **WHEN** a message is sent to `jeff@stitchesncolorstudio.com` after the change
- **THEN** it is delivered as before, because the apex MX and SPF are unchanged

### Requirement: SES Is Out of the Sandbox Before Cutover

SES production access SHALL be granted for `us-east-1` before DNS cutover, so the customer auto-reply
reaches unverified addresses.

#### Scenario: Auto-reply to an unverified address

- **WHEN** a request is submitted with an email that was never verified in SES
- **THEN** the auto-reply is delivered

### Requirement: Operators Are Alerted to Failures

CloudWatch alarms on Lambda errors, API Gateway 5xx responses and SES bounce rate SHALL notify an SNS
topic subscribed by the owner's email address.

#### Scenario: Handler error

- **WHEN** the function reports an error
- **THEN** the alarm fires and the owner receives a notification email
