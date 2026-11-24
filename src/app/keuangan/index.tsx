import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotionPressable } from '@/components/common/MotionPressable';
import { useAuth } from '@/hooks/useAuth';
import {
  useCreateExpenseCategoryMutation,
  useCreateExpenseMutation,
  useDeleteExpenseCategoryMutation,
  useDeleteExpenseMutation,
  useExpenseCategoriesQuery,
  useExpensesQuery,
} from '@/hooks/useExpenses';
import { formatIsoDateLocal, formatRupiah } from '@/lib/format';
import type { ExpenseCategoryRow, ExpenseRow } from '@/types/database';

const styles = StyleSheet.create({
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 32,
  },
  chipStrip: {
    gap: 6,
  },
  heroShadow: {
    shadowColor: '#D91E2A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 4,
  },
  iconPressed: {
    opacity: 0.7,
  },
});

const ExpenseRowItem = memo(function ExpenseRowItem({
  item,
  isFirst,
  isLast,
  onDelete,
}: {
  item: ExpenseRow;
  isFirst: boolean;
  isLast: boolean;
  onDelete: (item: ExpenseRow) => void;
}) {
  return (
    <View
      className={`flex-row items-center justify-between gap-2.5 border-x border-border bg-white px-3.5 py-3 ${
        isFirst ? 'rounded-t-card border-t' : ''
      } ${isLast ? 'rounded-b-card border-b' : 'border-b border-border'}`}
    >
      <View className="flex-1">
        <Text className="font-bold text-[13.5px] text-black">
          {item.category_name_snapshot}
        </Text>
        {item.note ? (
          <Text className="mt-0.5 font-medium text-[12px] text-muted" numberOfLines={2}>
            {item.note}
          </Text>
        ) : null}
        <Text className="mt-0.5 font-medium text-[11px] text-muted" style={styles.tabular}>
          {item.expense_date}
        </Text>
      </View>

      <View className="flex-row items-center gap-2.5">
        <Text className="font-extrabold text-[14px] text-red" style={styles.tabular}>
          -{formatRupiah(item.amount)}
        </Text>
        <Pressable
          onPress={() => onDelete(item)}
          hitSlop={6}
          accessibilityLabel="Hapus pengeluaran"
          style={({ pressed }) => (pressed ? styles.iconPressed : undefined)}
          className="h-8 w-8 items-center justify-center rounded-full bg-surface"
        >
          <FontAwesome6 name="trash" size={12} color="#09090B" solid />
        </Pressable>
      </View>
    </View>
  );
});

