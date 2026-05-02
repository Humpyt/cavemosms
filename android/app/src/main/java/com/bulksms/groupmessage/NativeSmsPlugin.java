package com.bulksms.groupmessage;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.os.Build;
import android.telephony.SmsManager;
import android.telephony.SubscriptionInfo;
import android.telephony.SubscriptionManager;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@CapacitorPlugin(
    name = "NativeSms",
    permissions = {
        @Permission(alias = "sms", strings = { "android.permission.SEND_SMS" }),
        @Permission(alias = "phone", strings = { "android.permission.READ_PHONE_STATE" })
    }
)
public class NativeSmsPlugin extends Plugin {
    private static final String ACTION_SMS_SENT = "com.bulksms.groupmessage.SMS_SENT";
    private static final long DEFAULT_RETRY_DELAY_MS = 15000L;

    private final AtomicInteger requestCodeCounter = new AtomicInteger(1000);
    private final Map<String, SendTracker> trackers = new ConcurrentHashMap<>();
    private BroadcastReceiver sentReceiver;

    @Override
    public void load() {
        super.load();
        registerSentReceiver();
        NativeSmsQueueScheduler.scheduleRecurring(getContext());
    }

    @Override
    protected void handleOnDestroy() {
        if (sentReceiver != null) {
            try {
                getContext().unregisterReceiver(sentReceiver);
            } catch (IllegalArgumentException ignored) {
                // Receiver was already unregistered.
            }
        }
        trackers.clear();
        super.handleOnDestroy();
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = buildStatus();
        call.resolve(result);
    }

    @PluginMethod
    public void requestSmsPermission(PluginCall call) {
        if (getPermissionState("sms") == PermissionState.GRANTED) {
            call.resolve(buildStatus());
            return;
        }

        requestPermissionForAlias("sms", call, "handlePermissionResult");
    }

    @PluginMethod
    public void requestPhonePermission(PluginCall call) {
        if (getPermissionState("phone") == PermissionState.GRANTED) {
            call.resolve(buildStatus());
            return;
        }

        requestPermissionForAlias("phone", call, "handlePermissionResult");
    }

    @PermissionCallback
    private void handlePermissionResult(PluginCall call) {
        call.resolve(buildStatus());
    }

    @PluginMethod
    public void send(PluginCall call) {
        if (getPermissionState("sms") != PermissionState.GRANTED) {
            call.reject("SMS permission is required before sending.");
            return;
        }

        if (!getContext().getPackageManager().hasSystemFeature(PackageManager.FEATURE_TELEPHONY_MESSAGING)) {
            call.reject("This device cannot send SMS messages.");
            return;
        }

        String phoneNumber = trim(call.getString("phoneNumber"));
        String message = trim(call.getString("message"));
        String requestId = trim(call.getString("requestId"));
        Integer logId = call.getInt("logId");
        Integer batchId = call.getInt("batchId");
        Integer subscriptionId = call.getInt("subscriptionId");

        if (phoneNumber.isEmpty()) {
            call.reject("phoneNumber is required.");
            return;
        }

        if (message.isEmpty()) {
            call.reject("message is required.");
            return;
        }

        if (requestId.isEmpty()) {
            requestId = String.format(Locale.US, "%d-%d", System.currentTimeMillis(), requestCodeCounter.incrementAndGet());
        }

        try {
            sendSmsInternal(phoneNumber, message, requestId, logId, batchId, subscriptionId);

            JSObject response = new JSObject();
            response.put("requestId", requestId);
            response.put("partCount", trackers.containsKey(requestId) ? trackers.get(requestId).totalParts : 1);
            response.put("phoneNumber", phoneNumber);
            if (logId != null) {
                response.put("logId", logId);
            }
            if (batchId != null) {
                response.put("batchId", batchId);
            }
            call.resolve(response);
        } catch (Exception exception) {
            trackers.remove(requestId);
            call.reject(exception.getMessage(), exception);
        }
    }

