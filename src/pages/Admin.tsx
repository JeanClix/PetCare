import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowClockwise,
  CalendarBlank,
  CalendarCheck,
  ChartBar,
  ChatCircleDots,
  ClipboardText,
  EnvelopeSimple,
  FirstAidKit,
  Gauge,
  Lightbulb,
  Minus,
  PaintBrush,
  Receipt,
  ShareNetwork,
  TrendDown,
  TrendUp,
  UserGear,
  Users,
  WhatsappLogo,
} from "@phosphor-icons/react";
import { Navigate, useLocation } from "react-router-dom";
import { StaffShell, type StaffNavSection } from "@/components/staff/StaffShell";
import { SocialMediaManager } from "@/components/staff/SocialMediaManager";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { useAuth, type AuthUser } from "@/context/AuthContext";
import { isAdminAuthConfigured, isStaffRole, type StaffRole } from "@/lib/adminAuth";
import { cn } from "@/lib/utils";
import { AdminAccounts } from "@/pages/AdminAccounts";
import { AppointmentsBoard } from "@/pages/AppointmentsBoard";
import { AvailabilityManager } from "@/pages/clinic/AvailabilityManager";
import { PatientsView } from "@/pages/clinic/PatientsView";
import { WhatsappSettings } from "@/pages/WhatsappSettings";
import { VisualSiteEditor } from "@/pages/VisualSiteEditor";
import { WhatsappComposer } from "@/components/staff/WhatsappComposer";
import { PurchaseRegister } from "@/components/staff/PurchaseRegister";
import type { WhatsappContext } from "@/lib/whatsapp";
import {
  clearCrmData,
  getAppointments,
  getAppointmentSlots,
  getLegacyCrmMigrationCount,
  getCrmData,
  migrateLegacyCrm,
  sendMarketingCampaign,
  sendMarketingTest,
  setContactLifecycle,
  setContactNotes,
  setCrmLeadStatus,
  setMessageStatus,
  type Appointment,
  type AppointmentSlot,
  type ContactLifecycle,
  type ContactMessage,
  type ContactRecord,
  type CrmLead,
  type CrmLeadStatus,
  type CrmLeadType,
  type MessageStatus,
  type CrmData,
  type CustomerPurchase,
} from "@/lib/crm";
import { products as catalogProducts, categoryLabels as productCategoryLabels, type Category as ProductCategory } from "@/data/products";

const productCategoryById = new Map<number, ProductCategory>(catalogProducts.map((product) => [product.id, product.category]));

