export interface MobileBridgeOptions {
  targetUrl: string;
  title: string;
  subtitle: string;
  buttonLabel: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function assertSafeTargetUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (
    !/^(?:healthcare:\/\/|https:\/\/|http:\/\/localhost(?::\d+)?(?:\/|$))/i.test(
      trimmed,
    )
  ) {
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
    p { font-size: 14px; color: #475569; margin: 0 0 22px; line-height: 1.5; }
    a.btn { display: inline-block; background: #10b981; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 20px; border-radius: 12px; }
    @media (prefers-color-scheme: dark) {
      body { background: #020617; color: #f8fafc; }
      .card { background: #0f172a; border-color: #1e293b; }
      p { color: #94a3b8; }
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>${titleEscaped}</h1>
    <p>${subtitleEscaped}</p>
    <a class="btn" href="${hrefEscaped}">${buttonLabelEscaped}</a>
  </div>
  <script>
    (function () {
      var target = ${jsUrl};
      try { window.location.replace(target); } catch (_) {}
    })();
  </script>
</body>
</html>`;
}

