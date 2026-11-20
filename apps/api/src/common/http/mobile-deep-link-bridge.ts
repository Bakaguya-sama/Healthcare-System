export interface MobileBridgeOptions {
  targetUrl: string;
  title: string;
  subtitle: string;
  buttonLabel: string;
  secondaryUrl?: string;
  secondaryLabel?: string;
  hint?: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function assertSafeTargetUrl(rawUrl: string, allowRelative = false): string {
  const trimmed = rawUrl.trim();
  const isAllowedAbsolute =
    /^(?:healthcare:\/\/|https:\/\/|http:\/\/localhost(?::\d+)?(?:\/|$))/i.test(
      trimmed,
    );
  const isAllowedRelative = allowRelative && /^\/api\//i.test(trimmed);
  if (!isAllowedAbsolute && !isAllowedRelative) {
    throw new Error('Unsafe mobile bridge redirect URI');
  }
  return trimmed;
}

export function renderMobileDeepLinkBridgeHtml(
  options: MobileBridgeOptions,
): string {
  const safeTargetUrl = assertSafeTargetUrl(options.targetUrl);
  const hrefEscaped = escapeHtml(safeTargetUrl);
  const jsUrl = JSON.stringify(safeTargetUrl).replaceAll('<', '\\u003c');
  const titleEscaped = escapeHtml(options.title);
  const subtitleEscaped = escapeHtml(options.subtitle);
  const buttonLabelEscaped = escapeHtml(options.buttonLabel);
  const hintHtml = options.hint
    ? `<p class="hint">${escapeHtml(options.hint)}</p>`
    : '';
  const secondaryHtml =
    options.secondaryUrl && options.secondaryLabel
      ? `<a class="btn secondary" href="${escapeHtml(assertSafeTargetUrl(options.secondaryUrl, true))}">${escapeHtml(options.secondaryLabel)}</a>`
      : '';

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${titleEscaped}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f8fafc; color: #0f172a; padding: 20px; }
    .card { max-width: 420px; width: 100%; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 28px; text-align: center; box-shadow: 0 10px 25px rgba(15, 23, 42, 0.06); }
    h1 { font-size: 18px; margin: 0 0 10px; line-height: 1.4; }
    p { font-size: 14px; color: #475569; margin: 0 0 18px; line-height: 1.5; }
    p.hint { font-size: 12px; color: #64748b; margin: 16px 0 0; line-height: 1.45; }
    .actions { display: flex; flex-direction: column; gap: 10px; align-items: stretch; }
    a.btn { display: inline-block; background: #10b981; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 20px; border-radius: 12px; }
    a.btn.secondary { background: #f1f5f9; color: #0f172a; border: 1px solid #cbd5e1; }
    @media (prefers-color-scheme: dark) {
      body { background: #020617; color: #f8fafc; }
      .card { background: #0f172a; border-color: #1e293b; }
      p { color: #94a3b8; }
      p.hint { color: #94a3b8; }
      a.btn.secondary { background: #1e293b; color: #f8fafc; border-color: #334155; }
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>${titleEscaped}</h1>
    <p>${subtitleEscaped}</p>
    <div class="actions">
      <a id="returnBtn" class="btn" href="${hrefEscaped}">${buttonLabelEscaped}</a>
      ${secondaryHtml}
    </div>
    ${hintHtml}
  </div>
  <script>
    (function () {
      var target = ${jsUrl};
      function tryReturn() {
        try { window.location.href = target; } catch (_) {}
        setTimeout(function () { try { window.close(); } catch (_) {} }, 350);
      }
      var btn = document.getElementById('returnBtn');
      if (btn) {
        btn.addEventListener('click', function () {
          setTimeout(function () { try { window.close(); } catch (_) {} }, 350);
        });
      }
      tryReturn();
    })();
  </script>
</body>
</html>`;
}