const ExpenseFormHeader = memo(function ExpenseFormHeader({
  storeId,
  categories,
  totalExpenses,
  expenseCount,
  onOpenCatModal,
}: {
  storeId: string | undefined;
  categories: ExpenseCategoryRow[];
  totalExpenses: number;
  expenseCount: number;
  onOpenCatModal: () => void;
}) {
  const createExpense = useCreateExpenseMutation();

  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategoryRow | null>(null);
  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => formatIsoDateLocal());
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedCategory && categories.length > 0) {
      setSelectedCategory(categories[0]);
    }
  }, [categories, selectedCategory]);

  const handleAddExpense = async () => {
    if (!storeId) return;
    setFormError(null);

    if (!selectedCategory) {
      setFormError('Pilih kategori pengeluaran terlebih dahulu.');
      return;
    }

    const amount = Number.parseInt(amountText.trim(), 10);
    if (!Number.isInteger(amount) || amount <= 0) {
      setFormError('Nominal pengeluaran harus bilangan bulat lebih dari 0.');
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseDate.trim())) {
      setFormError('Format tanggal wajib YYYY-MM-DD (contoh: 2026-11-24).');
      return;
    }

    try {
      await createExpense.mutateAsync({
        storeId,
        categoryId: selectedCategory.id,
        categoryName: selectedCategory.name,
        amount,
        note,
        expenseDate: expenseDate.trim(),
      });
      setAmountText('');
      setNote('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal mencatat pengeluaran.');
    }
  };

  return (
    <View className="mb-4">
      {/* Hero Total */}
      <View className="mb-4 rounded-hero bg-red p-5" style={styles.heroShadow}>
        <Text className="font-semibold text-[12px] text-white/90">
          Total Pengeluaran Tercatat
        </Text>
        <Text
          className="mt-1 font-extrabold text-[26px] tracking-[-0.03em] text-white"
          style={styles.tabular}
        >
          {formatRupiah(totalExpenses)}
        </Text>
        <Text className="mt-1 font-medium text-[11.5px] text-white/85">
          {expenseCount} catatan • Pemasukan otomatis dari Kasir
        </Text>
      </View>

      {/* Form Catat Pengeluaran */}
      <View className="mb-5 rounded-card border border-border bg-white p-4">
        <View className="mb-2.5 flex-row items-center justify-between">
          <Text className="font-extrabold text-[14px] text-black">Catat Pengeluaran</Text>
          <MotionPressable onPress={onOpenCatModal} scaleTo={0.95}>
            <Text className="font-bold text-[12px] text-red">Kelola Kategori</Text>
          </MotionPressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-3"
          contentContainerStyle={styles.chipStrip}
        >
          {categories.map((cat) => {
            const active = selectedCategory?.id === cat.id;
            return (
              <Pressable
                key={cat.id}
                onPress={() => setSelectedCategory(cat)}
                className={`rounded-chip border px-3 py-1.5 ${
                  active ? 'border-red bg-red' : 'border-border bg-white'
                }`}
              >
                <Text
                  className={`text-[12px] ${
                    active ? 'font-bold text-white' : 'font-semibold text-black'
                  }`}
                >
                  {cat.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View className="mb-3 flex-row gap-2.5">
          <View className="flex-1">
            <Text className="mb-1.5 font-bold text-[12px] text-black">Nominal (Rp) *</Text>
            <TextInput
              value={amountText}
              onChangeText={(t) => setAmountText(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder="50000"
              placeholderTextColor="#71717A"
              className="rounded-control bg-surface px-3 py-2.5 font-extrabold text-[14px] text-black"
            />
          </View>

          <View className="w-[132px]">
            <Text className="mb-1.5 font-bold text-[12px] text-black">Tanggal *</Text>
            <TextInput
              value={expenseDate}
              onChangeText={setExpenseDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#71717A"
              className="rounded-control bg-surface px-3 py-2.5 font-semibold text-[13px] text-black"
            />
          </View>
        </View>

        <Text className="mb-1.5 font-bold text-[12px] text-black">Catatan (Opsional)</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Contoh: Beli kantong kresek & token listrik"
          placeholderTextColor="#71717A"
          className="mb-3.5 rounded-control bg-surface px-3 py-2.5 font-medium text-[13px] text-black"
        />

        {formError ? (
          <Text className="mb-2.5 font-bold text-[12px] text-red">{formError}</Text>
        ) : null}

        <MotionPressable
          onPress={() => void handleAddExpense()}
          disabled={createExpense.isPending}
          className="min-h-[46px] flex-row items-center justify-center gap-2 rounded-control bg-red py-3"
        >
          {createExpense.isPending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <FontAwesome6 name="plus" size={13} color="#FFFFFF" solid />
          )}
          <Text className="font-extrabold text-[13.5px] text-white">
            {createExpense.isPending ? 'Menyimpan...' : 'Simpan Pengeluaran'}
          </Text>
        </MotionPressable>
      </View>

      <Text className="font-extrabold text-[14px] text-black">
        Riwayat Pengeluaran ({expenseCount})
      </Text>
    </View>
  );
});

const keyExtractor = (item: ExpenseRow) => item.id;

export default function KeuanganScreen() {
  const router = useRouter();
  const { store } = useAuth();

  const { data: categories = [] } = useExpenseCategoriesQuery(store?.id);
  const { data: expenses = [], isLoading } = useExpensesQuery(store?.id);
  const deleteExpense = useDeleteExpenseMutation();
  const createCategory = useCreateExpenseCategoryMutation();
  const deleteCategory = useDeleteExpenseCategoryMutation();

  const [catModalOpen, setCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [catError, setCatError] = useState<string | null>(null);

  const totalExpenses = useMemo(
    () => expenses.reduce((sum, e) => sum + e.amount, 0),
    [expenses],
  );

  const handleAddCategory = async () => {
    if (!store?.id) return;
    setCatError(null);

    try {
      await createCategory.mutateAsync({ storeId: store.id, name: newCatName });
      setNewCatName('');
    } catch (err) {
      setCatError(err instanceof Error ? err.message : 'Gagal menambah kategori.');
    }
  };

  const confirmDeleteExpense = useCallback(
    (item: ExpenseRow) => {
      Alert.alert(
        'Hapus Pengeluaran?',
        `${item.category_name_snapshot} (${formatRupiah(item.amount)}) akan dihapus permanen.`,
        [
          { text: 'Batal', style: 'cancel' },
          {
            text: 'Hapus',
            style: 'destructive',
            onPress: () => void deleteExpense.mutateAsync(item.id),
          },
        ],
      );
    },
    [deleteExpense],
  );

  const totalCount = expenses.length;
  const renderExpense = useCallback(
    ({ item, index }: { item: ExpenseRow; index: number }) => (
      <ExpenseRowItem
        item={item}
        isFirst={index === 0}
        isLast={index === totalCount - 1}
        onDelete={confirmDeleteExpense}
      />
    ),
    [totalCount, confirmDeleteExpense],
  );

  const openCatModal = useCallback(() => setCatModalOpen(true), []);

  const listHeader = useMemo(
    () => (
      <ExpenseFormHeader
        storeId={store?.id}
        categories={categories}
        totalExpenses={totalExpenses}
        expenseCount={expenses.length}
        onOpenCatModal={openCatModal}
      />
    ),
    [store?.id, categories, totalExpenses, expenses.length, openCatModal],
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center justify-between px-[18px] py-3">
        <MotionPressable
          onPress={() => router.back()}
          accessibilityLabel="Kembali"
          className="h-10 w-10 items-center justify-center rounded-full bg-surface"
        >
          <FontAwesome6 name="chevron-left" size={14} color="#09090B" solid />
        </MotionPressable>
        <Text className="font-extrabold text-[16px] tracking-[-0.02em] text-black">
          Keuangan
        </Text>
        <MotionPressable
          onPress={openCatModal}
          accessibilityLabel="Kelola kategori pengeluaran"
          className="h-10 w-10 items-center justify-center rounded-full bg-surface"
        >
          <FontAwesome6 name="tags" size={14} color="#09090B" solid />
        </MotionPressable>
      </View>

      <FlatList
        data={expenses}
        keyExtractor={keyExtractor}
        renderItem={renderExpense}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={5}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator size="small" color="#D91E2A" />
          ) : (
            <View className="rounded-card border border-border bg-white p-4">
              <Text className="font-medium text-[12.5px] text-muted">
                Belum ada catatan pengeluaran.
              </Text>
            </View>
          )
        }
      />

      {/* Modal Kelola Kategori Pengeluaran Kustom (Lazy-mounted) */}
      {catModalOpen ? (
        <Modal
          visible
          animationType="slide"
          onRequestClose={() => setCatModalOpen(false)}
        >
          <SafeAreaView className="flex-1 bg-white">
            <View className="flex-row items-center justify-between px-[18px] py-3">
              <MotionPressable
                onPress={() => setCatModalOpen(false)}
                accessibilityLabel="Tutup kelola kategori"
                className="h-10 w-10 items-center justify-center rounded-full bg-surface"
              >
                <FontAwesome6 name="xmark" size={15} color="#09090B" solid />
              </MotionPressable>
              <Text className="font-extrabold text-[16px] text-black">
                Kategori Pengeluaran
              </Text>
              <View className="h-10 w-10" />
            </View>

            <ScrollView
              className="flex-1 px-[18px]"
              contentContainerStyle={{ paddingBottom: 32 }}
              keyboardShouldPersistTaps="handled"
            >
              <View className="mb-4 flex-row gap-2">
                <TextInput
                  value={newCatName}
                  onChangeText={setNewCatName}
                  placeholder="Tambah kategori kustom..."
                  placeholderTextColor="#71717A"
                  className="flex-1 rounded-control bg-surface px-3.5 py-2.5 font-semibold text-[13px] text-black"
                />
                <MotionPressable
                  onPress={() => void handleAddCategory()}
                  disabled={createCategory.isPending}
                  className="items-center justify-center rounded-control bg-red px-4"
                >
                  <FontAwesome6 name="plus" size={14} color="#FFFFFF" solid />
                </MotionPressable>
              </View>

              {catError ? (
                <Text className="mb-3 font-bold text-[12px] text-red">{catError}</Text>
              ) : null}

              <View className="overflow-hidden rounded-card border border-border bg-white">
                {categories.map((cat, idx) => {
                  const isLast = idx === categories.length - 1;
                  return (
                    <View
                      key={cat.id}
                      className={`flex-row items-center justify-between px-4 py-3 ${
                        !isLast ? 'border-b border-border' : ''
                      }`}
                    >
                      <View>
                        <Text className="font-bold text-[13.5px] text-black">{cat.name}</Text>
                        <Text className="font-medium text-[11px] text-muted">
                          {cat.is_default ? 'Kategori bawaan' : 'Kategori kustom'}
                        </Text>
                      </View>

                      {!cat.is_default && store?.id ? (
                        <Pressable
                          onPress={() =>
                            void deleteCategory.mutateAsync({
                              categoryId: cat.id,
                              storeId: store.id,
                            })
                          }
                          accessibilityLabel={`Hapus kategori ${cat.name}`}
                          className="h-8 w-8 items-center justify-center rounded-full bg-red-soft"
                        >
                          <FontAwesome6 name="trash" size={12} color="#D91E2A" solid />
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}
