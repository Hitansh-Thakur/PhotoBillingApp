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
import type { User } from '@/types';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Design tokens (shared with login) ─────────────────────────────────────────
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
  hint: '#9CA3AF',
};

export default function RegisterScreen() {
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  const clearError = () => setError('');

  const validate = useCallback((): string | null => {
    const bn = businessName.trim();
    const on = ownerName.trim();
    const em = email.trim();
    const pw = password.trim();
    const ob = openingBalance.trim();
    if (!bn) return 'Business name is required';
    if (!on) return 'Owner name is required';
    if (!em) return 'Email is required';
    if (!EMAIL_REGEX.test(em)) return 'Please enter a valid email address';
    if (!pw) return 'Password is required';
    if (pw.length < 7) return 'Password must be at least 7 characters';
    if (ob !== '') {
      const num = parseFloat(ob);
      if (Number.isNaN(num)) return 'Opening balance must be a valid number';
      if (num <= 0) return 'Opening balance must be greater than 0';
    }
    return null;
  }, [businessName, ownerName, email, password, openingBalance]);

  const handleRegister = useCallback(async () => {
    setError('');
    const err = validate();
    if (err) { setError(err); return; }

    const balance = openingBalance.trim() === ''
      ? 0
      : Math.max(0, parseFloat(openingBalance.trim()) || 0);

    const user: User = {
      email: email.trim(),
      password: password.trim(),
      businessName: businessName.trim(),
      ownerName: ownerName.trim(),
      openingBalance: balance,
    };
    setSubmitting(true);
    const result = await register(user);
    setSubmitting(false);
    if (!result.success) {
      setError(result.error ?? 'Registration failed. Please try again.');
    }
  }, [validate, businessName, ownerName, email, password, openingBalance, register]);

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
            <Text style={styles.tagline}>Create your business account</Text>
          </View>

          {/* ── Card ───────────────────────────────────────── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Create account</Text>
            <Text style={styles.cardSubtitle}>Fill in the details to set up your business</Text>

            {/* Error banner */}
            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorIcon}>!</Text>
                <Text style={styles.errorMsg}>{error}</Text>
              </View>
            ) : null}

            {/* Business Name */}
            <Text style={styles.label}>Business Name</Text>
            <TextInput
              style={[styles.input, focusedField === 'biz' && styles.inputFocused]}
              value={businessName}
              onChangeText={(t) => { setBusinessName(t); clearError(); }}
              onFocus={() => setFocusedField('biz')}
              onBlur={() => setFocusedField(null)}
              placeholder="e.g. My Photo Studio"
              placeholderTextColor={C.placeholder}
              editable={!submitting}
            />

            {/* Owner Name */}
            <Text style={styles.label}>Owner Name</Text>
            <TextInput
              style={[styles.input, focusedField === 'owner' && styles.inputFocused]}
              value={ownerName}
              onChangeText={(t) => { setOwnerName(t); clearError(); }}
              onFocus={() => setFocusedField('owner')}
              onBlur={() => setFocusedField(null)}
              placeholder="Your full name"
              placeholderTextColor={C.placeholder}
              editable={!submitting}
            />

            {/* Email */}
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={[styles.input, focusedField === 'email' && styles.inputFocused]}
              value={email}
              onChangeText={(t) => { setEmail(t); clearError(); }}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
              placeholder="you@example.com"
              placeholderTextColor={C.placeholder}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!submitting}
            />

            {/* Password */}
            <Text style={styles.label}>Password</Text>
            <View style={[
              styles.inputRow,
              focusedField === 'pass' && styles.inputFocused,
            ]}>
              <TextInput
                style={styles.inputRowText}
                value={password}
                onChangeText={(t) => { setPassword(t); clearError(); }}
                onFocus={() => setFocusedField('pass')}
                onBlur={() => setFocusedField(null)}
                placeholder="At least 7 characters"
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

            {/* Opening Balance */}
            <Text style={styles.label}>
              Opening Balance (₹){' '}
              <Text style={styles.optional}>Optional</Text>
            </Text>
            <TextInput
              style={[styles.input, focusedField === 'ob' && styles.inputFocused, { marginBottom: 8 }]}
              value={openingBalance}
              onChangeText={(t) => { setOpeningBalance(t); clearError(); }}
              onFocus={() => setFocusedField('ob')}
              onBlur={() => setFocusedField(null)}
              placeholder="0.00"
              placeholderTextColor={C.placeholder}
              keyboardType="decimal-pad"
              editable={!submitting}
            />
            <Text style={styles.hint}>Must be greater than 0 if provided</Text>

            {/* Register button */}
            <TouchableOpacity
              style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]}
              onPress={handleRegister}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting
                ? <ActivityIndicator color={C.primaryText} />
                : <Text style={styles.primaryBtnText}>Create Account</Text>
              }
            </TouchableOpacity>
          </View>

          {/* ── Footer ─────────────────────────────────────── */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.back()} disabled={submitting}>
              <Text style={styles.footerLink}>Sign in</Text>
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
    paddingTop: 32,
    paddingBottom: 32,
  },

  // Header
  header: { alignItems: 'center', marginBottom: 28 },
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
  optional: {
    fontSize: 12,
    fontWeight: '400',
    color: C.hint,
  },
  hint: {
    fontSize: 12,
    color: C.hint,
    marginBottom: 20,
    marginTop: 2,
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
    backgroundColor: C.bg,
    marginBottom: 20,
  },
  inputRowText: { flex: 1, fontSize: 15, color: C.text, paddingVertical: 12 },
  eyeIcon: { fontSize: 17, paddingLeft: 8, color: C.textSub },

  // Primary button
  primaryBtn: {
    backgroundColor: C.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
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