function formatCurrency(value: number) {
  return `S/ ${value.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function percentChange(current: number, previous: number): { label: string; direction: "up" | "down" | "flat" } {
  if (previous > 0) {
    const pct = ((current - previous) / previous) * 100;
    const rounded = Math.round(pct * 10) / 10;
    return { label: `${rounded > 0 ? "+" : ""}${rounded}%`, direction: rounded > 0 ? "up" : rounded < 0 ? "down" : "flat" };
  }
  if (current > 0) return { label: "Sin base anterior", direction: "up" };
  return { label: "Sin actividad", direction: "flat" };
}

const statusLabels: Record<CrmLeadStatus, string> = {
  new: "Nuevo",
  contacted: "Contactado",
  qualified: "Calificado",
  closed: "Cerrado",
};

type AdminView = "dashboard" | "leads" | "purchases" | "contacts" | "accounts" | "messages" | "marketing" | "analytics" | "recommendations" | "appointments" | "availability" | "patients" | "whatsapp" | "social" | "site";

const adminViews: Record<AdminView, { label: string; description: string; icon: typeof Gauge; roles: StaffRole[] }> = {
  dashboard: { label: "Dashboard", description: "Resumen de solicitudes, contactos y mensajes guardados en Neon.", icon: Gauge, roles: ["admin", "sales"] },
  leads: { label: "Pedidos y solicitudes", description: "Pedidos hechos desde la tienda online y solicitudes de cita capturadas en la web.", icon: ClipboardText, roles: ["admin", "sales"] },
  purchases: { label: "Compras por cliente", description: "Para ventas que NO pasaron por la tienda online (en el local, por teléfono o WhatsApp): regístralas aquí para que queden en el historial del cliente.", icon: Receipt, roles: [] },
  contacts: { label: "Clientes y contactos", description: "Contactos del CRM, etapa del ciclo de vida y consentimiento.", icon: Users, roles: ["admin", "sales"] },
  messages: { label: "Mensajes", description: "Mensajes recibidos desde formularios y WhatsApp.", icon: ChatCircleDots, roles: ["admin", "sales"] },
  marketing: { label: "Email marketing", description: "Campañas por segmento con consentimiento verificado.", icon: EnvelopeSimple, roles: ["admin", "sales"] },
  analytics: { label: "Analítica digital", description: "Actividad registrada por formulario y WhatsApp.", icon: ChartBar, roles: ["admin", "sales"] },
  recommendations: { label: "Recomendaciones", description: "Pendientes que conviene atender primero.", icon: Lightbulb, roles: ["admin", "sales"] },
  appointments: { label: "Citas", description: "Solicitudes de cita de los clientes y su estado de atención.", icon: CalendarCheck, roles: ["admin", "sales", "veterinarian"] },
  availability: { label: "Disponibilidad", description: "Publica y administra los horarios de atención.", icon: CalendarBlank, roles: ["admin", "veterinarian"] },
  patients: { label: "Pacientes", description: "Historial clínico de cada mascota: datos, antecedentes y atenciones.", icon: FirstAidKit, roles: ["admin", "veterinarian"] },
  whatsapp: { label: "WhatsApp", description: "Número de la clínica enlazado y mensajes enviados desde el panel.", icon: WhatsappLogo, roles: ["admin"] },
  social: { label: "Redes Sociales", description: "Conecta Facebook e Instagram y publica contenido desde PetCare.", icon: ShareNetwork, roles: ["admin"] },
  accounts: { label: "Cuentas y roles", description: "Asigna los roles cliente, administrador, veterinario o ventas.", icon: UserGear, roles: ["admin"] },
  site: { label: "Editor del sitio", description: "Edita textos, imágenes y colores de las páginas públicas.", icon: PaintBrush, roles: ["admin"] },
};

const adminSections: Array<{ label: string; views: AdminView[] }> = [
  { label: "General", views: ["dashboard"] },
  { label: "Ventas", views: ["leads", "contacts", "messages"] },
  { label: "Clínica", views: ["appointments", "availability", "patients"] },
  { label: "Marketing", views: ["marketing", "social", "analytics", "recommendations"] },
  { label: "Administración", views: ["accounts", "whatsapp", "site"] },
];

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
      <Container className="grid min-h-dvh place-items-center py-14">
        <div role="alert" className="mx-auto max-w-xl rounded-media border border-border bg-card p-6 text-center shadow-soft">
          <p className="font-display text-xl font-black text-primary">Falta configurar el servicio de autenticación</p>
          <p className="mt-2 text-muted-foreground">
            Despliega la función administrativa en Neon y configura VITE_ADMIN_API_URL para habilitar el inicio de sesión.
          </p>
        </div>
      </Container>
    );
  }

  if (!ready) {
    return <Container className="grid min-h-dvh place-items-center text-muted-foreground">Verificando tu sesión...</Container>;
  }

  if (!user) return <Navigate to="/cuenta?next=%2Fadmin" replace />;
  if (!isStaffRole(user.role)) return <Navigate to="/cuenta" replace />;
  return <AdminDashboard user={user as AuthUser & { role: StaffRole }} onLogout={logout} />;
}

function AdminDashboard({ onLogout, user }: { onLogout: () => void; user: AuthUser & { role: StaffRole } }) {
  const location = useLocation();
  const { token, role } = user;
  const canReadCrm = role === "admin" || role === "sales";
  const isAdmin = role === "admin";
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [purchases, setPurchases] = useState<CustomerPurchase[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentSlots, setAppointmentSlots] = useState<AppointmentSlot[]>([]);
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
  const [loading, setLoading] = useState(canReadCrm);
  const [crmError, setCrmError] = useState("");
  const [activeView, setActiveView] = useState<AdminView>(canReadCrm ? "dashboard" : "appointments");
  const [appointmentsVersion, setAppointmentsVersion] = useState(0);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const clinicAccess = role === "admin" || role === "veterinarian";
  const [whatsappTarget, setWhatsappTarget] = useState<{ contactId: string; phone?: string; context: WhatsappContext } | null>(null);
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

  const socialOAuthState = new URLSearchParams(location.search).get("state") ?? "";
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("view") === "social") setActiveView("social");
  }, [location.search]);

  async function refreshCrm(showLoading = true) {
    if (!canReadCrm) return;
    if (showLoading) setLoading(true);
    setCrmError("");
    try {
      const [data, appointmentList, slotList] = await Promise.all([
        getCrmData(token),
        getAppointments(token),
        getAppointmentSlots(token),
      ]);
      setLeads(data.leads);
      setPurchases(data.purchases);
      setAppointments(appointmentList);
      setAppointmentSlots(slotList);
      setContacts(data.contacts);
      setMessages(data.messages);
      setMarketing(data.marketing);
      if (isAdmin) setLegacyCount(getLegacyCrmMigrationCount());
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

  const pendingMessages = messages.filter((message) => message.status === "nuevo").length;
  const newLeads = leads.filter((lead) => lead.status === "new").length;
  const navSections: StaffNavSection<AdminView>[] = adminSections
    .map(({ label, views }) => ({
      label,
      items: views
        .filter((view) => adminViews[view].roles.includes(role))
        .map((view) => ({
          view,
          label: adminViews[view].label,
          icon: adminViews[view].icon,
          badge: view === "messages" ? pendingMessages : view === "leads" ? newLeads : undefined,
        })),
    }))
    .filter((section) => section.items.length > 0);
  const current = adminViews[activeView];
  const showsCrmToolbar = activeView === "leads" || activeView === "contacts" || activeView === "messages";

  if (activeView === "site") {
    return <VisualSiteEditor token={token} onExit={() => setActiveView(canReadCrm ? "dashboard" : "appointments")} />;
  }

  return (
    <>
      <StaffShell
        sections={navSections}
        activeView={activeView}
        onSelect={setActiveView}
        title={current.label}
        description={current.description}
        user={user}
        onLogout={onLogout}
        actions={activeView !== "accounts" && activeView !== "patients" && activeView !== "availability" && activeView !== "whatsapp" && activeView !== "social" && (
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => {
              if (activeView === "appointments") setAppointmentsVersion((value) => value + 1);
              else void refreshCrm();
            }}
          >
            <ArrowClockwise weight="bold" className={cn(loading && "animate-spin")} />
            <span className="hidden sm:inline">Actualizar</span>
          </Button>
        )}
      >
        {activeView === "dashboard" && (
          loading ? (
            <div role="status" className="rounded-media border border-border bg-card px-6 py-16 text-center text-muted-foreground shadow-soft">Cargando métricas del CRM...</div>
          ) : (
            <AdminOverview
              leads={leads}
              contacts={contacts}
              messages={messages}
              purchases={purchases}
              appointments={appointments}
              appointmentSlots={appointmentSlots}
            />
          )
        )}

        {activeView === "appointments" && (
          <AppointmentsBoard
            key={appointmentsVersion}
            token={token}
            clinicAccess={clinicAccess}
            canConfirm={role === "admin" || role === "sales"}
            onOpenPatient={(petId) => {
              setSelectedPatientId(petId);
              setActiveView("patients");
            }}
          />
        )}
        {activeView === "availability" && <AvailabilityManager token={token} role={role} />}
        {activeView === "whatsapp" && <WhatsappSettings token={token} />}
        {activeView === "social" && <SocialMediaManager token={token} oauthState={socialOAuthState} />}
        {activeView === "patients" && <PatientsView token={token} selectedId={selectedPatientId} onSelect={setSelectedPatientId} />}

        {activeView === "accounts" && <AdminAccounts token={token} currentEmail={user.email} />}

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

        {showsCrmToolbar && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="block flex-1">
            <span className="sr-only">Buscar en CRM</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por nombre, correo, teléfono o contenido..."
              className="h-11 w-full rounded-xl border-2 border-border bg-card px-4 focus:border-accent focus:outline-none"
            />
          </label>
          {isAdmin && <Button
            variant="ghost"
            size="sm"
            className="text-danger hover:bg-danger/10"
            onClick={async () => {
              if (!window.confirm("¿Seguro que quieres borrar los datos del CRM, incluidos los clientes y su historial de compras? Esta acción no se puede deshacer.")) return;
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
          </Button>}
        </div>
        )}

        {crmError && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm">
            <span className="font-semibold text-danger">{crmError}</span>
            <Button size="sm" variant="ghost" onClick={() => void refreshCrm()}>Reintentar</Button>
          </div>
        )}
        {activeView === "purchases" && (
          loading ? (
            <div role="status" className="rounded-media border border-border bg-card px-6 py-16 text-center text-muted-foreground shadow-soft">Cargando compras desde la base de datos...</div>
          ) : (
            <PurchaseRegister
              contacts={contacts}
              purchases={purchases}
              token={token}
              searchTerm={searchTerm}
              onSaved={() => refreshCrm(false)}
            />
          )
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
                        {lead.phone && (
                          <button
                            type="button"
                            onClick={() => setWhatsappTarget({
                              contactId: lead.contactId,
                              phone: lead.phone,
                              context: { name: lead.owner, service: lead.service, pet: lead.pet?.replace(/\s*\([^)]*\)\s*$/, ""), total: lead.type === "order" ? lead.total : undefined },
                            })}
                            className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-[#128C4B] hover:underline"
                          >
                            <WhatsappLogo weight="fill" className="size-4" /> WhatsApp
                          </button>
                        )}
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
            : <DigitalAnalytics leads={leads} contacts={contacts} />
        )}
        {activeView === "recommendations" && (
          loading
            ? <div role="status" className="rounded-media border border-border bg-card px-6 py-16 text-center text-muted-foreground shadow-soft">Cargando recomendaciones...</div>
            : <AdminRecommendations leads={leads} messages={messages} />
        )}
      </StaffShell>
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
              <p className="flex flex-wrap items-center gap-x-3">
                {selectedContact.phone || "Sin teléfono"}
                {selectedContact.phone && (
                  <button
                    type="button"
                    onClick={() => setWhatsappTarget({
                      contactId: selectedContact.id,
                      phone: selectedContact.phone,
                      context: { name: `${selectedContact.firstname} ${selectedContact.lastname}`.trim() },
                    })}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#128C4B] hover:underline"
                  >
                    <WhatsappLogo weight="fill" className="size-4" /> Escribir por WhatsApp
                  </button>
                )}
              </p>
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
      {whatsappTarget && (
        <WhatsappComposer
          token={token}
          contactId={whatsappTarget.contactId}
          phone={whatsappTarget.phone}
          context={whatsappTarget.context}
          onClose={() => setWhatsappTarget(null)}
        />
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

function bucketRanges(range: DateBounds | null) {
  if (!range) return [] as { label: string; start: Date; end: Date }[];
  const dayCount = Math.max(1, Math.round((range.end.getTime() - range.start.getTime()) / 86_400_000));
  const bucketDays = Math.max(1, Math.ceil(dayCount / 14));
  return Array.from({ length: Math.ceil(dayCount / bucketDays) }, (_, index) => {
    const start = addDays(range.start, index * bucketDays);
    const end = new Date(Math.min(addDays(start, bucketDays).getTime(), range.end.getTime()));
    const label = start.toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
    return { label, start, end };
  });
}

function KpiCard({
  label,
  value,
  change,
  description,
}: {
  label: string;
  value: string | number;
  change?: { label: string; direction: "up" | "down" | "flat" } | null;
  description: string;
}) {
  const trendTone = !change ? "" : change.direction === "up" ? "text-accent" : change.direction === "down" ? "text-danger" : "text-muted-foreground";
  return (
    <div className="rounded-media border border-border bg-card p-5 shadow-soft">
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl font-black text-primary">{value}</p>
      {change && (
        <p className={cn("mt-1 flex items-center gap-1 text-xs font-bold", trendTone)}>
          {change.direction === "up" ? <TrendUp weight="bold" /> : change.direction === "down" ? <TrendDown weight="bold" /> : <Minus weight="bold" />}
          {change.label} vs. periodo anterior
        </p>
      )}
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

function MiniLineChart({
  buckets,
  ariaLabel,
  valueFormatter,
}: {
  buckets: { label: string; value: number }[];
  ariaLabel: string;
  valueFormatter?: (value: number) => string;
}) {
  if (buckets.length === 0 || buckets.every((bucket) => bucket.value === 0)) {
    return <EmptyState title="Sin datos en este periodo" description="Cuando haya registros en el rango seleccionado, la evolución aparecerá aquí." />;
  }
  const max = Math.max(1, ...buckets.map((bucket) => bucket.value));
  const points = buckets.map((bucket, index) => {
    const x = buckets.length < 2 ? 320 : 24 + index * (612 / (buckets.length - 1));
    const y = 172 - (bucket.value / max) * 142;
    return { x, y, ...bucket };
  });
  const path = points.map(({ x, y }, index) => `${index ? "L" : "M"}${x},${y}`).join(" ");
  const format = valueFormatter ?? ((value: number) => String(value));
  return (
    <div>
      <svg role="img" aria-label={ariaLabel} viewBox="0 0 660 210" className="h-56 w-full overflow-visible">
        <title>{ariaLabel}</title>
        {[30, 75, 120, 172].map((y) => <line key={y} x1="20" y1={y} x2="640" y2={y} stroke="var(--color-border)" strokeDasharray="4 5" />)}
        <path d={`${path} L${points.at(-1)?.x ?? 24},172 L${points[0]?.x ?? 24},172 Z`} fill="var(--color-accent)" opacity="0.11" />
        <path d={path} fill="none" stroke="var(--color-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => (
          <circle key={`${point.label}-${index}`} cx={point.x} cy={point.y} r="4" fill="var(--color-accent)" stroke="var(--color-card)" strokeWidth="2">
            <title>{point.label}: {format(point.value)}</title>
          </circle>
        ))}
      </svg>
      <div className="flex justify-between px-1 text-xs text-muted-foreground">
        <span>{buckets[0]?.label}</span>
        {buckets.length > 2 && <span>{buckets[Math.floor(buckets.length / 2)]?.label}</span>}
        <span>{buckets.at(-1)?.label}</span>
      </div>
    </div>
  );
}

function VerticalBars({
  bars,
  ariaLabel,
  tone = "bg-brand-navy",
}: {
  bars: { label: string; value: number }[];
  ariaLabel: string;
  tone?: string;
}) {
  const max = Math.max(1, ...bars.map((bar) => bar.value));
  return (
    <div role="img" aria-label={ariaLabel} className="flex min-h-56 items-end gap-1.5 overflow-x-auto border-b border-border px-1">
      {bars.map((bar, index) => (
        <div key={`${bar.label}-${index}`} title={`${bar.label}: ${bar.value}`} className="flex h-52 min-w-9 flex-1 flex-col items-center justify-end gap-2">
          <span className="text-xs font-bold text-muted-foreground">{bar.value || ""}</span>
          <div className={cn("w-full max-w-9 rounded-t-lg transition-[height]", tone)} style={{ height: `${Math.max(bar.value ? 8 : 2, (bar.value / max) * 100)}%` }} />
          <span className="whitespace-nowrap text-[0.65rem] text-muted-foreground">{bar.label}</span>
        </div>
      ))}
    </div>
  );
}

function StackedBars({ buckets, ariaLabel }: { buckets: { label: string; a: number; b: number }[]; ariaLabel: string }) {
  if (buckets.length === 0 || buckets.every((bucket) => bucket.a + bucket.b === 0)) {
    return <EmptyState title="Sin datos en este periodo" description="La evolución de clientes nuevos y recurrentes aparecerá aquí." />;
  }
  const max = Math.max(1, ...buckets.map((bucket) => bucket.a + bucket.b));
  return (
    <div role="img" aria-label={ariaLabel} className="flex min-h-56 items-end gap-1.5 overflow-x-auto border-b border-border px-1">
      {buckets.map((bucket, index) => {
        const total = bucket.a + bucket.b;
        return (
          <div key={`${bucket.label}-${index}`} title={`${bucket.label}: ${bucket.a} nuevos, ${bucket.b} recurrentes`} className="flex h-52 min-w-9 flex-1 flex-col items-center justify-end gap-2">
            <span className="text-xs font-bold text-muted-foreground">{total || ""}</span>
            <div className="flex w-full max-w-9 flex-col-reverse overflow-hidden rounded-t-lg" style={{ height: `${Math.max(total ? 8 : 2, (total / max) * 100)}%` }}>
              <div className="w-full bg-brand-navy" style={{ height: `${total ? (bucket.a / total) * 100 : 0}%` }} />
              <div className="w-full bg-accent" style={{ height: `${total ? (bucket.b / total) * 100 : 0}%` }} />
            </div>
            <span className="whitespace-nowrap text-[0.65rem] text-muted-foreground">{bucket.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function MiniBarList({ items, valueFormatter, emptyLabel }: { items: { label: string; value: number }[]; valueFormatter?: (value: number) => string; emptyLabel: string }) {
  if (items.length === 0) return <EmptyState title="Sin datos" description={emptyLabel} />;
  const max = Math.max(1, ...items.map((item) => item.value));
  const format = valueFormatter ?? ((value: number) => String(value));
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1.5 flex justify-between gap-3 text-sm"><span className="truncate" title={item.label}>{item.label}</span><strong className="shrink-0 tabular-nums">{format(item.value)}</strong></div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-accent" style={{ width: `${(item.value / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

function ConversionFunnel({ stages }: { stages: { label: string; value: number }[] }) {
  const max = Math.max(1, ...stages.map((stage) => stage.value));
  return (
    <div className="space-y-3">
      {stages.map((stage) => (
        <div key={stage.label}>
          <div className="mb-1.5 flex justify-between text-sm"><span>{stage.label}</span><strong className="tabular-nums">{stage.value}</strong></div>
          <div className="h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-brand-navy" style={{ width: `${Math.max(stage.value ? 6 : 1, (stage.value / max) * 100)}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

const categoryPalette: Record<string, { css: string; dot: string; label: string }> = {
  alimento: { css: "var(--color-accent)", dot: "bg-accent", label: productCategoryLabels.alimento },
  farmacia: { css: "var(--color-brand-navy)", dot: "bg-brand-navy", label: productCategoryLabels.farmacia },
  higiene: { css: "#f59e0b", dot: "bg-amber-500", label: productCategoryLabels.higiene },
  accesorio: { css: "#7c3aed", dot: "bg-violet-500", label: productCategoryLabels.accesorio },
  servicios: { css: "var(--color-muted-foreground)", dot: "bg-muted-foreground", label: "Servicios veterinarios" },
};

function CategoryDonut({ segments, centerLabel, centerValue }: { segments: { key: string; value: number }[]; centerLabel: string; centerValue: string }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (total <= 0) return <EmptyState title="Sin ingresos en este periodo" description="La distribución por categoría aparecerá cuando existan ventas registradas." />;
  let cursor = 0;
  const stops: string[] = [];
  const ordered = [...segments].sort((a, b) => b.value - a.value);
  ordered.forEach((segment) => {
    const share = (segment.value / total) * 100;
    const palette = categoryPalette[segment.key] ?? categoryPalette.servicios;
    stops.push(`${palette.css} ${cursor}% ${cursor + share}%`);
    cursor += share;
  });
  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      <div role="img" aria-label={`${centerLabel}: ${centerValue}`} className="grid size-40 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(${stops.join(", ")})` }}>
        <div className="grid size-24 place-items-center rounded-full bg-card text-center">
          <span><strong className="block font-display text-xl text-primary">{centerValue}</strong><span className="text-xs text-muted-foreground">{centerLabel}</span></span>
        </div>
      </div>
      <dl className="grid gap-3 text-sm">
        {ordered.map((segment) => {
          const palette = categoryPalette[segment.key] ?? categoryPalette.servicios;
          return <ChannelLegend key={segment.key} color={palette.dot} label={palette.label} count={formatCurrency(segment.value)} />;
        })}
      </dl>
    </div>
  );
}

function AdminOverview({
  leads,
  contacts,
  messages,
  purchases,
  appointments,
  appointmentSlots,
}: {
  leads: CrmLead[];
  contacts: ContactRecord[];
  messages: ContactMessage[];
  purchases: CustomerPurchase[];
  appointments: Appointment[];
  appointmentSlots: AppointmentSlot[];
}) {
  const filter = useDateFilter();
  const now = new Date();
  const currentLeads = leads.filter((lead) => inBounds(lead.createdAt, filter.range));
  const previousLeads = leads.filter((lead) => inBounds(lead.createdAt, filter.previous));
  const currentContacts = contacts.filter((contact) => inBounds(contact.createdAt, filter.range));
  const previousContacts = contacts.filter((contact) => inBounds(contact.createdAt, filter.previous));
  const currentMessages = messages.filter((message) => inBounds(message.createdAt, filter.range));
  const pendingMessages = currentMessages.filter((message) => message.status === "nuevo" || message.status === "leído").length;
  const orders = currentLeads.filter((lead) => lead.type === "order");
  const legacyAppointmentRequests = currentLeads.filter((lead) => lead.type === "appointment");

  // --- Analítica comercial: ventas e ingresos reales (petcare_purchases) ---
  const currentPurchases = useMemo(() => purchases.filter((purchase) => inBounds(purchase.createdAt, filter.range)), [purchases, filter.range]);
  const previousPurchases = useMemo(() => purchases.filter((purchase) => inBounds(purchase.createdAt, filter.previous)), [purchases, filter.previous]);
  const ingresos = currentPurchases.reduce((sum, purchase) => sum + purchase.total, 0);
  const ingresosPrev = previousPurchases.reduce((sum, purchase) => sum + purchase.total, 0);
  const ventas = currentPurchases.length;
  const ventasPrev = previousPurchases.length;
  const ticketPromedio = ventas ? ingresos / ventas : 0;
  const ticketPromedioPrev = ventasPrev ? ingresosPrev / ventasPrev : 0;
  const demoPurchaseCount = currentPurchases.filter((purchase) => purchase.recordedBy.startsWith("Datos de demostración")).length;

  const contactsWithLeadCurrent = new Set(currentLeads.map((lead) => lead.contactId));
  const contactsWithPurchaseCurrent = new Set(currentPurchases.map((purchase) => purchase.contactId));
  const contactsWithLeadPrev = new Set(previousLeads.map((lead) => lead.contactId));
  const contactsWithPurchasePrev = new Set(previousPurchases.map((purchase) => purchase.contactId));
  const conversionRate = contactsWithLeadCurrent.size ? (contactsWithPurchaseCurrent.size / contactsWithLeadCurrent.size) * 100 : null;
  const conversionRatePrev = contactsWithLeadPrev.size ? (contactsWithPurchasePrev.size / contactsWithLeadPrev.size) * 100 : null;

  const recurringCustomersCurrent = filter.range
    ? [...contactsWithPurchaseCurrent].filter((contactId) => purchases.some((purchase) => purchase.contactId === contactId && new Date(purchase.createdAt) < filter.range!.start)).length
    : 0;
  const recurringCustomersPrev = filter.previous
    ? [...contactsWithPurchasePrev].filter((contactId) => purchases.some((purchase) => purchase.contactId === contactId && new Date(purchase.createdAt) < filter.previous!.start)).length
    : 0;

  // --- Analítica de citas (petcare_leads tipo "appointment" + petcare_appointment_slots) ---
  const currentAppointments = useMemo(() => appointments.filter((appointment) => inBounds(appointment.createdAt, filter.range)), [appointments, filter.range]);
  const scheduledIn = (appointment: Appointment, bounds: DateBounds | null) => Boolean(appointment.scheduledAt && inBounds(appointment.scheduledAt, bounds));
  const confirmedCurrent = appointments.filter((appointment) => (appointment.status === "qualified" || appointment.status === "closed") && scheduledIn(appointment, filter.range));
  const confirmedPrev = appointments.filter((appointment) => (appointment.status === "qualified" || appointment.status === "closed") && scheduledIn(appointment, filter.previous));
  const attendedCurrent = appointments.filter((appointment) => appointment.status === "closed" && scheduledIn(appointment, filter.range));
  const attendedPrev = appointments.filter((appointment) => appointment.status === "closed" && scheduledIn(appointment, filter.previous));
  const noShowCurrent = appointments.filter((appointment) => appointment.status === "qualified" && appointment.scheduledAt && new Date(appointment.scheduledAt) < now && scheduledIn(appointment, filter.range));
  const noShowPrev = appointments.filter((appointment) => appointment.status === "qualified" && appointment.scheduledAt && new Date(appointment.scheduledAt) < now && scheduledIn(appointment, filter.previous));
  const attendanceBaseCurrent = attendedCurrent.length + noShowCurrent.length;
  const attendanceBasePrev = attendedPrev.length + noShowPrev.length;
  const attendanceRate = attendanceBaseCurrent ? (attendedCurrent.length / attendanceBaseCurrent) * 100 : null;
  const attendanceRatePrev = attendanceBasePrev ? (attendedPrev.length / attendanceBasePrev) * 100 : null;
  const cancelledCurrent = appointmentSlots.filter((slot) => slot.status === "cancelled" && inBounds(slot.startsAt, filter.range));

  // --- Series por periodo ---
  const revenueBuckets = useMemo(
    () => bucketRanges(filter.range).map((bucket) => ({ label: bucket.label, value: purchases.filter((purchase) => inBounds(purchase.createdAt, bucket)).reduce((sum, purchase) => sum + purchase.total, 0) })),
    [purchases, filter.range],
  );
  const appointmentDemandBuckets = useMemo(
    () => bucketRanges(filter.range).map((bucket) => ({ label: bucket.label, value: appointments.filter((appointment) => inBounds(appointment.createdAt, bucket)).length })),
    [appointments, filter.range],
  );
  const customerBuckets = useMemo(
    () => bucketRanges(filter.range).map((bucket) => {
      const newCount = contacts.filter((contact) => inBounds(contact.createdAt, bucket)).length;
      const purchasersInBucket = new Set(purchases.filter((purchase) => inBounds(purchase.createdAt, bucket)).map((purchase) => purchase.contactId));
      let recurringCount = 0;
      purchasersInBucket.forEach((contactId) => {
        if (purchases.some((purchase) => purchase.contactId === contactId && new Date(purchase.createdAt) < bucket.start)) recurringCount += 1;
      });
      return { label: bucket.label, a: newCount, b: recurringCount };
    }),
    [contacts, purchases, filter.range],
  );
  const weekdayLabels = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const demandByWeekday = useMemo(() => {
    const counts = new Array(7).fill(0);
    appointments.forEach((appointment) => {
      if (scheduledIn(appointment, filter.range)) counts[new Date(appointment.scheduledAt as string).getDay()] += 1;
    });
    return weekdayLabels.map((label, index) => ({ label, value: counts[index] }));
  }, [appointments, filter.range]);
  const demandByHour = useMemo(() => {
    const counts = new Array(24).fill(0);
    appointments.forEach((appointment) => {
      if (scheduledIn(appointment, filter.range)) counts[new Date(appointment.scheduledAt as string).getHours()] += 1;
    });
    return Array.from({ length: 13 }, (_, index) => index + 8).map((hour) => ({ label: `${hour}:00`, value: counts[hour] }));
  }, [appointments, filter.range]);

  // --- Rankings ---
  const categoryTotals = new Map<string, number>();
  const productTotals = new Map<string, number>();
  currentPurchases.forEach((purchase) => {
    purchase.items.forEach((item) => {
      const revenue = item.unitPrice * item.quantity;
      productTotals.set(item.name, (productTotals.get(item.name) ?? 0) + revenue);
      const category = item.productId !== null ? productCategoryById.get(item.productId) : undefined;
      const key = category ?? "servicios";
      categoryTotals.set(key, (categoryTotals.get(key) ?? 0) + revenue);
    });
  });
  const topProducts = [...productTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, value]) => ({ label, value }));
  const serviceCounts = new Map<string, number>();
  currentAppointments.forEach((appointment) => {
    if (appointment.service) serviceCounts.set(appointment.service, (serviceCounts.get(appointment.service) ?? 0) + 1);
  });
  const topServices = [...serviceCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, value]) => ({ label, value }));
  const funnelStages = [
    { label: "Solicitud recibida", value: currentLeads.length },
    { label: "Contactado", value: currentLeads.filter((lead) => lead.status === "contacted" || lead.status === "qualified" || lead.status === "closed").length },
    { label: "Calificado / cita confirmada", value: currentLeads.filter((lead) => lead.status === "qualified" || lead.status === "closed").length },
    { label: "Venta o servicio cerrado", value: currentLeads.filter((lead) => lead.status === "closed").length },
  ];

  return (
    <section className="space-y-8" aria-labelledby="admin-dashboard-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="admin-dashboard-heading" className="font-display text-2xl font-black text-primary">Centro de inteligencia de negocio</h2>
          <p className="mt-1 text-sm text-muted-foreground">KPIs, analítica comercial y de citas calculados sobre registros reales de Neon.</p>
        </div>
        <PeriodFilter filter={filter} />
      </div>
      {!filter.range && <p role="alert" className="rounded-xl bg-danger/5 px-4 py-3 text-sm text-danger">El rango personalizado no es válido. Selecciona fechas correctas.</p>}
      <p className="text-xs text-muted-foreground">Periodo: {rangeDescription(filter.range)} · Comparación: periodo anterior de igual duración.</p>
      {demoPurchaseCount > 0 && (
        <p className="rounded-xl bg-accent-soft px-4 py-3 text-sm font-semibold text-accent">
          {demoPurchaseCount} de las {ventas} ventas de este periodo son datos de demostración sembrados para validar el dashboard (aún no hay un flujo de pago en línea en producción). Los cálculos de abajo las tratan igual que una venta real.
        </p>
      )}

      {/* A. KPIs ejecutivos */}
      <section aria-labelledby="kpi-heading" className="space-y-4">
        <h3 id="kpi-heading" className="font-display text-lg font-black text-primary">KPIs principales</h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Ingresos totales" value={filter.range ? formatCurrency(ingresos) : "—"} change={filter.range ? percentChange(ingresos, ingresosPrev) : null} description="Importe realmente percibido por ventas y servicios registrados en Caja (petcare_purchases)." />
          <KpiCard label="Ventas realizadas" value={filter.range ? ventas : "—"} change={filter.range ? percentChange(ventas, ventasPrev) : null} description="Cantidad de operaciones de venta pagadas y registradas en el periodo." />
          <KpiCard label="Ticket promedio" value={filter.range ? formatCurrency(ticketPromedio) : "—"} change={filter.range ? percentChange(ticketPromedio, ticketPromedioPrev) : null} description="Ingreso promedio por operación (ingresos ÷ ventas realizadas)." />
          <KpiCard
            label="Tasa de conversión"
            value={filter.range ? (conversionRate === null ? "Sin datos" : `${conversionRate.toFixed(1)}%`) : "—"}
            change={filter.range && conversionRate !== null ? percentChange(conversionRate, conversionRatePrev ?? 0) : null}
            description="Contactos con al menos una compra ÷ contactos con al menos una solicitud, en el periodo."
          />
          <KpiCard label="Citas confirmadas" value={filter.range ? confirmedCurrent.length : "—"} change={filter.range ? percentChange(confirmedCurrent.length, confirmedPrev.length) : null} description="Citas con fecha y hora acordadas (estado calificado o cerrado), por fecha de la cita." />
          <KpiCard
            label="Tasa de asistencia"
            value={filter.range ? (attendanceRate === null ? "Sin datos" : `${attendanceRate.toFixed(1)}%`) : "—"}
            change={filter.range && attendanceRate !== null ? percentChange(attendanceRate, attendanceRatePrev ?? 0) : null}
            description="Citas atendidas ÷ (atendidas + no asistidas) entre las citas confirmadas cuya fecha ya pasó."
          />
          <KpiCard label="Clientes nuevos" value={filter.range ? currentContacts.length : "—"} change={filter.range ? percentChange(currentContacts.length, previousContacts.length) : null} description="Contactos registrados por primera vez durante el periodo." />
          <KpiCard label="Clientes recurrentes" value={filter.range ? recurringCustomersCurrent : "—"} change={filter.range ? percentChange(recurringCustomersCurrent, recurringCustomersPrev) : null} description="Clientes que compraron en el periodo y que ya tenían al menos una compra anterior." />
        </div>
      </section>

      {/* B. Analítica comercial */}
      <section aria-labelledby="commercial-heading" className="space-y-4">
        <h3 id="commercial-heading" className="font-display text-lg font-black text-primary">Analítica comercial</h3>
        <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <article className="rounded-media border border-border bg-card p-5 shadow-soft">
            <h4 className="font-display text-base font-black text-primary">Evolución de ingresos</h4>
            <p className="mt-1 text-sm text-muted-foreground">Ingresos reales agrupados por periodo · {rangeDescription(filter.range)}</p>
            <div className="mt-5"><MiniLineChart buckets={revenueBuckets} ariaLabel="Evolución de ingresos" valueFormatter={formatCurrency} /></div>
          </article>
          <article className="rounded-media border border-border bg-card p-5 shadow-soft">
            <h4 className="font-display text-base font-black text-primary">Comparación de periodos</h4>
            <p className="mt-1 text-sm text-muted-foreground">Actual vs. periodo anterior</p>
            <div className="mt-5 space-y-4">
              <div>
                <div className="mb-1.5 flex justify-between text-sm"><span>Ingresos actuales</span><strong className="tabular-nums">{formatCurrency(ingresos)}</strong></div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (ingresos / Math.max(1, ingresos, ingresosPrev)) * 100)}%` }} /></div>
              </div>
              <div>
                <div className="mb-1.5 flex justify-between text-sm"><span>Ingresos periodo anterior</span><strong className="tabular-nums">{formatCurrency(ingresosPrev)}</strong></div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-muted-foreground" style={{ width: `${Math.min(100, (ingresosPrev / Math.max(1, ingresos, ingresosPrev)) * 100)}%` }} /></div>
              </div>
              <div className="border-t border-border pt-4">
                <div className="mb-1.5 flex justify-between text-sm"><span>Ventas actuales</span><strong className="tabular-nums">{ventas}</strong></div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-brand-navy" style={{ width: `${Math.min(100, (ventas / Math.max(1, ventas, ventasPrev)) * 100)}%` }} /></div>
              </div>
              <div>
                <div className="mb-1.5 flex justify-between text-sm"><span>Ventas periodo anterior</span><strong className="tabular-nums">{ventasPrev}</strong></div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-muted-foreground" style={{ width: `${Math.min(100, (ventasPrev / Math.max(1, ventas, ventasPrev)) * 100)}%` }} /></div>
              </div>
            </div>
          </article>
        </div>
        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <article className="rounded-media border border-border bg-card p-5 shadow-soft">
            <h4 className="font-display text-base font-black text-primary">Ingresos por categoría</h4>
            <p className="mt-1 text-sm text-muted-foreground">Productos y servicios vendidos en el periodo</p>
            <div className="mt-5"><CategoryDonut segments={[...categoryTotals.entries()].map(([key, value]) => ({ key, value }))} centerLabel="ingresos" centerValue={formatCurrency(ingresos)} /></div>
          </article>
          <div className="grid gap-4">
            <article className="rounded-media border border-border bg-card p-5 shadow-soft">
              <h4 className="font-display text-base font-black text-primary">Productos más vendidos</h4>
              <div className="mt-4"><MiniBarList items={topProducts} valueFormatter={formatCurrency} emptyLabel="Las ventas de productos aparecerán aquí." /></div>
            </article>
            <article className="rounded-media border border-border bg-card p-5 shadow-soft">
              <h4 className="font-display text-base font-black text-primary">Servicios veterinarios más solicitados</h4>
              <div className="mt-4"><MiniBarList items={topServices} emptyLabel="Las citas solicitadas por servicio aparecerán aquí." /></div>
            </article>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-media border border-border bg-card p-5 shadow-soft">
            <h4 className="font-display text-base font-black text-primary">Clientes nuevos vs. recurrentes</h4>
            <p className="mt-1 text-sm text-muted-foreground">Azul marino: nuevos · Verde: recurrentes</p>
            <div className="mt-5"><StackedBars buckets={customerBuckets} ariaLabel="Clientes nuevos vs. recurrentes por periodo" /></div>
          </article>
          <article className="rounded-media border border-border bg-card p-5 shadow-soft">
            <h4 className="font-display text-base font-black text-primary">Embudo de conversión</h4>
            <p className="mt-1 text-sm text-muted-foreground">Desde la solicitud hasta la venta o servicio cerrado</p>
            <div className="mt-5"><ConversionFunnel stages={funnelStages} /></div>
          </article>
        </div>
      </section>

      {/* C. Analítica de citas y servicios */}
      <section aria-labelledby="appointments-analytics-heading" className="space-y-4">
        <h3 id="appointments-analytics-heading" className="font-display text-lg font-black text-primary">Analítica de citas y servicios</h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Citas solicitadas" value={filter.range ? currentAppointments.length : "—"} tone="accent" />
          <StatCard label="Confirmadas" value={filter.range ? confirmedCurrent.length : "—"} tone="navy" />
          <StatCard label="Atendidas" value={filter.range ? attendedCurrent.length : "—"} tone="green" />
          <StatCard label="Canceladas" value={filter.range ? cancelledCurrent.length : "—"} tone="sky" />
          <div className="rounded-media border border-border bg-card p-5 shadow-soft">
            <p className="text-sm font-semibold text-muted-foreground">Tasa de inasistencia</p>
            <p className="mt-3 font-display text-3xl font-black text-primary">{filter.range ? (attendanceRate === null ? "—" : `${(100 - attendanceRate).toFixed(1)}%`) : "—"}</p>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-media border border-border bg-card p-5 shadow-soft">
            <h4 className="font-display text-base font-black text-primary">Demanda por día de la semana</h4>
            <p className="mt-1 text-sm text-muted-foreground">Citas con fecha y hora confirmada, por día programado</p>
            <div className="mt-5">{demandByWeekday.every((bucket) => bucket.value === 0) ? <EmptyState title="Sin citas programadas" description="Cuando haya citas con fecha confirmada en el periodo, su distribución semanal aparecerá aquí." /> : <VerticalBars bars={demandByWeekday} ariaLabel="Demanda de citas por día de la semana" tone="bg-brand-navy" />}</div>
          </article>
          <article className="rounded-media border border-border bg-card p-5 shadow-soft">
            <h4 className="font-display text-base font-black text-primary">Demanda por horario</h4>
            <p className="mt-1 text-sm text-muted-foreground">Horario de atención (8:00 – 20:00)</p>
            <div className="mt-5">{demandByHour.every((bucket) => bucket.value === 0) ? <EmptyState title="Sin citas programadas" description="Cuando haya citas con fecha confirmada en el periodo, su distribución por hora aparecerá aquí." /> : <VerticalBars bars={demandByHour} ariaLabel="Demanda de citas por horario" tone="bg-accent" />}</div>
          </article>
        </div>
        <article className="rounded-media border border-border bg-card p-5 shadow-soft">
          <h4 className="font-display text-base font-black text-primary">Evolución de la demanda de servicios</h4>
          <p className="mt-1 text-sm text-muted-foreground">Citas solicitadas por periodo (fecha de solicitud) · {rangeDescription(filter.range)}</p>
          <div className="mt-5"><MiniLineChart buckets={appointmentDemandBuckets} ariaLabel="Evolución de la demanda de citas" /></div>
        </article>
      </section>

      {/* Contenido existente: actividad de solicitudes del CRM (se mantiene, sin cambios de cálculo) */}
      <section aria-labelledby="crm-activity-heading" className="space-y-4 border-t border-border pt-6">
        <div>
          <h3 id="crm-activity-heading" className="font-display text-lg font-black text-primary">Actividad de solicitudes (CRM)</h3>
          <p className="mt-1 text-sm text-muted-foreground">Panel original: solicitudes recibidas en el CRM; las solicitudes de pedido no representan ventas pagadas.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Solicitudes recibidas" value={filter.range ? currentLeads.length : "—"} tone="accent" />
          <StatCard label="Pedidos iniciados (no pagados)" value={filter.range ? orders.length : "—"} tone="green" />
          <StatCard label="Citas solicitadas" value={filter.range ? legacyAppointmentRequests.length : "—"} tone="navy" />
          <StatCard label="Contactos nuevos" value={filter.range ? currentContacts.length : "—"} tone="sky" />
        </div>
        <section className="overflow-hidden rounded-media border border-border bg-card shadow-soft" aria-labelledby="recent-leads-heading">
          <div className="border-b border-border p-5">
            <h4 id="recent-leads-heading" className="font-display text-base font-black text-primary">Solicitudes recientes</h4>
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
        <p className="text-sm text-muted-foreground">Mensajes pendientes de este periodo: <strong className="text-foreground">{filter.range ? pendingMessages : "—"}</strong>.</p>
      </section>
    </section>
  );
}

function DigitalAnalytics({
  leads,
  contacts,
}: {
  leads: CrmLead[];
  contacts: ContactRecord[];
}) {
  const filter = useDateFilter();
  const visibleLeads = leads.filter((lead) => inBounds(lead.createdAt, filter.range));
  const visibleContacts = contacts.filter((contact) => inBounds(contact.createdAt, filter.range));
  const forms = visibleLeads.filter((lead) => lead.channel === "form").length;
  const whatsapp = visibleLeads.filter((lead) => lead.channel === "whatsapp").length;
  const orderRequests = visibleLeads.filter((lead) => lead.type === "order").length;
  const appointments = visibleLeads.filter((lead) => lead.type === "appointment").length;
  const otherChannels = visibleLeads.length - forms - whatsapp;
  const formShare = visibleLeads.length ? forms / visibleLeads.length * 100 : 0;
  const whatsappShare = visibleLeads.length ? whatsapp / visibleLeads.length * 100 : 0;
  const buckets = useMemo(() => {
    if (!filter.range) return [];
    const dayCount = Math.max(1, Math.round((filter.range.end.getTime() - filter.range.start.getTime()) / 86_400_000));
    const bucketDays = Math.max(1, Math.ceil(dayCount / 14));
    return Array.from({ length: Math.ceil(dayCount / bucketDays) }, (_, index) => {
      const start = addDays(filter.range!.start, index * bucketDays);
      const end = new Date(Math.min(addDays(start, bucketDays).getTime(), filter.range!.end.getTime()));
      return {
        label: start.toLocaleDateString("es-PE", { day: "2-digit", month: "short" }),
        count: visibleLeads.filter((lead) => inBounds(lead.createdAt, { start, end })).length,
      };
    });
  }, [visibleLeads, filter.range]);
  const maxBucketCount = Math.max(1, ...buckets.map((bucket) => bucket.count));
  const linePoints = buckets.map((bucket, index) => {
    const x = buckets.length < 2 ? 320 : 24 + index * (612 / (buckets.length - 1));
    const y = 172 - bucket.count / maxBucketCount * 142;
    return { x, y, ...bucket };
  });
  const linePath = linePoints.map(({ x, y }, index) => `${index ? "L" : "M"}${x},${y}`).join(" ");
  const eventMix = [
    { label: "Solicitudes de cita", value: appointments, color: "bg-accent" },
    { label: "Pedidos iniciados", value: orderRequests, color: "bg-brand-navy" },
  ];
  const maxEventCount = Math.max(1, appointments, orderRequests);

  return (
    <section className="space-y-6" aria-labelledby="digital-analytics-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="digital-analytics-heading" className="font-display text-2xl font-black text-primary">Analítica digital</h2>
          <p className="mt-1 text-sm text-muted-foreground">Resumen visual de las interacciones registradas en PetCare.</p>
        </div>
        <PeriodFilter filter={filter} />
      </div>
      {!filter.range && <p role="alert" className="rounded-xl bg-danger/5 px-4 py-3 text-sm text-danger">El rango personalizado no es válido. Selecciona fechas correctas.</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Solicitudes registradas" value={filter.range ? visibleLeads.length : "—"} tone="accent" />
        <StatCard label="Contactos nuevos" value={filter.range ? visibleContacts.length : "—"} tone="navy" />
        <StatCard label="Formularios" value={filter.range ? forms : "—"} tone="green" />
        <StatCard label="Solicitudes por WhatsApp" value={filter.range ? whatsapp : "—"} tone="sky" />
      </div>
      <section className="grid gap-4 xl:grid-cols-[1.65fr_1fr]" aria-label="Actividad y canales">
        <article className="rounded-media border border-border bg-card p-5 shadow-soft">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-black text-primary">Solicitudes en el tiempo</h3>
              <p className="mt-1 text-sm text-muted-foreground">Actividad capturada por día o periodo · {rangeDescription(filter.range)}</p>
            </div>
            <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent">CRM</span>
          </div>
          {buckets.length > 0 && visibleLeads.length > 0 ? (
            <div className="mt-5">
              <svg role="img" aria-label="Gráfico de solicitudes CRM a lo largo del periodo" viewBox="0 0 660 210" className="h-56 w-full overflow-visible">
                <title>Solicitudes CRM a lo largo del periodo</title>
                {[30, 75, 120, 172].map((y) => <line key={y} x1="20" y1={y} x2="640" y2={y} stroke="var(--color-border)" strokeDasharray="4 5" />)}
                <path d={`${linePath} L${linePoints.at(-1)?.x ?? 24},172 L${linePoints[0]?.x ?? 24},172 Z`} fill="var(--color-accent)" opacity="0.11" />
                <path d={linePath} fill="none" stroke="var(--color-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                {linePoints.map((point, index) => <circle key={`${point.label}-${index}`} cx={point.x} cy={point.y} r="4" fill="var(--color-accent)" stroke="var(--color-card)" strokeWidth="2"><title>{point.label}: {point.count} solicitudes</title></circle>)}
              </svg>
              <div className="flex justify-between px-1 text-xs text-muted-foreground">
                <span>{buckets[0]?.label}</span>
                {buckets.length > 2 && <span>{buckets[Math.floor(buckets.length / 2)]?.label}</span>}
                <span>{buckets.at(-1)?.label}</span>
              </div>
            </div>
          ) : (
            <EmptyState title="Aún no hay actividad" description="Las solicitudes capturadas aparecerán en este gráfico." />
          )}
        </article>
        <article className="rounded-media border border-border bg-card p-5 shadow-soft">
          <h3 className="font-display text-lg font-black text-primary">Canales de captura</h3>
          <p className="mt-1 text-sm text-muted-foreground">Solicitudes recibidas en el CRM</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-6">
            <div
              role="img"
              aria-label={`Canales CRM: ${forms} por formulario, ${whatsapp} por WhatsApp y ${otherChannels} otros`}
              className="grid size-40 shrink-0 place-items-center rounded-full"
              style={{ background: visibleLeads.length ? `conic-gradient(var(--color-accent) 0 ${formShare}%, var(--color-brand-navy) ${formShare}% ${formShare + whatsappShare}%, var(--color-muted) ${formShare + whatsappShare}% 100%)` : "var(--color-muted)" }}
            >
              <div className="grid size-24 place-items-center rounded-full bg-card text-center">
                <span><strong className="block font-display text-2xl text-primary">{filter.range ? visibleLeads.length : "—"}</strong><span className="text-xs text-muted-foreground">solicitudes</span></span>
              </div>
            </div>
            <dl className="grid gap-3 text-sm">
              <ChannelLegend color="bg-accent" label="Formulario" count={filter.range ? forms : "—"} />
              <ChannelLegend color="bg-brand-navy" label="WhatsApp" count={filter.range ? whatsapp : "—"} />
              <ChannelLegend color="bg-muted" label="Otros" count={filter.range ? otherChannels : "—"} />
            </dl>
          </div>
        </article>
      </section>
      <section className="grid gap-4 lg:grid-cols-2" aria-label="Desglose de actividad">
        <article className="rounded-media border border-border bg-card p-5 shadow-soft">
          <h3 className="font-display text-lg font-black text-primary">Tipo de solicitud</h3>
          <p className="mt-1 text-sm text-muted-foreground">Los pedidos iniciados no son ventas pagadas.</p>
          <div className="mt-5 space-y-4">
            {eventMix.map((item) => (
              <div key={item.label}>
                <div className="mb-1.5 flex justify-between gap-3 text-sm"><span>{item.label}</span><strong>{filter.range ? item.value : "—"}</strong></div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", item.color)} style={{ width: `${item.value / maxEventCount * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </article>
        <article className="rounded-media border border-border bg-card p-5 shadow-soft">
          <h3 className="font-display text-lg font-black text-primary">Qué representan estos datos</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            El panel muestra formularios, solicitudes de WhatsApp, citas y pedidos iniciados guardados en el CRM; no son sesiones ni usuarios únicos.
            No se calculan tasas de conversión ni ingresos sin una fuente de visitas y pagos confirmados.
          </p>
          <p className="mt-3 rounded-xl bg-muted/70 px-4 py-3 text-sm font-semibold text-primary">
            Google Analytics 4 no está conectado. Visitas, páginas vistas y fuentes de tráfico no están disponibles y no se muestran como cero.
          </p>
        </article>
      </section>
    </section>
  );
}

function ChannelLegend({ color, label, count }: { color: string; label: string; count: string | number }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("size-2.5 rounded-full", color)} />
      <dt>{label}</dt>
      <dd className="ml-auto font-bold tabular-nums">{count}</dd>
    </div>
  );
}

