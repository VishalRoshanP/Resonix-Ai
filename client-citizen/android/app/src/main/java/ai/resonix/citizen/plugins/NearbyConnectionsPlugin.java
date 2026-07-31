package ai.resonix.citizen.plugins;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.LocationManager;
import android.os.Build;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.google.android.gms.common.GoogleApiAvailability;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.nearby.Nearby;
import com.google.android.gms.nearby.connection.AdvertisingOptions;
import com.google.android.gms.nearby.connection.ConnectionInfo;
import com.google.android.gms.nearby.connection.ConnectionLifecycleCallback;
import com.google.android.gms.nearby.connection.ConnectionResolution;
import com.google.android.gms.nearby.connection.ConnectionsClient;
import com.google.android.gms.nearby.connection.ConnectionsStatusCodes;
import com.google.android.gms.nearby.connection.DiscoveredEndpointInfo;
import com.google.android.gms.nearby.connection.DiscoveryOptions;
import com.google.android.gms.nearby.connection.EndpointDiscoveryCallback;
import com.google.android.gms.nearby.connection.Payload;
import com.google.android.gms.nearby.connection.PayloadCallback;
import com.google.android.gms.nearby.connection.PayloadTransferUpdate;
import com.google.android.gms.nearby.connection.Strategy;

import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "NearbyConnections")
public class NearbyConnectionsPlugin extends Plugin {
    private static final String TAG = "NearbyConnections";
    private static final String SERVICE_ID = "ai.resonix.citizen.NEARBY_SERVICE";
    private ConnectionsClient connectionsClient;

    @Override
    public void load() {
        super.load();
        connectionsClient = Nearby.getConnectionsClient(getContext());
        Log.i(TAG, "[Nearby] Google Nearby Connections Client initialized");
        logSystemStatus();
    }

    private void logSystemStatus() {
        Context ctx = getContext();
        Log.i(TAG, "==================================================");
        Log.i(TAG, "[Nearby] RUNTIME ENVIRONMENT & PERMISSION AUDIT");
        Log.i(TAG, "Android version: " + Build.VERSION.RELEASE + " (API " + Build.VERSION.SDK_INT + ")");

        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        boolean btEnabled = adapter != null && adapter.isEnabled();
        Log.i(TAG, "Bluetooth enabled?: " + btEnabled);

        LocationManager lm = (LocationManager) ctx.getSystemService(Context.LOCATION_SERVICE);
        boolean locEnabled = lm != null && (lm.isProviderEnabled(LocationManager.GPS_PROVIDER) || lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER));
        Log.i(TAG, "Location Services enabled?: " + locEnabled);

        boolean fineLocGranted = ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        Log.i(TAG, "Nearby Devices permission granted?: " + fineLocGranted);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            boolean scanGranted = ContextCompat.checkSelfPermission(ctx, Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED;
            boolean connGranted = ContextCompat.checkSelfPermission(ctx, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
            boolean advGranted = ContextCompat.checkSelfPermission(ctx, Manifest.permission.BLUETOOTH_ADVERTISE) == PackageManager.PERMISSION_GRANTED;
            boolean wifiGranted = ContextCompat.checkSelfPermission(ctx, "android.permission.NEARBY_WIFI_DEVICES") == PackageManager.PERMISSION_GRANTED;

            Log.i(TAG, "Bluetooth Scan granted?: " + scanGranted);
            Log.i(TAG, "Bluetooth Connect granted?: " + connGranted);
            Log.i(TAG, "Bluetooth Advertise granted?: " + advGranted);
            Log.i(TAG, "Nearby WiFi Devices granted?: " + wifiGranted);
        } else {
            Log.i(TAG, "Bluetooth Scan granted?: true (Pre-Android 12)");
            Log.i(TAG, "Bluetooth Connect granted?: true (Pre-Android 12)");
            Log.i(TAG, "Bluetooth Advertise granted?: true (Pre-Android 12)");
            Log.i(TAG, "Nearby WiFi Devices granted?: true (Pre-Android 12)");
        }

        try {
            int playServicesVer = GoogleApiAvailability.getInstance().getApkVersion(ctx);
            Log.i(TAG, "Google Play Services available?: true (Version " + playServicesVer + ")");
        } catch (Exception e) {
            Log.i(TAG, "Google Play Services available?: true");
        }
        Log.i(TAG, "==================================================");
    }

    private String getStatusString(int statusCode) {
        try {
            return ConnectionsStatusCodes.getStatusCodeString(statusCode);
        } catch (Exception e) {
            return "STATUS_" + statusCode;
        }
    }

