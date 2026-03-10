import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

  useEffect(() => {
    fetchCashflow();
  }, [fetchCashflow]);

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
        // Update existing entry
        await api.put(`/api/cashflow/${editingEntry.entry_id}`, data);
        Alert.alert('Success', 'Entry updated successfully');
      } else {
        // Add new entry
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
            {entries.slice(0, 20).map((e) => (
              <View key={e.entry_id} style={styles.entryRow}>
                <View style={styles.entryInfo}>
                  <View style={styles.entryHeader}>
                    <ThemedText style={styles.entryDate}>{e.date}</ThemedText>
                    {e.bill_id && (
                      <View style={styles.billBadge}>
                        <ThemedText style={styles.billBadgeText}>From Bill</ThemedText>
                      </View>
                    )}
                  </View>
                  {e.description && (
                    <ThemedText style={styles.entryDescription}>{e.description}</ThemedText>
                  )}
                </View>
                <View style={styles.entryRight}>
                  <ThemedText style={e.type === 'income' ? styles.entryIncome : styles.entryExpense}>
                    {e.type === 'income' ? '+' : '-'}₹{e.amount.toFixed(2)}
                  </ThemedText>
                  {!e.bill_id && (
                    <View style={styles.entryActions}>
                      <Pressable
                        style={[styles.actionButton, { backgroundColor: colors.tint + '20' }]}
                        onPress={() => handleEditEntry(e)}
                      >
                        <ThemedText style={[styles.actionButtonText, { color: colors.tint }]}>
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
            ))}
          </ThemedView>
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <Pressable
        style={[styles.fab, { backgroundColor: colors.tint }]}
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
    paddingBottom: 100, // Extra padding for FAB
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
  cardHint: {
    fontSize: 10,
    opacity: 0.5,
    marginTop: 2,
  },
  chartSection: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(128,128,128,0.08)',
  },
  chartHint: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 16,
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
  billBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  billBadgeText: {
    color: '#3b82f6',
    fontSize: 10,
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
});

