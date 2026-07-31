import { useState, useEffect, useCallback } from 'react';
import { onboardingPermissionService } from '../services/onboardingPermissionService';

/**
 * Custom React Hook for First-Time Onboarding Permission Flow
 * 
 * Provides reactive access to:
 * - isOnboardingComplete boolean
 * - permissionStates object (bluetooth, nearbyDevices, location, notifications)
 * - isProcessing boolean
 * - requestAllPermissions method
 * - markOnboardingComplete method
 * - shouldPromptDuringSOS method
 */
export function useOnboardingPermissions() {
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(() =>
    onboardingPermissionService.isOnboardingComplete()
  );
  const [permissionStates, setPermissionStates] = useState(() =>
    onboardingPermissionService.getPermissionStates()
  );
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Subscribe to permission state & onboarding completion changes
    const unsub = onboardingPermissionService.onPermissionStateChange((states, isComplete) => {
      setPermissionStates(states);
      setIsOnboardingComplete(isComplete);
    });

    return () => {
      unsub();
    };
  }, []);

  const requestAllPermissions = useCallback(async () => {
    setIsProcessing(true);
    const result = await onboardingPermissionService.requestAllOnboardingPermissions();
    setIsProcessing(false);
    return result;
  }, []);

  const markOnboardingComplete = useCallback(() => {
    return onboardingPermissionService.markOnboardingComplete();
  }, []);

  const shouldPromptDuringSOS = useCallback((permissionType) => {
    return onboardingPermissionService.shouldPromptDuringSOS(permissionType);
  }, []);

  return {
    isOnboardingComplete,
    permissionStates,
    isProcessing,
    deviceId: onboardingPermissionService.getDeviceId(),
    requestAllPermissions,
    markOnboardingComplete,
    shouldPromptDuringSOS,
  };
}

export default useOnboardingPermissions;