    @PluginMethod
    public void enqueueNativeQueue(PluginCall call) {
        String phoneNumber = trim(call.getString("phoneNumber"));
        String message = trim(call.getString("message"));
        String requestId = trim(call.getString("requestId"));
        Integer logId = call.getInt("logId");
        Integer batchId = call.getInt("batchId");
        Integer subscriptionId = call.getInt("subscriptionId");
        Integer retryCount = call.getInt("retryCount");
        Integer maxRetries = call.getInt("maxRetries");
        Long dueAt = call.getLong("dueAt");

        if (phoneNumber.isEmpty()) {
            call.reject("phoneNumber is required.");
            return;
        }

        if (message.isEmpty()) {
            call.reject("message is required.");
            return;
        }

        if (requestId.isEmpty()) {
            requestId = String.format(Locale.US, "q-%d-%d", System.currentTimeMillis(), requestCodeCounter.incrementAndGet());
        }

        try {
            JSONArray queue = loadQueue();
            JSONObject item = new JSONObject();
            item.put("requestId", requestId);
            item.put("phoneNumber", phoneNumber);
            item.put("message", message);
            item.put("logId", logId == null ? JSONObject.NULL : logId);
            item.put("batchId", batchId == null ? JSONObject.NULL : batchId);
            item.put("subscriptionId", subscriptionId == null ? JSONObject.NULL : subscriptionId);
            item.put("retryCount", retryCount == null ? 0 : retryCount);
            item.put("maxRetries", maxRetries == null ? 2 : maxRetries);
            item.put("dueAt", dueAt == null ? System.currentTimeMillis() : dueAt);
            queue.put(item);
            saveQueue(queue);
            NativeSmsQueueScheduler.scheduleImmediate(getContext());

            JSObject response = new JSObject();
            response.put("queued", queue.length());
            call.resolve(response);
        } catch (JSONException exception) {
            call.reject("Failed to enqueue native queue item.", exception);
        }
    }

    @PluginMethod
    public void processNativeQueueNow(PluginCall call) {
        if (getPermissionState("sms") != PermissionState.GRANTED) {
            call.reject("SMS permission is required before processing native queue.");
            return;
        }

        Integer maxToProcess = call.getInt("maxToProcess");
        int maxProcessCount = maxToProcess == null || maxToProcess <= 0 ? 100 : maxToProcess;
        long now = System.currentTimeMillis();
        int processed = 0;

        try {
            JSONArray queue = loadQueue();
            JSONArray remaining = new JSONArray();

            for (int index = 0; index < queue.length(); index++) {
                JSONObject item = queue.getJSONObject(index);
                long dueAt = item.optLong("dueAt", 0L);
                if (dueAt > now || processed >= maxProcessCount) {
                    remaining.put(item);
                    continue;
                }

                String requestId = item.optString("requestId", "");
                String phoneNumber = trim(item.optString("phoneNumber", ""));
                String message = trim(item.optString("message", ""));
                Integer logId = item.isNull("logId") ? null : item.optInt("logId");
                Integer batchId = item.isNull("batchId") ? null : item.optInt("batchId");
                Integer subscriptionId = item.isNull("subscriptionId") ? null : item.optInt("subscriptionId");
                int retryCount = item.optInt("retryCount", 0);
                int maxRetries = item.optInt("maxRetries", 2);

                try {
                    sendSmsInternal(phoneNumber, message, requestId, logId, batchId, subscriptionId);
                    processed += 1;
                } catch (Exception sendError) {
                    int nextRetryCount = retryCount + 1;
                    if (nextRetryCount > maxRetries) {
                        JSObject payload = buildNativeQueueFailurePayload(requestId, phoneNumber, logId, batchId, sendError.getMessage());
                        persistNativeEvent(payload);
                        notifyListeners("smsStatusChanged", payload, true);
                    } else {
                        item.put("retryCount", nextRetryCount);
                        item.put("dueAt", now + computeRetryDelayMs(nextRetryCount));
                        remaining.put(item);
                    }
                }
            }

            saveQueue(remaining);
            NativeSmsQueueScheduler.scheduleImmediate(getContext());

            JSObject response = new JSObject();
            response.put("processed", processed);
            response.put("queued", remaining.length());
            call.resolve(response);
        } catch (Exception exception) {
            call.reject("Failed to process native queue.", exception);
        }
    }

    @PluginMethod
    public void getNativeQueueStats(PluginCall call) {
        long now = System.currentTimeMillis();
        try {
            JSONArray queue = loadQueue();
            int due = 0;
            for (int index = 0; index < queue.length(); index++) {
                JSONObject item = queue.getJSONObject(index);
                if (item.optLong("dueAt", 0L) <= now) {
                    due += 1;
                }
            }

            JSObject response = new JSObject();
            response.put("total", queue.length());
            response.put("due", due);
            response.put("now", now);
            call.resolve(response);
        } catch (JSONException exception) {
            call.reject("Failed to read native queue stats.", exception);
        }
    }

    @PluginMethod
    public void clearNativeQueue(PluginCall call) {
        saveQueue(new JSONArray());
        JSObject response = new JSObject();
        response.put("cleared", true);
        call.resolve(response);
    }

    @PluginMethod
    public void drainNativeEvents(PluginCall call) {
        JSONArray drained = NativeSmsQueueScheduler.drainEvents(getContext());
        JSArray events = new JSArray();
        for (int index = 0; index < drained.length(); index++) {
            JSONObject item = drained.optJSONObject(index);
            if (item != null) {
                try {
                    events.put(JSObject.fromJSONObject(item));
                } catch (JSONException ignored) {
                    // Skip malformed persisted event item.
                }
            }
        }

        JSObject response = new JSObject();
        response.put("events", events);
        call.resolve(response);
    }

