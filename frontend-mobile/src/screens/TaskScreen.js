import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Platform, StyleSheet, View, Alert } from "react-native";
import {
  ActivityIndicator,
  Button,
  Chip,
  Dialog,
  FAB,
  IconButton,
  Portal,
  RadioButton,
  Text,
  TextInput,
} from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import api from "../services/api";
import useResponsive from "../hooks/useResponsive";
import { colors, shadows, spacing } from "../theme";

// Lazy-load expo-notifications (not available on web)
let Notifications = null;
try {
  if (Platform.OS !== "web") {
    Notifications = require("expo-notifications");
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }
} catch (_) {}

async function scheduleTaskNotification(taskId, title, dueTime) {
  if (!Notifications || Platform.OS === "web") return;
  try {
    // dueTime format: "HH:MM"
    const [hour, minute] = dueTime.split(":").map(Number);
    if (isNaN(hour) || isNaN(minute)) return;
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Nhắc nhở công việc",
        body: title,
        sound: true,
      },
      trigger: { hour, minute, repeats: true },
    });
    await AsyncStorage.setItem(`task_notif_${taskId}`, id);
  } catch (_) {}
}

async function cancelTaskNotification(taskId) {
  if (!Notifications || Platform.OS === "web") return;
  try {
    const id = await AsyncStorage.getItem(`task_notif_${taskId}`);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id);
      await AsyncStorage.removeItem(`task_notif_${taskId}`);
    }
  } catch (_) {}
}

const PRIORITY_OPTIONS = [
  { value: "high", label: "Cao", color: colors.error },
  { value: "medium", label: "Vừa", color: colors.warning },
  { value: "low", label: "Thấp", color: colors.success },
];

function priorityColor(p) {
  return PRIORITY_OPTIONS.find((o) => o.value === p)?.color || colors.textMuted;
}

function TaskCard({ task, onToggle, onDelete }) {
  const done = !!task.completed;
  const pColor = done ? colors.textMuted : priorityColor(task.priority);
  const pBg = pColor + "15";

  return (
    <View style={[tcStyles.card, done && tcStyles.cardDone]}>
      <View style={[tcStyles.indicator, { backgroundColor: pColor }]} />
      <View style={tcStyles.content}>
        <View style={tcStyles.topRow}>
          <Text variant="titleMedium" style={[tcStyles.title, done && tcStyles.titleDone]} numberOfLines={2}>
            {task.title}
          </Text>
          <Chip compact style={{ backgroundColor: pBg }} textStyle={{ color: pColor, fontSize: 11, fontWeight: "700" }}>
            {PRIORITY_OPTIONS.find((o) => o.value === task.priority)?.label || task.priority}
          </Chip>
        </View>
        {task.due_time ? (
          <View style={tcStyles.timeRow}>
            <MaterialCommunityIcons name="clock-outline" size={14} color={colors.textMuted} />
            <Text variant="bodySmall" style={tcStyles.time}>{task.due_time}</Text>
          </View>
        ) : null}
      </View>
      <View style={tcStyles.actions}>
        <IconButton
          icon={done ? "checkbox-marked-circle" : "checkbox-blank-circle-outline"}
          iconColor={done ? colors.success : colors.textMuted}
          size={26}
          onPress={() => onToggle(task.id)}
        />
        <IconButton icon="delete-outline" iconColor={colors.error} size={22} onPress={() => onDelete(task.id)} />
      </View>
    </View>
  );
}

