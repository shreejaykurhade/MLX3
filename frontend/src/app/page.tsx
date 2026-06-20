
"use client";

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import Head from 'next/head';

export default function LandingPage() {
  const { isConnected } = useAccount();
  const router = useRouter();

  useEffect(() => {
    if (isConnected) {
      router.push('/dashboard');
    }
  }, [isConnected, router]);

  return (
    <div className="landing-page-root">
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('/landing/style.css');
        .landing-page-root {
           /* isolation if needed, but style.css is global */
        }
      `}} />
      

  {/*  ── NAV ──  */}
  <nav id="navbar">
    <div className="nav-inner">
      <a href="#" className="nav-logo">
        <span className="nav-logo-wrapper">
          <video className="nav-logo-video" autoPlay loop muted playsInline width="46" height="46">
            <source src="/landing/monadslogo_transparent.webm?v=14" type="video/webm" />
          </video>
        </span>
        <span className="nav-logo-text">MLX<span className="logo-3">3</span></span>
      </a>
      <div className="nav-links" id="nav-tabs">
        <a href="#home" className="nav-tab-item" data-index="0">Home</a>
        <a href="#features" className="nav-tab-item" data-index="1">Features</a>
        <a href="#how-it-works" className="nav-tab-item" data-index="2">How It Works</a>
        <a href="#compare" className="nav-tab-item" data-index="3">Compare</a>
        <a href="#faq" className="nav-tab-item" data-index="4">FAQ</a>
        <span className="nav-tabs-cursor" id="nav-tabs-cursor"></span>
      </div>
      <div className="nav-actions">
        <a href="https://github.com/shreejaykurhade/MLX3"  className="btn-ghost">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path
              d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          GitHub
        </a>
        <ConnectButton />
      </div>
    </div>
  </nav>

  {/*  ── HERO ──  */}
  <section className="hero" id="home">
    <canvas id="hero-canvas"></canvas>
    <div className="hero-gradient"></div>
    <div className="hero-content">
      <div className="hero-badge">
        <span className="badge-dot"></span>
        Live on Base Sepolia · EAS Attested · x402 Payments
      </div>
      <h1 className="hero-heading">
        Every cloud asks you<br />
        to <span className="dim-text">trust them.</span>
      </h1>
      <p className="hero-sub">We are the only one that proves you cannot.</p>
      <p className="hero-desc">
        Describe your stack in plain English. An AI agent deploys it in under 60 seconds with SHA256-encrypted containers,
        per-provider EAS attestation, and x402 micropayments.
      </p>
      <div className="hero-ctas">
        <a href="/dashboard" 
          className="btn-primary btn-lg">Launch App</a>
        <a href="https://github.com/shreejaykurhade/MLX3" 
          className="btn-outline btn-lg">View on GitHub</a>
      </div>
    </div>
    {/*  Floating tech pills  */}
    <div className="hero-pills">
      <span className="pill">SHA256 Encrypted</span>
      <span className="pill">EAS Attested</span>
      <span className="pill">x402 Payments</span>
      <span className="pill">AI Agent</span>
    </div>
  </section>

  {/*  ── SECTION TRANSITION dark→light ──  */}
  <div className="transition-dark-light"></div>

  {/*  ── FEATURES ──  */}
  <section id="features" className="section-light">
    <div className="container">
      <p className="section-label">Agentic Deployment SDK</p>
      <h2 className="section-heading-dark">
        Describe your stack.<br />
        <span className="dim-dark">The agent handles everything.</span>
      </h2>
      <p className="section-sub-dark">
        The agent uses Claude with a fixed set of constrained tools. No raw shell access. No filesystem access outside
        your mounted volume. Every call is logged and the merkle root is attested on-chain.
      </p>

      {/*  Tool pills  */}
      <div className="tool-pills">
        <span className="tool-pill">analyze_repo()</span>
        <span className="tool-pill">select_provider()</span>
        <span className="tool-pill">create_container()</span>
        <span className="tool-pill">install_packages()</span>
        <span className="tool-pill">configure_network()</span>
        <span className="tool-pill">attach_storage()</span>
        <span className="tool-pill">setup_ide()</span>
        <span className="tool-pill">setup_database()</span>
        <span className="tool-pill">generate_keypair()</span>
        <span className="tool-pill">health_check()</span>
        <span className="tool-pill">get_logs()</span>
        <span className="tool-pill">destroy_container()</span>
      </div>

      {/*  Code block  */}
      <div className="code-block">
        <div className="code-tabs">
          <span className="code-tab active">Python</span>
          <span className="code-tab">Node.js</span>
          <span className="code-tab">Go</span>
          <span className="code-tab">REST</span>
        </div>
        <pre
          className="code-content"><code><span className="ln">1</span><span className="kw">import</span> mlx3

<span className="ln">3</span><span className="cm">client</span> = mlx3.Client(<span className="str">api_key=</span><span className="s">"ck_live_..."</span>)

<span className="ln">6</span><span className="comment"># Natural language deployment</span>
<span className="ln">7</span><span className="cm">job</span> = <span className="kw">await</span> client.deploy(<span className="s">"""</span>
<span className="ln">8</span>  React frontend, FastAPI backend with pandas,
<span className="ln">9</span>  PostgreSQL 16, all connected on an internal network
<span className="ln">10</span><span className="s">"""</span>)

<span className="ln">12</span><span className="comment"># Agent calls: generate_keypair, select_provider,</span>
<span className="ln">13</span><span className="comment"># create_container x3, install_packages x2,</span>
<span className="ln">14</span><span className="comment"># configure_network, setup_ide, attach_storage</span>
<span className="ln">15</span><span className="comment"># Every call is logged and attested on-chain</span>

<span className="ln">17</span><span className="kw">async for</span> step <span className="kw">in</span> job.stream():
<span className="ln">18</span>    <span className="kw">print</span>(step.tool, step.status)

<span className="ln">20</span><span className="comment"># Verify the full action log</span>
<span className="ln">21</span><span className="cm">attestation</span> = <span className="kw">await</span> job.get_attestation()
<span className="ln">22</span><span className="kw">print</span>(attestation.eas_uid)       <span className="comment"># on Base Sepolia</span>
<span className="ln">23</span><span className="kw">print</span>(attestation.merkle_root)   <span className="comment"># recompute locally</span></code></pre>
      </div>



      {/*  Stat cards  */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-num">&lt; 60s</div>
          <div className="stat-label">Deployment time</div>
          <div className="stat-desc">From natural language to running encrypted containers with access credentials</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">x402</div>
          <div className="stat-label">Payment model</div>
          <div className="stat-desc">HTTP-native per-request micropayments. No central gatekeeper, no lock-in</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">EAS</div>
          <div className="stat-label">On-chain proof</div>
          <div className="stat-desc">Per-provider attestation on Base Sepolia, signed by the provider wallet, not ours</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">SHA256</div>
          <div className="stat-label">Data privacy</div>
          <div className="stat-desc">Filesystem encrypted with your key, generated in your browser, never sent to the server
          </div>
        </div>
      </div>
    </div>
  </section>

  {/*  ── SECTION TRANSITION light→dark ──  */}
  <div className="transition-light-dark"></div>

  {/*  ── HOW IT WORKS ──  */}
  <section id="how-it-works" className="section-dark">
    <div className="container">
      <p className="section-label-dark">Three Pillars</p>
      <h2 className="section-heading-light">
        Trust is not assumed.<br />
        <span className="dim-light">It is proven.</span>
      </h2>
      <p className="section-sub-light">
        MLX3 combines three properties no existing platform has together: agentic UX, verifiable confidentiality, and
        per-provider on-chain attestation.
      </p>

      <div className="pillars-grid">
        <div className="pillar-card">
          <div className="pillar-num">01</div>
          <h3 className="pillar-title">Confidential Containers</h3>
          <p className="pillar-desc">Every container runs with SHA256 filesystem encryption. The key is derived from your
            keypair, generated in-browser, never sent to the server. Even with root access on the host machine, the
            operator cannot read your data.</p>
        </div>
        <div className="pillar-card">
          <div className="pillar-num">02</div>
          <h3 className="pillar-title">Agentic Deployment</h3>
          <p className="pillar-desc">Describe your stack in plain English. The agent calls a constrained set of tools with
            no raw shell access and no filesystem access outside your mounted volumes. It cannot do anything you did not
            ask for.</p>
        </div>
        <div className="pillar-card">
          <div className="pillar-num">03</div>
          <h3 className="pillar-title">On-Chain Verification</h3>
          <p className="pillar-desc">Every tool call is appended to an immutable action log. The merkle root of all action
            hashes is attested on-chain via EAS, signed by the provider wallet, not ours. Recompute the root yourself to
            verify nothing extra ran.</p>
        </div>
      </div>

      <div className="pillar-ctas">
        <a href="/dashboard"  className="btn-primary">Deploy
          Now</a>
        <a href="https://github.com/shreejaykurhade/MLX3" 
          className="btn-ghost-dark">Read Architecture</a>
      </div>
    </div>

    {/*  Marquee  */}
    <div className="marquee-wrapper">
      <div className="marquee-track">
        <span className="marquee-item">Confidential Containers</span>
        <span className="marquee-item">Agentic Deployment</span>
        <span className="marquee-item">On-Chain Attestation</span>
        <span className="marquee-item">SHA256 Encryption</span>
        <span className="marquee-item">EAS on Base Sepolia</span>
        <span className="marquee-item">x402 Micropayments</span>
        <span className="marquee-item">ProviderRegistry.sol</span>
        <span className="marquee-item">Permissionless Network</span>
        <span className="marquee-item">gVisor Sandboxing</span>
        <span className="marquee-item">Merkle Action Log</span>
        <span className="marquee-item">Claude Function Calling</span>
        <span className="marquee-item">Zero Root Access</span>
        <span className="marquee-item">Confidential Containers</span>
        <span className="marquee-item">Agentic Deployment</span>
        <span className="marquee-item">On-Chain Attestation</span>
        <span className="marquee-item">SHA256 Encryption</span>
        <span className="marquee-item">EAS on Base Sepolia</span>
        <span className="marquee-item">x402 Micropayments</span>
        <span className="marquee-item">ProviderRegistry.sol</span>
        <span className="marquee-item">Permissionless Network</span>
      </div>
    </div>
  </section>

  {/*  ── COMPARE ──  */}
  <div className="transition-dark-light"></div>
  <section id="compare" className="section-light">
    <div className="container">
      <p className="section-label">Competitive Landscape</p>
      <h2 className="section-heading-dark">
        Nobody else does<br />
        <span className="dim-dark">all four.</span>
      </h2>
      <p className="section-sub-dark">
        Every competitor is missing at least one of: agentic deployment, verifiable confidentiality, per-provider
        on-chain attestation, or an open permissionless provider network.
      </p>

      <div className="table-wrapper">
        <table className="compare-table">
          <thead>
            <tr>
              <th className="col-feature">Feature</th>
              <th>AWS / GCP</th>
              <th>Replit Agent</th>
              <th>Fluence</th>
              <th>Phala</th>
              <th>Akash</th>
              <th className="col-mlx3">MLX3</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="row-label"><strong>Agentic Deployment</strong><br /><small>Natural language to running
                  infrastructure</small></td>
              <td className="cell-no">No</td>
              <td className="cell-yes">Yes</td>
              <td className="cell-no">No</td>
              <td className="cell-no">No</td>
              <td className="cell-no">No</td>
              <td className="cell-mlx3 cell-yes">Yes</td>
            </tr>
            <tr>
              <td className="row-label"><strong>Confidential Compute</strong><br /><small>Operator cannot read your
                  data</small></td>
              <td className="cell-no">No</td>
              <td className="cell-no">No</td>
              <td className="cell-partial">Roadmap</td>
              <td className="cell-partial">Partial</td>
              <td className="cell-no">No</td>
              <td className="cell-mlx3 cell-yes">Yes</td>
            </tr>
            <tr>
              <td className="row-label"><strong>On-Chain Attestation</strong><br /><small>Cryptographic proof of what the
                  agent ran</small></td>
              <td className="cell-no">No</td>
              <td className="cell-no">No</td>
              <td className="cell-no">No</td>
              <td className="cell-partial">Partial</td>
              <td className="cell-no">No</td>
              <td className="cell-mlx3 cell-yes">Full</td>
            </tr>
            <tr>
              <td className="row-label"><strong>Open Provider Network</strong><br /><small>Anyone can join as a compute
                  provider</small></td>
              <td className="cell-no">No</td>
              <td className="cell-no">No</td>
              <td className="cell-yes">Yes</td>
              <td className="cell-partial">Partial</td>
              <td className="cell-yes">Yes</td>
              <td className="cell-mlx3 cell-yes">Yes</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="compare-footnote">MLX3 is the only platform combining all four properties.</p>
    </div>
  </section>

  {/*  ── ECOSYSTEM ──  */}
  <div className="transition-light-dark"></div>
  <section className="section-dark" id="ecosystem">
    <div className="container text-center">
      <p className="section-label-dark">Ecosystem</p>
      <h2 className="section-heading-light">
        Connect any agent<br />
        <span className="dim-light">to any verified provider.</span>
      </h2>
      <p className="section-sub-light">
        MLX3 sits between AI agents and compute infrastructure, handling payments, encryption, and attestation
        transparently.
      </p>
    </div>

    {/*  ── Floating Layer Diagram ──  */}
    <div className="layer-diagram" id="layer-diagram">
      {/*  SVG connector lines drawn by JS  */}
      <svg className="layer-svg" id="layer-svg" aria-hidden="true"></svg>

      {/*  Column 1: Inputs  */}
      <div className="layer-col layer-col--left">
        <div className="layer-card" data-col="left" data-idx="0">
          <div className="lc-icon">🤖</div>
          <div className="lc-title">AI Agent</div>
          <div className="lc-sub">any client</div>
        </div>
        <div className="layer-card" data-col="left" data-idx="1">
          <div className="lc-icon">🐍</div>
          <div className="lc-title">Python SDK</div>
          <div className="lc-sub">3.10+</div>
        </div>
        <div className="layer-card" data-col="left" data-idx="2">
          <div className="lc-icon">⚡</div>
          <div className="lc-title">REST API</div>
          <div className="lc-sub">HTTP/2</div>
        </div>
        <div className="layer-card" data-col="left" data-idx="3">
          <div className="lc-icon">🌐</div>
          <div className="lc-title">Web UI</div>
          <div className="lc-sub">browser</div>
        </div>
      </div>

      {/*  Column 2: Center Hub  */}
      <div className="layer-col layer-col--center">
        <div className="layer-hub" id="layer-hub">
          <div className="hub-glow"></div>
          <div className="hub-ring hub-ring--1"></div>
          <div className="hub-ring hub-ring--2"></div>
          <div className="hub-label">MLX<span>3</span></div>
          <div className="hub-sub">Trustless Core</div>
        </div>
      </div>

      {/*  Column 3: Infrastructure  */}
      <div className="layer-col layer-col--right">
        <div className="layer-card" data-col="right" data-idx="0">
          <div className="lc-icon">🐋</div>
          <div className="lc-title">Docker</div>
          <div className="lc-sub">runtime</div>
        </div>
        <div className="layer-card" data-col="right" data-idx="1">
          <div className="lc-icon">🔐</div>
          <div className="lc-title">SHA256</div>
          <div className="lc-sub">encrypted</div>
        </div>
        <div className="layer-card" data-col="right" data-idx="2">
          <div className="lc-icon">⛓️</div>
          <div className="lc-title">Base L2</div>
          <div className="lc-sub">Ethereum</div>
        </div>
        <div className="layer-card" data-col="right" data-idx="3">
          <div className="lc-icon">📜</div>
          <div className="lc-title">EAS</div>
          <div className="lc-sub">attestation</div>
        </div>
        <div className="layer-card" data-col="right" data-idx="4">
          <div className="lc-icon">💸</div>
          <div className="lc-title">x402</div>
          <div className="lc-sub">payments</div>
        </div>
      </div>
    </div>

    <div className="container">
      <div className="metrics-strip">
        <div className="metric">
          <div className="metric-num">3</div>
          <div className="metric-label">active providers</div>
        </div>
        <div className="metric-divider"></div>
        <div className="metric">
          <div className="metric-num">&lt; 60s</div>
          <div className="metric-label">average deploy</div>
        </div>
        <div className="metric-divider"></div>
        <div className="metric">
          <div className="metric-num">1 tx</div>
          <div className="metric-label">per attestation</div>
        </div>
        <div className="metric-divider"></div>
        <div className="metric">
          <div className="metric-num">0.01 USDC</div>
          <div className="metric-label">compute per minute</div>
        </div>
      </div>
    </div>
  </section>

  {/*  ── FAQ ──  */}
  <div className="transition-dark-light"></div>
  <section id="faq" className="section-light">
    <div className="container">
      <div className="faq-layout">
        <div className="faq-sidebar">
          <h2 className="faq-heading">Frequently Asked Questions</h2>
          <p className="faq-link-text">More questions? <a href="https://github.com/shreejaykurhade/MLX3" target="_blank"
              rel="noopener noreferrer">Open an issue on GitHub</a>.</p>
        </div>
        <div className="faq-list">
          <div className="faq-item">
            <button className="faq-btn" onClick={(e) => (window as any).toggleFaq(e.currentTarget)}>
              <span>What is MLX3?</span><span className="faq-icon">+</span>
            </button>
            <div className="faq-answer">
              MLX3 is a trustless agentic cloud platform. You describe your stack in plain English, and an AI agent
              deploys it in under 60 seconds using SHA256-encrypted containers with per-provider on-chain EAS attestation
              and x402 micropayments — so you can verify everything that ran.
            </div>
          </div>
          <div className="faq-item">
            <button className="faq-btn" onClick={(e) => (window as any).toggleFaq(e.currentTarget)}>
              <span>How is this different from AWS or GCP?</span><span className="faq-icon">+</span>
            </button>
            <div className="faq-answer">
              AWS and GCP require you to trust them. MLX3 proves you don't have to: your container filesystem is
              SHA256-encrypted with a key only you possess, every agent action is merkle-attested on-chain, and payments
              are per-request with no lock-in.
            </div>
          </div>
          <div className="faq-item">
            <button className="faq-btn" onClick={(e) => (window as any).toggleFaq(e.currentTarget)}>
              <span>How do you guarantee you cannot see my data?</span><span className="faq-icon">+</span>
            </button>
            <div className="faq-answer">
              Your keypair is generated in your browser and never sent to our servers. Your container's SHA256 encryption
              key is derived from that keypair. Even with root access on the physical host, the operator sees only
              encrypted bytes.
            </div>
          </div>
          <div className="faq-item">
            <button className="faq-btn" onClick={(e) => (window as any).toggleFaq(e.currentTarget)}>
              <span>What if the agent does something unexpected?</span><span className="faq-icon">+</span>
            </button>
            <div className="faq-answer">
              The agent operates with a constrained set of tools — no raw shell access, no filesystem access outside
              your mounted volume. Every tool call is logged in an immutable action log. The merkle root is attested
              on-chain, so you can audit exactly what ran.
            </div>
          </div>
          <div className="faq-item">
            <button className="faq-btn" onClick={(e) => (window as any).toggleFaq(e.currentTarget)}>
              <span>What blockchain does MLX3 use?</span><span className="faq-icon">+</span>
            </button>
            <div className="faq-answer">
              MLX3 uses Base Sepolia (Ethereum L2) for EAS attestations and the ProviderRegistry, DeploymentEscrow, and
              JobAuction smart contracts. x402 micropayments are HTTP-native and require no gas per request.
            </div>
          </div>
          <div className="faq-item">
            <button className="faq-btn" onClick={(e) => (window as any).toggleFaq(e.currentTarget)}>
              <span>Can I become a compute provider?</span><span className="faq-icon">+</span>
            </button>
            <div className="faq-answer">
              Yes! Anyone can join as a compute provider by staking USDC in ProviderRegistry.sol. Providers earn x402
              micropayments for each compute job and build an on-chain reputation through EAS attestations signed by
              their wallet.
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  {/*  ── CTA ──  */}
  <div className="transition-light-dark"></div>
  <section className="section-dark cta-section">
    <div className="container text-center">
      <div className="cta-badge">Ready to deploy?</div>
      <h2 className="cta-heading">
        Your key.<br />
        <span className="dim-light">Your cloud.</span>
      </h2>
      <p className="cta-sub">Start deploying with cryptographic proof in under 60 seconds.</p>
      <div className="cta-buttons">
        <a href="/dashboard" 
          className="btn-primary btn-xl">Launch App →</a>
        <a href="https://github.com/shreejaykurhade/MLX3" 
          className="btn-ghost-dark btn-xl">View GitHub</a>
      </div>
    </div>
  </section>

  {/*  ── FOOTER ──  */}
  <footer className="footer">
    <div className="container footer-inner">
      <div className="footer-logo">MLX<span>3</span></div>
      <p className="footer-tagline">Trustless Agentic Cloud — every deployment is cryptographically proven.</p>
      <div className="footer-links">
        <a href="#features">Features</a>
        <a href="#how-it-works">How It Works</a>
        <a href="#compare">Compare</a>
        <a href="#faq">FAQ</a>
        <a href="https://github.com/shreejaykurhade/MLX3" >GitHub</a>
      </div>
      <p className="footer-copy">© 2025 MLX3. Live on Base Sepolia.</p>
    </div>
  </footer>

  

      <Script src="/landing/main.js" strategy="lazyOnload" />
    </div>
  );
}
