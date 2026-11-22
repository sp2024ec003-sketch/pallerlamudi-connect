export default function CampaignsPage() {
  return <main><h1>Campaign Manager</h1><section className="card">
    <h2>Zero-cost mode</h2>
    <p>Prepare a Telugu and English announcement, select opted-in recipients, and use manual WhatsApp handoff.</p>
    <p><strong>Cloud API outbound sending is blocked</strong> until an authorized non-zero budget is configured.</p>
    <a className="btn" href="/api/whatsapp/status">Check API status</a>
  </section></main>;
}
