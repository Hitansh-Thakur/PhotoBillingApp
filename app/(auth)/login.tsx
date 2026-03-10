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

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const handleLogin = useCallback(async () => {
    setError('');
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    if (!trimmedEmail || !trimmedPassword) {
      setError('Please enter email and password');
      return;
    }
    setSubmitting(true);
    const result = await login(trimmedEmail, trimmedPassword);
    setSubmitting(false);
    if (!result.success) {
      setError(result.error ?? 'Invalid email or password');
    }
    // AuthGate will automatically redirect to /(tabs) when isLoggedIn becomes true
  }, [email, password, login]);

  const goToRegister = useCallback(() => {
    setError('');
    router.push('/(auth)/register');
  }, [router]);

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
            Welcome back
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Sign in to continue to your business
          </ThemedText>

          <ThemedView style={styles.form}>
            {error ? (
              <ThemedView style={styles.errorBox}>
                <ThemedText style={styles.errorText}>{error}</ThemedText>
              </ThemedView>
            ) : null}
            <ThemedText style={styles.label}>Email</ThemedText>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={email}
              onChangeText={(t) => { setEmail(t); setError(''); }}
              placeholder="you@example.com"
              placeholderTextColor={colors.icon}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              editable={!submitting}
            />
            <ThemedText style={styles.label}>Password</ThemedText>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={password}
              onChangeText={(t) => { setPassword(t); setError(''); }}
              placeholder="••••••••"
              placeholderTextColor={colors.icon}
              secureTextEntry
              editable={!submitting}
            />
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.tint }]}
              onPress={handleLogin}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.primaryBtnText}>Sign in</ThemedText>
              )}
            </TouchableOpacity>

            <View style={styles.footer}>
              <ThemedText style={styles.footerText}>Don&apos;t have an account? </ThemedText>
              <TouchableOpacity onPress={goToRegister} disabled={submitting}>
                <ThemedText style={[styles.link, { color: colors.tint }]}>
                  Create Account
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
  container: { flex: 1 },
  keyboard: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 24, paddingTop: 48 },
  title: { marginBottom: 8 },
  subtitle: { opacity: 0.8, marginBottom: 32 },
  form: { marginBottom: 24 },
  errorBox: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  errorText: { color: '#ef4444', fontSize: 14 },
  label: { fontSize: 12, marginBottom: 4, opacity: 0.8 },
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
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  footerText: { opacity: 0.8 },
  link: { fontWeight: '600' },
});
