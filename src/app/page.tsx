import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Hash,
  LayoutGrid,
  ListTree,
  Sparkles,
  Sun,
} from "lucide-react";

const FEATURES = [
  { icon: Sun, title: "Smart views", body: "Today, Tomorrow, Next 7 Days, Inbox — your day, organized." },
  { icon: CalendarDays, title: "Calendar", body: "Drag tasks between days. Plan your week visually." },
  { icon: ListTree, title: "Subtasks", body: "Break work into pieces. Track progress at a glance." },
  { icon: CheckCircle2, title: "Recurring tasks", body: "Daily, weekly, monthly — set it once, never miss it." },
  { icon: Clock, title: "Pomodoro", body: "Focus cycles with breaks, all logged for later review." },
  { icon: Sparkles, title: "Habits", body: "Build streaks. Show up. Compound." },
  { icon: LayoutGrid, title: "Eisenhower", body: "Sort by urgency × importance. Decide faster." },
  { icon: Hash, title: "Tags & priorit