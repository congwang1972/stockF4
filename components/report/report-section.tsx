import { ReportContent } from "@/types/report";

interface ReportSectionProps {
  id: keyof ReportContent;
  title: string;
  content: string;
}

export function ReportSection({ id, title, content }: ReportSectionProps) {
  return (
    <section id={id} className="rounded-xl bg-white p-6 shadow">
      <h2 className="mb-4 text-xl font-semibold text-primary">{title}</h2>
      <p className="leading-relaxed text-text-primary whitespace-pre-line">{content}</p>
    </section>
  );
}
