import React from 'react';

export default function Footer() {
  return (
    <footer style={{ borderTop: '1px solid #eee', marginTop: 24, padding: '12px 20px', background: '#fff' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: '#333', fontSize: 14 }}>© {new Date().getFullYear()} SignatureThreads</div>
        <div style={{ display: 'flex', gap: 12, fontSize: 14 }}>
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy</a>
        </div>
      </div>
    </footer>
  );
}
