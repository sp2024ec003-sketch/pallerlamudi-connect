export default function ContactsPage() {
  return <main><h1>Contact Manager</h1><section className="card">
    <p>Import a CSV with columns <code>name,phone_e164,consent_status,consent_source</code>.</p>
    <p>Only contacts with explicit <code>OPTED_IN</code> consent may be added to campaigns.</p>
    <p className="muted">CSV import endpoint and authenticated upload UI are the next integration step. Do not upload scraped or purchased lists.</p>
  </section></main>;
}
