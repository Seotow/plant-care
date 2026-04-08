export const farmerProfile = {
  name: "Nguyen Van A",
  phone: "0901 222 333",
  location: "Cu Chi, TP.HCM"
};

export const dashboardSummary = {
  totalGardens: 3,
  totalTrees: 1260,
  healthScore: 82,
  todayAlerts: 4
};

export const weatherToday = {
  temperature: "31C",
  humidity: "72%",
  rain: "20%",
  note: "Nắng nhẹ, nên tưới vào chiều muộn"
};

export const weeklyHealth = {
  labels: ["T2", "T3", "T4", "T5", "T6", "T7", "CN"],
  data: [78, 75, 80, 82, 84, 83, 82]
};

export const todayTasks = [
  {
    id: "task-1",
    title: "Kiem tra sau benh lo Cam 01",
    dueTime: "08:30",
    priority: "high"
  },
  {
    id: "task-2",
    title: "Tuoi nho giot khu B",
    dueTime: "16:00",
    priority: "medium"
  },
  {
    id: "task-3",
    title: "Cap nhat nhat ky phun sinh hoc",
    dueTime: "18:00",
    priority: "low"
  }
];

export const recentDetections = [
  {
    id: "det-1",
    garden: "Vườn Cam 01",
    disease: "Greening nghi ngờ",
    confidence: 0.89,
    createdAt: "2026-03-17 15:30"
  },
  {
    id: "det-2",
    garden: "Vườn Ớt Khu B",
    disease: "Nấm lá sớm",
    confidence: 0.77,
    createdAt: "2026-03-17 09:10"
  },
  {
    id: "det-3",
    garden: "Vườn Xoài 02",
    disease: "Thối quả",
    confidence: 0.73,
    createdAt: "2026-03-16 17:45"
  }
];

export const gardens = [
  {
    id: "garden-1",
    name: "Vườn Cam 01",
    cropType: "Cam sanh",
    area: "2.1 ha",
    trees: 420,
    healthScore: 80
  },
  {
    id: "garden-2",
    name: "Vườn Xoài 02",
    cropType: "Xoài Cát Hòa Lộc",
    area: "1.6 ha",
    trees: 310,
    healthScore: 86
  },
  {
    id: "garden-3",
    name: "Vườn Ớt Khu B",
    cropType: "Ớt hiểm",
    area: "0.9 ha",
    trees: 530,
    healthScore: 79
  }
];
