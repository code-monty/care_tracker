import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BriefcaseBusiness, Users } from "lucide-react";
import { getAttorneyClients, getAttorneys } from "@/lib/data/records";
import styles from "../attorneys.module.css";

export default async function AttorneyDetailPage({ params }: PageProps<"/attorneys/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const attorneys = await getAttorneys();
  const attorney = attorneys.find((item) => item.id === id);
  if (!attorney) notFound();
  const clients = await getAttorneyClients(id);

  return <main className={styles.page}>
    <Link className={styles.backLink} href="/attorneys"><ArrowLeft size={17} aria-hidden="true" />Back to Attorneys</Link>
    <div className={styles.heading}><h1>{attorney.full_name}</h1><p>Attorney information and linked clients</p></div>
    <section className={styles.panel} aria-labelledby="attorney-information"><div className={styles.sectionHeader}><BriefcaseBusiness size={21} aria-hidden="true" /><h2 id="attorney-information">Attorney Information</h2></div><dl className={styles.details}><div><dt>Name</dt><dd>{attorney.full_name}</dd></div><div><dt>Contact number</dt><dd>{attorney.contact_no}</dd></div><div><dt>Email address</dt><dd>{attorney.email}</dd></div></dl></section>
    <section className={styles.panel} aria-labelledby="linked-clients"><div className={styles.sectionHeader}><Users size={21} aria-hidden="true" /><h2 id="linked-clients">Linked Clients <span>({clients.length})</span></h2></div>
      {clients.length ? <div className={styles.tableScroll}><table><thead><tr><th scope="col">Petitioner name</th><th scope="col">Status</th><th scope="col">Next deadline</th><th scope="col">Actions</th></tr></thead><tbody>{clients.map((client) => <tr key={client.id}><td>{client.full_name}</td><td><span className={client.status === "active" ? styles.activeBadge : styles.inactiveBadge}>{client.status === "active" ? "Active" : "Inactive"}</span></td><td><span className={styles.pendingDeadline}>Not tracked yet</span></td><td><a className={styles.detailsButton} href={`/clients/${client.id}`}>View Client</a></td></tr>)}</tbody></table></div> : <div className={styles.emptyState}><Users size={29} aria-hidden="true" /><strong>No linked clients</strong><p>This attorney does not have any current client records.</p></div>}
    </section>
  </main>;
}
