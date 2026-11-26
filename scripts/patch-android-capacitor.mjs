import fs from 'fs';
import path from 'path';

const root = process.cwd();
const androidRoot = path.join(root, 'android');

if (!fs.existsSync(androidRoot)) {
  console.log('[patch-android-capacitor] android/ directory does not exist yet — run `npx cap add android` first.');
  process.exit(0);
}

// 1. Patch AndroidManifest.xml with audio/background/network permissions & cleartext traffic
const manifestPath = path.join(androidRoot, 'app', 'src', 'main', 'AndroidManifest.xml');
if (fs.existsSync(manifestPath)) {
  let manifest = fs.readFileSync(manifestPath, 'utf8');

  const requiredPermissions = [
    'android.permission.INTERNET',
    'android.permission.ACCESS_NETWORK_STATE',
    'android.permission.WAKE_LOCK',
    'android.permission.FOREGROUND_SERVICE',
    'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
    'android.permission.POST_NOTIFICATIONS',
  ];

  for (const perm of requiredPermissions) {
    if (!manifest.includes(perm)) {
      manifest = manifest.replace(
        '<application',
        `    <uses-permission android:name="${perm}" />\n\n    <application`
      );
    }
  }

  if (!manifest.includes('android:usesCleartextTraffic=')) {
    manifest = manifest.replace(
      '<application',
      '<application\n        android:usesCleartextTraffic="true"'
    );
  }

  if (!manifest.includes('MediaSessionService')) {
    manifest = manifest.replace(
      '</application>',
      '        <service\n            android:name=".MediaSessionService"\n            android:foregroundServiceType="mediaPlayback"\n            android:exported="false" />\n    </application>'
    );
  }

  fs.writeFileSync(manifestPath, manifest, 'utf8');
  console.log('[patch-android-capacitor] Patched AndroidManifest.xml');
}

// 2. Patch MainActivity.kt or MainActivity.java so mediaPlaybackRequiresUserGesture = false
function findMainActivity(dir) {
  if (!fs.existsSync(dir)) return null;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findMainActivity(full);
      if (found) return found;
    } else if (entry.name === 'MainActivity.kt' || entry.name === 'MainActivity.java') {
      return full;
    }
  }
  return null;
}

const mainActivityPath = findMainActivity(path.join(androidRoot, 'app', 'src', 'main', 'java'));
if (mainActivityPath) {
  let code = fs.readFileSync(mainActivityPath, 'utf8');
  const isKotlin = mainActivityPath.endsWith('.kt');

  if (!code.includes('mediaPlaybackRequiresUserGesture') && !code.includes('setMediaPlaybackRequiresUserGesture')) {
    if (isKotlin) {
      if (!code.includes('import android.os.Bundle')) {
        code = code.replace('import com.getcapacitor.BridgeActivity', 'import android.os.Bundle\nimport android.webkit.WebSettings\nimport com.getcapacitor.BridgeActivity');
      } else if (!code.includes('import android.webkit.WebSettings')) {
        code = code.replace('import com.getcapacitor.BridgeActivity', 'import android.webkit.WebSettings\nimport com.getcapacitor.BridgeActivity');
      }
      const hook = `
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        bridge?.webView?.settings?.apply {
            mediaPlaybackRequiresUserGesture = false
            domStorageEnabled = true
            useWideViewPort = true
            loadWithOverviewMode = true
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        }
    }
`;
      if (code.includes('override fun onCreate')) {
        code = code.replace(
          /super\.onCreate\([^)]*\)/,
          `$&\n        bridge?.webView?.settings?.apply {\n            mediaPlaybackRequiresUserGesture = false\n            domStorageEnabled = true\n            useWideViewPort = true\n            loadWithOverviewMode = true\n            setSupportZoom(false)\n            builtInZoomControls = false\n            displayZoomControls = false\n            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW\n        }`
        );
      } else {
        code = code.replace(/class MainActivity[^{]*\{/, `$&\n${hook}`);
      }
    } else {
      if (!code.includes('import android.os.Bundle;')) {
        code = code.replace('import com.getcapacitor.BridgeActivity;', 'import android.os.Bundle;\nimport android.webkit.WebSettings;\nimport com.getcapacitor.BridgeActivity;');
      } else if (!code.includes('import android.webkit.WebSettings;')) {
        code = code.replace('import com.getcapacitor.BridgeActivity;', 'import android.webkit.WebSettings;\nimport com.getcapacitor.BridgeActivity;');
      }
      const hook = `
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebSettings ws = this.bridge.getWebView().getSettings();
            ws.setMediaPlaybackRequiresUserGesture(false);
            ws.setDomStorageEnabled(true);
            ws.setUseWideViewPort(true);
            ws.setLoadWithOverviewMode(true);
            ws.setSupportZoom(false);
            ws.setBuiltInZoomControls(false);
            ws.setDisplayZoomControls(false);
            ws.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }
    }
`;
      if (code.includes('onCreate(')) {
        code = code.replace(
          /super\.onCreate\([^)]*\);/,
          `$&\n        if (this.bridge != null && this.bridge.getWebView() != null) {\n            WebSettings ws = this.bridge.getWebView().getSettings();\n            ws.setMediaPlaybackRequiresUserGesture(false);\n            ws.setDomStorageEnabled(true);\n            ws.setUseWideViewPort(true);\n            ws.setLoadWithOverviewMode(true);\n            ws.setSupportZoom(false);\n            ws.setBuiltInZoomControls(false);\n            ws.setDisplayZoomControls(false);\n            ws.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);\n        }`
        );
      } else {
        code = code.replace(/class MainActivity[^{]*\{/, `$&\n${hook}`);
      }
    }
    fs.writeFileSync(mainActivityPath, code, 'utf8');
    console.log(`[patch-android-capacitor] Patched ${path.basename(mainActivityPath)}`);
  }
}
