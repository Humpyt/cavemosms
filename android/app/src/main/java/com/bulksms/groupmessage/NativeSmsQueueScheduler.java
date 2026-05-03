package com.bulksms.groupmessage;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.telephony.SmsManager;

import androidx.core.content.ContextCompat;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.concurrent.TimeUnit;

public final class NativeSmsQueueScheduler {
    public static final String PREFS_NAME = "native_sms_queue";
    public static final String PREFS_QUEUE_KEY = "queue_json";
    public static final String PREFS_EVENTS_KEY = "events_json";
    public static final String PREFS_LAST_SENT_AT_KEY = "last_sent_at_ms";
    public static final String PERIODIC_WORK_NAME = "native_sms_queue_periodic";
    public static final String IMMEDIATE_WORK_NAME = "native_sms_queue_immediate";
    private static final long BASE_RETRY_DELAY_MS = 15000L;
    private static final long DEFAULT_MIN_SEND_GAP_MS = 4000L;
    private static final Object LOCK = new Object();

    private NativeSmsQueueScheduler() {}

    public static void scheduleRecurring(Context context) {
        Constraints constraints = new Constraints.Builder()
            .setRequiredNetworkType(NetworkType.NOT_REQUIRED)
            .build();

        PeriodicWorkRequest request =
            new PeriodicWorkRequest.Builder(NativeSmsQueueWorker.class, 15, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .build();

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            PERIODIC_WORK_NAME,
            ExistingPeriodicWorkPolicy.UPDATE,
            request
        );
    }

    public static void scheduleImmediate(Context context) {
        OneTimeWorkRequest request =
            new OneTimeWorkRequest.Builder(NativeSmsQueueWorker.class).build();

        WorkManager.getInstance(context).enqueueUniqueWork(
            IMMEDIATE_WORK_NAME,
            ExistingWorkPolicy.REPLACE,
            request
        );
    }

