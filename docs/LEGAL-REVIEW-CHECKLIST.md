# MapleWish Legal Review Checklist

Status: implementation checklist, not a substitute for Canadian legal advice.

## Before paid public launch

- Have Canadian counsel review Privacy Policy, Terms of Use, Contribution Terms, Refund Policy, Application Terms, Applicant Privacy Notice, Story/Photo Consent and Giveaway Rules.
- Confirm Maple Vibe Inc. is the correct contracting/sponsor entity everywhere.
- Designate the individual or title acting as MapleWish Privacy Officer.
- Verify the public Contact / Privacy Request form is monitored and privacy requests have an owner.
- Confirm payment checkout clearly displays price, 50% direct-help allocation, Contribution Terms and Refund Policy before payment.
- When payments are wired, persist the Contribution Terms version accepted with each transaction.
- Confirm tax/GST/HST treatment with accounting advice before accepting material payment volume.
- Do not issue charitable tax receipts unless MapleWish later becomes legally entitled to do so.

## Quebec / French

Implemented in the product:
- Complete French public-site, application, account-recovery, contact and legal-page paths under `/fr/`.
- French Application Terms / Applicant Privacy Notice are presented before the English versions in the application workflow.
- Quebec applicants who choose English must expressly record that choice after French versions are available; language, French presentation, choice timestamp and accepted document versions are persisted.
- French Official Rules are available before English rules; Quebec entrants using English must expressly choose English and the rules language is recorded with the entry.
- Applicant verification and password-recovery email templates follow the account's preferred language.
- Contribution records have language/version fields ready for the live payment workflow.

Still required before treating Quebec compliance as final: Canadian/Quebec counsel review of the French text and workflow, final payment/receipt language handling when payments go live, and review of any other Quebec-specific consumer-law obligations that apply to MapleWish.

## Giveaway operations

- Every draw must have a prize, opening time, closing time and draw time recorded before entry opens.
- Current Draw Details and the Official Rules version must match the database.
- Keep no-purchase entry easy to find and separate from leaf purchases.
- Keep marketing consent optional and separate from contest entry.
- Record winner verification, skill-testing question completion, contact attempts and prize delivery.
- Review any sponsor-specific prize conditions before the draw opens.

## Privacy operations

- Follow docs/PRIVACY-GOVERNANCE.md.
- Review retention/deletion jobs before application volume grows.
- Review third-party processors whenever hosting, payments, email or analytics providers change.
- Do a privacy/security review before collecting new categories of sensitive documents.
- Record actual recipient publication approval before using the admin publication-approval gate.

## CASL / marketing

- Operational account/application/security emails must remain separate from marketing.
- Marketing signup must remain opt-in where required.
- Marketing messages must include required sender identification and a functioning unsubscribe mechanism.
- Keep evidence of marketing consent and unsubscribe actions.
