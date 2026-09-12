package com.meuapp.android;

import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import org.json.JSONObject;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Solicita permissão de microfone se ainda não concedida
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.RECORD_AUDIO}, 101);
        }

        setupPrintInterface();

        handleIncomingIntent(getIntent());
    }

    private void setupPrintInterface() {
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().addJavascriptInterface(new AndroidPrintBridge(), "AndroidPrintInterface");
            Log.d(TAG, "AndroidPrintInterface registered successfully");
        } else {
            Log.w(TAG, "Could not register AndroidPrintInterface: WebView or Bridge is null");
        }
    }

    public class AndroidPrintBridge {
        @JavascriptInterface
        public void print(final String title) {
            runOnUiThread(() -> {
                try {
                    if (getBridge() == null || getBridge().getWebView() == null) {
                        Log.e(TAG, "WebView is null, cannot trigger print");
                        return;
                    }

                    WebView webView = getBridge().getWebView();
                    PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                    if (printManager == null) {
                        Log.e(TAG, "PrintManager not available on this device");
                        return;
                    }

                    String jobName = (title != null && !title.trim().isEmpty())
                            ? title.trim().replaceAll("[/\\\\?%*:|\"<>]", "_")
                            : "Prontuario_Paciente";

                    PrintDocumentAdapter printAdapter = webView.createPrintDocumentAdapter(jobName);
                    PrintAttributes.Builder builder = new PrintAttributes.Builder();
                    builder.setMediaSize(PrintAttributes.MediaSize.ISO_A4);

                    printManager.print(jobName, printAdapter, builder.build());
                    Log.d(TAG, "Android native print dialog launched successfully");
                } catch (Exception e) {
                    Log.e(TAG, "Error launching native print: " + e.getMessage(), e);
                }
            });
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingIntent(intent);
    }

    private void handleIncomingIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        Log.d(TAG, "handleIncomingIntent: action=" + action);

        Uri uri = null;
        if (Intent.ACTION_VIEW.equals(action)) {
            uri = intent.getData();
        } else if (Intent.ACTION_SEND.equals(action)) {
            uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (uri == null) {
                uri = intent.getData();
            }
        }

        if (uri != null) {
            Log.d(TAG, "Handling incoming file intent (scheme=" + uri.getScheme() + ")");
            readAndStoreJsonUri(uri);
        }
    }

    private static final long MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

    private void readAndStoreJsonUri(Uri uri) {
        try {
            // Verificação de tamanho pelo OpenableColumns, se suportado pelo ContentProvider
            try {
                android.database.Cursor cursor = getContentResolver().query(uri, null, null, null, null);
                if (cursor != null) {
                    int sizeIndex = cursor.getColumnIndex(android.provider.OpenableColumns.SIZE);
                    if (sizeIndex != -1 && cursor.moveToFirst()) {
                        long size = cursor.getLong(sizeIndex);
                        if (size > MAX_FILE_SIZE_BYTES) {
                            Log.w(TAG, "Incoming file exceeds maximum allowed limit (10MB). Rejected.");
                            cursor.close();
                            return;
                        }
                    }
                    cursor.close();
                }
            } catch (Exception ignored) {}

            InputStream inputStream = getContentResolver().openInputStream(uri);
            if (inputStream == null) {
                Log.w(TAG, "Cannot open input stream for incoming URI");
                return;
            }

            BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream));
            StringBuilder sb = new StringBuilder();
            String line;
            long totalBytesRead = 0;
            while ((line = reader.readLine()) != null) {
                totalBytesRead += line.length() + 1;
                if (totalBytesRead > MAX_FILE_SIZE_BYTES) {
                    Log.w(TAG, "Incoming file stream exceeded maximum limit of 10MB. Aborting read.");
                    reader.close();
                    inputStream.close();
                    return;
                }
                sb.append(line).append('\n');
            }
            reader.close();
            inputStream.close();

            String jsonContent = sb.toString().trim();
            if (!jsonContent.isEmpty()) {
                // Validação sintática preliminar segura antes de armazenar
                if (!jsonContent.startsWith("{") && !jsonContent.startsWith("[")) {
                    Log.w(TAG, "Incoming content is not a valid JSON structure. Aborting.");
                    return;
                }

                try {
                    if (jsonContent.startsWith("{")) {
                        new org.json.JSONObject(jsonContent);
                    } else {
                        new org.json.JSONArray(jsonContent);
                    }
                } catch (org.json.JSONException jsonErr) {
                    Log.w(TAG, "Incoming file contains invalid/malformed JSON syntax. Aborting.");
                    return;
                }

                Log.d(TAG, "Successfully validated incoming JSON file (" + jsonContent.length() + " chars)");

                // Armazena no SharedPreferences do Capacitor ("CapacitorStorage")
                SharedPreferences prefs = getSharedPreferences("CapacitorStorage", MODE_PRIVATE);
                prefs.edit().putString("pending_patient_import", jsonContent).apply();

                // Notifica a WebView (caso o app já esteja em execução)
                if (getBridge() != null && getBridge().getWebView() != null) {
                    final String quotedJson = JSONObject.quote(jsonContent);
                    getBridge().getWebView().post(() -> {
                        getBridge().getWebView().evaluateJavascript(
                            "(function() {" +
                            "  try {" +
                            "    var jsonStr = " + quotedJson + ";" +
                            "    window.dispatchEvent(new CustomEvent('pendingPatientImport', { detail: jsonStr }));" +
                            "  } catch(e) { console.error('Error dispatching pendingPatientImport', e); }" +
                            "})();",
                            null
                        );
                    });
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error reading incoming patient file: " + e.getMessage(), e);
        }
    }
}
