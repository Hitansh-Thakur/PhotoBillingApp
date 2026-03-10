import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { User } from '@/types';

export default function RegisterScreen() {
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const validate = useCallback((): string | null => {
    const bn = businessName.trim();
    const on = ownerName.trim();
    const em = email.trim();
    const pw = password.trim();
    const ob = openingBalance.trim();
    if (!bn) return 'Business name is required';
    if (!on) return 'Owner name is required';
    if (!em) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return 'Please enter a valid email';
    if (!pw) return 'Password is required';
    if (pw.length < 4) return 'Password must be at least 4 characters';
    const num = parseFloat(ob);
    if (ob !== '' && (Number.isNaN(num) || num < 0)) return 'Opening balance must be a non-negative number';
    return null;
  }, [businessName, ownerName, email, password, openingBalance]);

  const handleRegister = useCallback(async () => {
    setError('');
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
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
      setError(result.error ?? 'Registration failed');
    }
    // AuthGate will automatically redirect to /(tabs) when isLoggedIn becomes true
  }, [validate, businessName, ownerName, email, password, openingBalance, register]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboard}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <ThemedText type="title" style={styles.title}>
            Create account
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Set up your business to get started
          </ThemedText>

          <ThemedView style={styles.form}>
            {error ? (
              <ThemedView style={styles.errorBox}>
                <ThemedText style={styles.errorText}>{error}</ThemedText>
              </ThemedView>
            ) : null}
            <ThemedText style={styles.label}>Business Name</ThemedText>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={businessName}
              onChangeText={(t) => { setBusinessName(t); setError(''); }}
              placeholder="My Store"
              placeholderTextColor={colors.icon}
              editable={!submitting}
            />
            <ThemedText style={styles.label}>Owner Name</ThemedText>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={ownerName}
              onChangeText={(t) => { setOwnerName(t); setError(''); }}
              placeholder="Your name"
              placeholderTextColor={colors.icon}
              editable={!submitting}
            />
            <ThemedText style={styles.label}>Email</ThemedText>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={email}
              onChangeText={(t) => { setEmail(t); setError(''); }}
              placeholder="you@example.com"
              placeholderTextColor={colors.icon}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!submitting}
            />
            <ThemedText style={styles.label}>Password</ThemedText>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={password}
              onChangeText={(t) => { setPassword(t); setError(''); }}
              placeholder="At least 4 characters"
              placeholderTextColor={colors.icon}
              secureTextEntry
              editable={!submitting}
            />
            <ThemedText style={styles.label}>Opening Balance (₹)</ThemedText>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={openingBalance}
              onChangeText={(t) => { setOpeningBalance(t); setError(''); }}
              placeholder="0"
              placeholderTextColor={colors.icon}
              keyboardType="decimal-pad"
              editable={!submitting}
            />
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.tint }]}
              onPress={handleRegister}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.primaryBtnText}>Register</ThemedText>
              )}
            </TouchableOpacity>

            <View style={styles.footer}>
              <ThemedText style={styles.footerText}>Already have an account? </ThemedText>
              <TouchableOpacity
                onPress={() => router.back()}
                disabled={submitting}
              >
                <ThemedText style={[styles.link, { color: colors.tint }]}>
                  Sign in
                </ThemedText>
              </TouchableOpacity>
            </View>
          </ThemedView>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboard: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 48,
  },
  title: {
    marginBottom: 8,
  },
  subtitle: {
    opacity: 0.8,
    marginBottom: 32,
  },
  form: {
    marginBottom: 24,
  },
  errorBox: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
  },
  label: {
    fontSize: 12,
    marginBottom: 4,
    opacity: 0.8,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.3)',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  primaryBtn: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  footerText: {
    opacity: 0.8,
  },
  link: {
    fontWeight: '600',
  },
});