    private JSObject buildStatus() {
        JSObject result = new JSObject();
        boolean supported = getContext().getPackageManager().hasSystemFeature(PackageManager.FEATURE_TELEPHONY_MESSAGING);
        boolean smsGranted = getPermissionState("sms") == PermissionState.GRANTED;
        boolean phoneGranted = getPermissionState("phone") == PermissionState.GRANTED;

        result.put("supported", supported);
        result.put("canSend", supported && smsGranted);
        result.put("smsPermission", permissionStateValue("sms"));
        result.put("phonePermission", permissionStateValue("phone"));
        result.put("subscriptions", getSubscriptions(phoneGranted));
        result.put("defaultSubscriptionId", SubscriptionManager.getDefaultSmsSubscriptionId());
        result.put("manufacturer", Build.MANUFACTURER);
        result.put("model", Build.MODEL);
        return result;
    }

    private JSArray getSubscriptions(boolean phoneGranted) {
        JSArray subscriptions = new JSArray();
        if (!phoneGranted) {
            return subscriptions;
        }

        try {
            SubscriptionManager subscriptionManager = ContextCompat.getSystemService(getContext(), SubscriptionManager.class);
            if (subscriptionManager == null) {
                return subscriptions;
            }

            List<SubscriptionInfo> activeSubscriptions = subscriptionManager.getActiveSubscriptionInfoList();
            if (activeSubscriptions == null) {
                return subscriptions;
            }

            int defaultSmsSubscriptionId = SubscriptionManager.getDefaultSmsSubscriptionId();
            for (SubscriptionInfo subscription : activeSubscriptions) {
                JSObject item = new JSObject();
                item.put("id", subscription.getSubscriptionId());
                item.put("slotIndex", subscription.getSimSlotIndex());
                item.put("displayName", String.valueOf(subscription.getDisplayName()));
                item.put("carrierName", String.valueOf(subscription.getCarrierName()));
                item.put("defaultSms", subscription.getSubscriptionId() == defaultSmsSubscriptionId);
                subscriptions.put(item);
            }
        } catch (SecurityException ignored) {
            // Permission may still be denied at runtime.
        }

        return subscriptions;
    }

    private SmsManager getSmsManager(Integer subscriptionId) {
        if (subscriptionId != null && subscriptionId >= 0 && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            SubscriptionManager subscriptionManager = ContextCompat.getSystemService(getContext(), SubscriptionManager.class);
            if (subscriptionManager != null) {
                return getContext().getSystemService(SmsManager.class).createForSubscriptionId(subscriptionId);
            }
        }

        if (subscriptionId != null && subscriptionId >= 0) {
            return SmsManager.getSmsManagerForSubscriptionId(subscriptionId);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            SmsManager smsManager = getContext().getSystemService(SmsManager.class);
            if (smsManager != null) {
                return smsManager;
            }
        }

        return SmsManager.getDefault();
    }

    private void sendSmsInternal(
        String phoneNumber,
        String message,
        String requestId,
        Integer logId,
        Integer batchId,
        Integer subscriptionId
    ) {
        SmsManager smsManager = getSmsManager(subscriptionId);
        ArrayList<String> parts = smsManager.divideMessage(message);
        if (parts == null || parts.isEmpty()) {
            throw new IllegalArgumentException("Message body cannot be empty.");
        }

        trackers.put(requestId, new SendTracker(requestId, phoneNumber, logId, batchId, parts.size()));

        ArrayList<PendingIntent> sentIntents = new ArrayList<>();
        for (int index = 0; index < parts.size(); index++) {
            Intent sentIntent = new Intent(ACTION_SMS_SENT);
            sentIntent.setPackage(getContext().getPackageName());
            sentIntent.putExtra("requestId", requestId);
            sentIntent.putExtra("phoneNumber", phoneNumber);
            sentIntent.putExtra("logId", logId);
            sentIntent.putExtra("batchId", batchId);
            sentIntent.putExtra("partIndex", index);

            sentIntents.add(
                PendingIntent.getBroadcast(
                    getContext(),
                    requestCodeCounter.incrementAndGet(),
                    sentIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                )
            );
        }

        if (parts.size() == 1) {
            smsManager.sendTextMessage(phoneNumber, null, message, sentIntents.get(0), null);
        } else {
            smsManager.sendMultipartTextMessage(phoneNumber, null, parts, sentIntents, null);
        }
    }

    private long computeRetryDelayMs(int retryCount) {
        int multiplier = Math.max(1, Math.min(8, (int) Math.pow(2, Math.max(0, retryCount - 1))));
        return DEFAULT_RETRY_DELAY_MS * multiplier;
    }