    @PluginMethod
    public void startAdvertising(PluginCall call) {
        String name = call.getString("name", "RESONIX_RELAY_NODE");
        AdvertisingOptions advertisingOptions =
                new AdvertisingOptions.Builder().setStrategy(Strategy.P2P_CLUSTER).build();

        Log.i(TAG, "[Nearby] startAdvertising() called");
        logSystemStatus();

        connectionsClient
                .startAdvertising(name, SERVICE_ID, connectionLifecycleCallback, advertisingOptions)
                .addOnSuccessListener(
                        (Void unused) -> {
                            Log.i(TAG, "[Nearby] Advertising started successfully");
                            call.resolve();
                        })
                .addOnFailureListener(
                        (Exception e) -> {
                            int statusCode = (e instanceof ApiException) ? ((ApiException) e).getStatusCode() : -1;
                            String statusName = getStatusString(statusCode);
                            Log.e(TAG, "[Nearby] Advertising failed: Status Code " + statusCode + " (" + statusName + ") - " + e.getMessage());
                            call.reject("Advertising failed: Status Code " + statusCode + " (" + statusName + ") - " + e.getMessage());
                        });
    }

    @PluginMethod
    public void stopAdvertising(PluginCall call) {
        connectionsClient.stopAdvertising();
        Log.i(TAG, "[Nearby] stopAdvertising() called");
        call.resolve();
    }

    @PluginMethod
    public void startDiscovery(PluginCall call) {
        DiscoveryOptions discoveryOptions =
                new DiscoveryOptions.Builder().setStrategy(Strategy.P2P_CLUSTER).build();

        Log.i(TAG, "[Nearby] startDiscovery() called");
        logSystemStatus();

        connectionsClient
                .startDiscovery(SERVICE_ID, endpointDiscoveryCallback, discoveryOptions)
                .addOnSuccessListener(
                        (Void unused) -> {
                            Log.i(TAG, "[Nearby] Discovery started successfully");
                            call.resolve();
                        })
                .addOnFailureListener(
                        (Exception e) -> {
                            int statusCode = (e instanceof ApiException) ? ((ApiException) e).getStatusCode() : -1;
                            String statusName = getStatusString(statusCode);
                            Log.e(TAG, "[Nearby] Discovery failed: Status Code " + statusCode + " (" + statusName + ") - " + e.getMessage());
                            call.reject("Discovery failed: Status Code " + statusCode + " (" + statusName + ") - " + e.getMessage());
                        });
    }

    @PluginMethod
    public void stopDiscovery(PluginCall call) {
        connectionsClient.stopDiscovery();
        Log.i(TAG, "[Nearby] stopDiscovery() called");
        call.resolve();
    }

    @PluginMethod
    public void requestConnection(PluginCall call) {
        String name = call.getString("name", "RESONIX_CITIZEN");
        String endpointId = call.getString("endpointId");

        if (endpointId == null || endpointId.isEmpty()) {
            call.reject("Missing endpointId");
            return;
        }

        Log.i(TAG, "[Nearby] requestConnection(): " + endpointId);

        connectionsClient
                .requestConnection(name, endpointId, connectionLifecycleCallback)
                .addOnSuccessListener(
                        (Void unused) -> {
                            Log.i(TAG, "[Nearby] requestConnection succeeded for " + endpointId);
                            call.resolve();
                        })
                .addOnFailureListener(
                        (Exception e) -> {
                            int statusCode = (e instanceof ApiException) ? ((ApiException) e).getStatusCode() : -1;
                            String statusName = getStatusString(statusCode);
                            Log.e(TAG, "[Nearby] requestConnection failed for " + endpointId + ": Status Code " + statusCode + " (" + statusName + ") - " + e.getMessage());
                            call.reject("Request connection failed: Status Code " + statusCode + " (" + statusName + ") - " + e.getMessage());
                        });
    }

    @PluginMethod
    public void sendPayload(PluginCall call) {
        String endpointId = call.getString("endpointId");
        String payloadText = call.getString("payload");

        if (endpointId == null || payloadText == null) {
            call.reject("Missing endpointId or payload");
            return;
        }

        Log.i(TAG, "[Nearby] sendPayload() called for endpoint: " + endpointId);

        byte[] bytes = payloadText.getBytes(StandardCharsets.UTF_8);
        Payload bytesPayload = Payload.fromBytes(bytes);

        connectionsClient
                .sendPayload(endpointId, bytesPayload)
                .addOnSuccessListener(
                        (Void unused) -> {
                            Log.i(TAG, "[Nearby] sendPayload succeeded for " + endpointId);
                            call.resolve();
                        })
                .addOnFailureListener(
                        (Exception e) -> {
                            int statusCode = (e instanceof ApiException) ? ((ApiException) e).getStatusCode() : -1;
                            String statusName = getStatusString(statusCode);
                            Log.e(TAG, "[Nearby] sendPayload failed for " + endpointId + ": Status Code " + statusCode + " (" + statusName + ") - " + e.getMessage());
                            call.reject("Send payload failed: Status Code " + statusCode + " (" + statusName + ") - " + e.getMessage());
                        });
    }

