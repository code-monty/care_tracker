import styles from "./attorneys.module.css";

export default function Loading() {
  return <main className={styles.page} data-route-loading><div className={styles.heading}><h1>Attorneys</h1></div><section className={styles.panel} aria-live="polite"><p className={styles.message}>Loading attorney records…</p></section></main>;
}
