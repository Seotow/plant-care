import React, { useCallback, useState } from "react";
import { FlatList, StyleSheet, View, Alert } from "react-native";
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Dialog,
  FAB,
  IconButton,
  Portal,
  RadioButton,
  Text,
  TextInput,
} from "react-native-paper";
import { useFocusEffect } from "@react-navigation/native";
import api from "../services/api";

const PRIORITY_OPTIONS = [
  { value: "high", label: "Cao", color: "#B3261E" },
  { value: "medium", label: "Vừa", color: "#F9A825" },
  { value: "low", label: "Thấp", color: "#2F6E49" },
];

function priorityColor(p) {
  return PRIORITY_OPTIONS.find((o) => o.value === p)?.color || "#999";
}

function TaskCard({ task, onToggle, onDelete }) {
  const done = !!task.completed;
  const color = done ? "#999" : priorityColor(task.priority);

  return (
    <Card
      style={[styles.card, { borderLeftWidth: 3, borderLeftColor: color, opacity: done ? 0.6 : 1 }]}
      mode="elevated"
    >
      <Card.Content style={styles.cardContent}>
        <View style={styles.cardLeft}>
          <Text
            variant="titleMedium"
            style={[styles.taskTitle, done && styles.taskDone]}
          >
            {task.title}
          </Text>
          <View style={styles.metaRow}>
            {task.due_time ? (
              <Text variant="bodySmall" style={styles.dueTime}>
                {task.due_time}
              </Text>
            ) : null}
            <Chip
              compact
              style={{ backgroundColor: color + "18" }}
              textStyle={{ color, fontSize: 11, fontWeight: "600" }}
            >
              {PRIORITY_OPTIONS.find((o) => o.value === task.priority)?.label || task.priority}
            </Chip>
          </View>
        </View>
        <View style={styles.cardActions}>
          <IconButton
            icon={done ? "checkbox-marked-circle" : "checkbox-blank-circle-outline"}
            iconColor={done ? "#2F6E49" : "#999"}
            size={24}
            onPress={() => onToggle(task.id)}
          />
          <IconButton
            icon="delete-outline"
            iconColor="#B3261E"
            size={22}
            onPress={() => onDelete(task.id)}
          />
        </View>
      </Card.Content>
    </Card>
  );
}

export default function TaskScreen() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [priority, setPriority] = useState("medium");
  const [saving, setSaving] = useState(false);

  const fetchTasks = useCallback(() => {
    setLoading(true);
    api
      .getTasks()
      .then(setTasks)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(fetchTasks);

  const handleToggle = async (id) => {
    try {
      await api.toggleTask(id);
      fetchTasks();
    } catch {}
  };

  const handleDelete = (id) => {
    Alert.alert("Xóa công việc", "Bạn có chắc muốn xóa?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          try {
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
      await api.createTask({ title: title.trim(), due_time: dueTime.trim(), priority });
      setTitle("");
      setDueTime("");
      setPriority("medium");
      setDialogOpen(false);
      fetchTasks();
    } catch {}
    setSaving(false);
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const pending = tasks.filter((t) => !t.completed);
  const completed = tasks.filter((t) => t.completed);

  return (
    <View style={styles.container}>
      <FlatList
        contentContainerStyle={styles.list}
        data={[...pending, ...completed]}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <TaskCard task={item} onToggle={handleToggle} onDelete={handleDelete} />
        )}
        ListEmptyComponent={
          <Text variant="bodyLarge" style={styles.empty}>
            Chưa có công việc nào
          </Text>
        }
        ListHeaderComponent={
          pending.length > 0 && completed.length > 0 ? null : undefined
        }
        stickyHeaderIndices={[]}
      />

      <FAB icon="plus" style={styles.fab} onPress={() => setDialogOpen(true)} />

      <Portal>
        <Dialog visible={dialogOpen} onDismiss={() => setDialogOpen(false)}>
          <Dialog.Title>Thêm công việc</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Tên công việc *"
              value={title}
              onChangeText={setTitle}
              mode="outlined"
              style={styles.input}
            />
            <TextInput
              label="Thời gian (VD: 08:00)"
              value={dueTime}
              onChangeText={setDueTime}
              mode="outlined"
              style={styles.input}
            />
            <Text variant="labelLarge" style={styles.prioLabel}>
              Ưu tiên
            </Text>
            <RadioButton.Group onValueChange={setPriority} value={priority}>
              {PRIORITY_OPTIONS.map((opt) => (
                <RadioButton.Item
                  key={opt.value}
                  label={opt.label}
                  value={opt.value}
                  labelStyle={{ color: opt.color }}
                />
              ))}
            </RadioButton.Group>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogOpen(false)}>Hủy</Button>
            <Button onPress={handleCreate} loading={saving} disabled={!title.trim()}>
              Tạo
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F6EE" },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  list: { padding: 14, paddingBottom: 80 },
  card: { borderRadius: 14, marginBottom: 10 },
  cardContent: { flexDirection: "row", alignItems: "center" },
  cardLeft: { flex: 1 },
  taskTitle: { fontWeight: "700", marginBottom: 4 },
  taskDone: { textDecorationLine: "line-through", color: "#999" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dueTime: { opacity: 0.6 },
  cardActions: { flexDirection: "row" },
  empty: { textAlign: "center", opacity: 0.5, marginTop: 40 },
  fab: { position: "absolute", right: 16, bottom: 16, backgroundColor: "#2F6E49" },
  input: { marginBottom: 10 },
  prioLabel: { marginTop: 4, marginBottom: 2 },
});
