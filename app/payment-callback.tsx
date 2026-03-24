import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

/**
 * Payment Callback Placeholder Route
 * This prevents "Unmatched Route" error in Expo Router when
 * redirecting from the Razorpay checkout.
 * WebBrowser.openAuthSessionAsync intercepts this redirect,
 * so this screen is usually only momentarily visible, if at all.
 */
export default function PaymentCallbackScreen() {
  const router = useRouter();

  useEffect(() => {
    // If WebBrowser fails to intercept, just go back to Home
    const timer = setTimeout(() => {
      router.replace('/(tabs)');
    }, 2000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20 }}>
      <ActivityIndicator size="large" color="#7c6aff" />
      <ThemedText type="defaultSemiBold">Processing Payment...</ThemedText>
    </ThemedView>
  );
}
