import { AmbientBackground } from "@/components/session/ambient-background";
import { ScreenLoading } from "@/components/shell/screen-loading";

export default function Loading() {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <AmbientBackground state="idle" />
      <ScreenLoading />
    </div>
  );
}
