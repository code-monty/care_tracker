"use client";

import styles from "./attorneys.module.css";

export default function Error({ reset }: { reset: () => void }) {
  return <main className={styles.page}><div className={styles.heading}><h1>Attorneys</h1></div><section className={styles.panel}><div className={styles.emptyState}><strong>Attorney records could not be loaded</strong><p>Please try again.</p><button className={styles.detailsButton} type="button" onClick={reset}>Retry</button></div></section></main>;
}
