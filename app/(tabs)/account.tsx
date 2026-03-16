import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/backend/src/utils/api';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface AnalyticsData {
  bestSellingProducts: { product_id: number; name: string; total_sold: number; revenue: number }[];
  dailySales?: { period: string; total: number }[];
  inventoryValue: { totalValue: number; productCount: number };
  profitLoss: { totalIncome: number; totalExpense: number; profit: number; period: string };
}

export default function AccountScreen() {
  const { profile, updateProfile, loading: appLoading } = useAppData();
  const { logout } = useAuth();
  const router = useRouter();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [storeName, setStoreName] = useState(profile.storeName);
  const [ownerName, setOwnerName] = useState(profile.ownerName);
  const [openingBalance, setOpeningBalance] = useState(String(profile.openingBalance));
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get<AnalyticsData>('/api/analytics');
        if (!cancelled) setAnalytics(data);
      } catch (e) {
        if (!cancelled) {
          const message = e && typeof e === 'object' && 'message' in e
            ? String((e as { message: unknown }).message)
            : 'Failed to load analytics';
          Alert.alert('Error', message);
        }
      } finally {
        if (!cancelled) setAnalyticsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const totalRevenue = analytics?.profitLoss?.totalIncome ?? 0;
  const netProfit = analytics?.profitLoss?.profit ?? 0;
  const bestSelling = analytics?.bestSellingProducts?.slice(0, 5) ?? [];
  const inventoryValue = analytics?.inventoryValue?.totalValue ?? 0;
  const avgDailySales = analytics?.dailySales?.length
    ? analytics.dailySales.reduce((s, d) => s + d.total, 0) / analytics.dailySales.length
    : 0;
  const health = netProfit >= 0 ? 'Healthy' : 'Needs attention';

  const saveProfile = useCallback(async () => {
    const balance = Math.max(0, parseFloat(openingBalance) || 0);
    setProfileSaving(true);
    try {
      await updateProfile({
        storeName: storeName.trim() || profile.storeName,
        ownerName: ownerName.trim() || profile.ownerName,
        openingBalance: balance,
      });
      setEditModalVisible(false);
      Alert.alert('Success', 'Profile updated successfully.');
    } catch {
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setProfileSaving(false);
    }
  }, [storeName, ownerName, openingBalance, updateProfile, profile]);

  const handleLogout = useCallback(async () => {
    await logout();
    router.replace('/(auth)/login');
  }, [logout, router]);

  if (appLoading || (analyticsLoading && !analytics)) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.tint} />
          <ThemedText style={styles.loadingText}>Loading…</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <ThemedText type="title" style={styles.title}>
          Account
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          Profile & business analytics
        </ThemedText>

        <ThemedView style={styles.profileCard}>
          <ThemedText type="defaultSemiBold">{profile.storeName}</ThemedText>
          <ThemedText style={styles.profileMeta}>{profile.ownerName}</ThemedText>
          <ThemedText style={styles.profileMeta}>
            Opening balance: ₹{profile.openingBalance.toFixed(2)}
          </ThemedText>
          <View style={styles.profileActions}>
            <TouchableOpacity
              style={[styles.editBtn, { borderColor: colors.tint }]}
              onPress={() => {
                setStoreName(profile.storeName);
                setOwnerName(profile.ownerName);
                setOpeningBalance(String(profile.openingBalance));
                setEditModalVisible(true);
              }}
            >
              <ThemedText style={[styles.editBtnText, { color: colors.tint }]}>
                Update Profile
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.logoutBtn, { borderColor: '#ef4444' }]}
              onPress={handleLogout}
            >
              <ThemedText style={styles.logoutBtnText}>Logout</ThemedText>
            </TouchableOpacity>
          </View>
        </ThemedView>

        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Business Analytics
        </ThemedText>

        <View style={styles.analyticsGrid}>
          <ThemedView style={styles.analyticCard}>
            <ThemedText style={styles.analyticLabel}>Total Revenue</ThemedText>
            <ThemedText style={styles.analyticValue}>₹{totalRevenue.toFixed(2)}</ThemedText>
          </ThemedView>
          <ThemedView style={styles.analyticCard}>
            <ThemedText style={styles.analyticLabel}>Net Profit/Loss</ThemedText>
            <ThemedText
              style={[
                styles.analyticValue,
                { color: netProfit >= 0 ? '#22c55e' : '#ef4444' },
              ]}
            >
              {netProfit >= 0 ? '+' : ''}₹{netProfit.toFixed(2)}
            </ThemedText>
          </ThemedView>
          <ThemedView style={styles.analyticCard}>
            <ThemedText style={styles.analyticLabel}>Avg Daily Sales</ThemedText>
            <ThemedText style={styles.analyticValue}>₹{avgDailySales.toFixed(0)}</ThemedText>
          </ThemedView>
          <ThemedView style={styles.analyticCard}>
            <ThemedText style={styles.analyticLabel}>Inventory Value</ThemedText>
            <ThemedText style={styles.analyticValue}>₹{inventoryValue.toFixed(2)}</ThemedText>
          </ThemedView>
          <ThemedView style={styles.analyticCard}>
            <ThemedText style={styles.analyticLabel}>Business Health</ThemedText>
            <ThemedText
              style={[
                styles.analyticValue,
                { color: health === 'Healthy' ? '#22c55e' : '#f59e0b' },
              ]}
            >
              {health}
            </ThemedText>
          </ThemedView>
        </View>

        <ThemedView style={styles.bestSelling}>
          <ThemedText type="subtitle">Best Selling Products</ThemedText>
          {bestSelling.length > 0 ? (
            bestSelling.map((p, i) => (
              <View key={p.product_id} style={styles.bestRow}>
                <ThemedText>
                  {i + 1}. {p.name}
                </ThemedText>
                <ThemedText type="defaultSemiBold">{p.total_sold} sold</ThemedText>
              </View>
            ))
          ) : (
            <ThemedText style={styles.emptyHint}>No sales data yet</ThemedText>
          )}
        </ThemedView>
      </ScrollView>

      <Modal visible={editModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ThemedView style={styles.modal}>
            <ThemedText type="title" style={styles.modalTitle}>
              Update Profile
            </ThemedText>
            <ThemedText style={styles.label}>Store Name</ThemedText>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={storeName}
              onChangeText={setStoreName}
              placeholder="Store name"
              placeholderTextColor={colors.icon}
            />
            <ThemedText style={styles.label}>Owner Name</ThemedText>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={ownerName}
              onChangeText={setOwnerName}
              placeholder="Owner name"
              placeholderTextColor={colors.icon}
            />
            <ThemedText style={styles.label}>Opening Balance (₹)</ThemedText>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={openingBalance}
              onChangeText={setOpeningBalance}
              placeholder="0"
              placeholderTextColor={colors.icon}
              keyboardType="decimal-pad"
            />
              <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setEditModalVisible(false)} disabled={profileSaving}>
                  <ThemedText style={{ color: colors.tint }}>Cancel</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: colors.tint }]}
                  onPress={saveProfile}
                  disabled={profileSaving}
                >
                  <ThemedText style={styles.saveBtnText}>
                    {profileSaving ? 'Saving…' : 'Save'}
                  </ThemedText>
                </TouchableOpacity>
              </View>
          </ThemedView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  title: {
    marginBottom: 4,
  },
  subtitle: {
    opacity: 0.8,
    marginBottom: 24,
  },
  profileCard: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
    backgroundColor: 'rgba(128,128,128,0.08)',
  },
  profileMeta: {
    marginTop: 4,
    opacity: 0.8,
  },
  profileActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    flexWrap: 'wrap',
  },
  editBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  editBtnText: {
    fontWeight: '600',
  },
  logoutBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  logoutBtnText: {
    fontWeight: '600',
    color: '#ef4444',
  },
  sectionTitle: {
    marginBottom: 16,
  },
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  analyticCard: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(128,128,128,0.08)',
  },
  analyticLabel: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 4,
  },
  analyticValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  bestSelling: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(128,128,128,0.08)',
  },
  bestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  emptyHint: {
    opacity: 0.6,
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    marginBottom: 4,
    opacity: 0.7,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.3)',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    marginTop: 8,
  },
  saveBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
});