    public static int processDueQueue(Context context, int maxToProcess) {
        synchronized (LOCK) {
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) {
                return 0;
            }

            long now = System.currentTimeMillis();
            int processed = 0;
            long lastSentAt = loadLastSentAt(context);

            JSONArray queue = loadQueue(context);
            JSONArray remaining = new JSONArray();

            for (int index = 0; index < queue.length(); index++) {
                JSONObject item = queue.optJSONObject(index);
                if (item == null) {
                    continue;
                }

                long dueAt = item.optLong("dueAt", 0L);
                if (dueAt > now || processed >= maxToProcess) {
                    remaining.put(item);
                    continue;
                }

                long minGapMs = Math.max(1000L, item.optLong("minGapMs", DEFAULT_MIN_SEND_GAP_MS));
                long earliestNextSend = lastSentAt + minGapMs;
                if (lastSentAt > 0L && now < earliestNextSend) {
                    try {
                        item.put("dueAt", earliestNextSend);
                    } catch (Exception ignored) {
                        // Keep item if dueAt mutation fails.
                    }
                    remaining.put(item);
                    continue;
                }

                String requestId = item.optString("requestId", "");
                String phoneNumber = item.optString("phoneNumber", "").trim();
                String message = item.optString("message", "").trim();
                int retryCount = item.optInt("retryCount", 0);
                int maxRetries = item.optInt("maxRetries", 2);
                Integer logId = item.isNull("logId") ? null : item.optInt("logId");
                Integer batchId = item.isNull("batchId") ? null : item.optInt("batchId");
                Integer subscriptionId = item.isNull("subscriptionId") ? null : item.optInt("subscriptionId");

                try {
                    sendNow(context, phoneNumber, message, subscriptionId);
                    appendEvent(
                        context,
                        buildEventPayload(requestId, phoneNumber, "sent", logId, batchId, null, 0)
                    );
                    lastSentAt = System.currentTimeMillis();
                    saveLastSentAt(context, lastSentAt);
                    processed += 1;
                } catch (Exception sendError) {
                    int nextRetryCount = retryCount + 1;
                    if (nextRetryCount <= Math.max(0, maxRetries)) {
                        item.remove("error");
                        item.remove("sentAt");
                        try {
                            item.put("retryCount", nextRetryCount);
                            item.put("dueAt", now + computeRetryDelayMs(nextRetryCount));
                            item.put("lastError", sendError.getMessage());
                        } catch (Exception ignored) {
                            // Keep best effort on queue item mutation.
                        }
                        remaining.put(item);
                    } else {
                        appendEvent(
                            context,
                            buildEventPayload(
                                requestId,
                                phoneNumber,
                                "failed",
                                logId,
                                batchId,
                                sendError.getMessage(),
                                -1
                            )
                        );
                    }
                }
            }

            saveQueue(context, remaining);
            return processed;
        }
    }

    static JSONArray loadQueue(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String raw = prefs.getString(PREFS_QUEUE_KEY, "[]");
        try {
            return new JSONArray(raw);
        } catch (Exception ignored) {
            return new JSONArray();
        }
    }

    static void saveQueue(Context context, JSONArray queue) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(PREFS_QUEUE_KEY, queue.toString()).apply();
    }

    public static synchronized void appendEvent(Context context, JSONObject event) {
        JSONArray events = loadEvents(context);
        events.put(event);
        saveEvents(context, events);
    }

    public static synchronized JSONArray drainEvents(Context context) {
        JSONArray events = loadEvents(context);
        saveEvents(context, new JSONArray());
        return events;
    }

    public static int removeBatchFromQueue(Context context, int batchId) {
        synchronized (LOCK) {
            JSONArray queue = loadQueue(context);
            JSONArray remaining = new JSONArray();
            int removed = 0;

            for (int index = 0; index < queue.length(); index++) {
                JSONObject item = queue.optJSONObject(index);
                if (item == null) {
                    continue;
                }

                Integer itemBatchId = item.isNull("batchId") ? null : item.optInt("batchId");
                if (itemBatchId != null && itemBatchId == batchId) {
                    removed += 1;
                    continue;
                }
                remaining.put(item);
            }

            saveQueue(context, remaining);
            return removed;
        }
    }

    private static JSONArray loadEvents(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String raw = prefs.getString(PREFS_EVENTS_KEY, "[]");
        try {
            return new JSONArray(raw);
        } catch (Exception ignored) {
            return new JSONArray();
        }
    }

    private static long loadLastSentAt(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        return prefs.getLong(PREFS_LAST_SENT_AT_KEY, 0L);
    }

    private static void saveLastSentAt(Context context, long value) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putLong(PREFS_LAST_SENT_AT_KEY, value).apply();
    }

    private static void saveEvents(Context context, JSONArray events) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(PREFS_EVENTS_KEY, events.toString()).apply();
    }

    private static long computeRetryDelayMs(int retryCount) {
        int multiplier = Math.max(1, Math.min(8, (int) Math.pow(2, Math.max(0, retryCount - 1))));
        return BASE_RETRY_DELAY_MS * multiplier;
    }

    private static void sendNow(Context context, String phoneNumber, String message, Integer subscriptionId) {
        if (phoneNumber.isEmpty()) {
            throw new IllegalArgumentException("phoneNumber is required.");
        }
        if (message.isEmpty()) {
            throw new IllegalArgumentException("message is required.");
        }

        SmsManager smsManager = getSmsManager(context, subscriptionId);
        if (smsManager == null) {
            throw new IllegalStateException("SmsManager not available.");
        }
        smsManager.sendTextMessage(phoneNumber, null, message, null, null);
    }

    private static SmsManager getSmsManager(Context context, Integer subscriptionId) {
        if (subscriptionId != null && subscriptionId >= 0) {
            return SmsManager.getSmsManagerForSubscriptionId(subscriptionId);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return ContextCompat.getSystemService(context, SmsManager.class);
        }
        return SmsManager.getDefault();
    }

    private static JSONObject buildEventPayload(
        String requestId,
        String phoneNumber,
        String status,
        Integer logId,
        Integer batchId,
        String error,
        int resultCode
    ) {
        JSONObject payload = new JSONObject();
        try {
            payload.put("requestId", requestId);
            payload.put("phoneNumber", phoneNumber);
            payload.put("status", status);
            payload.put("partCount", 1);
            if (logId != null) payload.put("logId", logId);
            if (batchId != null) payload.put("batchId", batchId);
            if (error != null) payload.put("error", error);
            if (resultCode != 0) payload.put("resultCode", resultCode);
            payload.put("timestamp", System.currentTimeMillis());
        } catch (Exception ignored) {
            // Best effort payload build.
        }
        return payload;
    }
}
