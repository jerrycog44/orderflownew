/**
 * OrderFlow WhatsApp & Public Tracking Helpers
 *
 * Provides phone formatting for WhatsApp direct links (wa.me),
 * pre-composed merchant-to-customer notification messages,
 * and public tracking URL generation.
 */

/**
 * Sanitizes and formats a telephone number into the international digit-only
 * format required by WhatsApp direct links (wa.me/{phone}).
 *
 * Supports Nigerian local numbers (e.g. "08012345678" -> "2348012345678")
 * and existing international formats with '+' or punctuation.
 */
export function formatWhatsAppPhone(phone: string): string {
  if (!phone) return '';

  // Remove all non-digit characters except leading plus
  let cleaned = phone.trim().replace(/[^\d+]/g, '');

  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  } else if (cleaned.startsWith('0') && cleaned.length >= 10 && cleaned.length <= 11) {
    // Standard Nigerian 11-digit or 10-digit number starting with 0 -> prepend 234
    cleaned = `234${cleaned.replace(/^0+/, '')}`;
  }

  // Remove any remaining non-digit characters
  return cleaned.replace(/\D/g, '');
}

/**
 * Generates the full public URL for tracking a delivery.
 */
export function getPublicTrackingUrl(trackingCode: string): string {
  const base = typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'https://orderflow.ng';
  return `${base}/track/${encodeURIComponent(trackingCode.trim())}`;
}

export interface WhatsAppMessageParams {
  recipientName: string;
  productName: string;
  trackingCode: string;
  vendorName?: string;
  estimatedDeliveryTime?: string;
  podVerificationCode?: string;
}

/**
 * Composes a clear, professional message for a merchant to send to their customer via WhatsApp.
 */
export function generateTrackingWhatsAppMessage(params: WhatsAppMessageParams): string {
  const {
    recipientName,
    productName,
    trackingCode,
    vendorName,
    estimatedDeliveryTime,
    podVerificationCode,
  } = params;

  const trackingUrl = getPublicTrackingUrl(trackingCode);
  const senderGreeting = vendorName ? `from *${vendorName}*` : '';
  const estTransit = estimatedDeliveryTime ? `\n⏱ *Estimated Transit:* ${estimatedDeliveryTime}` : '';
  const pinSection = podVerificationCode
    ? `\n\n🔐 *Delivery Verification PIN:* ${podVerificationCode}\n(Please share this 4-digit code with the courier only when receiving your package)`
    : '';

  return (
    `Hello ${recipientName || 'there'}! 👋\n\n` +
    `Your delivery of *${productName}* ${senderGreeting} is being handled via *OrderFlow*.\n\n` +
    `📦 *Tracking Code:* ${trackingCode}` +
    `${estTransit}` +
    `${pinSection}\n\n` +
    `You can track your package in real-time here:\n${trackingUrl}\n\n` +
    `Thank you for your business!`
  );
}

/**
 * Generates the complete wa.me link with encoded message.
 * If phone is provided, opens direct chat with recipient.
 * If phone is empty, opens WhatsApp contact chooser with prefilled message.
 */
export function getWhatsAppShareUrl(phone: string, message: string): string {
  const cleanPhone = formatWhatsAppPhone(phone);
  const encodedText = encodeURIComponent(message);

  if (cleanPhone) {
    return `https://wa.me/${cleanPhone}?text=${encodedText}`;
  }
  return `https://wa.me/?text=${encodedText}`;
}
