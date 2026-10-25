/**
 * Native Capacitor Bridge & Android Lifecycle Integration
 * 
 * Provides native Android capabilities when running inside the Capacitor container:
 * - Hardware back button handling with modal suppression and app exit rules.
 * - Status bar styling (#0F172A dark bar with light icons).
 * - Keyboard visibility awareness and layout adjustment.
 * - Splash screen auto-hide coordination after initial paint.
 * - In-app external browser link handling without disrupting the WebView session.
 */

import { isNativePlatform } from './platform';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Keyboard } from '@capacitor/keyboard';
import { Browser } from '@capacitor/browser';

let isBridgeInitialized = false;

/**
 * Initializes all native Capacitor device listeners and system styles.
 * Safe to call on all platforms (no-ops gracefully on standard web browsers).
 */
export async function initNativeBridge(): Promise<void> {
  if (isBridgeInitialized || !isNativePlatform()) return;
  isBridgeInitialized = true;

  try {
    // 1. Status Bar: Dark background (#0F172A) with crisp light icons
    await StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    await StatusBar.setBackgroundColor({ color: '#0F172A' }).catch(() => {});
    await StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
  } catch (err) {
    console.warn('[NativeBridge] StatusBar setup error:', err);
  }

  try {
    // 2. Hardware Back Button Handling on Android
    await CapApp.addListener('backButton', ({ canGoBack }) => {
      // Prioritize closing open modals, sheets, or popups first
      const activeModalClose = document.querySelector<HTMLButtonElement>(
        '[data-dismiss-modal="true"], .of-modal-close, .m-bottom-sheet-close'
      );
      if (activeModalClose) {
        activeModalClose.click();
        return;
      }

      const pathname = window.location.pathname;
      const isRoot =
        pathname === '/' ||
        pathname === '/vendor/dashboard' ||
        pathname === '/logistics/dashboard' ||
        pathname === '/login';

      if (isRoot || !canGoBack) {
        CapApp.exitApp();
      } else {
        window.history.back();
      }
    });
  } catch (err) {
    console.warn('[NativeBridge] BackButton listener error:', err);
  }

  try {
    // 3. Keyboard behavior and CSS variables
    await Keyboard.addListener('keyboardWillShow', (info) => {
      document.body.classList.add('keyboard-visible');
      document.documentElement.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`);
    });

    await Keyboard.addListener('keyboardWillHide', () => {
      document.body.classList.remove('keyboard-visible');
      document.documentElement.style.setProperty('--keyboard-height', '0px');
    });
  } catch (err) {
    console.warn('[NativeBridge] Keyboard listener error:', err);
  }

  try {
    // 4. Hide splash screen smoothly once the app shell has initialized
    setTimeout(async () => {
      await SplashScreen.hide({ fadeOutDuration: 300 }).catch(() => {});
    }, 400);
  } catch (err) {
    console.warn('[NativeBridge] SplashScreen hide error:', err);
  }
}

/**
 * Open external URL securely in Capacitor in-app browser or new web tab
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (isNativePlatform()) {
    try {
      await Browser.open({ url, presentationStyle: 'popover' });
      return;
    } catch {
      // Fall through to window.open
    }
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}
