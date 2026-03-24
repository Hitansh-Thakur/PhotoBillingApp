import { getToken } from '@/backend/src/utils/storage';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'loading' | 'qr_generated' | 'paid' | 'failed'>('idle');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [upiLink, setUpiLink] = useState<string | null>(null);

  const bill = useMemo(() => bills.find((b) => b.id === id), [bills, id]);

  // Polling for payment status
  useEffect(() => {
    if (paymentStatus !== 'qr_generated' || !bill?.id) return;

    let timer: any;
    const checkStatus = async () => {
      try {
        const token = await getToken();
        // Check if the bill status has changed in the database
        const res = await fetch(`${API_URL}/api/bills/${bill.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.payment_status === 'paid') {
            setPaymentStatus('paid');
          }
        }
      } catch (e) {
        console.warn('Poll error:', e);
      }
    };

    timer = setInterval(checkStatus, 5000);
    return () => clearInterval(timer);
  }, [paymentStatus, bill?.id]);

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
      // Step 1: Create UPI QR on backend
      const res = await fetch(`${API_URL}/api/payment/create-qr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ billId: bill.id }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to generate QR');
      }

      const { upi_link } = await res.json();
      setUpiLink(upi_link);
      setPaymentStatus('qr_generated');
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
  const showQr = paymentStatus === 'qr_generated' && upiLink;

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

            {showQr && (
              <ThemedView style={styles.qrContainer}>
                <ThemedText type="defaultSemiBold" style={styles.qrTitle}>Scan to Pay UPI</ThemedText>
                {/* 
                  Using an external QR API because no local library is installed.
                  In production, you'd use 'react-native-qrcode-svg'.
                */}
                <View style={styles.qrWrapper}>
                  <Image
                    source={{ uri: `https://quickchart.io/qr?text=${encodeURIComponent(upiLink)}&size=250` }}
                    style={{ width: 200, height: 200 }}
                  />
                </View>
                <ThemedText style={styles.qrLink}>{upiLink}</ThemedText>
                <View style={styles.pollingStatus}>
                  <ActivityIndicator size="small" color={colors.tint} />
                  <ThemedText style={styles.pollingText}>Waiting for payment confirmation...</ThemedText>
                </View>
              </ThemedView>
            )}

            {!showQr && (
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
                    <ThemedText style={styles.payBtnText}>Generating QR...</ThemedText>
                  </View>
                ) : (
                  <ThemedText style={styles.payBtnText}>
                    ⚡ Generate Payment QR
                  </ThemedText>
                )}
              </TouchableOpacity>
            )}

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
  // ── QR UI Styles ──
  qrContainer: {
    padding: 24,
    borderRadius: 16,
    backgroundColor: 'rgba(128,128,128,0.05)',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.1)',
  },
  qrTitle: {
    fontSize: 18,
    marginBottom: 16,
  },
  qrWrapper: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  qrLink: {
    fontSize: 11,
    opacity: 0.4,
    textAlign: 'center',
    marginBottom: 16,
  },
  pollingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pollingText: {
    fontSize: 13,
    opacity: 0.7,
  },
});
