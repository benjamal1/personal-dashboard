import Clock from "./components/Clock";
import TodoList from "./components/TodoList";
import Weather from "./components/Weather";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[#111111]">
      <div className="flex w-full max-w-lg flex-col items-center gap-0 px-8">
        <Clock initialTimestamp={new Date().toISOString()} />
        <Weather />
        <TodoList />
      </div>
    </main>
  );
}
