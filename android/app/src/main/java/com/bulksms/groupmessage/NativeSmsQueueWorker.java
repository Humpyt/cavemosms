package com.bulksms.groupmessage;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

public class NativeSmsQueueWorker extends Worker {
    public NativeSmsQueueWorker(@NonNull Context context, @NonNull WorkerParameters workerParams) {
        super(context, workerParams);
    }

    @NonNull
    @Override
    public Result doWork() {
        try {
            NativeSmsQueueScheduler.processDueQueue(getApplicationContext(), 1);
            return Result.success();
        } catch (Exception exception) {
            return Result.retry();
        }
    }
}
