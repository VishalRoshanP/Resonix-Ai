/**
 * Authentication Screen for RESONIX AI Citizen Mobile (React Native)
 * 
 * 100% Feature Parity with Citizen Web CitizenLoginPage.jsx & CitizenRegisterPage.jsx
 * 
 * Features:
 * - Active Disaster Emergency SOS Bypass Banner: "Continue as Guest (1-Tap SOS)"
 * - Sign In & Registration Tabs
 * - Email / Mobile Number & Password inputs
 * - Light Mode & Dark Mode support
 * - JWT Token persistence & profile hydration
 */

const React = require('react');
const { useState, useContext } = React;
const {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} = require('react-native');

const { AuthContext } = require('../context/AuthContext');
const { useTheme } = require('../context/ThemeContext');

function AuthScreen({ onContinueAsGuest, onAuthSuccess }) {
  const { colors, isDark } = useTheme();
  const { login, register, continueAsGuest } = useContext(AuthContext);

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleGuestBypass = () => {
    continueAsGuest();
    onContinueAsGuest && onContinueAsGuest();
  };

  const handleSubmit = async () => {
    setErrorText('');

    if (!identifier.trim() || !password.trim()) {
      setErrorText('Email or mobile number and password are required.');
      return;
    }

    if (isRegisterMode && !name.trim()) {
      setErrorText('Full name is required for registration.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isRegisterMode) {
        const res = await register(name.trim(), identifier.trim(), password.trim(), phone.trim());
        if (!res.success) {
          setErrorText(res.error || 'Registration failed. Please try again.');
        } else {
          Alert.alert('Welcome!', 'Citizen account registered successfully.');
          onAuthSuccess && onAuthSuccess();
        }
      } else {
        const res = await login(identifier.trim(), password.trim());
        if (!res.success) {
          setErrorText(res.error || 'Invalid credentials or login failed.');
        } else {
          onAuthSuccess && onAuthSuccess();
        }
      }
    } catch (err) {
      setErrorText(err.message || 'Authentication error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
    >
      {/* 1. Emergency SOS Direct Bypass Header Banner (Exact parity with Web) */}
      <View style={[styles.emergencyBypassCard, { backgroundColor: colors.errorContainer, borderColor: colors.error }]}>
        <View style={styles.emergencyRow}>
          <Text style={styles.emergencyIcon}>🚨</Text>
          <Text style={[styles.emergencyTitle, { color: colors.error }]}>IN AN ACTIVE DISASTER?</Text>
        </View>
        <Text style={[styles.emergencySubtext, { color: colors.onSurface }]}>
          Emergency SOS reporting <Text style={{ fontWeight: 'bold' }}>never</Text> requires sign in or registration.
        </Text>
        <TouchableOpacity
          style={[styles.guestBypassButton, { backgroundColor: colors.error }]}
          onPress={handleGuestBypass}
          activeOpacity={0.8}
        >
          <Text style={styles.guestBypassButtonText}>⚡ Continue as Guest (1-Tap SOS)</Text>
        </TouchableOpacity>
      </View>

      {/* 2. Main Authentication Card */}
      <View style={[styles.authCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
        <View style={styles.brandBox}>
          <Text style={[styles.logoText, { color: colors.primary }]}>RESONIX AI</Text>
          <Text style={[styles.tagline, { color: colors.secondary }]}>Citizen Emergency Assistance</Text>
        </View>

        {/* Tab Switcher */}
        <View style={[styles.tabContainer, { backgroundColor: colors.surfaceContainer }]}>
          <TouchableOpacity
            style={[
              styles.tabBtn,
              !isRegisterMode && { backgroundColor: colors.secondary },
            ]}
            onPress={() => { setIsRegisterMode(false); setErrorText(''); }}
          >
            <Text style={[styles.tabBtnText, { color: !isRegisterMode ? '#FFFFFF' : colors.primary }]}>
              Sign In
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabBtn,
              isRegisterMode && { backgroundColor: colors.secondary },
            ]}
            onPress={() => { setIsRegisterMode(true); setErrorText(''); }}
          >
            <Text style={[styles.tabBtnText, { color: isRegisterMode ? '#FFFFFF' : colors.primary }]}>
              Register
            </Text>
          </TouchableOpacity>
        </View>

        {/* Error Box */}
        {errorText ? (
          <View style={[styles.errorBox, { backgroundColor: colors.errorContainer, borderColor: colors.error }]}>
            <Text style={[styles.errorText, { color: colors.error }]}>{errorText}</Text>
          </View>
        ) : null}

        {/* Register-only Full Name field */}
        {isRegisterMode && (
          <View style={styles.inputGroup}>
            <Text style={[styles.fieldLabel, { color: colors.primary }]}>Full Name *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant, color: colors.primary }]}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Rahul Sharma"
              placeholderTextColor={colors.subtleText}
            />
          </View>
        )}

        {/* Email or Mobile Number */}
        <View style={styles.inputGroup}>
          <Text style={[styles.fieldLabel, { color: colors.primary }]}>
            Email or Mobile Phone *
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant, color: colors.primary }]}
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="email@example.com or +91 9876543210"
            placeholderTextColor={colors.subtleText}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        {/* Register-only Phone number (optional if email used) */}
        {isRegisterMode && (
          <View style={styles.inputGroup}>
            <Text style={[styles.fieldLabel, { color: colors.primary }]}>Emergency Mobile Phone</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant, color: colors.primary }]}
              value={phone}
              onChangeText={setPhone}
              placeholder="+91 9876543210"
              placeholderTextColor={colors.subtleText}
              keyboardType="phone-pad"
            />
          </View>
        )}

        {/* Password field */}
        <View style={styles.inputGroup}>
          <Text style={[styles.fieldLabel, { color: colors.primary }]}>Password *</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[
                styles.input,
                styles.passwordInput,
                { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant, color: colors.primary },
              ]}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your account password"
              placeholderTextColor={colors.subtleText}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity
              style={styles.showPasswordBtn}
              onPress={() => setShowPassword((prev) => !prev)}
            >
              <Text style={{ fontSize: 16 }}>{showPassword ? '👁️' : '🔒'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: colors.secondary }]}
          onPress={handleSubmit}
          disabled={isSubmitting}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.submitButtonText}>
              {isRegisterMode ? 'Create Citizen Account' : 'Sign In to Resonix'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  emergencyBypassCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    marginBottom: 16,
    alignItems: 'center',
  },
  emergencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  emergencyIcon: {
    fontSize: 18,
  },
  emergencyTitle: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  emergencySubtext: {
    fontSize: 11.5,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 16,
  },
  guestBypassButton: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  guestBypassButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  authCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  brandBox: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: 11.5,
    fontWeight: '700',
    marginTop: 2,
  },
  tabContainer: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    marginBottom: 14,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  errorBox: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  inputGroup: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12.5,
  },
  passwordRow: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: 40,
  },
  showPasswordBtn: {
    position: 'absolute',
    right: 12,
  },
  submitButton: {
    marginTop: 14,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
});

module.exports = AuthScreen;
