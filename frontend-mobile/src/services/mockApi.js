import {
  dashboardSummary,
  farmerProfile,
  gardens,
  recentDetections,
  todayTasks,
  weatherToday,
  weeklyHealth
} from "../data/mockData";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getDashboardData() {
  await wait(450);
  return {
    profile: farmerProfile,
    summary: dashboardSummary,
    weather: weatherToday,
    weeklyHealth,
    tasks: todayTasks,
    recentDetections
  };
}

export async function getGardens() {
  await wait(300);
  return gardens;
}
