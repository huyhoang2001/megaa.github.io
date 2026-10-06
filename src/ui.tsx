import type { ButtonHTMLAttributes, HTMLAttributes, SelectHTMLAttributes } from "react";
import { clsx } from "clsx";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={clsx("card", className)} {...props} />; }
export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return <div className="card-header"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>;
}
export function Button({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) { return <button className={clsx("button", className)} {...props} />; }
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) { return <select className="select" {...props} />; }
export function EmptyState({ text = "No data available" }: { text?: string }) { return <div className="empty-state">{text}</div>; }
export function NumberBall({ number, index = 0, small = false }: { number: number; index?: number; small?: boolean }) { return <span className={clsx("number-ball", `ball-${index % 6}`, small && "small")}>{String(number).padStart(2, "0")}</span>; }
export function ScoreBadge({ score }: { score: number }) { return <span className="score-badge">{Number.isFinite(score) ? score.toFixed(2) : "-"}</span>; }
