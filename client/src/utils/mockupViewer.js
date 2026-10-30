/**
 * Opens a mockup or proof image safely in a new browser tab.
 * Modern Chromium browsers block top-frame navigation to base64 `data:` URLs.
 * This utility converts `data:` URLs to a trusted `blob:` Object URL or renders
 * an interactive studio canvas window so the user can inspect the high-res artwork.
 */
export function viewMockupPreview(imageUrl, title = 'Garment Proof Mockup') {
  if (!imageUrl) return;

  // If it's a base64 data URL, convert to Blob URL to bypass Chrome's top-frame navigation block
  if (imageUrl.startsWith('data:')) {
    try {
      const parts = imageUrl.split(',');
      const mimeMatch = parts[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/png';
      const byteCharacters = atob(parts[1]);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mime });
      const blobUrl = URL.createObjectURL(blob);

      // Open a window with an inspection frame
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(`
          <!DOCTYPE html>
          <html lang="en">
            <head>
              <meta charset="UTF-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
              <title>${escapeHtml(title)}</title>
              <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body {
                  background-color: #0b0f19;
                  color: #e2e8f0;
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                  display: flex;
                  flex-direction: column;
                  min-height: 100vh;
                }
                header {
                  padding: 14px 24px;
                  background: rgba(15, 23, 42, 0.85);
                  backdrop-filter: blur(8px);
                  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                }
                .title {
                  font-size: 14px;
                  font-weight: 700;
                  letter-spacing: -0.01em;
                  display: flex;
                  align-items: center;
                  gap: 8px;
                }
                .badge {
                  background: #4f46e5;
                  color: #fff;
                  font-size: 10px;
                  font-weight: 800;
                  padding: 2px 8px;
                  border-radius: 9999px;
                  text-transform: uppercase;
                  letter-spacing: 0.05em;
                }
                .actions {
                  display: flex;
                  gap: 10px;
                }
                .btn {
                  padding: 6px 14px;
                  border-radius: 8px;
                  font-size: 12px;
                  font-weight: 600;
                  text-decoration: none;
                  cursor: pointer;
                  transition: all 0.2s;
                  display: inline-flex;
                  align-items: center;
                  gap: 6px;
                }
                .btn-download {
                  background: #6366f1;
                  color: #fff;
                  border: none;
                }
                .btn-download:hover {
                  background: #4f46e5;
                }
                main {
                  flex: 1;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  padding: 24px;
                }
                .preview-container {
                  background: radial-gradient(circle at center, #1e293b 0%, #0f172a 100%);
                  border: 1px solid rgba(255, 255, 255, 0.1);
                  border-radius: 16px;
                  padding: 32px;
                  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  max-width: 95vw;
                  max-height: 85vh;
                }
                img {
                  max-width: 100%;
                  max-height: 75vh;
                  object-fit: contain;
                  filter: drop-shadow(0 15px 25px rgba(0, 0, 0, 0.5));
                }
              </style>
            </head>
            <body>
              <header>
                <div class="title">
                  <span>${escapeHtml(title)}</span>
                  <span class="badge">Visual Proof</span>
                </div>
                <div class="actions">
                  <a href="${blobUrl}" download="${slugify(title)}.png" class="btn btn-download">
                    ⬇ Download Mockup
                  </a>
                </div>
              </header>
              <main>
                <div class="preview-container">
                  <img src="${blobUrl}" alt="${escapeHtml(title)}" />
                </div>
              </main>
            </body>
          </html>
        `);
        win.document.close();
        return;
      }

      // Fallback if popup window was blocked
      window.open(blobUrl, '_blank');
      return;
    } catch (err) {
      console.error('viewMockupPreview error:', err);
    }
  }

  // Normal HTTP or API URL: open directly
  window.open(imageUrl, '_blank', 'noopener,noreferrer');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugify(str) {
  if (!str) return 'mockup-preview';
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

