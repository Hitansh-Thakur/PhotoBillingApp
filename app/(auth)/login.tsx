import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  bg: '#FFFFFF',
  surface: '#F8F9FA',
  border: '#DDE1E7',
  borderFocus: '#0a7ea3',
  text: '#1C1C1E',
  textSub: '#6B7280',
  placeholder: '#9CA3AF',
  primary: '#0a7ea3',
  primaryText: '#FFFFFF',
  error: '#D93025',
  errorBg: '#FEF2F0',
  errorBorder: '#F5C6C2',
  divider: '#E5E7EB',
};

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = useCallback(async () => {
    setError('');
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    if (!trimmedEmail || !trimmedPassword) {
      setError('Please enter your email and password');
      return;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setError('Please enter a valid email address');
      return;
    }
    setSubmitting(true);
    const result = await login(trimmedEmail, trimmedPassword);
    setSubmitting(false);
    if (!result.success) {
      setError(result.error ?? 'Incorrect email or password');
    }
  }, [email, password, login]);

  const goToRegister = useCallback(() => {
    setError('');
    router.push('/(auth)/register');
  }, [router]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ─────────────────────────────────────── */}
          <View style={styles.header}>
            <View style={styles.logoMark}>
              <Text style={styles.logoIcon}>📷</Text>
            </View>
            <Text style={styles.appName}>PhotoBilling</Text>
            <Text style={styles.tagline}>Manage your studio business</Text>
          </View>

          {/* ── Card ───────────────────────────────────────── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign in</Text>
            <Text style={styles.cardSubtitle}>Enter your credentials to continue</Text>

            {/* Error banner */}
            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorIcon}>!</Text>
                <Text style={styles.errorMsg}>{error}</Text>
              </View>
            ) : null}

            {/* Email */}
            <Text style={styles.label}>Email address</Text>
            <TextInput
              style={[
                styles.input,
                focusedField === 'email' && styles.inputFocused,
              ]}
              value={email}
              onChangeText={(t) => { setEmail(t); setError(''); }}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
              placeholder="you@example.com"
              placeholderTextColor={C.placeholder}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              editable={!submitting}
            />

            {/* Password */}
            <Text style={styles.label}>Password</Text>
            <View style={[
              styles.inputRow,
              focusedField === 'password' && styles.inputFocused,
            ]}>
              <TextInput
                style={styles.inputRowText}
                value={password}
                onChangeText={(t) => { setPassword(t); setError(''); }}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                placeholder="Enter your password"
                placeholderTextColor={C.placeholder}
                secureTextEntry={!showPassword}
                editable={!submitting}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
                <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁'}</Text>
              </TouchableOpacity>
            </View>

            {/* Sign in button */}
            <TouchableOpacity
              style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]}
              onPress={handleLogin}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting
                ? <ActivityIndicator color={C.primaryText} />
                : <Text style={styles.primaryBtnText}>Sign in</Text>
              }
            </TouchableOpacity>
          </View>

          {/* ── Footer ─────────────────────────────────────── */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don&apos;t have an account? </Text>
            <TouchableOpacity onPress={goToRegister} disabled={submitting}>
              <Text style={styles.footerLink}>Create account</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 32,
  },

  // Header
  header: { alignItems: 'center', marginBottom: 36 },
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.divider,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoIcon: { fontSize: 30 },
  appName: {
    fontSize: 22,
    fontWeight: '700',
    color: C.text,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  tagline: { fontSize: 14, color: C.textSub },

  // Card
  card: {
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.divider,
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: C.text,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: C.textSub,
    marginBottom: 24,
  },

  // Error banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.errorBg,
    borderWidth: 1,
    borderColor: C.errorBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 20,
    gap: 8,
  },
  errorIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.error,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '700',
    fontSize: 13,
  },
  errorMsg: { flex: 1, color: C.error, fontSize: 13, lineHeight: 18 },

  // Labels & inputs
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: C.text,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: C.text,
    backgroundColor: C.bg,
    marginBottom: 16,
  },
  inputFocused: { borderColor: C.borderFocus },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 0,
    backgroundColor: C.bg,
    marginBottom: 24,
  },
  inputRowText: { flex: 1, fontSize: 15, color: C.text, paddingVertical: 12 },
  eyeIcon: { fontSize: 17, paddingLeft: 8, color: C.textSub },

  // Primary button
  primaryBtn: {
    backgroundColor: C.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: {
    color: C.primaryText,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  footerText: { fontSize: 14, color: C.textSub },
  footerLink: { fontSize: 14, fontWeight: '600', color: C.primary },
});
