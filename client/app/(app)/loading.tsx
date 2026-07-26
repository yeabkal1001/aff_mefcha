import { ScreenLoading } from "@/components/shell/screen-loading";

export default function Loading() {
  // The shell layout is already mounted around this, so the sidebar and the
  // ambient field stay put while the screen itself resolves.
  return <ScreenLoading label="Loading your session" />;
}
