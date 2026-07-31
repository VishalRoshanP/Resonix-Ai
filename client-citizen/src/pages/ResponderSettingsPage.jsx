import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

export default function ResponderSettingsPage() {
  return (
    <div className="space-y-6 text-left max-w-4xl">
      <div>
        <h1 className="text-headline-lg font-bold text-primary">Command Center Settings</h1>
        <p className="text-body-md text-on-surface-variant mt-0.5">Configure operational parameters, Gemma 4 inference limits, and mesh thresholds</p>
      </div>

      <Card className="p-6 space-y-6">
        <h3 className="text-body-lg font-bold text-primary border-b border-outline-variant/60 pb-3">
          Gemma 4 Local Reasoning Configuration
        </h3>

        <div className="space-y-4 text-sm">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-bold text-primary">Local Offline Inference Engine</p>
              <p className="text-xs text-on-surface-variant">Process incident triage locally on CPU/NPU without cloud connectivity</p>
            </div>
            <input type="checkbox" defaultChecked className="w-5 h-5 accent-secondary cursor-pointer" />
          </div>

          <div className="flex justify-between items-center">
            <div>
              <p className="font-bold text-primary">Automated Resource Allocation Prompts</p>
              <p className="text-xs text-on-surface-variant">Suggest optimal responder unit deployments based on predictive models</p>
            </div>
            <input type="checkbox" defaultChecked className="w-5 h-5 accent-secondary cursor-pointer" />
          </div>
        </div>

        <div className="pt-4 border-t border-outline-variant/60 flex justify-end gap-3">
          <Button variant="secondary">Reset Defaults</Button>
          <Button variant="primary">Save Command Settings</Button>
        </div>
      </Card>
    </div>
  );
}