function AdminRecommendations({ leads, messages }: { leads: CrmLead[]; messages: ContactMessage[] }) {
  const newLeads = leads.filter((lead) => lead.status === "new");
  const openMessages = messages.filter((message) => message.status === "nuevo" || message.status === "leído");
  const pendingOrders = newLeads.filter((lead) => lead.type === "order");
  const insights = [
    ...(newLeads.length ? [`Tienes ${newLeads.length} solicitudes nuevas sin contactar. Revisa la cola de solicitudes y actualiza su estado después de responder.`] : []),
    ...(openMessages.length ? [`Hay ${openMessages.length} mensajes en estado nuevo o leído. Atiéndelos y marca su estado para mantener el seguimiento.`] : []),
    ...(pendingOrders.length ? [`${pendingOrders.length} solicitudes de pedido siguen nuevas. Confirma disponibilidad y pago antes de marcarlas como clientes o ventas.`] : []),
  ];
  return (
    <section className="space-y-6" aria-labelledby="recommendations-heading">
      <div>
        <h2 id="recommendations-heading" className="font-display text-2xl font-black text-primary">Análisis y recomendaciones</h2>
        <p className="mt-1 text-sm text-muted-foreground">Observaciones explicables a partir de registros actuales del CRM, sin predicciones simuladas.</p>
      </div>
      {insights.length ? (
        <div className="grid gap-3">{insights.map((insight) => (
          <article key={insight} className="rounded-media border border-border bg-card p-5 shadow-soft">
            <p className="font-semibold text-primary">{insight}</p>
          </article>
        ))}</div>
      ) : (
        <EmptyState title="No hay alertas operativas" description="No existen solicitudes nuevas ni mensajes pendientes en los datos disponibles." />
      )}
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
