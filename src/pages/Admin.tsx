import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ChartBar, ChatCircleDots, ClipboardText, EnvelopeSimple, Gauge, Lightbulb, Storefront, Users } from "@phosphor-icons/react";
import { Link, Navigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { useAuth } from "@/context/AuthContext";
import { isAdminAuthConfigured } from "@/lib/adminAuth";
import { cn } from "@/lib/utils";
import { hubspot } from "@/lib/hubspot";
import {
  clearCrmData,
  getLegacyCrmMigrationCount,
  getCrmData,
  migrateLegacyCrm,
  sendMarketingCampaign,
  sendMarketingTest,
  setContactLifecycle,
  setContactNotes,
  setCrmLeadStatus,
  setMessageStatus,
  type ContactLifecycle,
  type ContactMessage,
  type ContactRecord,
  type CrmLead,
  type CrmLeadStatus,
  type CrmLeadType,
  type MessageStatus,
  type CrmData,
} from "@/lib/crm";

const statusLabels: Record<CrmLeadStatus, string> = {
  new: "Nuevo",
  contacted: "Contactado",
  qualified: "Calificado",
  closed: "Cerrado",
};

type AdminView = "dashboard" | "leads" | "contacts" | "messages" | "marketing" | "analytics" | "recommendations";

const adminViewLabels: Record<AdminView, string> = {
  dashboard: "Dashboard",
  leads: "Pedidos y solicitudes",
  contacts: "Clientes y contactos",
  messages: "Mensajes",
  marketing: "Email marketing",
  analytics: "Analítica digital",
  recommendations: "Análisis y recomendaciones",
};

const typeLabels: Record<CrmLeadType, string> = {
  appointment: "Cita",
  order: "Pedido",
};

const lifecycleLabels: Record<ContactLifecycle, string> = {
  visitante: "Visitante",
  lead: "Lead",
  interesado: "Interesado",
  cliente: "Cliente",
  cliente_recurrente: "Cliente recurrente",
  cliente_fidelizado: "Cliente fidelizado",
};

const messageStatusLabels: Record<MessageStatus, string> = {
  nuevo: "Nuevo",
  leído: "Leído",
  contactado: "Contactado",
  resuelto: "Resuelto",
};

export function Admin() {
  const { user, ready, logout } = useAuth();

  if (!isAdminAuthConfigured()) {
    return (
      <>
        <PageHeader title="Panel administrativo" description="El acceso seguro del administrador aún no está configurado." />
        <Container className="py-14 sm:py-20">
          <div role="alert" className="mx-auto max-w-xl rounded-media border border-border bg-card p-6 text-center shadow-soft">
            <p className="font-display text-xl font-black text-primary">Falta configurar el servicio de autenticación</p>
            <p className="mt-2 text-muted-foreground">
              Despliega la función administrativa en Neon y configura VITE_ADMIN_API_URL para habilitar el inicio de sesión.
            </p>
          </div>
        </Container>
      </>
    );
  }

  if (!ready) {
    return <Container className="py-20 text-center text-muted-foreground">Verificando tu sesión...</Container>;
  }

  if (!user || user.role !== "admin") return <Navigate to="/cuenta?next=%2Fadmin" replace />;
  return <AdminDashboard token={user.token} onLogout={logout} />;
}

function AdminDashboard({ onLogout, token }: { onLogout: () => void; token: string }) {
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [marketing, setMarketing] = useState<CrmData["marketing"]>({
    available: false,
    webhookConfigured: false,
    campaignsSent: 0,
    emailsSent: 0,
    testEmailsSent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    complaints: 0,
    segmentCounts: { all: 0, newContacts: 0, unconverted: 0, newCustomers: 0, recurringCustomers: 0, loyalCustomers: 0 },
    campaignHistory: [],
  });
  const [loading, setLoading] = useState(true);
  const [crmError, setCrmError] = useState("");
  const [activeView, setActiveView] = useState<AdminView>("dashboard");
  const [typeFilter, setTypeFilter] = useState<"all" | CrmLeadType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | CrmLeadStatus>("all");
  const [contactSegment, setContactSegment] = useState<"all" | "marketing" | "non-marketing">("all");
  const [lifecycleSegment, setLifecycleSegment] = useState<"all" | "unconverted" | ContactLifecycle>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [legacyCount, setLegacyCount] = useState(0);
  const [migrationMessage, setMigrationMessage] = useState("");
  const [migrating, setMigrating] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [contactNotesDraft, setContactNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  async function refreshCrm(showLoading = true) {
    if (showLoading) setLoading(true);
    setCrmError("");
    try {
      const data = await getCrmData(token);
      setLeads(data.leads);
      setContacts(data.contacts);
      setMessages(data.messages);
      setMarketing(data.marketing);
      setLegacyCount(getLegacyCrmMigrationCount());
    } catch (cause) {
      setCrmError(cause instanceof Error ? cause.message : "No se pudo cargar el CRM.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => {
    void refreshCrm();
  }, [token]);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredLeads = useMemo(
    () =>
      leads.filter(
        (lead) =>
          (typeFilter === "all" || lead.type === typeFilter) &&
          (statusFilter === "all" || lead.status === statusFilter) &&
          (!normalizedSearch || [lead.owner, lead.email, lead.phone, lead.service, lead.pet, lead.details].some((value) => value?.toLowerCase().includes(normalizedSearch))),
      ),
    [leads, typeFilter, statusFilter, normalizedSearch],
  );

  const lifecycleCounts = useMemo(
    () => Object.fromEntries(
      Object.keys(lifecycleLabels).map((stage) => [stage, contacts.filter((contact) => contact.lifecycle === stage).length]),
    ) as Record<ContactLifecycle, number>,
    [contacts],
  );
  const marketingSummary = useMemo(() => ({
    authorized: marketing.segmentCounts.all,
    newCustomers: contacts.filter((contact) => contact.lifecycle === "cliente").length,
    recurringCustomers: contacts.filter((contact) => contact.lifecycle === "cliente_recurrente").length,
    eligibleLeadsWithoutConfirmedPurchase: marketing.segmentCounts.unconverted,
    eligibleNewCustomers: marketing.segmentCounts.newCustomers,
    eligibleRecurringCustomers: marketing.segmentCounts.recurringCustomers,
    eligibleLoyalCustomers: marketing.segmentCounts.loyalCustomers,
  }), [contacts, marketing.segmentCounts]);

  const contactsById = useMemo(() => new Map(contacts.map((contact) => [contact.id, contact])), [contacts]);
  const selectedContact = selectedContactId ? contactsById.get(selectedContactId) : undefined;
  const selectedContactMessages = selectedContact ? messages.filter((message) => message.contactId === selectedContact.id) : [];
  const selectedContactLeads = selectedContact ? leads.filter((lead) => lead.contactId === selectedContact.id) : [];
  const filteredContacts = useMemo(
    () => contacts.filter((contact) =>
      (contactSegment === "all" || contact.marketingConsent === (contactSegment === "marketing")) &&
      (contactSegment !== "marketing" || (
        !contact.marketingUnsubscribedAt &&
        /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact.email)
      )) &&
      (lifecycleSegment === "all" ||
        (lifecycleSegment === "unconverted"
          ? contact.lifecycle === "lead" || contact.lifecycle === "interesado"
          : contact.lifecycle === lifecycleSegment)) &&
      (!normalizedSearch || [contact.firstname, contact.lastname, contact.email, contact.phone].some((value) => value.toLowerCase().includes(normalizedSearch))),
    ),
    [contacts, contactSegment, lifecycleSegment, normalizedSearch],
  );
  const filteredMessages = useMemo(
    () => messages.filter((message) => {
      const contact = contactsById.get(message.contactId);
      return !normalizedSearch || [message.subject, message.body, contact?.firstname, contact?.lastname, contact?.email]
        .some((value) => value?.toLowerCase().includes(normalizedSearch));
    }),
    [messages, contactsById, normalizedSearch],
  );

  function exportMarketingSegment() {
    const eligible = filteredContacts.filter((contact) => contact.marketingConsent);
    const columns = ["email", "firstname", "lastname", "phone", "marketing_consent_at", "marketing_consent_source"];
    const rows = eligible.map((contact) => [
      contact.email,
      contact.firstname,
      contact.lastname,
      contact.phone,
      contact.marketingConsentAt ?? "",
      contact.marketingConsentSource ?? "",
    ]);
    const csv = [columns, ...rows]
      .map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "petcare-contactos-con-consentimiento.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        title="Panel administrativo"
        description="Gestiona contactos, mensajes, citas y pedidos capturados desde la web de PetCare."
      />

      <Container className="py-8 sm:py-12">
        <div className="grid items-start gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <aside className="rounded-media border border-border bg-card p-4 shadow-soft lg:sticky lg:top-28">
            <p className="px-3 pb-3 font-display text-sm font-black uppercase tracking-wide text-muted-foreground">Administración</p>
            <nav aria-label="Menú administrativo" className="grid gap-1">
              {([
                ["dashboard", "Dashboard", Gauge],
                ["leads", "Pedidos y solicitudes", ClipboardText],
                ["contacts", "Clientes y contactos", Users],
                ["messages", "Mensajes", ChatCircleDots],
                ["marketing", "Email marketing", EnvelopeSimple],
                ["analytics", "Analítica digital", ChartBar],
                ["recommendations", "Análisis y recomendaciones", Lightbulb],
              ] as const).map(([view, label, Icon]) => (
                <button
                  key={view}
                  type="button"
                  aria-current={activeView === view ? "page" : undefined}
                  onClick={() => setActiveView(view)}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-bold transition-colors",
                    activeView === view ? "bg-accent-soft text-accent" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon weight="bold" className="size-5 shrink-0" />
                  {label}
                </button>
              ))}
              <Link
                to="/tienda"
                className="mt-2 flex min-h-11 items-center gap-3 rounded-xl border-t border-border px-3 pt-3 text-sm font-bold text-primary transition-colors hover:text-accent"
              >
                <Storefront weight="bold" className="size-5 shrink-0" />
                Ver tienda
              </Link>
            </nav>
            <Button variant="ghost" size="sm" className="mt-4 w-full" onClick={onLogout}>Cerrar sesión</Button>
          </aside>

          <main className="min-w-0 space-y-8">
        {activeView === "dashboard" && (
          loading ? (
            <div role="status" className="rounded-media border border-border bg-card px-6 py-16 text-center text-muted-foreground shadow-soft">Cargando métricas del CRM...</div>
          ) : (
            <AdminOverview leads={leads} contacts={contacts} messages={messages} />
          )
        )}

        {activeView === "dashboard" && <section aria-labelledby="lifecycle-heading" className="space-y-3 rounded-media border border-border bg-card p-5 shadow-soft">
          <div>
            <h2 id="lifecycle-heading" className="font-display text-lg font-black text-primary">Ciclo de vida del cliente</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Nuevos contactos comienzan como lead; una segunda interacción o solicitud de pedido los mueve a interesado.
              Marca cliente y etapas posteriores cuando la compra o fidelización esté confirmada.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {(Object.entries(lifecycleLabels) as [ContactLifecycle, string][]).map(([stage, label]) => (
              <button
                key={stage}
                type="button"
                onClick={() => {
                  setActiveView("contacts");
                  setLifecycleSegment(stage);
                }}
                className="rounded-xl border border-border bg-background px-3 py-3 text-left transition-colors hover:border-accent"
              >
                <span className="block text-xs font-semibold text-muted-foreground">{label}</span>
                <span className="mt-1 block font-display text-2xl font-black text-primary">{lifecycleCounts[stage]}</span>
              </button>
            ))}
          </div>
        </section>}

        {(activeView === "leads" || activeView === "contacts" || activeView === "messages" || activeView === "marketing") && (
          <>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-media border border-border bg-card p-4 shadow-soft">
          <p className="font-display text-lg font-black text-primary">{adminViewLabels[activeView]}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              if (!window.confirm("¿Seguro que quieres borrar los datos del CRM? Esta acción no se puede deshacer.")) return;
              setCrmError("");
              try {
                await clearCrmData(token);
                await refreshCrm();
              } catch (cause) {
                setCrmError(cause instanceof Error ? cause.message : "No se pudo limpiar el CRM.");
              }
            }}
          >
            Limpiar CRM
          </Button>
        </div>
        <label className="block">
          <span className="sr-only">Buscar en CRM</span>
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar por nombre, correo, teléfono o contenido..."
            className="h-12 w-full rounded-xl border-2 border-border bg-card px-4 shadow-soft focus:border-accent focus:outline-none"
          />
        </label>
          </>
        )}

        {crmError && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm">
            <span className="font-semibold text-danger">{crmError}</span>
            <Button size="sm" variant="ghost" onClick={() => void refreshCrm()}>Reintentar</Button>
          </div>
        )}
        {activeView === "leads" && legacyCount > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
            <div>
              <p className="font-bold">Hay {legacyCount} leads guardados en este navegador.</p>
              <p className="mt-0.5">Puedes copiarlos a Neon; los datos locales originales no se borrarán.</p>
              {migrationMessage && <p role="status" className="mt-1 font-semibold">{migrationMessage}</p>}
            </div>
            <Button
              size="sm"
              disabled={migrating}
              onClick={async () => {
                setMigrating(true);
                setMigrationMessage("");
                try {
                  const count = await migrateLegacyCrm(token);
                  setMigrationMessage(`Se migraron ${count} registros. Los originales se conservaron en este navegador.`);
                  await refreshCrm();
                } catch (cause) {
                  setMigrationMessage(cause instanceof Error ? cause.message : "No se pudo completar la migración.");
                } finally {
                  setMigrating(false);
                }
              }}
            >
              {migrating ? "Migrando..." : "Migrar leads locales"}
            </Button>
          </div>
        )}

        {(activeView === "leads" || activeView === "contacts" || activeView === "messages" || activeView === "marketing") && <div className="overflow-hidden rounded-media border border-border bg-card shadow-soft">
          {loading ? (
            <div className="px-6 py-16 text-center text-muted-foreground" role="status">Cargando CRM desde la base de datos...</div>
          ) : activeView === "leads" && (
            <>
              <div className="flex flex-wrap gap-3 border-b border-border p-4">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Tipo</span>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as "all" | CrmLeadType)}
                    className="rounded-full border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
                  >
                    <option value="all">Todos</option>
                    <option value="appointment">Citas</option>
                    <option value="order">Pedidos</option>
                  </select>
                </label>

                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Estado</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as "all" | CrmLeadStatus)}
                    className="rounded-full border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
                  >
                    <option value="all">Todos</option>
                    <option value="new">Nuevo</option>
                    <option value="contacted">Contactado</option>
                    <option value="qualified">Calificado</option>
                    <option value="closed">Cerrado</option>
                  </select>
                </label>
              </div>
              {filteredLeads.length === 0 ? (
                <EmptyState title="Aún no hay leads en el CRM" description="Cuando alguien agende una cita o haga un pedido, aparecerá aquí." />
              ) : (
                <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-muted/60 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Contacto</th>
                    <th className="px-4 py-3 font-semibold">Tipo</th>
                    <th className="px-4 py-3 font-semibold">Servicio / productos</th>
                    <th className="px-4 py-3 font-semibold">Canal</th>
                    <th className="px-4 py-3 font-semibold">Estado</th>
                    <th className="px-4 py-3 font-semibold">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id} className="border-t border-border align-top">
                      <td className="px-4 py-4">
                        <p className="font-semibold text-foreground">{lead.owner}</p>
                        <p className="mt-0.5 text-muted-foreground">{lead.email}</p>
                        <p className="text-muted-foreground">{lead.phone || "Sin teléfono"}</p>
                      </td>
                      <td className="px-4 py-4">
                        <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent">
                          {typeLabels[lead.type]}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">
                        {lead.type === "order" ? (
                          lead.items?.length ? (
                            <ul className="space-y-1">
                              {lead.items.map((item, index) => <li key={`${lead.id}-${index}`}>{item}</li>)}
                            </ul>
                          ) : lead.details?.trim() ? (
                            <p className="whitespace-pre-wrap">{lead.details}</p>
                          ) : (
                            <span className="italic">Productos no registrados en este pedido</span>
                          )
                        ) : (
                          lead.service || lead.pet || "Sin servicio especificado"
                        )}
                        {lead.total !== undefined && <span className="mt-1 block font-semibold text-foreground">S/ {lead.total.toFixed(2)}</span>}
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">
                        {lead.channel === "whatsapp" ? "WhatsApp" : "Formulario"}
                      </td>
                      <td className="px-4 py-4">
                        <select
                          value={lead.status}
                          onChange={(e) => {
                            const nextStatus = e.target.value as CrmLeadStatus;
                            void setCrmLeadStatus(token, lead.id, nextStatus).then(() => refreshCrm()).catch((cause: unknown) => {
                              setCrmError(cause instanceof Error ? cause.message : "No se pudo actualizar el lead.");
                            });
                          }}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-semibold focus:border-accent focus:outline-none",
                            lead.status === "new" && "border-yellow-200 bg-yellow-50 text-yellow-700",
                            lead.status === "contacted" && "border-blue-200 bg-blue-50 text-blue-700",
                            lead.status === "qualified" && "border-green-200 bg-green-50 text-green-700",
                            lead.status === "closed" && "border-brand-navy/30 bg-brand-navy/5 text-brand-navy",
                          )}
                        >
                          {Object.entries(statusLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">
                        {new Date(lead.createdAt).toLocaleString("es-PE", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
                </div>
              )}
            </>
          )}

          {!loading && activeView === "contacts" && (
            contacts.length === 0 ? (
              <EmptyState title="Aún no hay contactos" description="Los contactos se crean cuando alguien envía una solicitud o un pedido." />
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Segmento</span>
                    <select
                      value={contactSegment}
                      onChange={(event) => setContactSegment(event.target.value as typeof contactSegment)}
                      className="rounded-full border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
                    >
                      <option value="all">Todos los contactos</option>
                      <option value="marketing">Aceptaron marketing</option>
                      <option value="non-marketing">Sin consentimiento de marketing</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Etapa</span>
                    <select
                      value={lifecycleSegment}
                      onChange={(event) => setLifecycleSegment(event.target.value as typeof lifecycleSegment)}
                      className="rounded-full border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
                    >
                      <option value="all">Todas las etapas</option>
                      <option value="unconverted">Leads sin compra confirmada</option>
                      {Object.entries(lifecycleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <Button size="sm" variant="ghost" onClick={exportMarketingSegment}>
                    Exportar consentidos ({filteredContacts.filter((contact) => contact.marketingConsent).length})
                  </Button>
                </div>
                <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-muted/60 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Contacto</th>
                      <th className="px-4 py-3 font-semibold">Origen</th>
                      <th className="px-4 py-3 font-semibold">Ciclo de vida</th>
                      <th className="px-4 py-3 font-semibold">Consentimiento</th>
                      <th className="px-4 py-3 font-semibold">Última actividad</th>
                      <th className="px-4 py-3 font-semibold">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredContacts.map((contact) => (
                      <tr key={contact.id} className="border-t border-border align-top">
                        <td className="px-4 py-4">
                          <p className="font-semibold text-foreground">{`${contact.firstname} ${contact.lastname}`.trim() || "Sin nombre"}</p>
                          <p className="mt-0.5 text-muted-foreground">{contact.email || "Sin correo"}</p>
                          <p className="text-muted-foreground">{contact.phone || "Sin teléfono"}</p>
                        </td>
                        <td className="px-4 py-4 text-muted-foreground">{sourceLabel(contact.source)}</td>
                        <td className="px-4 py-4">
                          <select
                            value={contact.lifecycle}
                            onChange={(event) => {
                              void setContactLifecycle(token, contact.id, event.target.value as ContactLifecycle).then(() => refreshCrm()).catch((cause: unknown) => {
                                setCrmError(cause instanceof Error ? cause.message : "No se pudo actualizar el contacto.");
                              });
                            }}
                            aria-label={`Ciclo de vida de ${contact.email || contact.firstname}`}
                            className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold focus:border-accent focus:outline-none"
                          >
                            {Object.entries(lifecycleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {contact.engagementCount ?? 0} interacciones · {contact.orderRequestCount ?? 0} pedidos iniciados
                          </p>
                          {contact.lifecycleReason && <p className="mt-1 max-w-xs text-xs text-muted-foreground">{contact.lifecycleReason}</p>}
                        </td>
                        <td className="px-4 py-4 text-muted-foreground">
                          {contact.marketingConsent ? (
                            <>
                              <span className="font-semibold text-green-700">Aceptado</span>
                              {contact.marketingConsentAt && <time className="mt-1 block text-xs">{formatDate(contact.marketingConsentAt)}</time>}
                              {contact.marketingConsentSource && <span className="block text-xs">{sourceLabel(contact.marketingConsentSource)}</span>}
                            </>
                          ) : "No aceptado"}
                        </td>
                        <td className="px-4 py-4 text-muted-foreground">{formatDate(contact.lastSeenAt)}</td>
                        <td className="px-4 py-4">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedContactId(contact.id);
                              setContactNotesDraft(contact.notes ?? "");
                            }}
                          >
                            Ver detalle
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </>
            )
          )}

          {!loading && activeView === "messages" && (
            filteredMessages.length === 0 ? (
              <EmptyState title="Aún no hay mensajes" description="Los mensajes recibidos desde los formularios y solicitudes aparecerán aquí." />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-muted/60 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Mensaje</th>
                      <th className="px-4 py-3 font-semibold">Contacto</th>
                      <th className="px-4 py-3 font-semibold">Canal</th>
                      <th className="px-4 py-3 font-semibold">Estado</th>
                      <th className="px-4 py-3 font-semibold">Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMessages.map((message) => {
                      const contact = contactsById.get(message.contactId);
                      return (
                        <tr key={message.id} className="border-t border-border align-top">
                          <td className="max-w-lg px-4 py-4">
                            <p className="font-semibold text-foreground">{message.subject}</p>
                            <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{message.body || "Sin contenido"}</p>
                          </td>
                          <td className="px-4 py-4 text-muted-foreground">
                            <p className="font-semibold text-foreground">{contact ? `${contact.firstname} ${contact.lastname}`.trim() || "Sin nombre" : "Contacto no disponible"}</p>
                            {contact?.email && <p>{contact.email}</p>}
                          </td>
                          <td className="px-4 py-4 text-muted-foreground">{message.channel === "whatsapp" ? "WhatsApp" : "Formulario"}</td>
                          <td className="px-4 py-4">
                            <select
                              value={message.status}
                              onChange={(event) => {
                                void setMessageStatus(token, message.id, event.target.value as MessageStatus).then(() => refreshCrm()).catch((cause: unknown) => {
                                  setCrmError(cause instanceof Error ? cause.message : "No se pudo actualizar el mensaje.");
                                });
                              }}
                              aria-label={`Estado del mensaje ${message.subject}`}
                              className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold focus:border-accent focus:outline-none"
                            >
                              {Object.entries(messageStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                            </select>
                          </td>
                          <td className="px-4 py-4 text-muted-foreground">{formatDate(message.createdAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}

          {!loading && activeView === "marketing" && (
            <EmailMarketingDashboard
              summary={marketingSummary}
              messages={messages.length}
              marketing={marketing}
              token={token}
              onSent={() => void refreshCrm(false)}
            />
          )}
        </div>}
        {activeView === "analytics" && (
          loading
            ? <div role="status" className="rounded-media border border-border bg-card px-6 py-16 text-center text-muted-foreground shadow-soft">Cargando datos de analítica...</div>
            : <DigitalAnalytics leads={leads} contacts={contacts} trackingConfigured={Boolean(hubspot.portalId)} />
        )}
        {activeView === "recommendations" && (
          loading
            ? <div role="status" className="rounded-media border border-border bg-card px-6 py-16 text-center text-muted-foreground shadow-soft">Cargando recomendaciones...</div>
            : <AdminRecommendations leads={leads} messages={messages} />
        )}
          </main>
        </div>
      </Container>
      {selectedContact && (
        <div className="fixed inset-0 z-[60] flex justify-end bg-brand-navy-deep/60">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-detail-heading"
            className="h-full w-full max-w-xl overflow-y-auto bg-card p-6 shadow-2xl sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="contact-detail-heading" className="font-display text-2xl font-black text-primary">Detalle del contacto</h2>
                <p className="mt-1 text-sm text-muted-foreground">Historial y datos registrados en el CRM.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedContactId(null)}>Cerrar</Button>
            </div>
            <div className="mt-6 grid gap-3 rounded-xl border border-border p-4 text-sm">
              <p className="font-bold">{`${selectedContact.firstname} ${selectedContact.lastname}`.trim()}</p>
              <p>{selectedContact.email}</p>
              <p>{selectedContact.phone || "Sin teléfono"}</p>
              <p>Origen: {sourceLabel(selectedContact.source)}</p>
              <p>Registrado: {formatDate(selectedContact.createdAt)}</p>
              <p>Etapa: {lifecycleLabels[selectedContact.lifecycle]}</p>
              <p>Consentimiento de marketing: {selectedContact.marketingConsent ? "Aceptado" : "No aceptado"}</p>
              {selectedContact.marketingConsentAt && <p>Autorizado: {formatDate(selectedContact.marketingConsentAt)}</p>}
            </div>
            <section className="mt-6">
              <h3 className="font-display text-lg font-black">Historial de mensajes ({selectedContactMessages.length})</h3>
              {selectedContactMessages.length ? (
                <ul className="mt-3 space-y-3">
                  {selectedContactMessages.map((message) => (
                    <li key={message.id} className="rounded-xl border border-border p-4 text-sm">
                      <p className="font-bold">{message.subject} · {messageStatusLabels[message.status]}</p>
                      <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{message.body || "Sin contenido"}</p>
                      <time className="mt-2 block text-xs text-muted-foreground">{formatDate(message.createdAt)}</time>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-2 text-sm text-muted-foreground">No hay mensajes registrados.</p>}
            </section>
            <section className="mt-6">
              <h3 className="font-display text-lg font-black">
                Pedidos registrados ({selectedContactLeads.filter((lead) => lead.type === "order").length})
              </h3>
              {selectedContactLeads.filter((lead) => lead.type === "order").length ? (
                <ul className="mt-3 space-y-2">
                  {selectedContactLeads.filter((lead) => lead.type === "order").map((lead) => (
                    <li key={lead.id} className="rounded-xl border border-border p-4 text-sm">
                      <p className="font-bold">Pedido · {statusLabels[lead.status]}</p>
                      {lead.items?.length ? (
                        <ul className="mt-2 list-inside list-disc space-y-1">
                          {lead.items.map((item, index) => <li key={`${lead.id}-${index}`}>{item}</li>)}
                        </ul>
                      ) : lead.details?.trim() ? (
                        <p className="mt-2 whitespace-pre-wrap">{lead.details}</p>
                      ) : (
                        <p className="mt-2 text-muted-foreground">Este pedido no tiene productos detallados.</p>
                      )}
                      {lead.total !== undefined && <p className="mt-1">S/ {Number(lead.total).toFixed(2)}</p>}
                      <time className="mt-1 block text-xs text-muted-foreground">{formatDate(lead.createdAt)}</time>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-2 text-sm text-muted-foreground">No hay pedidos registrados.</p>}
            </section>
            <section className="mt-6 space-y-3">
              <label htmlFor="contact-notes" className="font-display text-lg font-black">Notas CRM</label>
              <textarea
                id="contact-notes"
                value={contactNotesDraft}
                maxLength={5000}
                onChange={(event) => setContactNotesDraft(event.target.value)}
                rows={4}
                className="w-full rounded-xl border-2 border-border bg-background p-3 focus:border-accent focus:outline-none"
              />
              <Button
                disabled={savingNotes}
                onClick={async () => {
                  setSavingNotes(true);
                  setCrmError("");
                  try {
                    await setContactNotes(token, selectedContact.id, contactNotesDraft);
                    await refreshCrm();
                  } catch (cause) {
                    setCrmError(cause instanceof Error ? cause.message : "No se pudieron guardar las notas.");
                  } finally {
                    setSavingNotes(false);
                  }
                }}
              >
                {savingNotes ? "Guardando..." : "Guardar notas"}
              </Button>
            </section>
          </section>
        </div>
      )}
    </>
  );
}

type DateBounds = { start: Date; end: Date };
type DatePreset = "today" | "7d" | "30d" | "custom";

function startOfDay(value: Date) {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(value: Date, days: number) {
  const result = new Date(value);
  result.setDate(result.getDate() + days);
  return result;
}

function dateInputValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function useDateFilter() {
  const today = startOfDay(new Date());
  const [preset, setPreset] = useState<DatePreset>("30d");
  const [from, setFrom] = useState(() => dateInputValue(addDays(today, -29)));
  const [to, setTo] = useState(() => dateInputValue(today));
  const range = useMemo<DateBounds | null>(() => {
    const end = addDays(startOfDay(new Date()), 1);
    if (preset === "today") return { start: addDays(end, -1), end };
    if (preset === "7d") return { start: addDays(end, -7), end };
    if (preset === "30d") return { start: addDays(end, -30), end };
    if (!from || !to) return null;
    const start = startOfDay(new Date(`${from}T00:00:00`));
    const lastDay = startOfDay(new Date(`${to}T00:00:00`));
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(lastDay.getTime()) || start > lastDay) return null;
    return { start, end: addDays(lastDay, 1) };
  }, [preset, from, to]);
  const previous = range
    ? { start: new Date(range.start.getTime() - (range.end.getTime() - range.start.getTime())), end: range.start }
    : null;
  return { preset, setPreset, from, setFrom, to, setTo, range, previous };
}

function PeriodFilter({ filter }: { filter: ReturnType<typeof useDateFilter> }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="grid gap-1 text-xs font-bold text-muted-foreground">
        Periodo
        <select
          value={filter.preset}
          onChange={(event) => filter.setPreset(event.target.value as DatePreset)}
          className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground"
        >
          <option value="today">Hoy</option>
          <option value="7d">Últimos 7 días</option>
          <option value="30d">Últimos 30 días</option>
          <option value="custom">Rango personalizado</option>
        </select>
      </label>
      {filter.preset === "custom" && (
        <>
          <label className="grid gap-1 text-xs font-bold text-muted-foreground">
            Desde
            <input type="date" value={filter.from} onChange={(event) => filter.setFrom(event.target.value)}
              className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground" />
          </label>
          <label className="grid gap-1 text-xs font-bold text-muted-foreground">
            Hasta
            <input type="date" value={filter.to} onChange={(event) => filter.setTo(event.target.value)}
              className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground" />
          </label>
        </>
      )}
    </div>
  );
}

function inBounds(value: string, bounds: DateBounds | null) {
  if (!bounds) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date >= bounds.start && date < bounds.end;
}

function rangeDescription(bounds: DateBounds | null) {
  if (!bounds) return "Revisa las fechas seleccionadas.";
  return `${bounds.start.toLocaleDateString("es-PE")} – ${addDays(bounds.end, -1).toLocaleDateString("es-PE")}`;
}

function AdminOverview({
  leads,
  contacts,
  messages,
}: {
  leads: CrmLead[];
  contacts: ContactRecord[];
  messages: ContactMessage[];
}) {
  const filter = useDateFilter();
  const currentLeads = leads.filter((lead) => inBounds(lead.createdAt, filter.range));
  const previousLeads = leads.filter((lead) => inBounds(lead.createdAt, filter.previous));
  const currentContacts = contacts.filter((contact) => inBounds(contact.createdAt, filter.range));
  const currentMessages = messages.filter((message) => inBounds(message.createdAt, filter.range));
  const pendingMessages = currentMessages.filter((message) => message.status === "nuevo" || message.status === "leído").length;
  const orders = currentLeads.filter((lead) => lead.type === "order");
  const appointments = currentLeads.filter((lead) => lead.type === "appointment");
  const buckets = useMemo(() => {
    if (!filter.range) return [];
    const dayCount = Math.max(1, Math.round((filter.range.end.getTime() - filter.range.start.getTime()) / 86_400_000));
    const bucketDays = Math.max(1, Math.ceil(dayCount / 14));
    return Array.from({ length: Math.ceil(dayCount / bucketDays) }, (_, index) => {
      const start = addDays(filter.range!.start, index * bucketDays);
      const end = new Date(Math.min(addDays(start, bucketDays).getTime(), filter.range!.end.getTime()));
      const count = currentLeads.filter((lead) => inBounds(lead.createdAt, { start, end })).length;
      const label = start.toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
      return { label, count };
    });
  }, [currentLeads, filter.range]);
  const maxBucketCount = Math.max(1, ...buckets.map((bucket) => bucket.count));
  const change = previousLeads.length > 0
    ? `${Math.round(((currentLeads.length - previousLeads.length) / previousLeads.length) * 100)}%`
    : currentLeads.length > 0 ? "Sin base anterior" : "Sin actividad";
  const changeTone = currentLeads.length > previousLeads.length ? "text-accent" : currentLeads.length < previousLeads.length ? "text-muted-foreground" : "text-muted-foreground";

  return (
    <section className="space-y-6" aria-labelledby="admin-dashboard-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="admin-dashboard-heading" className="font-display text-2xl font-black text-primary">Resumen de actividad</h2>
          <p className="mt-1 text-sm text-muted-foreground">Datos del CRM; las solicitudes de pedido no representan ventas pagadas.</p>
        </div>
        <PeriodFilter filter={filter} />
      </div>
      {!filter.range && <p role="alert" className="rounded-xl bg-danger/5 px-4 py-3 text-sm text-danger">El rango personalizado no es válido. Selecciona fechas correctas.</p>}
      <p className="text-xs text-muted-foreground">Periodo: {rangeDescription(filter.range)} · Comparación: periodo anterior de igual duración.</p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Solicitudes recibidas" value={filter.range ? currentLeads.length : "—"} tone="accent" />
        <StatCard label="Pedidos iniciados (no pagados)" value={filter.range ? orders.length : "—"} tone="green" />
        <StatCard label="Citas solicitadas" value={filter.range ? appointments.length : "—"} tone="navy" />
        <StatCard label="Contactos nuevos" value={filter.range ? currentContacts.length : "—"} tone="sky" />
      </div>
      <section className="rounded-media border border-border bg-card p-5 shadow-soft" aria-labelledby="leads-chart-heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 id="leads-chart-heading" className="font-display text-lg font-black text-primary">Solicitudes a lo largo del tiempo</h3>
            <p className="text-sm text-muted-foreground">Solicitudes capturadas en el CRM; no es un gráfico de ventas.</p>
          </div>
          <p className={cn("text-sm font-bold", changeTone)}>{change} vs. periodo anterior</p>
        </div>
        {currentLeads.length === 0 ? (
          <EmptyState title="Sin solicitudes en este periodo" description="Cuando se reciban solicitudes de cita o pedidos, su evolución aparecerá aquí." />
        ) : (
          <div role="img" aria-label={`Solicitudes capturadas durante ${rangeDescription(filter.range)}`} className="mt-5 flex min-h-56 items-end gap-2 overflow-x-auto border-b border-border px-1">
            {buckets.map((bucket, index) => (
              <div key={`${bucket.label}-${index}`} title={`${bucket.label}: ${bucket.count} solicitudes`}
                className="flex h-52 min-w-8 flex-1 flex-col items-center justify-end gap-2">
                <span className="text-xs font-bold text-muted-foreground">{bucket.count || ""}</span>
                <div className="w-full max-w-10 rounded-t-lg bg-accent transition-[height]"
                  style={{ height: `${Math.max(bucket.count ? 8 : 2, bucket.count / maxBucketCount * 100)}%` }} />
                <span className="whitespace-nowrap text-[0.65rem] text-muted-foreground">{bucket.label}</span>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="overflow-hidden rounded-media border border-border bg-card shadow-soft" aria-labelledby="recent-leads-heading">
        <div className="border-b border-border p-5">
          <h3 id="recent-leads-heading" className="font-display text-lg font-black text-primary">Solicitudes recientes</h3>
        </div>
        {currentLeads.length === 0 ? (
          <EmptyState title="Aún no hay actividad" description="Las solicitudes registradas aparecerán aquí." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-muted/60 text-muted-foreground"><tr>
                <th className="px-4 py-3 font-semibold">Contacto</th><th className="px-4 py-3 font-semibold">Tipo</th>
                <th className="px-4 py-3 font-semibold">Estado</th><th className="px-4 py-3 font-semibold">Fecha</th>
              </tr></thead>
              <tbody>{[...currentLeads].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 5).map((lead) => (
                <tr key={lead.id} className="border-t border-border">
                  <td className="px-4 py-3"><span className="font-semibold">{lead.owner}</span><span className="block text-muted-foreground">{lead.email}</span></td>
                  <td className="px-4 py-3">{typeLabels[lead.type]}{lead.type === "order" ? " · solicitud" : ""}</td>
                  <td className="px-4 py-3">{statusLabels[lead.status]}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(lead.createdAt)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
      <p className="text-sm text-muted-foreground">Mensajes pendientes de este periodo: <strong className="text-foreground">{filter.range ? pendingMessages : "—"}</strong>. Ingresos, ticket promedio, inventario, visitas y tasa de conversión no están disponibles en las fuentes conectadas.</p>
    </section>
  );
}

function DigitalAnalytics({
  leads,
  contacts,
  trackingConfigured,
}: {
  leads: CrmLead[];
  contacts: ContactRecord[];
  trackingConfigured: boolean;
}) {
  const filter = useDateFilter();
  const visibleLeads = leads.filter((lead) => inBounds(lead.createdAt, filter.range));
  const visibleContacts = contacts.filter((contact) => inBounds(contact.createdAt, filter.range));
  const forms = visibleLeads.filter((lead) => lead.channel === "form").length;
  const whatsapp = visibleLeads.filter((lead) => lead.channel === "whatsapp").length;
  const orderRequests = visibleLeads.filter((lead) => lead.type === "order").length;
  const appointments = visibleLeads.filter((lead) => lead.type === "appointment").length;

  return (
    <section className="space-y-6" aria-labelledby="digital-analytics-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="digital-analytics-heading" className="font-display text-2xl font-black text-primary">Analítica digital</h2>
          <p className="mt-1 text-sm text-muted-foreground">Separa actividad registrada en PetCare del tráfico medido por una plataforma externa.</p>
        </div>
        <PeriodFilter filter={filter} />
      </div>
      {!filter.range && <p role="alert" className="rounded-xl bg-danger/5 px-4 py-3 text-sm text-danger">El rango personalizado no es válido. Selecciona fechas correctas.</p>}
      <section className="rounded-media border border-border bg-card p-5 shadow-soft">
        <h3 className="font-display text-lg font-black text-primary">Actividad interna · solicitudes del CRM</h3>
        <p className="mt-1 text-sm text-muted-foreground">Son formularios o solicitudes enviadas a través de WhatsApp; no equivalen a sesiones, usuarios, carritos ni compras.</p>
        <p className="mt-2 text-xs text-muted-foreground">Periodo: {rangeDescription(filter.range)}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Solicitudes por formulario" value={filter.range ? forms : "—"} tone="accent" />
          <StatCard label="Solicitudes por WhatsApp" value={filter.range ? whatsapp : "—"} tone="navy" />
          <StatCard label="Pedidos iniciados, sin pago confirmado" value={filter.range ? orderRequests : "—"} tone="green" />
          <StatCard label="Solicitudes de cita" value={filter.range ? appointments : "—"} tone="sky" />
        </div>
        {visibleLeads.length === 0 && <p className="mt-4 text-sm text-muted-foreground">No hay eventos CRM en este periodo. No se calcula una tasa de conversión porque no hay denominador fiable de sesiones o usuarios.</p>}
        <p className="mt-4 text-sm text-muted-foreground">Contactos creados en el periodo: <strong className="text-foreground">{filter.range ? visibleContacts.length : "—"}</strong>.</p>
      </section>
      <section className="rounded-media border border-border bg-card p-5 shadow-soft">
        <h3 className="font-display text-lg font-black text-primary">Tráfico web y atribución</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {trackingConfigured
            ? "El script público de seguimiento de HubSpot está configurado en la web. El panel no tiene acceso a su API de informes, por lo que no muestra cifras de visitas, usuarios ni fuentes."
            : "No hay una plataforma de analítica web configurada para consultar informes desde el panel."}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">Google Analytics 4 no está integrado. Fuentes de tráfico, páginas visitadas, eventos de carrito, inicio de compra y compras completadas no están disponibles. No se estiman ni se muestran como cero.</p>
      </section>
      <p className="text-sm text-muted-foreground">Para habilitar informes externos se requiere una integración de servidor con credenciales privadas protegidas y una propiedad de analítica; no se deben colocar secretos en variables VITE_ ni en el navegador. El procedimiento pendiente está descrito en docs/admin.md.</p>
    </section>
  );
}

function AdminRecommendations({ leads, messages }: { leads: CrmLead[]; messages: ContactMessage[] }) {
  const thisMonth = new Date();
  const latestMonth = new Date(thisMonth.getFullYear(), thisMonth.getMonth() - 1, 1);
  const previousMonth = new Date(thisMonth.getFullYear(), thisMonth.getMonth() - 2, 1);
  const snapshotForMonth = (month: Date) => {
    const monthLeads = leads.filter((lead) => {
      const created = new Date(lead.createdAt);
      return Number.isFinite(created.getTime()) &&
        created.getFullYear() === month.getFullYear() &&
        created.getMonth() === month.getMonth();
    });
    const monthMessages = messages.filter((message) => {
      const created = new Date(message.createdAt);
      return Number.isFinite(created.getTime()) &&
        created.getFullYear() === month.getFullYear() &&
        created.getMonth() === month.getMonth();
    });
    return {
      leads: monthLeads.length,
      appointments: monthLeads.filter((lead) => lead.type === "appointment").length,
      orders: monthLeads.filter((lead) => lead.type === "order").length,
      forms: monthLeads.filter((lead) => lead.channel === "form").length,
      whatsapp: monthLeads.filter((lead) => lead.channel === "whatsapp").length,
      untouched: monthLeads.filter((lead) => lead.status === "new").length,
      openMessages: monthMessages.filter((message) => message.status === "nuevo" || message.status === "leído").length,
    };
  };
  const current = snapshotForMonth(latestMonth);
  const previous = snapshotForMonth(previousMonth);
  const latestMonthLabel = latestMonth.toLocaleDateString("es-PE", { month: "long", year: "numeric" });
  const previousMonthLabel = previousMonth.toLocaleDateString("es-PE", { month: "long", year: "numeric" });
  const comparison = (now: number, before: number) => {
    if (before === 0) return now === 0 ? "Sin registros en ambos meses" : `${now} registrados; sin base previa`;
    const difference = Math.round(((now - before) / before) * 100);
    return difference === 0 ? "Sin variación" : `${difference > 0 ? "+" : ""}${difference}%`;
  };
  const insights: Array<{ title: string; signal: string; action: string }> = [];
  if (current.leads === 0 && previous.leads === 0) {
    insights.push({
      title: "Aún no hay una tendencia CRM que analizar",
      signal: `No hay solicitudes registradas en ${previousMonthLabel} ni en ${latestMonthLabel}.`,
      action: "Registra las consultas recibidas y mantén actualizado su canal y estado durante al menos dos meses antes de comparar resultados.",
    });
  } else if (current.leads > previous.leads) {
    insights.push({
      title: "Creció la demanda de contacto",
      signal: `Las solicitudes CRM pasaron de ${previous.leads} a ${current.leads} entre ${previousMonthLabel} y ${latestMonthLabel} (${comparison(current.leads, previous.leads)}).`,
      action: "Revisa la cola de atención y asigna responsables para responder a tiempo. Este aumento indica más solicitudes, no ventas confirmadas.",
    });
  } else if (current.leads < previous.leads) {
    insights.push({
      title: "Bajó el volumen de solicitudes",
      signal: `Las solicitudes CRM pasaron de ${previous.leads} a ${current.leads} (${comparison(current.leads, previous.leads)}).`,
      action: "Compara qué canales y actividades de difusión estuvieron activos en ambos meses; prueba un cambio medible y vuelve a revisar el próximo periodo.",
    });
  } else {
    insights.push({
      title: "El volumen de solicitudes se mantuvo estable",
      signal: `Se registraron ${current.leads} solicitudes en cada mes comparado.`,
      action: "Identifica una mejora concreta en el formulario o seguimiento por WhatsApp y evalúa su efecto con la misma métrica el próximo mes.",
    });
  }
  if (current.orders > previous.orders) {
    insights.push({
      title: "Aumentaron las solicitudes de pedido",
      signal: `Pasaron de ${previous.orders} a ${current.orders}; son pedidos iniciados, no pagos verificados.`,
      action: "Confirma disponibilidad y da seguimiento a cada solicitud. Para medir ventas, registra por separado cuáles terminan en una compra pagada.",
    });
  } else if (previous.orders > 0 && current.orders < previous.orders) {
    insights.push({
      title: "Disminuyeron las solicitudes de pedido",
      signal: `Pasaron de ${previous.orders} a ${current.orders}; el CRM no confirma si los pedidos se pagaron.`,
      action: "Revisa con el equipo si cambió la disponibilidad, el surtido ofrecido o el seguimiento después de recibir un pedido.",
    });
  }
  if (current.untouched > 0) {
    insights.push({
      title: "Hay solicitudes del último mes sin actualizar",
      signal: `${current.untouched} registros de ${latestMonthLabel} todavía figuran como nuevos.`,
      action: "Contacta a esas personas y actualiza el estado del CRM. Después podrás distinguir mejor las solicitudes atendidas de las que siguen pendientes.",
    });
  }
  if (current.openMessages > 0) {
    insights.push({
      title: "Quedan mensajes por atender",
      signal: `${current.openMessages} mensajes del último mes siguen como nuevos o leídos.`,
      action: "Respóndelos y marca su estado para reducir consultas pendientes y conservar un historial útil.",
    });
  }
  const channelTotal = current.forms + current.whatsapp;
  if (channelTotal > 0) {
    const dominantChannel = current.forms > current.whatsapp ? "formulario" : "WhatsApp";
    const dominantCount = Math.max(current.forms, current.whatsapp);
    if (dominantCount / channelTotal >= 0.7 && current.forms !== current.whatsapp) {
      insights.push({
        title: `La mayoría de solicitudes llega por ${dominantChannel}`,
        signal: `${dominantCount} de ${channelTotal} registros de ${latestMonthLabel} usaron ese canal; esto mide registros CRM, no visitas ni preferencia de todos los clientes.`,
        action: "Asegura que ese canal tenga una persona responsable y que las consultas recibidas por el otro canal también se registren para poder compararlos.",
      });
    }
  }
  return (
    <section className="space-y-6" aria-labelledby="recommendations-heading">
      <div>
        <h2 id="recommendations-heading" className="font-display text-2xl font-black text-primary">Análisis y recomendaciones</h2>
        <p className="mt-1 text-sm text-muted-foreground">Cada oportunidad muestra la señal observada, la comparación y un siguiente paso concreto.</p>
      </div>
      <section className="overflow-x-auto rounded-media border border-border bg-card p-5 shadow-soft" aria-labelledby="month-comparison-heading">
        <div>
          <h3 id="month-comparison-heading" className="font-display text-lg font-black text-primary">Comparación de meses completos</h3>
          <p className="mt-1 text-sm text-muted-foreground">Compara {latestMonthLabel} con {previousMonthLabel}. Incluye solo solicitudes CRM, no ventas.</p>
        </div>
        <table className="mt-4 min-w-full text-left text-sm">
          <thead className="text-muted-foreground"><tr>
            <th className="border-b border-border px-3 py-2 font-semibold">Indicador</th>
            <th className="border-b border-border px-3 py-2 font-semibold">{previousMonthLabel}</th>
            <th className="border-b border-border px-3 py-2 font-semibold">{latestMonthLabel}</th>
            <th className="border-b border-border px-3 py-2 font-semibold">Variación</th>
          </tr></thead>
          <tbody>
            {([
              ["Solicitudes totales", previous.leads, current.leads],
              ["Solicitudes de pedido (no pagados)", previous.orders, current.orders],
              ["Solicitudes de cita", previous.appointments, current.appointments],
              ["Formulario", previous.forms, current.forms],
              ["WhatsApp", previous.whatsapp, current.whatsapp],
              ["Aún en estado nuevo", previous.untouched, current.untouched],
            ] as const).map(([label, before, now]) => (
              <tr key={label} className="border-b border-border last:border-0">
                <th scope="row" className="px-3 py-3 font-medium text-foreground">{label}</th>
                <td className="px-3 py-3 text-muted-foreground">{before}</td>
                <td className="px-3 py-3 font-bold text-primary">{now}</td>
                <td className="px-3 py-3 text-muted-foreground">{comparison(now, before)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted-foreground">Los estados «nuevo» y «cerrado» son seguimiento manual del CRM; «cerrado» no confirma un pago.</p>
      </section>
      <div className="grid gap-3">
        {insights.map((insight) => (
          <article key={insight.title} className="rounded-media border border-border bg-card p-5 shadow-soft">
            <h3 className="font-display text-lg font-black text-primary">{insight.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground"><strong className="text-foreground">Señal:</strong> {insight.signal}</p>
            <p className="mt-2 text-sm text-muted-foreground"><strong className="text-foreground">Siguiente paso:</strong> {insight.action}</p>
          </article>
        ))}
      </div>
      <section className="rounded-media border border-border bg-card p-5 shadow-soft">
        <h3 className="font-display text-lg font-black text-primary">Predicción de ventas y demanda</h3>
        <p className="mt-2 text-sm text-muted-foreground">No disponible: el sistema registra solicitudes de pedido para coordinar por WhatsApp, pero no pagos completados, cantidades vendidas ni niveles de inventario. No sería fiable proyectar ventas o demanda con esos datos.</p>
        <p className="mt-2 text-sm text-muted-foreground">Para habilitar recomendaciones de desempeño o proyecciones haría falta registrar compras pagadas y sus productos/cantidades, además de existencias; para atribución por producto también se necesitan eventos de visualización y carrito.</p>
      </section>
    </section>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="px-6 py-16 text-center">
      <p className="font-display text-xl font-black text-primary">{title}</p>
      <p className="mt-2 text-muted-foreground">{description}</p>
    </div>
  );
}

function EmailMarketingDashboard({
  summary,
  messages,
  marketing,
  token,
  onSent,
}: {
  summary: {
    authorized: number;
    newCustomers: number;
    recurringCustomers: number;
    eligibleLeadsWithoutConfirmedPurchase: number;
    eligibleNewCustomers: number;
    eligibleRecurringCustomers: number;
    eligibleLoyalCustomers: number;
  };
  messages: number;
  marketing: CrmData["marketing"];
  token: string;
  onSent: () => void;
}) {
  const [campaignName, setCampaignName] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [segment, setSegment] = useState<"all" | "new_contacts" | "unconverted" | "new_customers" | "recurring_customers" | "loyal_customers">("all");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [sendMessage, setSendMessage] = useState("");
  const [sendError, setSendError] = useState(false);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const segmentOptions = [
    { id: "all", label: "Todos los contactos autorizados", count: marketing.segmentCounts.all },
    { id: "new_contacts", label: "Contactos nuevos (últimos 30 días)", count: marketing.segmentCounts.newContacts },
    { id: "unconverted", label: "Leads e interesados", count: marketing.segmentCounts.unconverted },
    { id: "new_customers", label: "Clientes", count: marketing.segmentCounts.newCustomers },
    { id: "recurring_customers", label: "Clientes recurrentes", count: marketing.segmentCounts.recurringCustomers },
    { id: "loyal_customers", label: "Clientes fidelizados", count: marketing.segmentCounts.loyalCustomers },
  ] as const;
  const selectedSegmentCount = segmentOptions.find((option) => option.id === segment)?.count ?? 0;

  async function sendTest() {
    setSending(true);
    setSendMessage("");
    setSendError(false);
    try {
      await sendMarketingTest(token, subject, message);
      setSendMessage("Prueba enviada a aylin_santacruz@hotmail.com. No se contó como campaña.");
      onSent();
    } catch (cause) {
      setSendError(true);
      setSendMessage(cause instanceof Error ? cause.message : "No se pudo enviar el correo de prueba.");
    } finally {
      setSending(false);
    }
  }

  async function sendCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!window.confirm(
      `Vas a enviar “${subject}” a ${selectedSegmentCount} contactos elegibles. ` +
      "Solo se incluirán suscriptores con consentimiento activo. ¿Confirmas el envío?",
    )) return;
    setSending(true);
    setSendMessage("");
    setSendError(false);
    try {
      const result = await sendMarketingCampaign(token, {
        name: campaignName,
        subject,
        message,
        segment,
        ctaLabel,
        ctaUrl,
      });
      setSendMessage(
        `Campaña ${result.status === "partial" ? "parcial" : "finalizada"}: ${result.sent} enviados, ${result.failed} fallidos y ${result.skipped} excluidos por baja de consentimiento.`,
      );
      setCampaignName("");
      setSubject("");
      setMessage("");
      setCtaLabel("");
      setCtaUrl("");
      onSent();
    } catch (cause) {
      setSendError(true);
      setSendMessage(cause instanceof Error ? cause.message : "No se pudo enviar la campaña.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="space-y-6 p-5 sm:p-6" aria-labelledby="email-marketing-heading">
      <div>
        <h2 id="email-marketing-heading" className="font-display text-2xl font-black text-primary">Email marketing</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Envía campañas solo a contactos con consentimiento vigente. Ninguna campaña se envía automáticamente.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Contactos autorizados" value={summary.authorized} tone="accent" />
        <StatCard label="Clientes nuevos" value={summary.newCustomers} tone="green" />
        <StatCard label="Clientes recurrentes" value={summary.recurringCustomers} tone="navy" />
        <StatCard label="Mensajes recibidos" value={messages} tone="sky" />
        <StatCard label="Campañas enviadas" value={marketing.campaignsSent} tone="navy" />
        <StatCard label="Emails aceptados por Resend" value={marketing.emailsSent} tone="navy" />
        <StatCard label="Pruebas enviadas a Aylin" value={marketing.testEmailsSent} tone="sky" />
      </div>

      <section className="space-y-3">
        <div>
          <h3 className="font-display text-lg font-black text-primary">Resultados de campañas</h3>
          <p className="text-sm text-muted-foreground">
            {marketing.webhookConfigured
              ? "Métricas recibidas de eventos firmados de Resend."
              : "Configura el webhook de Resend para registrar entregas, aperturas, clics, rebotes y quejas."}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Entregados" value={marketing.webhookConfigured ? marketing.delivered : "—"} tone="green" />
          <StatCard label="Aperturas" value={marketing.webhookConfigured ? marketing.opened : "—"} tone="sky" />
          <StatCard label="Clics" value={marketing.webhookConfigured ? marketing.clicked : "—"} tone="accent" />
          <StatCard label="Rebotes" value={marketing.webhookConfigured ? marketing.bounced : "—"} tone="navy" />
          <StatCard label="Quejas de spam" value={marketing.webhookConfigured ? marketing.complaints : "—"} tone="navy" />
        </div>
      </section>

      <form className="space-y-4 rounded-xl border border-border bg-background p-4" onSubmit={sendCampaign}>
        <div>
          <h3 className="font-display text-lg font-black text-primary">Crear campaña</h3>
          <p className="text-sm text-muted-foreground">Se envía un mensaje por correo único, con baja incluida. Límite: 500 destinatarios por campaña.</p>
        </div>
        <label className="block text-sm font-semibold">
          Nombre interno de la campaña
          <input required maxLength={120} value={campaignName} onChange={(event) => setCampaignName(event.target.value)}
            className="mt-1.5 h-11 w-full rounded-xl border border-border bg-card px-3 font-normal focus:border-accent focus:outline-none" />
        </label>
        <label className="block text-sm font-semibold">
          Segmento destinatario
          <select value={segment} onChange={(event) => setSegment(event.target.value as typeof segment)}
            className="mt-1.5 h-11 w-full rounded-xl border border-border bg-card px-3 font-normal focus:border-accent focus:outline-none">
            {segmentOptions.map((option) => (
              <option key={option.id} value={option.id}>{option.label} ({option.count})</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold">
          Asunto
          <input
            required
            maxLength={160}
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className="mt-1.5 h-11 w-full rounded-xl border border-border bg-card px-3 font-normal focus:border-accent focus:outline-none"
          />
        </label>
        <label className="block text-sm font-semibold">
          Mensaje
          <textarea
            required
            maxLength={6000}
            rows={5}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-border bg-card p-3 font-normal focus:border-accent focus:outline-none"
          />
        </label>
        <p className="-mt-2 text-xs text-muted-foreground">Puedes personalizar el nombre con {"{{nombre}}"}.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold">
            Texto del botón (opcional)
            <input maxLength={60} value={ctaLabel} onChange={(event) => setCtaLabel(event.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-border bg-card px-3 font-normal focus:border-accent focus:outline-none" />
          </label>
          <label className="block text-sm font-semibold">
            Enlace HTTPS del botón (opcional)
            <input type="url" maxLength={1000} value={ctaUrl} onChange={(event) => setCtaUrl(event.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-border bg-card px-3 font-normal focus:border-accent focus:outline-none" />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={sending || !marketing.available || selectedSegmentCount === 0 || (Boolean(ctaLabel) !== Boolean(ctaUrl))}>
            {sending ? "Enviando..." : `Enviar campaña a ${selectedSegmentCount}`}
          </Button>
          {!marketing.available && (
            <span className="text-sm text-muted-foreground">Resend no está configurado en la función Neon.</span>
          )}
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/30 p-4">
        <p className="mr-auto text-sm text-muted-foreground">
          Prueba separada, siempre dirigida solo a aylin_santacruz@hotmail.com; lleva [PRUEBA] y no afecta las métricas de campaña.
        </p>
        <Button type="button" variant="outline" disabled={sending || !marketing.available || !subject.trim() || !message.trim()} onClick={() => void sendTest()}>
          {sending ? "Enviando..." : "Enviar prueba"}
        </Button>
        {sendMessage && <span role={sendError ? "alert" : "status"} className={cn("basis-full text-sm", sendError ? "text-danger" : "text-green-700")}>{sendMessage}</span>}
      </div>

      <section className="space-y-3 rounded-xl border border-border bg-muted/30 p-4" aria-label="Vista previa del correo">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-lg font-black text-primary">Vista previa</h3>
          <div className="flex gap-2">
            {(["desktop", "mobile"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={previewMode === mode}
                onClick={() => setPreviewMode(mode)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-semibold",
                  previewMode === mode ? "bg-accent text-white" : "bg-background text-muted-foreground",
                )}
              >
                {mode === "desktop" ? "Escritorio" : "Móvil"}
              </button>
            ))}
          </div>
        </div>
        <article className={cn(
          "mx-auto min-h-40 rounded-xl border border-border bg-white p-5 text-gray-900 shadow-soft",
          previewMode === "mobile" ? "max-w-sm" : "max-w-3xl",
        )}>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vista previa · no se envía</p>
          <h4 className="mt-3 break-words text-lg font-bold">{subject || "Asunto del correo"}</h4>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed">{message || "El contenido del mensaje aparecerá aquí."}</p>
          {ctaLabel && <span className="mt-5 inline-block rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white">{ctaLabel}</span>}
          <p className="mt-8 border-t border-gray-200 pt-3 text-xs text-gray-500">Recibes este correo porque aceptaste comunicaciones de PetCare. Incluirá un enlace para cancelar la suscripción.</p>
        </article>
      </section>

      <section className="space-y-3">
        <h3 className="font-display text-lg font-black text-primary">Historial de campañas</h3>
        {marketing.campaignHistory.length === 0 ? (
          <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">Todavía no hay campañas reales.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="p-3">Campaña</th><th className="p-3">Fecha</th><th className="p-3">Estado</th>
                  <th className="p-3">Enviados / destinatarios</th><th className="p-3">Entregados</th>
                  <th className="p-3">Aperturas</th><th className="p-3">Clics</th><th className="p-3">Fallidos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {marketing.campaignHistory.map((campaign) => (
                  <tr key={campaign.id}>
                    <td className="p-3"><span className="block font-semibold">{campaign.name}</span><span className="text-muted-foreground">{campaign.subject}</span></td>
                    <td className="p-3">{formatDate(campaign.createdAt)}</td>
                    <td className="p-3">{campaign.status}</td>
                    <td className="p-3">{campaign.sent} / {campaign.recipientCount}{campaign.skipped ? ` (${campaign.skipped} excluidos)` : ""}</td>
                    <td className="p-3">{marketing.webhookConfigured ? campaign.delivered : "—"}</td>
                    <td className="p-3">{marketing.webhookConfigured ? campaign.opened : "—"}</td>
                    <td className="p-3">{marketing.webhookConfigured ? campaign.clicked : "—"}</td>
                    <td className="p-3">{campaign.failed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <UnavailableSegment label="Clientes inactivos" reason="No hay una regla de inactividad definida." />
        <UnavailableSegment label="Carritos abandonados" reason="El carrito vive en el navegador y no está vinculado a un contacto ni a una compra confirmada." />
      </div>
    </section>
  );
}

function UnavailableSegment({ label, reason }: { label: string; reason: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-4">
      <p className="font-semibold text-primary">{label}</p>
      <p className="mt-1 text-sm text-muted-foreground">No disponible: {reason}</p>
    </div>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sourceLabel(source: string) {
  const labels: Record<string, string> = {
    contact_form: "Formulario de contacto",
    whatsapp: "WhatsApp",
    checkout: "Checkout",
    purchase: "Compra",
    newsletter: "Newsletter",
    registration: "Registro",
  };
  return labels[source] ?? source;
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "accent" | "navy" | "green" | "sky";
}) {
  const classes = {
    accent: "bg-accent-soft text-accent",
    navy: "bg-brand-navy/5 text-brand-navy",
    green: "bg-green-50 text-green-700",
    sky: "bg-sky/80 text-brand-navy",
  };

  return (
    <div className={cn("rounded-media border border-border p-5 shadow-soft", classes[tone])}>
      <p className="text-sm font-semibold opacity-80">{label}</p>
      <p className="mt-3 font-display text-3xl font-black">{value}</p>
    </div>
  );
}
