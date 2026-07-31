package ai.resonix.citizen;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import ai.resonix.citizen.plugins.NearbyConnectionsPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NearbyConnectionsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
