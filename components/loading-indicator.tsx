import styles from "./loading-indicator.module.css";

export function LoadingIndicator({
  message = "Loading CareTracker…",
  tone = "auto",
  fullScreen = false,
}: {
  message?: string;
  tone?: "auto" | "light" | "dark";
  fullScreen?: boolean;
}) {
  return (
    <div className={`${styles.loading} ${styles[tone]} ${fullScreen ? styles.fullScreen : ""}`} role="status" aria-live="polite">
      <span className={styles.spinner} aria-hidden="true" />
      <span className={styles.brand}>CareTracker</span>
      <span className={styles.message}>{message}</span>
    </div>
  );
}
