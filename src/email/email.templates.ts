// Plain inline-styled HTML, deliberately not using <style> blocks, flexbox, or CSS variables —
// most email clients (Outlook, Gmail's clipped-CSS sanitizer) only render reliably with inline
// styles on simple block/table elements. Colors are copied from the frontend's own brand tokens
// (src/styles.css) so the email actually looks like it came from the same app as the website.

const COLOR_BACKGROUND = '#f8f9ff';
const COLOR_CARD = '#ffffff';
const COLOR_BORDER = '#e2e5ee';
const COLOR_ON_BACKGROUND = '#121c2a';
const COLOR_MUTED = '#45464d';
const COLOR_FOOTER_MUTED = '#8a8d98';
const COLOR_BRAND = '#ab3500';
const COLOR_SUCCESS_BG = '#fdf0ea';
const COLOR_ERROR = '#ba1a1a';
const COLOR_ERROR_BG = '#fdeceb';

function getIconCircleHtml(variant: 'success' | 'error'): string {
  const isSuccess = variant === 'success';
  const backgroundColor = isSuccess ? COLOR_SUCCESS_BG : COLOR_ERROR_BG;
  const glyphColor = isSuccess ? COLOR_BRAND : COLOR_ERROR;
  const glyph = isSuccess ? '&#10003;' : '&#10005;';
  return `
    <div style="width:56px;height:56px;border-radius:50%;background-color:${backgroundColor};margin:0 auto 20px;line-height:56px;font-size:26px;font-weight:700;color:${glyphColor};">
      ${glyph}
    </div>
  `;
}

function getButtonHtml(label: string, href: string): string {
  return `
    <a href="${href}" style="display:inline-block;background-color:${COLOR_BRAND};color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:10px;">
      ${label}
    </a>
  `;
}

function getLinkHtml(label: string, href: string): string {
  return `<a href="${href}" style="color:${COLOR_BRAND};text-decoration:underline;font-size:13px;">${label}</a>`;
}

function wrapEmailLayout(bodyHtml: string): string {
  return `
    <div style="background-color:${COLOR_BACKGROUND};padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background-color:${COLOR_CARD};border-radius:16px;overflow:hidden;border:1px solid ${COLOR_BORDER};">
        <tr>
          <td style="padding:24px 32px;text-align:center;border-bottom:1px solid ${COLOR_BORDER};">
            <span style="font-size:18px;font-weight:700;letter-spacing:0.04em;color:${COLOR_ON_BACKGROUND};">FRAMED</span>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px;text-align:center;">
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:18px 32px;text-align:center;background-color:${COLOR_BACKGROUND};border-top:1px solid ${COLOR_BORDER};">
            <p style="margin:0;font-size:12px;color:${COLOR_FOOTER_MUTED};">FRAMED &middot; Event photography, delivered.</p>
          </td>
        </tr>
      </table>
    </div>
  `;
}

export function getPhotosDeliveredEmailHtml(params: {
  amount: number;
  receiptLink: string;
  imageLink: string;
}): string {
  const formattedAmount = params.amount.toFixed(2);
  const body = `
    ${getIconCircleHtml('success')}
    <h1 style="margin:0 0 12px;font-size:21px;color:${COLOR_ON_BACKGROUND};">Thank you for your order!</h1>
    <p style="margin:0 0 28px;font-size:14px;line-height:1.6;color:${COLOR_MUTED};">
      We've received your payment of RM ${formattedAmount}. Your photos are ready.
    </p>
    <p style="margin:0 0 16px;">${getButtonHtml('View Your Photos', params.imageLink)}</p>
    <p style="margin:0;">${getLinkHtml('View Receipt', params.receiptLink)}</p>
  `;
  return wrapEmailLayout(body);
}

export function getPaymentFailedEmailHtml(params: {
  amount: number;
  retryLink: string;
}): string {
  const formattedAmount = params.amount.toFixed(2);
  const body = `
    ${getIconCircleHtml('error')}
    <h1 style="margin:0 0 12px;font-size:21px;color:${COLOR_ON_BACKGROUND};">Your payment could not be completed</h1>
    <p style="margin:0 0 28px;font-size:14px;line-height:1.6;color:${COLOR_MUTED};">
      We couldn't process your payment of RM ${formattedAmount}. You have not been charged.
      Please try checking out again.
    </p>
    <p style="margin:0;">${getButtonHtml('Try Again', params.retryLink)}</p>
  `;
  return wrapEmailLayout(body);
}
