// ── FAQ Toggle ──
function toggleFaq(btn) {
  btn.classList.toggle('open');
  const answer = btn.nextElementSibling;
  if (answer) {
    answer.classList.toggle('open');
  }
}

// Ensure function is globally accessible
window.toggleFaq = toggleFaq;

document.addEventListener('DOMContentLoaded', () => {
  // ── Navbar Scroll Effect ──
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });

  // ── Code Tab Switching ──
  const tabs = document.querySelectorAll('.code-tab');
  const codeContent = document.querySelector('.code-content code');

  const codeSnippets = {
    'Python': `<span class="ln">1</span><span class="kw">import</span> mlx3
<span class="ln">2</span>
<span class="ln">3</span><span class="cm">client</span> = mlx3.Client(<span class="str">api_key=</span><span class="s">"ck_live_..."</span>)
<span class="ln">4</span>
<span class="ln">5</span><span class="comment"># Natural language deployment</span>
<span class="ln">6</span><span class="cm">job</span> = <span class="kw">await</span> client.deploy(<span class="s">"""</span>
<span class="ln">7</span>  React frontend, FastAPI backend with pandas,
<span class="ln">8</span>  PostgreSQL 16, all connected on an internal network
<span class="ln">9</span><span class="s">"""</span>)
<span class="ln">10</span>
<span class="ln">11</span><span class="comment"># Agent calls: generate_keypair, select_provider,</span>
<span class="ln">12</span><span class="comment"># create_container x3, install_packages x2,</span>
<span class="ln">13</span><span class="comment"># configure_network, setup_ide, attach_storage</span>
<span class="ln">14</span>
<span class="ln">15</span><span class="kw">async for</span> step <span class="kw">in</span> job.stream():
<span class="ln">16</span>    <span class="kw">print</span>(step.tool, step.status)
<span class="ln">17</span>
<span class="ln">18</span><span class="comment"># Verify the full action log</span>
<span class="ln">19</span><span class="cm">attestation</span> = <span class="kw">await</span> job.get_attestation()
<span class="ln">20</span><span class="kw">print</span>(attestation.eas_uid)       <span class="comment"># on Base Sepolia</span>
<span class="ln">21</span><span class="kw">print</span>(attestation.merkle_root)   <span class="comment"># recompute locally</span>`,
    'Node.js': `<span class="ln">1</span><span class="kw">const</span> { MLX3Client } = <span class="kw">require</span>(<span class="s">'mlx3-sdk'</span>);
<span class="ln">2</span><span class="kw">const</span> client = <span class="kw">new</span> <span class="cm">MLX3Client</span>({ apiKey: <span class="s">'ck_live_...'</span> });
<span class="ln">3</span>
<span class="ln">4</span><span class="kw">async function</span> <span class="cm">main</span>() {
<span class="ln">5</span>  <span class="kw">const</span> job = <span class="kw">await</span> client.deploy({
<span class="ln">6</span>    prompt: <span class="s">'React frontend, FastAPI backend with pandas, PostgreSQL 16'</span>
<span class="ln">7</span>  });
<span class="ln">8</span>
<span class="ln">9</span>  job.on(<span class="s">'step'</span>, (step) => {
<span class="ln">10</span>    console.log(step.tool, step.status);
<span class="ln">11</span>  });
<span class="ln">12</span>
<span class="ln">13</span>  <span class="kw">const</span> attestation = <span class="kw">await</span> job.getAttestation();
<span class="ln">14</span>  console.log(attestation.easUid);
<span class="ln">15</span>}`,
    'Go': `<span class="ln">1</span><span class="kw">package</span> main
<span class="ln">2</span>
<span class="ln">3</span><span class="kw">import</span> (
<span class="ln">4</span>\t<span class="s">"context"</span>
<span class="ln">5</span>\t<span class="s">"fmt"</span>
<span class="ln">6</span>\t<span class="s">"github.com/mlx3ai/mlx3-go"</span>
<span class="ln">7</span>)
<span class="ln">8</span>
<span class="ln">9</span><span class="kw">func</span> <span class="cm">main</span>() {
<span class="ln">10</span>\tclient := mlx3.NewClient(<span class="s">"ck_live_..."</span>)
<span class="ln">11</span>\tjob, _ := client.Deploy(context.Background(), <span class="s">"React frontend, FastAPI backend..."</span>)
<span class="ln">12</span>
<span class="ln">13</span>\tstream := job.Stream()
<span class="ln">14</span>\t<span class="kw">for</span> stream.Next() {
<span class="ln">15</span>\t\tstep := stream.Step()
<span class="ln">16</span>\t\tfmt.Println(step.Tool, step.Status)
<span class="ln">17</span>\t}
<span class="ln">18</span>}`,
    'REST': `<span class="ln">1</span><span class="kw">POST</span> /v1/deploy <span class="kw">HTTP/1.1</span>
<span class="ln">2</span><span class="kw">Host</span>: api.mlx3.ai
<span class="ln">3</span><span class="kw">Authorization</span>: Bearer ck_live_...
<span class="ln">4</span><span class="kw">Content-Type</span>: application/json
<span class="ln">5</span>
<span class="ln">6</span>{
<span class="ln">7</span>  <span class="s">"prompt"</span>: <span class="s">"React frontend, FastAPI backend with pandas, PostgreSQL 16"</span>
<span class="ln">8</span>}
<span class="ln">9</span>
<span class="ln">10</span><span class="comment"># Response streams SSE (Server-Sent Events)</span>
<span class="ln">11</span><span class="comment"># for agent actions and progress</span>`
  };

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const lang = tab.textContent.trim();
      if (codeContent && codeSnippets[lang]) {
        codeContent.innerHTML = codeSnippets[lang];
      }
    });
  });

  // ── Scroll Reveal (Intersection Observer) ──
  // Apply reveal to inner containers only so section backgrounds stay visible while scrolling
  const revealElements = [
    document.querySelector('#features .container'),
    document.querySelector('#how-it-works .container'),
    document.querySelector('#compare .container'),
    document.querySelector('#ecosystem .container'),
    document.querySelector('#faq .container'),
    document.querySelector('.cta-section .container')
  ].filter(Boolean);

  revealElements.forEach(el => el.classList.add('reveal'));

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

  revealElements.forEach(el => {
    revealObserver.observe(el);

    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.92 && rect.bottom > 0) {
      el.classList.add('visible');
    }
  });

  // ── Hero Canvas Particle Animation ──
  const canvas = document.getElementById('hero-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let width = canvas.width = canvas.offsetWidth;
    let height = canvas.height = canvas.offsetHeight;

    window.addEventListener('resize', () => {
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    });

    const particles = [];
    const maxParticles = 60;
    const mouse = { x: null, y: null, radius: 150 };

    window.addEventListener('mousemove', (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    });

    window.addEventListener('mouseleave', () => {
      mouse.x = null;
      mouse.y = null;
    });

    class Particle {
      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.4;
        this.vy = (Math.random() - 0.5) * 0.4;
        this.radius = Math.random() * 2 + 1;
        this.alpha = Math.random() * 0.5 + 0.2;
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0 || this.x > width) this.vx *= -1;
        if (this.y < 0 || this.y > height) this.vy *= -1;

        // Interaction with mouse
        if (mouse.x !== null && mouse.y !== null) {
          const dx = mouse.x - this.x;
          const dy = mouse.y - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < mouse.radius) {
            const force = (mouse.radius - dist) / mouse.radius;
            this.x -= dx * force * 0.02;
            this.y -= dy * force * 0.02;
          }
        }
      }

      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(120, 80, 255, ${this.alpha})`;
        ctx.fill();
      }
    }

    for (let i = 0; i < maxParticles; i++) {
      particles.push(new Particle());
    }

    function animate() {
      ctx.clearRect(0, 0, width, height);

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 120) {
            const alpha = (120 - dist) / 120 * 0.15;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(74, 222, 128, ${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      particles.forEach(p => {
        p.update();
        p.draw();
      });

      requestAnimationFrame(animate);
    }

    animate();
  }

  // ── Navbar SlideTabs & ScrollSpy Interaction ──
  const navTabs = document.getElementById('nav-tabs');
  const navCursor = document.getElementById('nav-tabs-cursor');
  const navItems = document.querySelectorAll('.nav-tab-item');
  const sections = [
    document.getElementById('home'),
    document.getElementById('features'),
    document.getElementById('how-it-works'),
    document.getElementById('compare'),
    document.getElementById('faq')
  ];

  if (navTabs && navCursor) {
    let activeTab = null;
    let isHovering = false;

    // Function to update the cursor position to a specific tab element
    function updateCursor(tabEl) {
      if (tabEl) {
        navCursor.style.left = `${tabEl.offsetLeft}px`;
        navCursor.style.width = `${tabEl.offsetWidth}px`;
        navCursor.style.opacity = '1';
      } else {
        navCursor.style.opacity = '0';
      }
    }

    // Function to update the active tab based on scroll position (ScrollSpy)
    function updateScrollSpy() {
      let currentActive = null;
      const scrollPos = window.scrollY + 120; // Offset for early triggers

      sections.forEach((sec, idx) => {
        if (sec) {
          const top = sec.offsetTop;
          const height = sec.offsetHeight;
          if (scrollPos >= top && scrollPos < top + height) {
            currentActive = navItems[idx];
          }
        }
      });

      // Special case: if scrolled near the very bottom, activate FAQ
      if ((window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight - 50) {
        currentActive = navItems[navItems.length - 1];
      }

      // Update active class on tab links
      navItems.forEach(item => {
        if (item === currentActive) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });

      activeTab = currentActive;

      // Only update cursor visually if the user is not actively hovering the navigation tabs
      if (!isHovering) {
        updateCursor(activeTab);
      }
    }

    // Set initial position
    setTimeout(updateScrollSpy, 150);

    // Hover events on tab items
    navItems.forEach(tab => {
      tab.addEventListener('mouseenter', () => {
        isHovering = true;
        updateCursor(tab);
      });
    });

    // Reset cursor when mouse leaves the navbar links area
    navTabs.addEventListener('mouseleave', () => {
      isHovering = false;
      updateCursor(activeTab);
    });

    // Handle scroll for ScrollSpy
    window.addEventListener('scroll', updateScrollSpy);

    // Also update on window resize (to correct offsets/widths)
    window.addEventListener('resize', () => {
      updateCursor(isHovering ? null : activeTab);
    });
  }
});
