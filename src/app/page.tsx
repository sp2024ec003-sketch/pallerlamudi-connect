export default function Home() {
  return <main>
    <h1>Pallerlamudi Connect</h1>
    <p className="muted">Selected-contact messaging · Telugu + English · Strict ₹0 API budget</p>
    <div className="grid">
      <section className="card"><h2>Contacts</h2><p>Import opted-in contacts and organize groups.</p><a className="btn" href="/contacts">Open contacts</a></section>
      <section className="card"><h2>Campaigns</h2><p>Prepare bilingual messages and select recipients.</p><a className="btn" href="/campaigns">Open campaigns</a></section>
      <section className="card"><h2>API safety</h2><p>Cloud API sending is disabled while the authorized budget is ₹0.</p><strong>₹0 / month</strong></section>
    </div>
  </main>;
}
