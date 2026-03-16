/**
 * BillDetailModal – shows a formatted bill and offers a Print action.
 * Print is implemented via Expo Print (if available) or a formatted Alert on native.
 */
import * as Print from 'expo-print';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

import { api } from '@/backend/src/utils/api';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface BillItem {
  product_id: number;
  name: string;
  quantity: number;
  price: number;
}

interface Props {
  billId: number | null;
  billDate: string;
  billTotal: number;
  visible: boolean;
  onClose: () => void;
}

export function BillDetailModal({ billId, billDate, billTotal, visible, onClose }: Props) {
  const [items, setItems] = useState<BillItem[]>([]);
  const [loading, setLoading] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  useEffect(() => {
    if (!visible || billId == null) return;
    let cancelled = false;
    setLoading(true);
    api.get<BillItem[]>(`/api/bills/${billId}/items`)
      .then((data) => { if (!cancelled) setItems(data); })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [visible, billId]);

  /** Build the print-ready HTML */
  const buildHtml = useCallback(() => {
    const rows = items
      .map(
        (i) => `
        <tr>
          <td>${i.name}</td>
          <td style="text-align:center;">${i.quantity}</td>
          <td style="text-align:right;">₹${i.price.toFixed(2)}</td>
          <td style="text-align:right;">₹${(i.price * i.quantity).toFixed(2)}</td>
        </tr>`
      )
      .join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Bill #${billId}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; color: #1a1a1a; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    .meta { color: #555; font-size: 13px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f3f4f6; text-align: left; padding: 8px 10px; font-size: 13px; }
    th:nth-child(2), th:nth-child(3), th:nth-child(4) { text-align: right; }
    td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
    .total-row td { font-weight: bold; font-size: 15px; border-top: 2px solid #1a1a1a; border-bottom: none; }
    .footer { margin-top: 32px; color: #888; font-size: 12px; text-align: center; }
  </style>
</head>
<body>
  <h1>Bill #${billId}</h1>
  <p class="meta">Date: ${billDate} &nbsp;|&nbsp; Total: ₹${billTotal.toFixed(2)}</p>
  <table>
    <thead>
      <tr>
        <th>Product</th>
        <th style="text-align:center;">Qty</th>
        <th style="text-align:right;">Price</th>
        <th style="text-align:right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr class="total-row">
        <td colspan="3">Grand Total</td>
        <td style="text-align:right;">₹${billTotal.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>
  <p class="footer">Thank you for your purchase!</p>
</body>
</html>`;
  }, [items, billId, billDate, billTotal]);

  const handlePrint = useCallback(async () => {
    if (Platform.OS === 'web') {
      // On web, open a new window with the HTML and trigger print
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(buildHtml());
        win.document.close();
        win.print();
      }
      return;
    }
    try {
      await Print.printAsync({ html: buildHtml() });
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message: unknown }).message)
          : 'Could not open printer';
      Alert.alert('Print Error', msg);
    }
  }, [buildHtml]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <ThemedView style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <ThemedText type="defaultSemiBold" style={styles.title}>
                Bill #{billId}
              </ThemedText>
              <ThemedText style={styles.date}>{billDate}</ThemedText>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <ThemedText style={styles.closeBtnText}>✕</ThemedText>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator style={styles.loader} size="large" color={colors.tint} />
          ) : (
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
              {/* Column headings */}
              <View style={[styles.row, styles.headRow]}>
                <ThemedText style={[styles.colProduct, styles.headText]}>Product</ThemedText>
                <ThemedText style={[styles.colQty, styles.headText]}>Qty</ThemedText>
                <ThemedText style={[styles.colPrice, styles.headText]}>Price</ThemedText>
                <ThemedText style={[styles.colTotal, styles.headText]}>Total</ThemedText>
              </View>

              {items.map((item, idx) => (
                <View key={idx} style={styles.row}>
                  <ThemedText style={styles.colProduct}>{item.name}</ThemedText>
                  <ThemedText style={styles.colQty}>{item.quantity}</ThemedText>
                  <ThemedText style={styles.colPrice}>₹{item.price.toFixed(2)}</ThemedText>
                  <ThemedText style={styles.colTotal}>
                    ₹{(item.price * item.quantity).toFixed(2)}
                  </ThemedText>
                </View>
              ))}

              {/* Total row */}
              <View style={[styles.row, styles.totalRow]}>
                <ThemedText style={[styles.colProduct, styles.totalLabel]}>Grand Total</ThemedText>
                <ThemedText style={[styles.colQty]} />
                <ThemedText style={[styles.colPrice]} />
                <ThemedText style={[styles.colTotal, styles.totalValue]}>
                  ₹{billTotal.toFixed(2)}
                </ThemedText>
              </View>
            </ScrollView>
          )}

          {/* Print button */}
          <TouchableOpacity
            style={[styles.printBtn, { backgroundColor: colors.tint }]}
            onPress={handlePrint}
            disabled={loading || items.length === 0}
          >
            <ThemedText style={styles.printBtnText}>🖨  Print Bill</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.15)',
  },
  title: {
    fontSize: 18,
  },
  date: {
    opacity: 0.6,
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(128,128,128,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  loader: {
    margin: 40,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.1)',
  },
  headRow: {
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(128,128,128,0.25)',
    paddingBottom: 8,
  },
  headText: {
    fontSize: 12,
    opacity: 0.6,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  totalRow: {
    borderBottomWidth: 0,
    borderTopWidth: 2,
    borderTopColor: 'rgba(128,128,128,0.25)',
    marginTop: 4,
  },
  totalLabel: {
    fontWeight: '700',
  },
  totalValue: {
    fontWeight: '700',
    fontSize: 16,
  },
  colProduct: {
    flex: 3,
    fontSize: 14,
  },
  colQty: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
  },
  colPrice: {
    flex: 2,
    textAlign: 'right',
    fontSize: 14,
  },
  colTotal: {
    flex: 2,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '600',
  },
  printBtn: {
    margin: 20,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  printBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
