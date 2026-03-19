import { useState } from 'react';
import {
    Alert,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface ExpenseFormModalProps {
    visible: boolean;
    mode: 'add' | 'edit';
    initialData?: {
        entry_id?: number;
        type: 'income' | 'expense';
        amount: number;
        description: string | null;
        date: string;
    };
    onSubmit: (data: {
        type: 'income' | 'expense';
        amount: number;
        description: string;
        date: string;
    }) => void;
    onCancel: () => void;
}

export function ExpenseFormModal({
    visible,
    mode,
    initialData,
    onSubmit,
    onCancel,
}: ExpenseFormModalProps) {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];

    const [type, setType] = useState<'income' | 'expense'>(
        initialData?.type || 'expense'
    );
    const [amount, setAmount] = useState(
        initialData?.amount?.toString() || ''
    );
    const [description, setDescription] = useState(
        initialData?.description || ''
    );
    const [date, setDate] = useState(
        initialData?.date || new Date().toISOString().split('T')[0]
    );
    const [amountError, setAmountError] = useState('');

    const handleSubmit = () => {
        // Validate amount
        const numAmount = parseFloat(amount);
        if (!amount.trim()) {
            setAmountError('Amount is required');
            return;
        }
        if (isNaN(numAmount)) {
            setAmountError('Please enter a valid number');
            return;
        }
        if (numAmount < 0) {
            setAmountError('Amount cannot be negative');
            return;
        }
        if (numAmount === 0) {
            setAmountError('Amount cannot be zero');
            return;
        }
        setAmountError('');

        const today = new Date().toISOString().split('T')[0];
        if (date > today) {
            Alert.alert('Invalid Date', 'Date cannot be in the future');
            return;
        }

        onSubmit({
            type,
            amount: numAmount,
            description: description.trim(),
            date,
        });
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onCancel}
        >
            <View style={styles.modalOverlay}>
                <ThemedView style={styles.modalContent}>
                    <ScrollView>
                        <ThemedText type="title" style={styles.modalTitle}>
                            {mode === 'add' ? 'Add Entry' : 'Edit Entry'}
                        </ThemedText>

                        {/* Type Toggle */}
                        <View style={styles.formGroup}>
                            <ThemedText style={styles.label}>Type</ThemedText>
                            <View style={styles.typeToggle}>
                                <Pressable
                                    style={[
                                        styles.typeButton,
                                        type === 'expense' && {
                                            backgroundColor: colors.tint,
                                        },
                                    ]}
                                    onPress={() => setType('expense')}
                                >
                                    <ThemedText
                                        style={[
                                            styles.typeButtonText,
                                            type === 'expense' && styles.typeButtonTextActive,
                                        ]}
                                    >
                                        Expense
                                    </ThemedText>
                                </Pressable>
                                <Pressable
                                    style={[
                                        styles.typeButton,
                                        type === 'income' && {
                                            backgroundColor: colors.tint,
                                        },
                                    ]}
                                    onPress={() => setType('income')}
                                >
                                    <ThemedText
                                        style={[
                                            styles.typeButtonText,
                                            type === 'income' && styles.typeButtonTextActive,
                                        ]}
                                    >
                                        Income
                                    </ThemedText>
                                </Pressable>
                            </View>
                        </View>

                        {/* Amount */}
                        <View style={styles.formGroup}>
                            <ThemedText style={styles.label}>Amount (₹)</ThemedText>
                            <TextInput
                                style={[
                                    styles.input,
                                    {
                                        color: colors.text,
                                        borderColor: amountError ? '#ef4444' : colors.tint + '40',
                                        backgroundColor: colors.background,
                                    },
                                ]}
                                value={amount}
                                onChangeText={(t) => { setAmount(t); setAmountError(''); }}
                                keyboardType="decimal-pad"
                                placeholder="0.00"
                                placeholderTextColor={colors.text + '60'}
                            />
                            {amountError ? (
                                <ThemedText style={styles.amountError}>{amountError}</ThemedText>
                            ) : null}
                        </View>

                        {/* Description */}
                        <View style={styles.formGroup}>
                            <ThemedText style={styles.label}>Description</ThemedText>
                            <TextInput
                                style={[
                                    styles.input,
                                    styles.textArea,
                                    {
                                        color: colors.text,
                                        borderColor: colors.tint + '40',
                                        backgroundColor: colors.background,
                                    },
                                ]}
                                value={description}
                                onChangeText={setDescription}
                                placeholder="Enter description..."
                                placeholderTextColor={colors.text + '60'}
                                multiline
                                numberOfLines={3}
                            />
                        </View>

                        {/* Date */}
                        <View style={styles.formGroup}>
                            <ThemedText style={styles.label}>Date</ThemedText>
                            <TextInput
                                style={[
                                    styles.input,
                                    {
                                        color: colors.text,
                                        borderColor: colors.tint + '40',
                                        backgroundColor: colors.background,
                                    },
                                ]}
                                value={date}
                                onChangeText={setDate}
                                placeholder="YYYY-MM-DD"
                                placeholderTextColor={colors.text + '60'}
                            />
                        </View>

                        {/* Buttons */}
                        <View style={styles.buttonRow}>
                            <Pressable
                                style={[styles.button, styles.cancelButton]}
                                onPress={onCancel}
                            >
                                <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
                            </Pressable>
                            <Pressable
                                style={[
                                    styles.button,
                                    styles.submitButton,
                                    { backgroundColor: colors.tint },
                                ]}
                                onPress={handleSubmit}
                            >
                                <ThemedText style={styles.submitButtonText}>
                                    {mode === 'add' ? 'Add' : 'Update'}
                                </ThemedText>
                            </Pressable>
                        </View>
                    </ScrollView>
                </ThemedView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '100%',
        maxWidth: 500,
        borderRadius: 16,
        padding: 24,
        maxHeight: '80%',
    },
    modalTitle: {
        marginBottom: 24,
        textAlign: 'center',
    },
    formGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        opacity: 0.9,
    },
    input: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
    },
    amountError: {
        color: '#ef4444',
        fontSize: 12,
        marginTop: 4,
        fontWeight: '500',
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    typeToggle: {
        flexDirection: 'row',
        gap: 12,
    },
    typeButton: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        backgroundColor: 'rgba(128, 128, 128, 0.15)',
        alignItems: 'center',
    },
    typeButtonText: {
        fontSize: 14,
        fontWeight: '600',
        opacity: 0.7,
    },
    typeButtonTextActive: {
        color: '#fff',
        opacity: 1,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    button: {
        flex: 1,
        padding: 14,
        borderRadius: 8,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: 'rgba(128, 128, 128, 0.15)',
    },
    submitButton: {
        // backgroundColor set dynamically
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    submitButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
});
