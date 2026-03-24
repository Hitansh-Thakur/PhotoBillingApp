import { getToken } from '@/backend/src/utils/storage';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAppData } from '@/context/AppDataContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import Constants from 'expo-constants';

// ─── API Base URL ────────────────────────────────────────────────────────────
const API_URL = Constants.expoConfig?.extra?.apiUrl
  ?? process.env.EXPO_PUBLIC_API_URL
  ?? 'http://192.168.0.100:4000';

export default function BillPreviewScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { bills, clearPendingBill } = useAppData();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // ── Payment state ──────────────────────────────────────────────────────────
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'loading' | 'paid' | 'failed'>('idle');
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const bill = useMemo(() => bills.find((b) => b.id === id), [bills, id]);

  const handleDone = async () => {
    // If not paid online, mark as cash payment in DB
    if (paymentStatus !== 'paid' && bill && bill.id) {
      try {
        const token = await getToken();
        await fetch(`${API_URL}/api/payment/mark-as-cash`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ billId: bill.id }),
        });
      } catch (e) {
        console.warn('Failed to mark as cash:', e);
      }
    }
    clearPendingBill();
    router.replace('/(tabs)');
  };

  // ── Main payment handler ───────────────────────────────────────────────────
  const handlePayment = useCallback(async () => {
    const token = await getToken();
    if (!bill || !token) return;

    setPaymentStatus('loading');
    setPaymentError(null);

    try {
      // Step 1: Create Razorpay order on backend
      const orderRes = await fetch(`${API_URL}/api/payment/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: bill.total,
          billId: bill.id,
        }),
      });

      if (!orderRes.ok) {
        const errData = await orderRes.json();
        throw new Error(errData.message || 'Failed to create payment order');
      }

      const { order_id, amount } = await orderRes.json();

      // Step 2: Build callback URL (deep link back to app)
      // Linking.createURL handles Expo Go specifically
      const callbackScheme = Linking.createURL('/payment-callback');

      // Step 3: Open Razorpay web checkout in browser
      const checkoutUrl =
        `${API_URL}/api/payment/checkout/${order_id}` +
        `?amount=${amount}` +
        `&billId=${bill.id}` +
        `&name=Photo+Billing` +
        `&description=Bill+%23${bill.id}` +
        `&callbackUrl=${encodeURIComponent(callbackScheme)}`;

      const result = await WebBrowser.openAuthSessionAsync(checkoutUrl, callbackScheme);

      // Step 4: Handle result from web checkout
      if (result.type === 'success' && result.url) {
        const parsed = new URL(result.url);
        const status = parsed.searchParams.get('status');

        if (status === 'success') {
          const razorpay_order_id = parsed.searchParams.get('razorpay_order_id');
          const razorpay_payment_id = parsed.searchParams.get('razorpay_payment_id');
          const razorpay_signature = parsed.searchParams.get('razorpay_signature');

          // Step 5: Verify payment on backend
          const verifyRes = await fetch(`${API_URL}/api/payment/verify-payment`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              razorpay_order_id,
              razorpay_payment_id,
              razorpay_signature,
              billId: bill.id,
            }),
          });

          if (verifyRes.ok) {
            setPaymentStatus('paid');
          } else {
            const errData = await verifyRes.json();
            throw new Error(errData.message || 'Payment verification failed');
          }
        } else {
          const error = parsed.searchParams.get('error') || 'Payment failed';
          throw new Error(decodeURIComponent(error));
        }
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        // User closed the browser without paying
        setPaymentStatus('idle');
        setPaymentError('Payment was cancelled.');
      }
    } catch (err: any) {
      console.error('Payment error:', err);
      setPaymentStatus('failed');
      setPaymentError(err.message || 'Something went wrong during payment.');
      Alert.alert('Payment Failed', err.message || 'Please try again.');
    }
  }, [bill]);

  if (!bill) {
    return (
      <SafeAreaView style={styles.container}>
        <ThemedView style={styles.content}>
          <ThemedText>Bill not found.</ThemedText>
          <TouchableOpacity onPress={handleDone}>
            <ThemedText style={{ color: colors.tint }}>Go to Home</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </SafeAreaView>
    );
  }

  const date = new Date(bill.createdAt).toLocaleString();
  const isPaid = paymentStatus === 'paid';
  const isLoading = paymentStatus === 'loading';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <ThemedText type="title" style={styles.title}>
          Bill Generated
        </ThemedText>
        <ThemedText style={styles.date}>{date}</ThemedText>

        {/* ── Bill Items Card ── */}
        <ThemedView style={styles.card}>
          {bill.items.map((item, i) => (
            <View key={i} style={styles.row}>
              <ThemedText>
                {item.name} × {item.quantity}
              </ThemedText>
              <ThemedText>₹{(item.price * item.quantity).toFixed(2)}</ThemedText>
            </View>
          ))}
          <View style={[styles.totalRow, { borderTopColor: colors.icon + '60' }]}>
            <ThemedText type="defaultSemiBold">Total</ThemedText>
            <ThemedText type="title">₹{bill.total.toFixed(2)}</ThemedText>
          </View>
        </ThemedView>

        {/* ── Bill Saved Notice ── */}
        <ThemedView style={styles.successBox}>
          <ThemedText type="defaultSemiBold">✓ Bill saved</ThemedText>
          <ThemedText style={styles.successHint}>
            Inventory and cashflow have been updated
          </ThemedText>
        </ThemedView>

        {/* ── Payment Status Section ── */}
        {isPaid ? (
          <View style={[styles.paymentBadge, { backgroundColor: '#16a34a22', borderColor: '#16a34a' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <ThemedText style={[styles.paymentBadgeText, { color: '#16a34a' }]}>
                ✅ Payment Successful
              </ThemedText>
              <View style={[styles.modeBadge, { backgroundColor: '#16a34a' }]}>
                <ThemedText style={styles.modeBadgeText}>
                  {(bill.paymentMode || 'online').toUpperCase()}
                </ThemedText>
              </View>
            </View>
            <ThemedText style={styles.paymentBadgeHint}>
              This bill has been marked as paid via {bill.paymentMode || 'online'}
            </ThemedText>
          </View>
        ) : (
          <>
            {paymentError && (
              <View style={[styles.paymentBadge, { backgroundColor: '#dc262622', borderColor: '#dc2626' }]}>
                <ThemedText style={[styles.paymentBadgeText, { color: '#dc2626' }]}>
                  ⚠️ {paymentError}
                </ThemedText>
              </View>
            )}

            {/* ── Pay Now Button ── */}
            <TouchableOpacity
              style={[
                styles.payBtn,
                { backgroundColor: isLoading ? colors.icon : '#7c6aff' },
              ]}
              onPress={handlePayment}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <View style={styles.payBtnInner}>
                  <ActivityIndicator color="#fff" size="small" />
                  <ThemedText style={styles.payBtnText}>Processing...</ThemedText>
                </View>
              ) : (
                <ThemedText style={styles.payBtnText}>
                  💳 Pay ₹{bill.total.toFixed(2)}
                </ThemedText>
              )}
            </TouchableOpacity>

            <ThemedText style={styles.secureNote}>🔒 Secured by Razorpay</ThemedText>
          </>
        )}
      </ScrollView>

      {/* ── Done Button ── */}
      <TouchableOpacity
        style={[styles.doneBtn, { backgroundColor: colors.tint }]}
        onPress={handleDone}
      >
        <ThemedText style={styles.doneBtnText}>
          {isPaid ? 'Done' : 'Paid Cash'}
        </ThemedText>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 8,
  },
  title: {
    marginBottom: 4,
  },
  date: {
    opacity: 0.7,
    marginBottom: 24,
  },
  card: {
    padding: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(128,128,128,0.08)',
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    marginTop: 8,
    borderTopWidth: 1,
  },
  successBox: {
    padding: 16,
    borderRadius: 12,
    gap: 4,
    marginBottom: 20,
  },
  successHint: {
    fontSize: 14,
    opacity: 0.8,
  },
  // ── Payment UI ──
  payBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#7c6aff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  payBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  payBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  secureNote: {
    textAlign: 'center',
    fontSize: 12,
    opacity: 0.5,
    marginBottom: 8,
  },
  paymentBadge: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
    gap: 4,
  },
  paymentBadgeText: {
    fontWeight: '700',
    fontSize: 15,
  },
  paymentBadgeHint: {
    fontSize: 13,
    opacity: 0.8,
  },
  modeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  modeBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  // ── Done button ──
  doneBtn: {
    margin: 24,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
