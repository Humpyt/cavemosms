package com.bulksms.groupmessage;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(NativeSmsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
