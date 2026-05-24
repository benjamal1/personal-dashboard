import DashboardShell from "./components/DashboardShell";

export default function HomePage() {
  return <DashboardShell initialTimestamp={new Date().toISOString()} />;
}