const tcStyles = StyleSheet.create({
  card: {
    flexDirection: "row", backgroundColor: colors.surface, borderRadius: 16,
    marginBottom: 10, overflow: "hidden", ...shadows.small,
  },
  cardDone: { opacity: 0.6 },
  indicator: { width: 4 },
  content: { flex: 1, padding: 14 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  title: { fontWeight: "600", color: colors.text, flex: 1, marginRight: 8 },
  titleDone: { textDecorationLine: "line-through", color: colors.textMuted },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  time: { color: colors.textMuted },
  actions: { flexDirection: "column", justifyContent: "center", paddingRight: 4 },
});

export default function TaskScreen() {
  const { isMobile } = useResponsive();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [priority, setPriority] = useState("medium");
  const [saving, setSaving] = useState(false);

  const fetchTasks = useCallback(() => {
    setLoading(true);
    api.getTasks().then(setTasks).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useFocusEffect(fetchTasks);

  // Request notification permissions once on mount
  useEffect(() => {
    if (Notifications && Platform.OS !== "web") {
      Notifications.requestPermissionsAsync().catch(() => {});
    }
  }, []);

  const handleToggle = async (id, task) => {
    try {
      await api.toggleTask(id);
      if (!task.completed) {
        // marking as done → cancel notification
        cancelTaskNotification(id);
      }
      fetchTasks();
    } catch {}
  };

  const handleDelete = (id) => {
    Alert.alert("Xóa công việc", "Bạn có chắc muốn xóa?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa", style: "destructive",
        onPress: async () => {
          try {
            cancelTaskNotification(id);
            await api.deleteTask(id);
            fetchTasks();
          } catch {}
        },
      },
    ]);
  };

  const handleCreate = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const task = await api.createTask({ title: title.trim(), due_time: dueTime.trim(), priority });
      if (dueTime.trim() && task?.id) {
        await scheduleTaskNotification(task.id, title.trim(), dueTime.trim());
      }
      setTitle(""); setDueTime(""); setPriority("medium"); setDialogOpen(false);
      fetchTasks();
    } catch {}
    setSaving(false);
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const pending = tasks.filter((t) => !t.completed);
  const completed = tasks.filter((t) => t.completed);

  return (
    <View style={styles.container}>
      <FlatList
        contentContainerStyle={[styles.list, !isMobile && styles.listWeb]}
        data={[...pending, ...completed]}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <TaskCard
            task={item}
            onToggle={(id) => handleToggle(id, item)}
            onDelete={handleDelete}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <MaterialCommunityIcons name="clipboard-check-outline" size={48} color={colors.textMuted} />
            <Text variant="bodyLarge" style={styles.emptyText}>Chưa có công việc nào</Text>
          </View>
        }
      />

      <FAB icon="plus" style={styles.fab} color={colors.onPrimary} onPress={() => setDialogOpen(true)} />

      <Portal>
        <Dialog visible={dialogOpen} onDismiss={() => setDialogOpen(false)} style={styles.dialog}>
          <Dialog.Title>Thêm công việc</Dialog.Title>
          <Dialog.Content>
            <TextInput label="Tên công việc *" value={title} onChangeText={setTitle} mode="outlined" style={styles.input} outlineStyle={styles.inputOutline} />
            <TextInput label="Thời gian (VD: 08:00)" value={dueTime} onChangeText={setDueTime} mode="outlined" style={styles.input} outlineStyle={styles.inputOutline} />
            <Text variant="labelLarge" style={styles.prioLabel}>Ưu tiên</Text>
            <RadioButton.Group onValueChange={setPriority} value={priority}>
              {PRIORITY_OPTIONS.map((opt) => (
                <RadioButton.Item key={opt.value} label={opt.label} value={opt.value} labelStyle={{ color: opt.color, fontWeight: "600" }} />
              ))}
            </RadioButton.Group>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogOpen(false)}>Hủy</Button>
            <Button onPress={handleCreate} loading={saving} disabled={!title.trim()} mode="contained" style={styles.createBtn}>
              Tạo
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loader: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  list: { padding: spacing.md, paddingBottom: 80 },
  listWeb: { maxWidth: 600, alignSelf: "center", width: "100%" },
  emptyWrap: { alignItems: "center", marginTop: 60, gap: 8 },
  emptyText: { color: colors.textMuted },
  fab: { position: "absolute", right: 16, bottom: 16, backgroundColor: colors.primary, borderRadius: 16 },
  dialog: { borderRadius: 20 },
  input: { marginBottom: 12, backgroundColor: colors.surface },
  inputOutline: { borderRadius: 12 },
  prioLabel: { marginTop: 4, marginBottom: 2, color: colors.text },
  createBtn: { borderRadius: 10 },
});
