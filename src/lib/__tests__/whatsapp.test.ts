import { describe, it, expect } from 'vitest';
import {
  formatWhatsAppPhone,
  getPublicTrackingUrl,
  generateTrackingWhatsAppMessage,
  getWhatsAppShareUrl,
} from '../whatsapp';

describe('Phase 3: WhatsApp Workflows & Sharing Helpers', () => {
  describe('formatWhatsAppPhone', () => {
    it('converts local Nigerian 11-digit phone starting with 0 to 234 format', () => {
      expect(formatWhatsAppPhone('08031234567')).toBe('2348031234567');
      expect(formatWhatsAppPhone('08129876543')).toBe('2348129876543');
    });

    it('strips leading plus from international format', () => {
      expect(formatWhatsAppPhone('+2348031234567')).toBe('2348031234567');
      expect(formatWhatsAppPhone('+12025550199')).toBe('12025550199');
    });

    it('strips hyphens, spaces, and parentheses', () => {
      expect(formatWhatsAppPhone('+234 (080) 3123-4567')).toBe('23408031234567');
      expect(formatWhatsAppPhone('080-312-34567')).toBe('2348031234567');
    });

    it('handles empty or blank phone inputs gracefully', () => {
      expect(formatWhatsAppPhone('')).toBe('');
      expect(formatWhatsAppPhone('   ')).toBe('');
    });
  });

  describe('getPublicTrackingUrl', () => {
    it('generates a public tracking URL with encoded code', () => {
      const url = getPublicTrackingUrl('OF-TEST-1234');
      expect(url).toContain('/track/OF-TEST-1234');
    });
  });

  describe('generateTrackingWhatsAppMessage', () => {
    it('creates polite, structured customer message containing all order details', () => {
      const message = generateTrackingWhatsAppMessage({
        recipientName: 'Chioma Okeke',
        productName: 'Designer Leather Handbag',
        trackingCode: 'OF-IBD-9042',
        vendorName: 'Kemi Boutique',
        estimatedDeliveryTime: 'Same Day (2–4 hours)',
      });

      expect(message).toContain('Hello Chioma Okeke');
      expect(message).toContain('*Designer Leather Handbag*');
      expect(message).toContain('*Kemi Boutique*');
      expect(message).toContain('OF-IBD-9042');
      expect(message).toContain('/track/OF-IBD-9042');
      expect(message).toContain('Same Day (2–4 hours)');
    });
  });

  describe('getWhatsAppShareUrl', () => {
    it('builds direct wa.me link with encoded text when phone is provided', () => {
      const url = getWhatsAppShareUrl('08031234567', 'Your package is on the way!');
      expect(url.startsWith('https://wa.me/2348031234567?text=')).toBe(true);
      expect(url).toContain('Your%20package%20is%20on%20the%20way!');
    });

    it('builds contact-chooser wa.me link when phone is not provided', () => {
      const url = getWhatsAppShareUrl('', 'Check your delivery status');
      expect(url.startsWith('https://wa.me/?text=')).toBe(true);
      expect(url).toContain('Check%20your%20delivery%20status');
    });
  });
});