    private JSONArray loadQueue() {
        return NativeSmsQueueScheduler.loadQueue(getContext());
    }

    private void saveQueue(JSONArray queue) {
        NativeSmsQueueScheduler.saveQueue(getContext(), queue);
    }

    private JSObject buildNativeQueueFailurePayload(
        String requestId,
        String phoneNumber,
        Integer logId,
        Integer batchId,
        String error
    ) {
        JSObject payload = new JSObject();
        payload.put("requestId", requestId);
        payload.put("phoneNumber", phoneNumber);
        payload.put("status", "failed");
        payload.put("partCount", 1);
        if (logId != null) payload.put("logId", logId);
        if (batchId != null) payload.put("batchId", batchId);
        if (error != null) payload.put("error", error);
        return payload;
    }

    private String permissionStateValue(String alias) {
        PermissionState state = getPermissionState(alias);
        return state == null ? PermissionState.PROMPT.toString() : state.toString();
    }

    private void registerSentReceiver() {
        if (sentReceiver != null) {
            return;
        }

        sentReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String requestId = intent.getStringExtra("requestId");
                if (requestId == null) {
                    return;
                }

                SendTracker tracker = trackers.get(requestId);
                if (tracker == null) {
                    return;
                }

                int resultCode = getResultCode();
                if (resultCode == Activity.RESULT_OK) {
                    tracker.completedParts += 1;
                    if (tracker.completedParts >= tracker.totalParts && !tracker.finalized) {
                        tracker.finalized = true;
                        trackers.remove(requestId);
                        JSObject payload = tracker.toPayload("sent", null, 0);
                        persistNativeEvent(payload);
                        notifyListeners("smsStatusChanged", payload, true);
                    }
                    return;
                }

                tracker.finalized = true;
                trackers.remove(requestId);
                JSObject payload = tracker.toPayload("failed", describeResultCode(resultCode), resultCode);
                persistNativeEvent(payload);
                notifyListeners(
                    "smsStatusChanged",
                    payload,
                    true
                );
            }
        };

        IntentFilter intentFilter = new IntentFilter(ACTION_SMS_SENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(sentReceiver, intentFilter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(sentReceiver, intentFilter);
        }
    }

    private String describeResultCode(int resultCode) {
        switch (resultCode) {
            case Activity.RESULT_CANCELED:
                return "SMS send was cancelled by the system.";
            case SmsManager.RESULT_ERROR_GENERIC_FAILURE:
                return "Generic carrier failure while sending SMS.";
            case SmsManager.RESULT_ERROR_RADIO_OFF:
                return "The device radio is off.";
            case SmsManager.RESULT_ERROR_NULL_PDU:
                return "The carrier rejected an empty SMS payload.";
            case SmsManager.RESULT_ERROR_NO_SERVICE:
                return "No mobile service is currently available.";
            case SmsManager.RESULT_ERROR_LIMIT_EXCEEDED:
                return "Carrier sending limit exceeded.";
            case SmsManager.RESULT_ERROR_SHORT_CODE_NOT_ALLOWED:
                return "This carrier does not allow that short code.";
            case SmsManager.RESULT_ERROR_SHORT_CODE_NEVER_ALLOWED:
                return "That short code is blocked on this device.";
            default:
                return String.format(Locale.US, "SMS send failed with result code %d.", resultCode);
        }
    }

    private String trim(String value) {
        return value == null ? "" : value.trim();
    }

    private void persistNativeEvent(JSObject payload) {
        try {
            JSONObject asJson = new JSONObject(payload.toString());
            asJson.put("timestamp", System.currentTimeMillis());
            NativeSmsQueueScheduler.appendEvent(getContext(), asJson);
        } catch (Exception ignored) {
            // Best effort persistence.
        }
    }

    private static class SendTracker {
        final String requestId;
        final String phoneNumber;
        final Integer logId;
        final Integer batchId;
        final int totalParts;
        int completedParts = 0;
        boolean finalized = false;

        SendTracker(String requestId, String phoneNumber, Integer logId, Integer batchId, int totalParts) {
            this.requestId = requestId;
            this.phoneNumber = phoneNumber;
            this.logId = logId;
            this.batchId = batchId;
            this.totalParts = totalParts;
        }

        JSObject toPayload(@NonNull String status, String error, int resultCode) {
            JSObject payload = new JSObject();
            payload.put("requestId", requestId);
            payload.put("phoneNumber", phoneNumber);
            payload.put("status", status);
            payload.put("partCount", totalParts);
            if (logId != null) {
                payload.put("logId", logId);
            }
            if (batchId != null) {
                payload.put("batchId", batchId);
            }
            if (error != null) {
                payload.put("error", error);
            }
            if (resultCode != 0) {
                payload.put("resultCode", resultCode);
            }
            return payload;
        }
    }
}
