import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

const STEPS = [
  {
    title: 'Welcome to Resonix AI',
    description: 'Your AI-powered disaster intelligence platform. Built for government-grade emergency operations.',
    icon: 'psychology',
  },
  {
    title: 'Offline-First Architecture',
    description: 'Resonix works without internet. Gemma 4 runs locally on your device, ensuring mission-critical operations never stop.',
    icon: 'wifi_off',
  },
  {
    title: 'Voice-Powered Relay',
    description: 'One voice command. One tap. Broadcast emergency signals across the mesh network instantly.',
    icon: 'mic',
  },
  {
    title: 'Configure Your Station',
    description: 'Set up your command credentials to get started.',
    icon: 'settings',
    isForm: true,
  },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const step = STEPS[currentStep];

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="space-y-8">
      {/* Progress Dots */}
      <div className="flex justify-center gap-2">
        {STEPS.map((_, index) => (
          <div
            key={index}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              index === currentStep
                ? 'bg-secondary w-6'
                : index < currentStep
                ? 'bg-primary'
                : 'bg-outline-variant'
            }`}
          />
        ))}
      </div>

      {/* Content Card */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-8 text-center animate-slide-up">
        <div className="mb-6 pb-4 border-b border-outline-variant/60">
          <h1 className="text-headline-md font-bold text-primary tracking-tight">RESONIX AI</h1>
          <p className="text-xs font-semibold text-secondary flex items-center justify-center gap-1.5 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
            Powered by Gemma 4
          </p>
        </div>

        <div className="w-16 h-16 bg-surface-container rounded-xl flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-secondary text-3xl">
            {step.icon}
          </span>
        </div>

        <h2 className="text-headline-lg font-bold text-primary mb-3">{step.title}</h2>
        <p className="text-body-md text-on-surface-variant mb-8 max-w-sm mx-auto">
          {step.description}
        </p>

        {step.isForm && (
          <div className="space-y-4 text-left max-w-sm mx-auto mb-8">
            <Input label="Station ID" placeholder="Enter your station identifier" icon="badge" />
            <Input label="Access Code" placeholder="Enter access code" icon="lock" type="password" />
            <Input label="Callsign" placeholder="Your operational callsign" icon="radio" />
          </div>
        )}

        <div className="flex gap-3 justify-center">
          {currentStep > 0 && (
            <Button variant="secondary" onClick={() => setCurrentStep((prev) => prev - 1)}>
              Back
            </Button>
          )}
          <Button variant="primary" size="lg" onClick={handleNext}>
            {currentStep === STEPS.length - 1 ? 'Launch Command Center' : 'Continue'}
          </Button>
        </div>
      </div>

      {/* Skip */}
      {currentStep < STEPS.length - 1 && (
        <button
          onClick={() => navigate('/dashboard')}
          className="block mx-auto text-sm text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
        >
          Skip onboarding →
        </button>
      )}
    </div>
  );
}