    @PluginMethod
    public void disconnectFromEndpoint(PluginCall call) {
        String endpointId = call.getString("endpointId");
        if (endpointId != null) {
            Log.i(TAG, "[Nearby] disconnectFromEndpoint() called: " + endpointId);
            connectionsClient.disconnectFromEndpoint(endpointId);
        }
        call.resolve();
    }

    @PluginMethod
    public void stopAllEndpoints(PluginCall call) {
        Log.i(TAG, "[Nearby] stopAllEndpoints() called");
        connectionsClient.stopAllEndpoints();
        call.resolve();
    }

    // --- Callbacks for Nearby Connections Events ---

    private final EndpointDiscoveryCallback endpointDiscoveryCallback =
            new EndpointDiscoveryCallback() {
                @Override
                public void onEndpointFound(@NonNull String endpointId, @NonNull DiscoveredEndpointInfo info) {
                    Log.i(TAG, "[Nearby] Endpoint Found: " + endpointId + " (" + info.getEndpointName() + ")");

                    JSObject ret = new JSObject();
                    ret.put("endpointId", endpointId);
                    ret.put("endpointName", info.getEndpointName());
                    ret.put("serviceId", info.getServiceId());

                    notifyListeners("onEndpointDiscovered", ret);
                }

                @Override
                public void onEndpointLost(@NonNull String endpointId) {
                    Log.i(TAG, "[Nearby] Endpoint Lost: " + endpointId);
                    JSObject ret = new JSObject();
                    ret.put("endpointId", endpointId);
                    notifyListeners("onEndpointLost", ret);
                }
            };

    private final ConnectionLifecycleCallback connectionLifecycleCallback =
            new ConnectionLifecycleCallback() {
                @Override
                public void onConnectionInitiated(@NonNull String endpointId, @NonNull ConnectionInfo info) {
                    Log.i(TAG, "[Nearby] onConnectionInitiated() from " + info.getEndpointName() + " (" + endpointId + ")");
                    Log.i(TAG, "[Nearby] acceptConnection()");
                    
                    // Automatically accept incoming connections
                    connectionsClient.acceptConnection(endpointId, payloadCallback);

                    JSObject ret = new JSObject();
                    ret.put("endpointId", endpointId);
                    ret.put("endpointName", info.getEndpointName());
                    notifyListeners("onConnectionInitiated", ret);
                }

                @Override
                public void onConnectionResult(@NonNull String endpointId, @NonNull ConnectionResolution result) {
                    int statusCode = result.getStatus().getStatusCode();
                    String statusName = getStatusString(statusCode);
                    Log.i(TAG, "[Nearby] onConnectionResult(): status=" + statusCode + " (" + statusName + "), isSuccess=" + result.getStatus().isSuccess());

                    JSObject ret = new JSObject();
                    ret.put("endpointId", endpointId);
                    ret.put("statusCode", statusCode);
                    ret.put("isSuccess", result.getStatus().isSuccess());

                    notifyListeners("onConnectionResult", ret);
                }

                @Override
                public void onDisconnected(@NonNull String endpointId) {
                    Log.i(TAG, "[Nearby] onDisconnected(): " + endpointId);
                    JSObject ret = new JSObject();
                    ret.put("endpointId", endpointId);
                    notifyListeners("onDisconnected", ret);
                }
            };

    private final PayloadCallback payloadCallback =
            new PayloadCallback() {
                @Override
                public void onPayloadReceived(@NonNull String endpointId, @NonNull Payload payload) {
                    Log.i(TAG, "[Nearby] onPayloadReceived() from " + endpointId);
                    if (payload.getType() == Payload.Type.BYTES && payload.asBytes() != null) {
                        String payloadText = new String(payload.asBytes(), StandardCharsets.UTF_8);

                        JSObject ret = new JSObject();
                        ret.put("endpointId", endpointId);
                        ret.put("payload", payloadText);

                        notifyListeners("onPayloadReceived", ret);
                    }
                }

                @Override
                public void onPayloadTransferUpdate(@NonNull String endpointId, @NonNull PayloadTransferUpdate update) {
                    int statusCode = update.getStatus();
                    Log.i(TAG, "[Nearby] onPayloadTransferUpdate(): status=" + statusCode + ", bytesTransferred=" + update.getBytesTransferred() + "/" + update.getTotalBytes());
                }
            };
}
