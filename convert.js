const fs = require('fs');

let html = fs.readFileSync('frontend/public/landing/index.html', 'utf8');

// Extract body innerHTML
const bodyMatch = html.match(/<body>([\s\S]*?)<\/body>/i);
let body = bodyMatch ? bodyMatch[1] : html;

// Convert to JSX
body = body.replace(/class=/g, 'className=');
body = body.replace(/for=/g, 'htmlFor=');
body = body.replace(/<!--([\s\S]*?)-->/g, '{/* $1 */}');
body = body.replace(/<br>/g, '<br />');
body = body.replace(/<hr>/g, '<hr />');
body = body.replace(/<img([^>]*[^\/])>/g, '<img$1 />');
body = body.replace(/<source([^>]*[^\/])>/g, '<source$1 />');
body = body.replace(/<input([^>]*[^\/])>/g, '<input$1 />');
body = body.replace(/style="([^"]*)"/g, (match, p1) => {
  // Very crude style conversion if needed. Luckily there are few inline styles in the landing page
  const styles = p1.split(';').filter(Boolean).map(s => {
    let [key, val] = s.split(':');
    if (!key || !val) return '';
    key = key.trim().replace(/-([a-z])/g, g => g[1].toUpperCase());
    return `${key}: '${val.trim()}'`;
  }).join(', ');
  return `style={{${styles}}}`;
});
// Remove scripts
body = body.replace(/<script[\s\S]*?<\/script>/g, '');
// Replace the top-right launch app with a placeholder for the connect button
body = body.replace(
  /<a href="\/dashboard" target="_blank" rel="noopener noreferrer" className="btn-primary">Launch\s*App<\/a>/,
  '<ConnectButton />'
);

const component = `
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
      <style dangerouslySetInnerHTML={{ __html: \`
        @import url('/landing/style.css');
        .landing-page-root {
           /* isolation if needed, but style.css is global */
        }
      \`}} />
      ${body}
      <Script src="/landing/main.js" strategy="lazyOnload" />
    </div>
  );
}
`;

fs.writeFileSync('frontend/src/app/page.tsx', component);
console.log("Converted successfully!");
