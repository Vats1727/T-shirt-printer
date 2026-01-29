import React from 'react';

export default function Header() {
  return (
    <header style={{ background: 'linear-gradient(90deg,#00f0ff,#34d1ff)', padding: '12px 20px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 700, color: '#003' }}>SignatureThreads</div>
        <nav style={{ display: 'flex', gap: 18 }}>
          <a href="/" style={{ color: '#003', textDecoration: 'none' }}>Explore</a>
          <a href="/store" style={{ color: '#003', textDecoration: 'none' }}>Apparel</a>
          <a href="/" style={{ color: '#003', textDecoration: 'none' }}>Homeware</a>
          <a href="/" style={{ color: '#003', textDecoration: 'none' }}>Accessories</a>
        </nav>
      </div>
    </header>
  );
}
