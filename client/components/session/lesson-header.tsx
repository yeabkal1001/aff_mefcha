export function LessonHeader({ topic }: { topic: string }) {
  return (
    <header className="flex flex-col items-center text-center">
      <p className="label-eyebrow">Lesson Topic</p>
      <h1 className="mt-2 border-b border-foreground/80 px-1.5 pb-1.5 text-[0.9375rem] font-semibold tracking-tight text-foreground">
        {topic}
      </h1>
    </header>
  );
}
