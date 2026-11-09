import { LoadingIndicator } from "@/components/loading-indicator";

export default function Loading() {
  return <div data-route-loading><LoadingIndicator message="Loading administration…" /></div>;
}
