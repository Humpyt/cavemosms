const fs = require('fs');

const path = '/opt/licensing-platform/server.js';
let src = fs.readFileSync(path, 'utf8');

const start = src.indexOf("app.get('/', (_req, res) => {");
const next = src.indexOf("app.post('/api/activate'", start);

if (start === -1 || next === -1) {
  console.error('MARKERS_NOT_FOUND');
  process.exit(2);
}

const replacement = `app.get('/', (_req, res) => {
  res.send(\`<!doctype html>
<html>
<head>
  <meta charset='utf-8'>
  <meta name='viewport' content='width=device-width,initial-scale=1'>
  <title>UG Live BulkSMS Pro</title>
  <style>
    :root {
      --color-ink:#1d1d1f;
      --color-graphite:#707070;
      --color-fog:#f5f5f7;
      --color-snow:#ffffff;
      --color-azure:#0071e3;
      --color-cobalt:#0066cc;
      --color-line:#e8e8ed;
      --radius-card:28px;
      --radius-pill:999px;
    }
    *{box-sizing:border-box}
    body{
      margin:0;
      background:var(--color-fog);
      color:var(--color-ink);
      font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
      letter-spacing:-0.003em;
    }
    .global-nav{
      position:sticky;top:0;z-index:20;
      height:44px;padding:0 16px;
      display:flex;align-items:center;justify-content:space-between;
      background:rgba(245,245,247,.92);
      border-bottom:1px solid var(--color-line);
      backdrop-filter:blur(10px);
      font-size:12px;
    }
    .global-nav a{text-decoration:none;color:var(--color-ink)}
    .global-buy{
      background:var(--color-azure);color:#fff !important;
      border-radius:var(--radius-pill);
      padding:7px 14px;
    }
    .wrap{max-width:1200px;margin:0 auto;padding:24px 16px 80px}
    .hero{text-align:center;padding:40px 0 24px}
    .logo{height:72px}
    .eyebrow{margin-top:12px;font-size:24px;line-height:1.29;letter-spacing:-0.015em;font-weight:600}
    h1{
      margin:8px 0 12px;
      font-size:clamp(44px,9vw,96px);
      line-height:1.04;
      letter-spacing:-0.022em;
      font-weight:700;
    }
    .sub{
      max-width:820px;margin:0 auto;
      color:var(--color-graphite);
      font-size:20px;line-height:1.4;
      letter-spacing:-0.01em;
      font-weight:300;
    }
    .price{
      margin-top:18px;
      font-size:clamp(30px,5vw,56px);
      line-height:1.07;letter-spacing:-0.019em;
      font-weight:700;
    }
    .price small{
      display:block;margin-top:6px;
      font-size:17px;line-height:1.47;
      letter-spacing:-0.006em;
      color:var(--color-graphite);
      font-weight:400;
    }
    .cta{margin-top:16px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
    .btn{
      font-size:17px;line-height:1.47;
      text-decoration:none;padding:8px 16px;
      border-radius:var(--radius-pill);
    }
    .btn.primary{background:var(--color-azure);color:#fff}
    .btn.link{color:var(--color-cobalt)}
    .band{margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:14px}
    .card{
      background:var(--color-snow);
      border-radius:var(--radius-card);
      padding:28px;
    }
    .card.fog{
      background:var(--color-fog);
      border:1px solid var(--color-line);
    }
    .card h3{
      margin:0 0 10px;
      font-size:40px;line-height:1.17;
      letter-spacing:-0.015em;
      font-weight:700;
    }
    .card p,.card li{
      color:var(--color-graphite);
      font-size:17px;line-height:1.47;
      letter-spacing:-0.006em;
    }
    ul,ol{margin:0;padding-left:20px}
    .feature-link{
      display:inline-block;margin-top:10px;
      color:var(--color-cobalt);
      text-decoration:none;
    }
    .gradient-stage{
      margin-top:14px;border-radius:var(--radius-card);padding:28px;color:#fff;
      background:linear-gradient(184deg, rgb(29, 29, 31) 0%, rgb(223, 231, 79) 33%, rgb(94, 156, 42) 66%, rgb(10, 134, 26) 95%);
    }
    .gradient-stage h3{
      margin:0 0 6px;
      font-size:56px;line-height:1.07;
      letter-spacing:-0.019em;
      font-weight:700;
    }
    .gradient-stage p{
      margin:0;max-width:760px;color:#fff;
      font-size:20px;line-height:1.4;
    }
    .swatches{display:flex;gap:8px;margin-top:14px}
    .sw{width:28px;height:28px;border-radius:999px;border:3px solid #fff}
    .sw.c{background:#dddc8c}.sw.b{background:#e8d0d0}.sw.i{background:#596680}
    .support{margin-top:14px}
    .support p{margin:0 0 8px}
    @media (max-width:900px){
      .band{grid-template-columns:1fr}
      .card h3{font-size:32px}
      .gradient-stage h3{font-size:40px}
    }
  </style>
</head>
<body>
  <div class='global-nav'>
    <a href='/'>UG Live BulkSMS Pro</a>
    <a class='global-buy' href='https://wa.me/254787022105' target='_blank'>Buy</a>
  </div>
  <div class='wrap'>
    <section class='hero'>
      <img src='/assets/uglive-logo.svg' class='logo' alt='UG Live'>
      <div class='eyebrow'>Enterprise Android Messaging</div>
      <h1>Send Big. Send Smart.</h1>
      <p class='sub'>Professional bulk SMS delivery for schools, SACCOs, campaigns, and operations teams with real-device sending, queue retries, and admin-managed licensing.</p>
      <div class='price'>UGX 500,000<small>One-time license per device. Onboarding support included.</small></div>
      <div class='cta'>
        <a class='btn primary' href='https://wa.me/254787022105' target='_blank'>Buy on WhatsApp</a>
        <a class='btn link' href='mailto:2humpyt@gmail.com'>Learn more</a>
      </div>
    </section>

    <section class='band'>
      <article class='card'>
        <h3>What You Get</h3>
        <ul>
          <li>Fast CSV import, segmentation tags, and group targeting</li>
          <li>Native Android SMS dispatch using active SIM devices</li>
          <li>Retry queue with pending, sent, and failed visibility</li>
          <li>Template-driven campaigns for repeat communication</li>
          <li>Admin panel for customer and license management</li>
        </ul>
        <a class='feature-link' href='mailto:2humpyt@gmail.com'>Talk to sales</a>
      </article>

      <article class='card fog'>
        <h3>How It Works</h3>
        <ol>
          <li>Purchase your license and receive activation support</li>
          <li>Install the APK on an Android phone with active SIM</li>
          <li>Grant SMS permission and select preferred SIM</li>
          <li>Import contacts and launch campaigns immediately</li>
        </ol>
        <a class='feature-link' href='https://wa.me/254787022105' target='_blank'>Request onboarding</a>
      </article>
    </section>

    <section class='gradient-stage'>
      <h3>Built for Delivery Teams</h3>
      <p>UG Live is designed for organizations that need clear control and dependable outbound messaging at scale.</p>
      <div class='swatches'>
        <span class='sw c' title='Citrus'></span>
        <span class='sw b' title='Blush'></span>
        <span class='sw i' title='Indigo'></span>
      </div>
    </section>

    <section class='card support'>
      <h3>Support & Contact</h3>
      <p>UG Live Systems | Kampala, Uganda | Daily onboarding and activation support.</p>
      <p><b>Email:</b> 2humpyt@gmail.com | <b>Phone:</b> +254 787 022 105 | <b>Web:</b> uglive.io</p>
      <div class='cta'>
        <a class='btn primary' href='https://wa.me/254787022105' target='_blank'>Start Now</a>
        <a class='btn link' href='tel:+254787022105'>Call Sales</a>
      </div>
    </section>
  </div>
</body>
</html>\`);
});

`;

src = src.slice(0, start) + replacement + src.slice(next);
fs.writeFileSync(path, src);
console.log('UPDATED_SERVER_JS');
