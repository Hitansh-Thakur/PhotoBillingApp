import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Print from 'expo-print';

import { api } from '@/backend/src/utils/api';
import { ExpenseFormModal } from '@/components/ExpenseFormModal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAppData } from '@/context/AppDataContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface CashflowSummary {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  period: { startDate: string; endDate: string } | null;
}

interface CashflowEntry {
  entry_id: number;
  type: string;
  amount: number;
  date: string;
  description: string | null;
  bill_id: number | null;
}

interface BillItem {
  bill_item_id: number;
  product_id: number;
  name: string;
  quantity: number;
  price: number;
}

interface BillDetails {
  bill_id: number;
  date: string;
  total_amount: number;
  items: BillItem[];
}

export default function CashflowScreen() {
  const { loading: appLoading } = useAppData();
  const [summary, setSummary] = useState<CashflowSummary | null>(null);
  const [entries, setEntries] = useState<CashflowEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CashflowEntry | null>(null);
  const [operationLoading, setOperationLoading] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Bill details modal state
  const [billModalVisible, setBillModalVisible] = useState(false);
  const [selectedBill, setSelectedBill] = useState<BillDetails | null>(null);
  const [billLoading, setBillLoading] = useState(false);


  const fetchCashflow = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ summary: CashflowSummary; entries: CashflowEntry[] }>('/api/cashflow');
      setSummary(res.summary);
      setEntries(res.entries);
    } catch (e) {
      const message = e && typeof e === 'object' && 'message' in e
        ? String((e as { message: unknown }).message)
        : 'Failed to load cashflow';
      setError(message);
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch cashflow every time this tab comes into focus so entries added
  // via bills or from other screens are reflected immediately.
  useFocusEffect(
    useCallback(() => {
      fetchCashflow();
    }, [fetchCashflow])
  );

  // Open bill details when user taps a "From Bill" entry
  const handleViewBill = useCallback(async (billId: number) => {
    setBillLoading(true);
    setBillModalVisible(true);
    setSelectedBill(null);
    try {
      // Fetch bill items
      const items = await api.get<BillItem[]>(`/api/bills/${billId}/items`);
      const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
      setSelectedBill({
        bill_id: billId,
        date: new Date().toLocaleDateString(),
        total_amount: total,
        items,
      });
    } catch (e) {
      const message = e && typeof e === 'object' && 'message' in e
        ? String((e as { message: unknown }).message)
        : 'Failed to load bill details';
      Alert.alert('Error', message);
      setBillModalVisible(false);
    } finally {
      setBillLoading(false);
    }
  }, []);

  // Build a clean, simple PDF bill
  const handlePrintBill = useCallback(async (bill: BillDetails) => {
    const billDate = bill.date || new Date().toLocaleDateString('en-IN', {
      day: '2-digit', month: 'long', year: 'numeric',
    });

    const itemRows = bill.items
      .map(
        (i) => `
        <tr>
          <td>${i.name}</td>
          <td style="text-align:center">${i.quantity}</td>
          <td style="text-align:right">&#8377;${i.price.toFixed(2)}</td>
          <td style="text-align:right">&#8377;${(i.price * i.quantity).toFixed(2)}</td>
        </tr>`
      )
      .join('');

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Bill #${String(bill.bill_id).padStart(4, '0')}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, sans-serif;
      background: #f5f5f5;
      padding: 24px 16px;
      color: #111;
    }
    .wrap {
      max-width: 480px;
      margin: 0 auto;
      background: #fff;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #e0e0e0;
    }
    .top {
      padding: 24px 24px 16px;
      border-bottom: 2px solid #0a7ea3;
    }
    .top h1 { font-size: 20px; font-weight: 700; color: #111; }
    .top .meta { margin-top: 6px; font-size: 13px; color: #555; }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    thead th {
      background: #f0f8fb;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #555;
      padding: 10px 12px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    thead th:not(:first-child) { text-align: right; }
    thead th:nth-child(2) { text-align: center; }
    tbody td {
      padding: 10px 12px;
      font-size: 14px;
      border-bottom: 1px solid #f0f0f0;
    }
    tbody td:not(:first-child) { text-align: right; }
    tbody td:nth-child(2) { text-align: center; }
    .total-section { border-top: 2px solid #ddd; }
    .total-section td {
      padding: 12px;
      font-size: 15px;
      font-weight: 700;
    }
    .total-section td:last-child { text-align: right; color: #0a7ea3; }
    .footer {
      padding: 14px 24px;
      font-size: 12px;
      color: #888;
      text-align: center;
      background: #fafafa;
      border-top: 1px solid #eee;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .wrap { border: none; border-radius: 0; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="top">
      <h1>Bill #${String(bill.bill_id).padStart(4, '0')}</h1>
      <div class="meta">Date: ${billDate} &nbsp;&bull;&nbsp; ${bill.items.length} item(s)</div>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:45%">Item</th>
          <th style="width:12%">Qty</th>
          <th style="width:20%">Price</th>
          <th style="width:23%">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
      <tfoot>
        <tr class="total-section">
          <td colspan="3">Amount to Pay</td>
          <td>&#8377;${bill.total_amount.toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>
    <div class="footer">Thank you for your purchase!</div>
  </div>
</body>
</html>`;

    if (Platform.OS === 'web') {
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(htmlContent);
        win.document.close();
        win.print();
      }
    } else {
      try {
        await Print.printAsync({ html: htmlContent });
      } catch (e) {
        try {
          const text = `Bill #${bill.bill_id}\n` +
            bill.items.map((i) => `${i.name} x${i.quantity} @ \u20b9${i.price.toFixed(2)} = \u20b9${(i.price * i.quantity).toFixed(2)}`).join('\n') +
            `\n\nTotal: \u20b9${bill.total_amount.toFixed(2)}`;
          await Share.share({ message: text, title: `Bill #${bill.bill_id}` });
        } catch {
          Alert.alert('Print failed', 'Could not print or share the bill.');
        }
      }
    }
  }, []);


  const handleAddEntry = () => {
    setEditingEntry(null);
    setModalVisible(true);
  };

  const handleEditEntry = (entry: CashflowEntry) => {
    setEditingEntry(entry);
    setModalVisible(true);
  };

  const handleDeleteEntry = (entry: CashflowEntry) => {
    Alert.alert(
      'Delete Entry',
      `Are you sure you want to delete this ${entry.type}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setOperationLoading(true);
            try {
              await api.delete(`/api/cashflow/${entry.entry_id}`);
              Alert.alert('Success', 'Entry deleted successfully');
              await fetchCashflow();
            } catch (e) {
              const message = e && typeof e === 'object' && 'message' in e
                ? String((e as { message: unknown }).message)
                : 'Failed to delete entry';
              Alert.alert('Error', message);
            } finally {
              setOperationLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleSubmitForm = async (data: {
    type: 'income' | 'expense';
    amount: number;
    description: string;
    date: string;
  }) => {
    setOperationLoading(true);
    try {
      if (editingEntry) {
        await api.put(`/api/cashflow/${editingEntry.entry_id}`, data);
        Alert.alert('Success', 'Entry updated successfully');
      } else {
        await api.post('/api/cashflow', data);
        Alert.alert('Success', 'Entry added successfully');
      }
      setModalVisible(false);
      setEditingEntry(null);
      await fetchCashflow();
    } catch (e) {
      const message = e && typeof e === 'object' && 'message' in e
        ? String((e as { message: unknown }).message)
        : 'Failed to save entry';
      Alert.alert('Error', message);
    } finally {
      setOperationLoading(false);
    }
  };

  if (appLoading || (loading && !summary)) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.tint} />
          <ThemedText style={styles.loadingText}>Loading cashflow…</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  const totalIncome = summary?.totalIncome ?? 0;
  const totalExpenses = summary?.totalExpenses ?? 0;
  const balance = summary?.balance ?? 0;
  const chartMax = Math.max(totalIncome, totalExpenses, 1);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <ThemedText type="title" style={styles.title}>
          Cashflow
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          Overview of your money flow
        </ThemedText>
        {error ? (
          <ThemedView style={styles.errorBox}>
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          </ThemedView>
        ) : null}

        <View style={styles.cards}>
          <ThemedView style={[styles.card, styles.primaryCard]}>
            <ThemedText style={styles.cardLabel}>Balance</ThemedText>
            <ThemedText style={styles.cardValue}>
              ₹{balance.toFixed(2)}
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.card}>
            <ThemedText style={styles.cardLabel}>Total Income</ThemedText>
            <ThemedText style={styles.cardValue}>₹{totalIncome.toFixed(2)}</ThemedText>
          </ThemedView>

          <ThemedView style={styles.card}>
            <ThemedText style={styles.cardLabel}>Total Expenses</ThemedText>
            <ThemedText style={styles.cardValue}>₹{totalExpenses.toFixed(2)}</ThemedText>
          </ThemedView>
        </View>

        <ThemedView style={styles.chartSection}>
          <ThemedText type="subtitle">Summary</ThemedText>
          <View style={styles.chartPlaceholder}>
            <View
              style={[
                styles.chartBar,
                {
                  height: `${Math.min(100, (totalIncome / chartMax) * 100)}%`,
                  backgroundColor: colors.tint,
                },
              ]}
            />
            <View
              style={[
                styles.chartBar,
                {
                  height: `${Math.min(100, (totalExpenses / chartMax) * 100)}%`,
                  backgroundColor: colors.tint + '80',
                },
              ]}
            />
          </View>
          <View style={styles.chartLabels}>
            <ThemedText style={styles.chartLabel}>Income</ThemedText>
            <ThemedText style={styles.chartLabel}>Expenses</ThemedText>
          </View>
        </ThemedView>



        {entries.length > 0 && (
          <ThemedView style={styles.entriesSection}>
            <ThemedText type="subtitle">Recent entries</ThemedText>
            {entries.slice(0, 20).map((e) => {
              return (
                <View key={e.entry_id} style={styles.entryRow}>
                  {/* Left: date + description + view bill button */}
                  <View style={styles.entryInfo}>
                    <ThemedText style={styles.entryDate}>{e.date}</ThemedText>
                    {e.description ? (
                      <ThemedText style={styles.entryDescription}>{e.description}</ThemedText>
                    ) : null}
                    {e.bill_id ? (
                      <Pressable
                        style={styles.viewBillBtn}
                        onPress={() => handleViewBill(e.bill_id!)}
                      >
                        <ThemedText style={styles.viewBillBtnText}>📄 View Bill</ThemedText>
                      </Pressable>
                    ) : null}
                  </View>

                  {/* Right: amount + edit/delete actions */}
                  <View style={styles.entryRight}>
                    <ThemedText style={e.type === 'income' ? styles.entryIncome : styles.entryExpense}>
                      {e.type === 'income' ? '+' : '-'}₹{e.amount.toFixed(2)}
                    </ThemedText>
                    {!e.bill_id && (
                      <View style={styles.entryActions}>
                        <Pressable
                          style={[styles.actionButton, { backgroundColor: '#0a7ea320' }]}
                          onPress={() => handleEditEntry(e)}
                        >
                          <ThemedText style={[styles.actionButtonText, { color: '#0a7ea3' }]}>
                            Edit
                          </ThemedText>
                        </Pressable>
                        <Pressable
                          style={[styles.actionButton, styles.deleteButton]}
                          onPress={() => handleDeleteEntry(e)}
                        >
                          <ThemedText style={styles.deleteButtonText}>Delete</ThemedText>
                        </Pressable>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </ThemedView>
        )}
      </ScrollView>

      {/* FAB — add entry */}
      <Pressable
        style={[styles.fab, { backgroundColor: '#0a7ea3' }]}
        onPress={handleAddEntry}
      >
        <ThemedText style={styles.fabText}>+</ThemedText>
      </Pressable>



      {/* Expense Form Modal */}
      <ExpenseFormModal
        visible={modalVisible}
        mode={editingEntry ? 'edit' : 'add'}
        initialData={editingEntry ? {
          entry_id: editingEntry.entry_id,
          type: editingEntry.type as 'income' | 'expense',
          amount: editingEntry.amount,
          description: editingEntry.description,
          date: editingEntry.date,
        } : undefined}
        onSubmit={handleSubmitForm}
        onCancel={() => {
          setModalVisible(false);
          setEditingEntry(null);
        }}
      />

      {/* Bill Details Modal */}
      <Modal visible={billModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ThemedView style={styles.billModal}>
            <View style={styles.billModalHeader}>
              <ThemedText type="subtitle">
                {selectedBill ? `Bill #${selectedBill.bill_id}` : 'Bill Details'}
              </ThemedText>
              <Pressable onPress={() => setBillModalVisible(false)} style={styles.closeBtn}>
                <ThemedText style={styles.closeBtnText}>✕</ThemedText>
              </Pressable>
            </View>

            {billLoading ? (
              <View style={styles.billLoading}>
                <ActivityIndicator size="large" color={colors.tint} />
                <ThemedText style={{ opacity: 0.7, marginTop: 8 }}>Loading bill…</ThemedText>
              </View>
            ) : selectedBill ? (
              <>
                <ScrollView style={styles.billScroll} showsVerticalScrollIndicator={false}>
                  {/* Table header */}
                  <View style={[styles.tableRow, styles.tableHeader]}>
                    <ThemedText style={[styles.tableCell, styles.cellProduct, styles.headerText]}>
                      Product
                    </ThemedText>
                    <ThemedText style={[styles.tableCell, styles.cellNum, styles.headerText]}>
                      Qty
                    </ThemedText>
                    <ThemedText style={[styles.tableCell, styles.cellNum, styles.headerText]}>
                      Price
                    </ThemedText>
                    <ThemedText style={[styles.tableCell, styles.cellNum, styles.headerText]}>
                      Total
                    </ThemedText>
                  </View>

                  {/* Table rows */}
                  {selectedBill.items.map((item, idx) => (
                    <View
                      key={item.bill_item_id}
                      style={[styles.tableRow, idx % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd]}
                    >
                      <ThemedText style={[styles.tableCell, styles.cellProduct]} numberOfLines={2}>
                        {item.name}
                      </ThemedText>
                      <ThemedText style={[styles.tableCell, styles.cellNum]}>
                        {item.quantity}
                      </ThemedText>
                      <ThemedText style={[styles.tableCell, styles.cellNum]}>
                        ₹{item.price.toFixed(2)}
                      </ThemedText>
                      <ThemedText style={[styles.tableCell, styles.cellNum]}>
                        ₹{(item.price * item.quantity).toFixed(2)}
                      </ThemedText>
                    </View>
                  ))}

                  {/* Total row */}
                  <View style={[styles.tableRow, styles.totalRow]}>
                    <ThemedText style={[styles.tableCell, styles.cellProduct, styles.totalText]}>
                      TOTAL
                    </ThemedText>
                    <ThemedText style={[styles.tableCell, styles.cellNum]}></ThemedText>
                    <ThemedText style={[styles.tableCell, styles.cellNum]}></ThemedText>
                    <ThemedText style={[styles.tableCell, styles.cellNum, styles.totalText]}>
                      ₹{selectedBill.total_amount.toFixed(2)}
                    </ThemedText>
                  </View>
                </ScrollView>

                {/* Print / Share button */}
                <Pressable
                  style={[styles.printBtn, { backgroundColor: colors.tint }]}
                  onPress={() => handlePrintBill(selectedBill)}
                >
                  <ThemedText style={styles.printBtnText}>
                    {Platform.OS === 'web' ? '🖨️ Print Bill' : '📤 Share Bill'}
                  </ThemedText>
                </Pressable>
              </>
            ) : null}
          </ThemedView>
        </View>
      </Modal>

      {/* Loading Overlay */}
      {operationLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 100,
  },
  title: {
    marginBottom: 4,
  },
  subtitle: {
    opacity: 0.8,
    marginBottom: 24,
  },
  cards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 32,
  },
  card: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(128,128,128,0.08)',
  },
  primaryCard: {
    minWidth: '100%',
  },
  cardLabel: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  chartSection: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(128,128,128,0.08)',
  },
  chartPlaceholder: {
    flexDirection: 'row',
    height: 120,
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    gap: 16,
  },
  chartBar: {
    flex: 1,
    borderRadius: 6,
    minHeight: 8,
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  chartLabel: {
    fontSize: 12,
    opacity: 0.7,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    opacity: 0.8,
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
  entriesSection: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(128,128,128,0.08)',
  },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.1)',
  },
  entryInfo: {
    flex: 1,
    marginRight: 12,
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  entryDate: {
    fontSize: 14,
    opacity: 0.8,
  },
  entryDescription: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  entryRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  entryIncome: {
    color: '#22c55e',
    fontWeight: '600',
    fontSize: 16,
  },
  entryExpense: {
    color: '#ef4444',
    fontWeight: '600',
    fontSize: 16,
  },
  viewBillBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#0a7ea3',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
  },
  viewBillBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  entryActions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  deleteButtonText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
  },
  // FAB action sheet
  // existing
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: {
    fontSize: 32,
    color: '#fff',
    fontWeight: '300',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Bill details modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  billModal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  billModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    fontSize: 18,
    opacity: 0.7,
  },
  billLoading: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  billScroll: {
    maxHeight: 320,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.12)',
  },
  tableHeader: {
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(128,128,128,0.25)',
  },
  tableRowEven: {
    backgroundColor: 'rgba(128,128,128,0.04)',
  },
  tableRowOdd: {
    backgroundColor: 'transparent',
  },
  tableCell: {
    fontSize: 13,
  },
  cellProduct: {
    flex: 2,
    paddingRight: 4,
  },
  cellNum: {
    flex: 1,
    textAlign: 'right',
  },
  headerText: {
    fontWeight: '700',
    fontSize: 12,
    opacity: 0.7,
  },
  totalRow: {
    borderTopWidth: 2,
    borderTopColor: 'rgba(128,128,128,0.3)',
    borderBottomWidth: 0,
    marginTop: 4,
  },
  totalText: {
    fontWeight: '700',
  },
  printBtn: {
    marginTop: 20,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  printBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

});
