import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function priorityLabel(p: number): string {
  if (p >= 5) return "High";
  if (p >= 3) return "Medium";
  if (p >= 1) return "Low";
  return "None";
}

export function priorityColorClass(p: number): string {
  if (p >= 5) return "text-p-high";
  if (p >= 3) return "text-p-med";
  if (p >= 1) return "text-p-low";
  return "text-p-none";
}
