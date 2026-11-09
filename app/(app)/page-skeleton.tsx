import styles from "./page-skeleton.module.css";

export type SkeletonKind = "dashboard" | "directory" | "appointments" | "deadlines" | "detail" | "archive" | "settings" | "users" | "logs" | "backup";

function Bar({ width = "medium" }: { width?: "short" | "medium" | "long" }) {
  return <span className={`${styles.bar} ${styles[width]}`} />;
}

function Table({ rows = 5 }: { rows?: number }) {
  return <div className={styles.table}><div className={styles.tableHead}><Bar width="medium" /><Bar width="short" /><Bar width="medium" /><Bar width="short" /></div>{Array.from({ length: rows }, (_, index) => <div className={styles.tableRow} key={index}><Bar width="medium" /><Bar width="short" /><Bar width="medium" /><Bar width="short" /></div>)}</div>;
}

function Panel({ children, wide = false }: { children?: React.ReactNode; wide?: boolean }) {
  return <section className={`${styles.panel} ${wide ? styles.wide : ""}`}><Bar width="medium" />{children ?? <><Bar width="long" /><Bar width="medium" /><Bar width="short" /></>}</section>;
}

export function PageSkeleton({ kind, label = "Loading page" }: { kind: SkeletonKind; label?: string }) {
  const table = kind === "directory" || kind === "appointments" || kind === "deadlines" || kind === "archive" || kind === "users" || kind === "logs";
  return <main className={styles.page} data-route-loading role="status" aria-live="polite" aria-label={label}>
    <span className={styles.srOnly}>{label}</span>
    <div aria-hidden="true" className={styles.placeholder}>
      <div className={styles.heading}><Bar width="medium" /><Bar width="long" /></div>
      {kind === "dashboard" && <><Panel wide><div className={styles.summary}><span className={styles.circle} /><div><Bar width="medium" /><Bar width="short" /></div></div></Panel><div className={styles.columns}><Panel><Table rows={3} /></Panel><Panel><Table rows={3} /></Panel></div></>}
      {table && <Panel wide><div className={styles.toolbar}><Bar width="long" /><Bar width="short" /></div><Table rows={kind === "logs" ? 7 : 5} /></Panel>}
      {kind === "detail" && <><div className={styles.detailHeading}><Bar width="short" /><Bar width="medium" /></div><div className={styles.columns}><Panel><div className={styles.fieldGrid}>{Array.from({ length: 6 }, (_, index) => <div key={index}><Bar width="short" /><Bar width="medium" /></div>)}</div></Panel><Panel><div className={styles.fieldGrid}>{Array.from({ length: 4 }, (_, index) => <div key={index}><Bar width="short" /><Bar width="medium" /></div>)}</div></Panel></div><Panel wide><Table rows={3} /></Panel></>}
      {kind === "settings" && <div className={styles.columns}><Panel><div className={styles.fields}>{Array.from({ length: 3 }, (_, index) => <div key={index}><Bar width="short" /><span className={styles.input} /></div>)}</div></Panel><Panel><div className={styles.fields}>{Array.from({ length: 2 }, (_, index) => <div key={index}><Bar width="short" /><span className={styles.input} /></div>)}</div></Panel></div>}
      {kind === "backup" && <Panel><Bar width="short" /></Panel>}
    </div>
  </main>;
}
