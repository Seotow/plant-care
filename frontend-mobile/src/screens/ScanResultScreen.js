import React, { useState, useEffect } from "react";
import { StyleSheet, View, ScrollView, Image, Dimensions } from "react-native";
import { Button, Card, Text, ProgressBar, Chip } from "react-native-paper";
import Svg, { Rect } from "react-native-svg";
import api from "../services/api";

const SCREEN_WIDTH = Dimensions.get("window").width - 32;

function formatLabel(label) {
  return label.replace(/___/g, " — ").replace(/_/g, " ");
}

function isHealthy(label) {
  return label.toLowerCase().includes("healthy") || label.includes("Khỏe mạnh");
}

function ConfidenceBar({ value }) {
  const color = value > 0.8 ? "#B3261E" : value > 0.5 ? "#F9A825" : "#2F6E49";
  return (
    <View style={styles.barWrap}>
      <ProgressBar progress={value} color={color} style={styles.bar} />
      <Text variant="labelSmall" style={{ color }}>
        {(value * 100).toFixed(1)}%
      </Text>
    </View>
  );
}

function AnalysisBanner({ analysis }) {
  if (!analysis) return null;
  const ratio = analysis.disease_ratio * 100;
  const color = ratio > 50 ? "#B3261E" : ratio > 20 ? "#F9A825" : "#2F6E49";

  return (
    <Card style={[styles.analysisBanner, { borderLeftColor: color }]} mode="elevated">
      <Card.Content style={styles.analysisContent}>
        <View style={styles.analysisHeader}>
          <Text variant="titleMedium" style={{ fontWeight: "700" }}>
            Phân tích tổng quan
          </Text>
          <Chip
            style={[styles.ratioChip, { backgroundColor: color + "20" }]}
            textStyle={{ color, fontWeight: "700" }}
          >
            Bệnh: {ratio.toFixed(0)}%
          </Chip>
        </View>
        <View style={styles.analysisStats}>
          <View style={styles.stat}>
            <Text variant="headlineMedium" style={styles.statValue}>
              {analysis.total_leaves}
            </Text>
            <Text variant="labelSmall" style={styles.statLabel}>Tổng lá</Text>
          </View>
          <View style={styles.stat}>
            <Text variant="headlineMedium" style={[styles.statValue, { color: "#2F6E49" }]}>
              {analysis.healthy_leaves}
            </Text>
            <Text variant="labelSmall" style={styles.statLabel}>Khỏe mạnh</Text>
          </View>
          <View style={styles.stat}>
            <Text variant="headlineMedium" style={[styles.statValue, { color: "#B3261E" }]}>
              {analysis.diseased_leaves}
            </Text>
            <Text variant="labelSmall" style={styles.statLabel}>Bệnh</Text>
          </View>
        </View>
      </Card.Content>
    </Card>
  );
}

function AnnotatedImage({ imageUrl, detections }) {
  const displayWidth = SCREEN_WIDTH;
  const [displayHeight, setDisplayHeight] = useState(280);
  const [imgNatural, setImgNatural] = useState({ w: 1, h: 1 });

  useEffect(() => {
    if (imageUrl) {
      Image.getSize(
        imageUrl,
        (w, h) => {
          setImgNatural({ w, h });
          setDisplayHeight(Math.min((h / w) * displayWidth, 420));
        },
        () => {},
      );
    }
  }, [imageUrl]);

  return (
    <View style={[styles.imageContainer, { height: displayHeight }]}>
      <Image
        source={{ uri: imageUrl }}
        style={{ width: displayWidth, height: displayHeight }}
        resizeMode="contain"
      />
      <Svg style={StyleSheet.absoluteFill}>
        {detections.map((det, i) => {
          const [bx1, by1, bx2, by2] = det.bbox || [0, 0, 0, 0];
          const rx = (bx1 / imgNatural.w) * displayWidth;
          const ry = (by1 / imgNatural.h) * displayHeight;
          const rw = ((bx2 - bx1) / imgNatural.w) * displayWidth;
          const rh = ((by2 - by1) / imgNatural.h) * displayHeight;
          const healthy = isHealthy(det.disease_label || det.disease_label_vi || "");
          const stroke = healthy ? "#2F6E49" : "#B3261E";
          return (
            <Rect
              key={i}
              x={rx}
              y={ry}
              width={rw}
              height={rh}
              fill={stroke + "18"}
              stroke={stroke}
              strokeWidth={2}
              rx={3}
            />
          );
        })}
      </Svg>
    </View>
  );
}

export default function ScanResultScreen({ navigation, route }) {
  const { result } = route.params;
  const detections = result?.detections || [];
  const analysis = result?.analysis || null;
  const imageUrl = result?.image_url ? api.getImageUrl(result.image_url) : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {imageUrl && <AnnotatedImage imageUrl={imageUrl} detections={detections} />}

      <AnalysisBanner analysis={analysis} />

      <Text variant="titleMedium" style={styles.heading}>
        Chi tiết nhận diện ({detections.length})
      </Text>

      {detections.length === 0 && (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="bodyLarge" style={{ textAlign: "center" }}>
              Không phát hiện bệnh trên ảnh này
            </Text>
          </Card.Content>
        </Card>
      )}

      {detections.map((det, idx) => {
        const label = det.disease_label_vi || formatLabel(det.disease_label);
        const healthy = isHealthy(det.disease_label || det.disease_label_vi || "");
        return (
          <Card key={det.id || idx} style={styles.card} mode="elevated">
            <Card.Content>
              <View style={styles.detLabelRow}>
                <View
                  style={[styles.dot, { backgroundColor: healthy ? "#2F6E49" : "#B3261E" }]}
                />
                <Text variant="titleMedium" style={styles.diseaseLabel}>
                  {label}
                </Text>
              </View>
              <ConfidenceBar value={det.confidence} />
            </Card.Content>
          </Card>
        );
      })}

      <Button
        mode="contained"
        onPress={() => navigation.goBack()}
        style={styles.button}
        icon="camera"
      >
        Quét tiếp
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F6EE" },
  content: { padding: 16, paddingBottom: 30 },
  imageContainer: {
    width: "100%",
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 16,
    backgroundColor: "#E8EFE3",
  },
  analysisBanner: {
    borderRadius: 14,
    borderLeftWidth: 4,
    marginBottom: 16,
  },
  analysisContent: { paddingVertical: 12 },
  analysisHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  ratioChip: { height: 32 },
  analysisStats: { flexDirection: "row", justifyContent: "space-around" },
  stat: { alignItems: "center" },
  statValue: { fontWeight: "700" },
  statLabel: { opacity: 0.6, marginTop: 2 },
  heading: { fontWeight: "700", marginBottom: 12 },
  card: { borderRadius: 14, marginBottom: 12 },
  detLabelRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
  diseaseLabel: { fontWeight: "700", flex: 1 },
  barWrap: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  bar: { flex: 1, height: 8, borderRadius: 4 },
  subLabel: { opacity: 0.6, marginBottom: 4 },
  topkRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  topkLabel: { flex: 1 },
  topkConf: { fontWeight: "600" },
  button: { marginTop: 16 },
});
