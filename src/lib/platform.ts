/**
 * Platform Detection & Adaptation Helper
 * 
 * Provides unified platform awareness across OrderFlow:
 * - Distinguishes between native mobile application (Capacitor wrapped Android/iOS)
 *   and universal web application (desktop, tablet, mobile web).
 * - Manages root CSS platform markers (.platform-native vs .platform-web).
 * - Exposes responsive viewport hooks for desktop, tablet, and mobile.
 */

import { useState, useEffect } from 'react';

export type PlatformType = 'web' | 'android' | 'ios';

export interface PlatformInfo {
  isNative: boolean;
  isWeb: boolean;
  platform: PlatformType;
  isDesktop: boolean;
  isTablet: boolean;
  isMobile: boolean;
}

/**
 * Checks if the current runtime is a native Capacitor container
 */
export function isNativePlatform(): boolean {
  if (typeof window === 'undefined') return false;

  // 1. Check for global Capacitor runtime
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } }).Capacitor;
  if (cap?.isNativePlatform && typeof cap.isNativePlatform === 'function') {
    return cap.isNativePlatform();
  }
  if (cap?.getPlatform && typeof cap.getPlatform === 'function') {
    const p = cap.getPlatform();
    return p === 'android' || p === 'ios';
  }

  // 2. Environment / Query parameter override (for development, preview, and automated tests)
  if (typeof window.location !== 'undefined') {
    try {
      const search = window.location.search;
      if (search) {
        const params = new URLSearchParams(search);
        const p = params.get('platform');
        if (p === 'native' || p === 'android' || p === 'capacitor') return true;
        if (p === 'web') return false;
      }
    } catch {
      // Ignore URL parsing errors
    }
  }

  // 3. LocalStorage override for local developer testing
  try {
    const override = localStorage.getItem('of_platform_mode');
    if (override === 'native') return true;
    if (override === 'web') return false;
  } catch {
    // Ignore storage errors
  }

  return false;
}

/**
 * Get current platform identifier
 */
export function getPlatformType(): PlatformType {
  if (!isNativePlatform()) return 'web';
  const cap = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
  const p = cap?.getPlatform?.();
  if (p === 'ios') return 'ios';
  return 'android';
}

/**
 * Initialize platform marker classes on document root
 */
export function initPlatform(): void {
  if (typeof document === 'undefined') return;

  const isNative = isNativePlatform();
  const root = document.documentElement;

  if (isNative) {
    root.classList.add('platform-native');
    root.classList.remove('platform-web');
  } else {
    root.classList.add('platform-web');
    root.classList.remove('platform-native');
  }
}

/**
 * React hook to observe platform and viewport breakpoint changes
 */
export function usePlatform(): PlatformInfo {
  const [platformInfo, setPlatformInfo] = useState<PlatformInfo>(() => {
    const isNative = isNativePlatform();
    const width = typeof window !== 'undefined' ? window.innerWidth : 1200;
    return {
      isNative,
      isWeb: !isNative,
      platform: getPlatformType(),
      isDesktop: width >= 1024,
      isTablet: width >= 768 && width < 1024,
      isMobile: width < 768,
    };
  });

  useEffect(() => {
    initPlatform();

    const handleResize = () => {
      const width = window.innerWidth;
      const isNative = isNativePlatform();
      setPlatformInfo({
        isNative,
        isWeb: !isNative,
        platform: getPlatformType(),
        isDesktop: width >= 1024,
        isTablet: width >= 768 && width < 1024,
        isMobile: width < 768,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return platformInfo;
}
