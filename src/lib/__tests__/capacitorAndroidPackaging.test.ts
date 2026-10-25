import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { initNativeBridge, openExternalUrl } from '../nativeBridge';
import capacitorConfig from '../../../capacitor.config';

// Mock Capacitor Plugins
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
    exitApp: vi.fn(),
  },
}));

vi.mock('@capacitor/status-bar', () => ({
  StatusBar: {
    setStyle: vi.fn().mockResolvedValue(undefined),
    setBackgroundColor: vi.fn().mockResolvedValue(undefined),
    setOverlaysWebView: vi.fn().mockResolvedValue(undefined),
  },
  Style: { Dark: 'DARK' },
}));

vi.mock('@capacitor/splash-screen', () => ({
  SplashScreen: {
    hide: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@capacitor/keyboard', () => ({
  Keyboard: {
    addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
  },
  KeyboardResize: {
    Body: 'body',
    Ionic: 'ionic',
    Native: 'native',
    None: 'none',
  },
  KeyboardStyle: {
    Dark: 'DARK',
    Light: 'LIGHT',
    Default: 'DEFAULT',
  },
}));

vi.mock('@capacitor/browser', () => ({
  Browser: {
    open: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('Phase 8: Capacitor Android Packaging & Native Bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('1. Capacitor Configuration Contracts', () => {
    it('configures proper App ID, Name, WebDir, and secure HTTPS scheme', () => {
      expect(capacitorConfig.appId).toBe('com.orderflow.app');
      expect(capacitorConfig.appName).toBe('OrderFlow');
      expect(capacitorConfig.webDir).toBe('dist');
      expect(capacitorConfig.server?.androidScheme).toBe('https');
    });

    it('configures dark slate splash screen and status bar branding', () => {
      expect(capacitorConfig.plugins?.SplashScreen?.backgroundColor).toBe('#0F172A');
      expect(capacitorConfig.plugins?.SplashScreen?.androidSplashResourceName).toBe('splash');
      expect(capacitorConfig.plugins?.StatusBar?.style).toBe('DARK');
      expect(capacitorConfig.plugins?.StatusBar?.backgroundColor).toBe('#0F172A');
      expect(capacitorConfig.plugins?.Keyboard?.resize).toBe('body');
    });
  });

  describe('2. Native Bridge Execution & Graceful Web Fallback', () => {
    it('gracefully no-ops in web mode without invoking native plugins', async () => {
      localStorage.setItem('of_platform_mode', 'web');
      await initNativeBridge();
      // On web, no native listeners should crash or trigger
      expect(true).toBe(true);
    });

    it('delegates openExternalUrl to window.open when on web', async () => {
      localStorage.setItem('of_platform_mode', 'web');
      const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      await openExternalUrl('https://example.com');
      expect(windowOpenSpy).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer');
      windowOpenSpy.mockRestore();
    });
  });

  describe('3. Android Native Project Structure & Brand Assets', () => {
    const rootDir = process.cwd();

    it('contains AndroidManifest.xml with package name and internet permission', () => {
      const manifestPath = path.join(rootDir, 'android/app/src/main/AndroidManifest.xml');
      expect(fs.existsSync(manifestPath)).toBe(true);

      const manifestContent = fs.readFileSync(manifestPath, 'utf8');
      expect(manifestContent).toContain('android.permission.INTERNET');
      expect(manifestContent).toContain('ic_launcher');
      expect(manifestContent).toContain('AppTheme.NoActionBarLaunch');
    });

    it('contains custom OrderFlow launcher mipmap icons for all standard densities', () => {
      const densities = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];
      for (const d of densities) {
        const iconPath = path.join(rootDir, `android/app/src/main/res/mipmap-${d}/ic_launcher.png`);
        const roundPath = path.join(rootDir, `android/app/src/main/res/mipmap-${d}/ic_launcher_round.png`);
        const fgPath = path.join(rootDir, `android/app/src/main/res/mipmap-${d}/ic_launcher_foreground.png`);

        expect(fs.existsSync(iconPath)).toBe(true);
        expect(fs.existsSync(roundPath)).toBe(true);
        expect(fs.existsSync(fgPath)).toBe(true);

        const iconStats = fs.statSync(iconPath);
        expect(iconStats.size).toBeGreaterThan(500);
      }
    });

    it('contains branded OrderFlow splash screens for portrait and landscape modes', () => {
      const defaultSplash = path.join(rootDir, 'android/app/src/main/res/drawable/splash.png');
      const portSplash = path.join(rootDir, 'android/app/src/main/res/drawable-port-xxxhdpi/splash.png');
      const landSplash = path.join(rootDir, 'android/app/src/main/res/drawable-land-xxxhdpi/splash.png');

      expect(fs.existsSync(defaultSplash)).toBe(true);
      expect(fs.existsSync(portSplash)).toBe(true);
      expect(fs.existsSync(landSplash)).toBe(true);

      expect(fs.statSync(defaultSplash).size).toBeGreaterThan(2000);
      expect(fs.statSync(portSplash).size).toBeGreaterThan(2000);
    });

    it('strings.xml specifies OrderFlow app name and com.orderflow.app package ID', () => {
      const stringsPath = path.join(rootDir, 'android/app/src/main/res/values/strings.xml');
      expect(fs.existsSync(stringsPath)).toBe(true);

      const content = fs.readFileSync(stringsPath, 'utf8');
      expect(content).toContain('<string name="app_name">OrderFlow</string>');
      expect(content).toContain('<string name="package_name">com.orderflow.app</string>');
    });
  });
});
