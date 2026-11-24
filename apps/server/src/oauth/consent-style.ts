/** Static CSS for the OAuth consent page. Kept exact so the CSP hash matches the <style> element. */
export const CONSENT_STYLE = `
:root{--paper:#FBF6EC;--ink:#4A3F35;--muted:#8A7B6C;--leaf:#7FA36B;--line:#E6DCC8}
@media (prefers-color-scheme: dark){:root{--paper:#2B2621;--ink:#F1E8DA;--muted:#BFB2A1;--leaf:#9CC388;--line:#4A4038}}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--paper);color:var(--ink);font-family:"Noto Sans TC","PingFang TC","Microsoft JhengHei",system-ui,sans-serif;padding:16px}
.card{max-width:420px;width:100%;background:color-mix(in srgb,var(--paper) 92%,#fff);border:2px solid var(--line);border-radius:24px;padding:28px;box-shadow:0 6px 0 var(--line)}
h1{font-size:1.4rem;margin:0 0 8px}p{line-height:1.7;margin:8px 0;color:#5e5146}strong{color:var(--ink)}
ul{padding-left:1.2em;line-height:1.8}.row{display:flex;gap:12px;margin-top:20px}
button{flex:1;min-height:44px;font:inherit;font-size:1rem;font-weight:700;padding:12px;border-radius:999px;border:2px solid var(--ink);cursor:pointer}
button:focus-visible{outline:3px solid #A9C7DE;outline-offset:2px}
button:active{transform:translateY(1px)}
.ok{background:#6f9a5c;color:#1c2416;border-color:#6f9a5c}.no{background:transparent;color:var(--ink)}
`;
