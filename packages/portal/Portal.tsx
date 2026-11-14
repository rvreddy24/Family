import React, { useEffect, useState } from "react";
import {
  HeartHandshake,
  LayoutDashboard,
  Users,
  ClipboardList,
  Activity,
  ShieldCheck,
  LogOut,
  ArrowUpRight,
  Plus,
  RefreshCw,
  MapPin,
  Check,
  X,
  Menu,
  ChevronRight,
  Phone,
  Camera,
  AlertCircle,
} from "lucide-react";
import "./portal.css";
import logo from "../shared/assets/logo_icon.png";

type Role = "CLIENT" | "ADMIN" | "PARTNER";
async function api(path: string, body?: any, method?: string) {
  const response = await fetch(`/api${path}`, {
    credentials: "same-origin",
    method: method || (body ? "POST" : "GET"),
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response
    .json()
    .catch(() => ({ error: "The service returned an invalid response." }));
  if (!response.ok)
    throw Error(data.error || "Unable to complete this request.");
  return data;
}
const label = (value: string = "") =>
  value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (x) => x.toUpperCase());
const date = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
function Field({ name, label: caption, type = "text", ...props }: any) {
  return (
    <label className="field">
      <span>{caption}</span>
      <input name={name} type={type} {...props} />
    </label>
  );
}
function Empty({ title, children }: any) {
  return (
    <div className="empty">
      <HeartHandshake size={36} strokeWidth={1.2} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export default function Portal({ role }: { role: Role }) {
  const [user, setUser] = useState<any>(null),
    [ready, setReady] = useState(false),
    [tab, setTab] = useState("overview"),
    [menu, setMenu] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]),
    [parents, setParents] = useState<any[]>([]),
    [partners, setPartners] = useState<any[]>([]),
    [emergencies, setEmergencies] = useState<any[]>([]);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [connected, setConnected] = useState(false);
  const [modal, setModal] = useState(""),
    [editing, setEditing] = useState<any>(null),
    [signup, setSignup] = useState(false),
    [selectedParent, setSelectedParent] = useState("");
  const [vitals, setVitals] = useState<any[]>([]),
    [medications, setMedications] = useState<any[]>([]),
    [documents, setDocuments] = useState<any[]>([]),
    [audit, setAudit] = useState<any[]>([]),
    [settings, setSettings] = useState<any>({});
  useEffect(() => {
    if (!modal) return;
    const before = document.activeElement as HTMLElement;
    const dialog = document.querySelector(".dialog") as HTMLElement;
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input, select, a[href]",
        ) || [],
      );
    focusable()[0]?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) setModal("");
      if (e.key === "Tab") {
        const items = focusable();
        const first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handle);
      document.body.style.overflow = overflow;
      before?.focus();
    };
  }, [modal, busy]);
  const [waLogs, setWaLogs] = useState<any[]>([]),
    [integrations, setIntegrations] = useState<any>({});
  const [sharingLocation, setSharingLocation] = useState(false),
    [tracked, setTracked] = useState<any>(null);
  useEffect(() => {
    if (!sharingLocation || !user || role !== "PARTNER") return;
    if (!navigator.geolocation) {
      setError("Location access is not available on this device.");
      setSharingLocation(false);
      return;
    }
    const watch = navigator.geolocation.watchPosition(
      (position) => {
        api(`/partners/${user.id}/location`, {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }).catch((e) => setError(e.message));
      },
      (e) => {
        setError(e.message);
        setSharingLocation(false);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [sharingLocation, user, role]);
  useEffect(() => {
    if (modal !== "track" || !editing?.assigned_partner_id) return;
    let stopped = false;
    const load = () =>
      api(`/partners/${editing.assigned_partner_id}/location`)
        .then((d) => {
          if (!stopped) setTracked(d);
        })
        .catch((e) => setError(e.message));
    load();
    const timer = setInterval(load, 15000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [modal, editing]);
  const title =
    role === "CLIENT"
      ? "Your family, cared for."
      : role === "ADMIN"
        ? "Care, coordinated."
        : "Make care personal.";
  const nav =
    role === "CLIENT"
      ? [
          ["overview", "Overview", LayoutDashboard],
          ["parents", "My parents", Users],
          ["tasks", "Care requests", ClipboardList],
          ["health", "Health records", Activity],
        ]
      : role === "ADMIN"
        ? [
            ["overview", "Overview", LayoutDashboard],
            ["tasks", "Dispatch desk", ClipboardList],
            ["partners", "Care partners", Users],
            ["messages", "WhatsApp updates", Phone],
            ["security", "Safety & audit", ShieldCheck],
          ]
        : [
            ["overview", "Overview", LayoutDashboard],
            ["tasks", "My assignments", ClipboardList],
            ["profile", "My profile", Users],
          ];
  useEffect(() => {
    api("/auth/me")
      .then((d) => {
        if (d.user.role === role) setUser(d.user);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, [role]);
  async function refresh() {
    if (!user) return;
    setLoading(true);
    try {
      const t = await api("/tasks");
      setTasks(t);
      if (role === "CLIENT") {
        const p = await api("/parents");
        setParents(p);
        setSelectedParent((old) => old || p[0]?.id || "");
      }
      if (role === "ADMIN") {
        const [p, e, a, s, w, i] = await Promise.all([
          api("/partners"),
          api("/emergency/active"),
          api("/security/audit-logs"),
          api("/security/settings"),
          api("/whatsapp/logs"),
          api("/integrations/status"),
        ]);
        setWaLogs(w);
        setIntegrations(i);
        setPartners(p);
        setEmergencies(e);
        setAudit(a);
        setSettings(s);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (!user) return;
    refresh();
    let socket: WebSocket;
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    function connect() {
      socket = new WebSocket(
        `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws/events`,
      );
      socket.onopen = () => setConnected(true);
      socket.onmessage = (e) => {
        if (JSON.parse(e.data).type !== "CONNECTED") refresh();
      };
      socket.onclose = () => {
        setConnected(false);
        if (!stopped) timer = setTimeout(connect, 5000);
      };
    }
    connect();
    const interval = setInterval(refresh, 30000);
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearInterval(interval);
      socket?.close();
    };
  }, [user]);
  useEffect(() => {
    if (tab !== "health" || !selectedParent) return;
    Promise.all([
      api(`/parents/${selectedParent}/vitals`),
      api(`/parents/${selectedParent}/medications`),
      api(`/parents/${selectedParent}/documents`),
    ])
      .then(([v, m, d]) => {
        setVitals(v);
        setMedications(m);
        setDocuments(d);
      })
      .catch((e) => setError(e.message));
  }, [tab, selectedParent, notice]);
  async function action(
    path: string,
    body: any,
    success: string,
    method?: string,
  ) {
    setBusy(true);
    setError("");
    try {
      await api(path, body, method);
      setNotice(success);
      setModal("");
      setEditing(null);
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function authenticate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const data = await api(`/auth/${signup ? "register" : "login"}`, {
        ...f,
        role,
      });
      if (data.confirmationRequired) {
        setNotice(data.message);
        setSignup(false);
      } else setUser(data.user);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f: any = Object.fromEntries(new FormData(e.currentTarget));
    if (modal === "parent") {
      f.whatsappConsent = f.whatsappConsent === "on";
      f.coordinatesLat = Number(f.coordinatesLat);
      f.coordinatesLng = Number(f.coordinatesLng);
      await action(
        editing ? `/parents/${editing.id}` : "/parents",
        f,
        "Parent details saved.",
        editing ? "PUT" : "POST",
      );
    }
    if (modal === "booking")
      await action(
        "/tasks",
        { ...f, scheduledAt: new Date(f.scheduledAt).toISOString() },
        "Care request sent to operations.",
      );
    if (modal === "vital")
      await action(
        `/parents/${selectedParent}/vitals`,
        {
          ...f,
          bloodPressureSys: Number(f.bloodPressureSys),
          bloodPressureDia: Number(f.bloodPressureDia),
          pulse: Number(f.pulse),
          spo2: Number(f.spo2),
          bloodSugarType: "NONE",
        },
        "Health reading saved.",
      );
    if (modal === "medication")
      await action(
        `/parents/${selectedParent}/medications`,
        f,
        "Medication saved.",
      );
    if (modal === "document")
      await action(
        `/parents/${selectedParent}/documents`,
        f,
        "Document reference saved.",
      );
    if (modal === "review")
      await action(
        `/tasks/${editing.id}/review`,
        { rating: Number(f.rating), feedbackText: f.feedbackText, tags: [] },
        "Thank you. Your feedback has been saved.",
      );
    if (modal === "verifyPartner")
      await action(
        `/partners/${editing.user_id}/verification`,
        { verified: f.verified === "true", notes: f.notes },
        "Partner verification updated.",
      );
    if (modal === "assign")
      await action(`/tasks/${editing.id}/assign`, f, "Partner assigned.");
    if (modal === "resolve")
      await action(
        `/emergency/${editing.id}/resolve`,
        f,
        "Emergency marked resolved.",
      );
    if (modal === "sos")
      await action(
        "/emergency/sos",
        f,
        "Your alert has been sent to operations. Call local emergency services if immediate help is needed.",
      );
  }
  async function proof(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const file = form.get("photo") as File;
    if (!file || file.size > 6000000) {
      setError("Choose an image under 6 MB.");
      return;
    }
    setBusy(true);
    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 0,
          }),
      );
      if (position.coords.accuracy > 150)
        throw Error(
          "Location accuracy is too low. Move outdoors and try again.",
        );
      const imageBase64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const upload = await api("/upload", { imageBase64 });
      await action(
        `/tasks/${editing.id}/verify`,
        {
          stage: form.get("stage"),
          selfieImageUrl: upload.imageUrl,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        },
        "Proof submitted for operations review.",
      );
    } catch (e: any) {
      setError(e.message || "Camera and precise location access are required.");
    } finally {
      setBusy(false);
    }
  }
  function open(type: string, item?: any) {
    setError("");
    setEditing(item || null);
    setModal(type);
  }
  if (!ready)
    return (
      <div className="boot">
        <HeartHandshake />
        Loading your care workspace…
      </div>
    );
  if (!user)
    return (
      <div className="care-auth">
        <section className="auth-story">
          <a className="brand" href="/">
            <img src={logo} alt="" />
            FamilyHubs
          </a>
          <div className="story-copy">
            <img
              className="story-logo"
              src={logo}
              alt="FamilyHubs: a caring home for your parents"
            />
            <span className="eyebrow">A LITTLE CLOSER TO HOME</span>
            <h1>
              Distance changes.
              <br />
              Care stays close.
            </h1>
            <p>
              A thoughtful place to arrange everyday support for your parents in
              India, and keep every care update together.
            </p>
            <div className="story-line" />
            <div className="story-detail">
              <ShieldCheck />
              <div>
                <strong>One connected care team</strong>
                <span>
                  Family, operations and field partners, working together.
                </span>
              </div>
            </div>
            <div className="story-detail">
              <ClipboardList />
              <div>
                <strong>Clarity at every step</strong>
                <span>
                  Requests, visit proof and health records in one place.
                </span>
              </div>
            </div>
          </div>
          <footer>Care with dignity. Connection with purpose.</footer>
        </section>
        <section className="auth-form">
          <div className="portal-label">
            {role === "CLIENT"
              ? "Family workspace"
              : role === "ADMIN"
                ? "Operations workspace"
                : "Care partner workspace"}
          </div>
          <h2>{signup ? "Begin a little closer." : "Welcome back."}</h2>
          <p>
            {signup
              ? "Create your account. We’ll send an email to confirm it."
              : "Sign in to pick up where you left off."}
          </p>
          {error && (
            <div role="alert" className="message error">
              {error}
            </div>
          )}
          {notice && (
            <div role="status" className="message">
              {notice}
            </div>
          )}
          <form onSubmit={authenticate}>
            {signup && (
              <>
                <Field
                  name="fullName"
                  label="Full name"
                  required
                  autoComplete="name"
                />
                <Field
                  name="phone"
                  label="Phone number"
                  type="tel"
                  required
                  autoComplete="tel"
                />
                {role === "CLIENT" ? (
                  <Field
                    name="countryResidence"
                    label="Country of residence"
                    required
                  />
                ) : (
                  <Field
                    name="operatingRegion"
                    label="Operating city / region"
                    required
                  />
                )}
              </>
            )}
            <Field
              name="email"
              label="Email address"
              type="email"
              required
              autoComplete="email"
            />
            <Field
              name="password"
              label="Password"
              type="password"
              required
              minLength={signup ? 12 : 1}
              autoComplete={signup ? "new-password" : "current-password"}
            />
            {signup && (
              <small>
                Use at least 12 characters. Choose a unique password.
              </small>
            )}
            <button className="primary wide" disabled={busy}>
              {busy ? "Please wait…" : signup ? "Create account" : "Sign in"}
              <ArrowUpRight size={18} />
            </button>
          </form>
          {role !== "ADMIN" && (
            <p className="auth-switch">
              {signup ? "Already have an account?" : "New to FamilyHubs?"}{" "}
              <button
                onClick={() => {
                  setSignup(!signup);
                  setError("");
                }}
              >
                {signup ? "Sign in" : "Create an account"}
              </button>
            </p>
          )}
          <div className="auth-note">
            <ShieldCheck size={16} />
            Your account is verified through secure email confirmation.
          </div>
          <div className="portal-links">
            <a href="/">Family</a>
            <a href="/partner/">Care partners</a>
            <a href="/ops/">Operations</a>
          </div>
        </section>
      </div>
    );
  const active = tasks.filter(
    (t) => !["COMPLETED", "CANCELLED"].includes(t.status),
  );
  return (
    <div className="care-app">
      <aside className={menu ? "sidebar show" : "sidebar"}>
        <a className="brand" href="/">
          <img src={logo} alt="" />
          FamilyHubs
        </a>
        <span className="workspace-name">
          {role === "CLIENT"
            ? "FAMILY WORKSPACE"
            : role === "ADMIN"
              ? "OPERATIONS"
              : "CARE PARTNER"}
        </span>
        <nav>
          {nav.map(([id, text, Icon]: any) => (
            <button
              className={tab === id ? "selected" : ""}
              key={id}
              onClick={() => {
                setTab(id);
                setMenu(false);
                setError("");
              }}
            >
              <Icon size={19} />
              {text}
              {tab === id && <ChevronRight size={15} />}
            </button>
          ))}
        </nav>
        <div className="sidebar-care">
          <HeartHandshake size={28} />
          <h3>Care starts with people.</h3>
          <p>
            Every detail helps your care team offer more thoughtful support.
          </p>
        </div>
        <button
          className="account"
          onClick={async () => {
            await api("/auth/logout", {});
            setUser(null);
            setTab("overview");
          }}
        >
          <span className="avatar">{user.full_name?.[0] || "F"}</span>
          <span>
            <strong>{user.full_name}</strong>
            <small>{label(role)}</small>
          </span>
          <LogOut size={17} />
        </button>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            aria-label="Toggle navigation"
            onClick={() => setMenu(!menu)}
          >
            <Menu />
          </button>
          <span>{nav.find((n) => n[0] === tab)?.[1] as string}</span>
          <div className="top-actions">
            <span className={connected ? "connection live" : "connection"}>
              <i />
              {connected ? "Live connection" : "Reconnecting"}
            </span>
            <button
              className="icon-button"
              aria-label="Refresh records"
              disabled={loading}
              onClick={refresh}
            >
              <RefreshCw size={17} className={loading ? "spin" : ""} />
            </button>
            <span className="avatar small">{user.full_name?.[0]}</span>
          </div>
        </header>
        <main className="content">
          <div className="page-heading">
            <div>
              <p className="greeting">
                {new Intl.DateTimeFormat("en", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                }).format(new Date())}
              </p>
              <h1>
                {tab === "overview"
                  ? title
                  : (nav.find((n) => n[0] === tab)?.[1] as string)}
              </h1>
              <p>
                {role === "CLIENT"
                  ? "A clear view of the people who matter most."
                  : role === "ADMIN"
                    ? "Thoughtful support begins with a well-organized team."
                    : "Your next visit can make someone’s day."}
              </p>
            </div>
            {role === "CLIENT" && (
              <button
                className="primary"
                onClick={() => open(tab === "parents" ? "parent" : "booking")}
              >
                <Plus size={18} />
                {tab === "parents" ? "Add parent" : "Request care"}
              </button>
            )}
          </div>
          {error && (
            <div role="alert" className="message error">
              <AlertCircle size={18} />
              {error}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="message">
              <Check size={18} />
              {notice}
              <button
                aria-label="Dismiss notification"
                onClick={() => setNotice("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {tab === "overview" && (
            <>
              <section className="overview-grid">
                <div className="care-banner">
                  <div className="banner-mark">
                    <HeartHandshake size={42} strokeWidth={1} />
                  </div>
                  <span className="eyebrow">
                    {role === "CLIENT"
                      ? "YOUR CIRCLE OF CARE"
                      : "TODAY’S CARE DESK"}
                  </span>
                  <h2>
                    {active.length
                      ? `${active.length} care request${active.length === 1 ? "" : "s"} in motion.`
                      : "A fresh start for thoughtful care."}
                  </h2>
                  <p>
                    {role === "CLIENT"
                      ? "From the first request to the last update, keep your family’s care connected."
                      : "Keep the next step clear. Review your assignments and respond to the people waiting for you."}
                  </p>
                  <button
                    onClick={() =>
                      setTab(role === "CLIENT" ? "parents" : "tasks")
                    }
                  >
                    {role === "CLIENT"
                      ? "Meet your family circle"
                      : "Open care requests"}
                    <ArrowUpRight size={17} />
                  </button>
                </div>
                <div className="summary">
                  <div>
                    <span>Active requests</span>
                    <strong>{active.length.toString().padStart(2, "0")}</strong>
                    <ClipboardList size={20} />
                  </div>
                  <div>
                    <span>Completed visits</span>
                    <strong>
                      {tasks
                        .filter((t) => t.status === "COMPLETED")
                        .length.toString()
                        .padStart(2, "0")}
                    </strong>
                    <Check size={20} />
                  </div>
                  <div>
                    <span>
                      {role === "CLIENT"
                        ? "Parent profiles"
                        : role === "ADMIN"
                          ? "Care partners"
                          : "Assigned requests"}
                    </span>
                    <strong>
                      {(role === "CLIENT"
                        ? parents.length
                        : role === "ADMIN"
                          ? partners.length
                          : tasks.length
                      )
                        .toString()
                        .padStart(2, "0")}
                    </strong>
                    <Users size={20} />
                  </div>
                </div>
              </section>
              <section className="panel">
                <div className="section-title">
                  <div>
                    <h2>Care in progress</h2>
                    <p>The latest requests and their next steps.</p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setTab("tasks")}
                  >
                    View all
                    <ArrowUpRight size={16} />
                  </button>
                </div>
                {active.length ? (
                  <TaskList
                    tasks={active.slice(0, 4)}
                    role={role}
                    busy={busy}
                    action={action}
                    open={open}
                  />
                ) : (
                  <Empty title="Nothing waiting for you">
                    {role === "CLIENT"
                      ? "Add a parent profile, then request the support they need."
                      : "New assignments will appear here as they are created."}
                  </Empty>
                )}
              </section>
              {role === "CLIENT" && (
                <div className="help-strip">
                  <Phone size={20} />
                  <div>
                    <strong>Need urgent help?</strong>
                    <p>
                      Send an alert to operations. For immediate danger, contact
                      local emergency services directly.
                    </p>
                  </div>
                  <button
                    className="danger-outline"
                    onClick={() => open("sos")}
                  >
                    Send care alert
                  </button>
                </div>
              )}
              {role === "ADMIN" &&
                emergencies.map((e) => (
                  <div className="message error" key={e.id}>
                    <AlertCircle />
                    {e.parent_name}: {e.notes || "Emergency alert"}
                    <button onClick={() => open("resolve", e)}>
                      Review & resolve
                    </button>
                  </div>
                ))}
            </>
          )}
          {tab === "parents" && (
            <section className="parent-grid">
              {parents.length ? (
                parents.map((p) => (
                  <article className="parent-card" key={p.id}>
                    <div className="parent-monogram">{p.parent_name[0]}</div>
                    <h2>{p.parent_name}</h2>
                    <p>
                      <MapPin size={15} />
                      {p.locality}
                    </p>
                    <div className="parent-details">
                      <span>Home address</span>
                      <p>{p.full_address}</p>
                      <span>Phone</span>
                      <a href={`tel:${p.primary_phone}`}>{p.primary_phone}</a>
                      <span>Care notes</span>
                      <p>{p.medical_notes || "No care notes added."}</p>
                    </div>
                    <div className="row-actions">
                      <button onClick={() => open("parent", p)}>
                        Edit details
                      </button>
                      <button
                        onClick={() => {
                          setSelectedParent(p.id);
                          setTab("health");
                        }}
                      >
                        Health records
                        <ArrowUpRight size={15} />
                      </button>
                      <button
                        className="danger-text"
                        onClick={() => open("delete", p)}
                      >
                        Remove
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <div className="panel">
                  <Empty title="Let’s introduce your parents">
                    Add their contact details, address and care preferences to
                    get started.
                  </Empty>
                  <button
                    className="primary centered"
                    onClick={() => open("parent")}
                  >
                    <Plus size={18} />
                    Add your first parent
                  </button>
                </div>
              )}
            </section>
          )}
          {tab === "tasks" && (
            <section className="panel">
              <div className="section-title">
                <div>
                  <h2>
                    {role === "ADMIN"
                      ? "Dispatch & visit history"
                      : "All care requests"}
                  </h2>
                  <p>
                    {tasks.length} request{tasks.length === 1 ? "" : "s"} ·
                    Updates appear automatically
                  </p>
                </div>
              </div>
              {tasks.length ? (
                <TaskList
                  tasks={tasks}
                  role={role}
                  busy={busy}
                  action={action}
                  open={open}
                />
              ) : (
                <Empty title="No care requests yet">
                  {role === "CLIENT"
                    ? "Your care history will begin with your first request."
                    : "Requests will appear here when assigned."}
                </Empty>
              )}
              <div className="panel-foot">
                Payments and payouts are unavailable until a payment provider is
                connected. No funds are collected here.
              </div>
            </section>
          )}
          {tab === "health" && (
            <>
              <div className="health-toolbar">
                <label>
                  Parent{" "}
                  <select
                    value={selectedParent}
                    onChange={(e) => setSelectedParent(e.target.value)}
                  >
                    <option value="">Choose a parent</option>
                    {parents.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.parent_name}
                      </option>
                    ))}
                  </select>
                </label>
                {selectedParent && (
                  <div className="row-actions">
                    <button onClick={() => open("vital")}>Add reading</button>
                    <button onClick={() => open("medication")}>
                      Add medication
                    </button>
                    <button onClick={() => open("document")}>
                      Add document
                    </button>
                  </div>
                )}
              </div>
              {!selectedParent ? (
                <Empty title="Choose a parent">
                  Add a parent profile to manage their health records.
                </Empty>
              ) : (
                <div className="health-sections">
                  <section className="panel">
                    <div className="section-title">
                      <h2>Health readings</h2>
                      <Activity size={20} />
                    </div>
                    {vitals.length ? (
                      vitals.map((v) => (
                        <div className="record" key={v.id}>
                          <strong>
                            {v.blood_pressure_sys || "—"}/
                            {v.blood_pressure_dia || "—"} <small>mmHg</small>
                          </strong>
                          <span>
                            Pulse {v.pulse || "—"} · SpO₂ {v.spo2 || "—"}%
                          </span>
                          <small>{date(v.recorded_at)}</small>
                          <p>{v.notes}</p>
                        </div>
                      ))
                    ) : (
                      <Empty title="No readings recorded">
                        Save observations from a visit to build a health
                        history.
                      </Empty>
                    )}
                  </section>
                  <section className="panel">
                    <div className="section-title">
                      <h2>Medications</h2>
                      <ClipboardList size={20} />
                    </div>
                    {medications.length ? (
                      medications.map((m) => (
                        <div className="record" key={m.id}>
                          <strong>{m.medicine_name}</strong>
                          <span>
                            {m.dosage} · {m.frequency}
                          </span>
                          <small>{m.instructions}</small>
                          <button
                            className="text-button danger-text"
                            onClick={() =>
                              action(
                                `/parents/${selectedParent}/medications/${m.id}`,
                                {},
                                "Medication removed.",
                                "DELETE",
                              )
                            }
                          >
                            Remove
                          </button>
                        </div>
                      ))
                    ) : (
                      <Empty title="No medications added">
                        Keep the prescription schedule provided by your
                        clinician here.
                      </Empty>
                    )}
                  </section>
                  <section className="panel">
                    <div className="section-title">
                      <h2>Document references</h2>
                      <ShieldCheck size={20} />
                    </div>
                    {documents.length ? (
                      documents.map((d) => (
                        <div className="record" key={d.id}>
                          <strong>{d.title}</strong>
                          <span>{label(d.category)}</span>
                          {/^https:\/\//.test(d.file_url) && (
                            <a
                              href={d.file_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open document
                              <ArrowUpRight size={15} />
                            </a>
                          )}
                        </div>
                      ))
                    ) : (
                      <Empty title="No documents yet">
                        Add a secure document link for your care team.
                      </Empty>
                    )}
                  </section>
                </div>
              )}
            </>
          )}
          {tab === "partners" && (
            <section className="panel">
              <div className="section-title">
                <h2>Partner directory</h2>
                <span>{partners.length} partners</span>
              </div>
              {partners.length ? (
                partners.map((p) => (
                  <div className="record" key={p.user_id}>
                    <strong>
                      {p.user?.full_name || p.full_name || p.user_id}
                    </strong>
                    <span>
                      {p.operating_region} · {label(p.service_category)}
                    </span>
                    <small>
                      {p.kyc_verified
                        ? "Verification approved"
                        : "Verification pending"}{" "}
                      · {p.is_active ? "On duty" : "Off duty"}
                    </small>
                    <button onClick={() => open("verifyPartner", p)}>
                      Review verification
                    </button>
                  </div>
                ))
              ) : (
                <Empty title="Your team is taking shape">
                  Registered partners will appear here. Verification must be
                  completed before dispatch.
                </Empty>
              )}
            </section>
          )}
          {tab === "messages" && (
            <section className="panel">
              <div className="section-title">
                <div>
                  <h2>WhatsApp care updates</h2>
                  <p>
                    {integrations.whatsapp
                      ? "Provider connected. Status updates come from signed delivery webhooks."
                      : "Manual mode: open WhatsApp to review and send each care update yourself."}
                  </p>
                </div>
                <Phone size={20} />
              </div>
              {waLogs.length ? (
                waLogs.map((w) => (
                  <div className="record" key={w.id}>
                    <strong>
                      {w.tracking_code} ? {label(w.template_name)}
                    </strong>
                    <span>{w.recipient_phone}</span>
                    <span className="status">
                      {!integrations.whatsapp && w.status === "QUEUED"
                        ? "Manual send available"
                        : label(w.status)}
                    </span>
                    {w.error_code && <small>{label(w.error_code)}</small>}
                    {w.whatsapp_consent === 1 && (
                      <a
                        href={`https://wa.me/${String(w.whatsapp_phone || w.recipient_phone).replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`FamilyHubs ${w.tracking_code}: ${label(w.template_name)}. Please check your care workspace for details.`)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open WhatsApp
                        <ArrowUpRight size={15} />
                      </a>
                    )}
                    {w.status === "FAILED" && (
                      <button
                        disabled={busy || !integrations.whatsapp}
                        onClick={() =>
                          action(
                            `/whatsapp/resend/${w.id}`,
                            {},
                            "Message queued for another delivery attempt.",
                          )
                        }
                      >
                        Retry delivery
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <Empty title="No WhatsApp updates yet">
                  Care updates are queued as visits progress. A parent must opt
                  in before a message can be sent.
                </Empty>
              )}
            </section>
          )}
          {tab === "security" && (
            <>
              <section className="panel">
                <div className="section-title">
                  <div>
                    <h2>Platform safety</h2>
                    <p>Changes are recorded in the audit trail.</p>
                  </div>
                  <ShieldCheck />
                </div>
                <div className="record">
                  <strong>Emergency payout freeze</strong>
                  <span>
                    {settings.emergency_escrow_freeze === "1"
                      ? "Freeze is active"
                      : "Freeze is inactive"}
                  </span>
                  <button
                    className="danger-outline"
                    onClick={() =>
                      action(
                        "/security/freeze",
                        { enabled: settings.emergency_escrow_freeze !== "1" },
                        "Freeze setting updated.",
                      )
                    }
                  >
                    {" "}
                    {settings.emergency_escrow_freeze === "1"
                      ? "Disable freeze"
                      : "Enable freeze"}
                  </button>
                </div>
              </section>
              <section className="panel">
                <div className="section-title">
                  <h2>Audit trail</h2>
                </div>
                {audit.length ? (
                  audit.map((a) => (
                    <div key={a.id} className="record">
                      <strong>{label(a.event_type)}</strong>
                      <span>
                        {a.actor_role} · {a.severity}
                      </span>
                      <small>{date(a.created_at)}</small>
                    </div>
                  ))
                ) : (
                  <Empty title="No audit events">
                    Operational changes will be recorded here.
                  </Empty>
                )}
              </section>
            </>
          )}
          {tab === "profile" && (
            <section className="panel">
              <div className="section-title">
                <h2>Your care partner account</h2>
              </div>
              <div className="record">
                <strong>{user.full_name}</strong>
                <span>{user.email}</span>
                <span>{user.phone}</span>
                <p>
                  Partner verification is reviewed by operations before
                  assignments can be dispatched.
                </p>
                <button onClick={() => setSharingLocation(!sharingLocation)}>
                  {sharingLocation
                    ? "Stop sharing location"
                    : "Share live location"}
                </button>
                <button
                  className="primary"
                  onClick={() =>
                    action(
                      `/partners/${user.id}/duty`,
                      { isActive: true },
                      "You are now on duty.",
                    )
                  }
                >
                  Go on duty
                </button>
                <button
                  onClick={() =>
                    action(
                      `/partners/${user.id}/duty`,
                      { isActive: false },
                      "You are now off duty.",
                    )
                  }
                >
                  Go off duty
                </button>
              </div>
            </section>
          )}
          <footer className="workspace-footer">
            <img className="footer-logo" src={logo} alt="" />
            FamilyHubs<span>Care with dignity, every day.</span>
          </footer>
        </main>
      </div>
      {modal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setModal("");
          }}
        >
          <section
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
          >
            <div className="dialog-heading">
              <h2 id="dialog-title">
                {
                  {
                    parent: editing ? "Edit parent details" : "Add a parent",
                    booking: "Request thoughtful care",
                    vital: "Record a health reading",
                    medication: "Add medication",
                    document: "Add a document reference",
                    track: "Partner location",
                    review: "Share your visit feedback",
                    verifyPartner: "Review partner verification",
                    assign: "Assign a care partner",
                    proof: "Submit visit proof",
                    sos: "Send a care alert",
                    resolve: "Resolve care alert",
                    delete: "Remove parent profile",
                  }[modal]
                }
              </h2>
              <button
                className="icon-button"
                aria-label="Close dialog"
                onClick={() => setModal("")}
                disabled={busy}
              >
                <X size={20} />
              </button>
            </div>
            {error && (
              <div role="alert" className="message error">
                {error}
              </div>
            )}
            {modal === "delete" ? (
              <>
                <p>
                  Remove {editing.parent_name}? Profiles with care history
                  cannot be removed.
                </p>
                <button
                  className="danger-outline"
                  disabled={busy}
                  onClick={() =>
                    action(
                      `/parents/${editing.id}`,
                      {},
                      "Parent profile removed.",
                      "DELETE",
                    )
                  }
                >
                  Remove profile
                </button>
              </>
            ) : (
              <form onSubmit={modal === "proof" ? proof : save}>
                {modal === "track" && (
                  <div className="record">
                    {tracked?.updated_at && tracked?.latitude !== null ? (
                      <>
                        <strong>Last location shared</strong>
                        <span>
                          {Number(tracked.latitude).toFixed(5)},{" "}
                          {Number(tracked.longitude).toFixed(5)}
                        </span>
                        <small>{date(tracked.updated_at)}</small>
                        <a
                          href={`https://www.openstreetmap.org/?mlat=${tracked.latitude}&mlon=${tracked.longitude}#map=16/${tracked.latitude}/${tracked.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open location on map
                          <ArrowUpRight size={16} />
                        </a>
                        <p>
                          This is the last reported position. A timestamp older
                          than a few minutes may no longer reflect the partner?s
                          current location.
                        </p>
                      </>
                    ) : (
                      <p>
                        No location has been shared yet. The partner must enable
                        location sharing on their device.
                      </p>
                    )}
                  </div>
                )}
                {modal === "review" && (
                  <>
                    <label className="field">
                      <span>How was the visit?</span>
                      <select name="rating">
                        {[5, 4, 3, 2, 1].map((n) => (
                          <option value={n} key={n}>
                            {n} of 5
                          </option>
                        ))}
                      </select>
                    </label>
                    <Field name="feedbackText" label="Your feedback" required />
                  </>
                )}
                {modal === "parent" && (
                  <>
                    <Field
                      name="parentName"
                      label="Parent’s full name"
                      required
                      defaultValue={editing?.parent_name}
                    />
                    <Field
                      name="primaryPhone"
                      label="Phone number"
                      type="tel"
                      required
                      defaultValue={editing?.primary_phone}
                    />
                    <Field
                      name="whatsappPhone"
                      label="WhatsApp number (optional)"
                      type="tel"
                      defaultValue={editing?.whatsapp_phone}
                    />
                    <Field
                      name="locality"
                      label="City / locality"
                      required
                      defaultValue={editing?.locality}
                    />
                    <Field
                      name="fullAddress"
                      label="Full home address"
                      required
                      defaultValue={editing?.full_address}
                    />
                    <label className="consent">
                      <input
                        type="checkbox"
                        name="whatsappConsent"
                        defaultChecked={!!editing?.whatsapp_consent}
                      />
                      <span>
                        My parent has agreed to receive care updates on WhatsApp
                        at this number.
                      </span>
                    </label>
                    <div className="form-columns">
                      <Field
                        name="coordinatesLat"
                        label="Home latitude"
                        type="number"
                        step="any"
                        min="-90"
                        max="90"
                        required
                        defaultValue={editing?.coordinates_lat}
                      />
                      <Field
                        name="coordinatesLng"
                        label="Home longitude"
                        type="number"
                        step="any"
                        min="-180"
                        max="180"
                        required
                        defaultValue={editing?.coordinates_lng}
                      />
                    </div>
                    <small>
                      Use the home’s exact map coordinates. Visit verification
                      uses this location.
                    </small>
                    <Field
                      name="medicalNotes"
                      label="Care preferences / medical notes (optional)"
                      defaultValue={editing?.medical_notes}
                    />
                  </>
                )}
                {(modal === "booking" || modal === "sos") && (
                  <label className="field">
                    <span>Parent</span>
                    <select name="parentId" required>
                      <option value="">Choose a parent</option>
                      {parents.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.parent_name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {modal === "booking" && (
                  <>
                    <Field
                      name="title"
                      label="What support is needed?"
                      required
                      maxLength={160}
                    />
                    <label className="field">
                      <span>Service</span>
                      <select name="category">
                        <option value="ERRANDS">Everyday errands</option>
                        <option value="MEDICAL_TRANSPORT">
                          Medical accompaniment
                        </option>
                        <option value="HOME_MAINTENANCE">Home support</option>
                      </select>
                    </label>
                    <Field
                      name="scheduledAt"
                      label="Preferred date and time (your local time)"
                      type="datetime-local"
                      min={new Date(
                        Date.now() - new Date().getTimezoneOffset() * 60000,
                      )
                        .toISOString()
                        .slice(0, 16)}
                      required
                    />
                    <Field
                      name="instructions"
                      label="Details for your care team"
                      required
                    />
                    <p className="form-note">
                      Operations will review availability and confirm the visit.
                      No payment is taken when you send this request.
                    </p>
                  </>
                )}
                {modal === "sos" && (
                  <>
                    <p className="form-note">
                      This sends an alert to your operations team. It does not
                      dispatch an ambulance. Contact local emergency services
                      for immediate help.
                    </p>
                    <Field name="notes" label="What is happening?" required />
                  </>
                )}
                {modal === "vital" && (
                  <>
                    <div className="form-columns">
                      <Field
                        name="bloodPressureSys"
                        label="Systolic (mmHg)"
                        type="number"
                        min="40"
                        max="300"
                        required
                      />
                      <Field
                        name="bloodPressureDia"
                        label="Diastolic (mmHg)"
                        type="number"
                        min="20"
                        max="200"
                        required
                      />
                      <Field
                        name="pulse"
                        label="Pulse (bpm)"
                        type="number"
                        min="20"
                        max="250"
                        required
                      />
                      <Field
                        name="spo2"
                        label="SpO₂ (%)"
                        type="number"
                        min="1"
                        max="100"
                        required
                      />
                    </div>
                    <Field name="notes" label="Notes" />
                  </>
                )}
                {modal === "medication" && (
                  <>
                    <Field name="medicineName" label="Medicine name" required />
                    <Field name="dosage" label="Prescribed dose" required />
                    <Field name="frequency" label="Frequency" required />
                    <Field
                      name="instructions"
                      label="Clinician’s instructions"
                    />
                  </>
                )}
                {modal === "document" && (
                  <>
                    <Field name="title" label="Document title" required />
                    <Field
                      name="fileUrl"
                      label="Secure document URL"
                      type="url"
                      pattern="https://.*"
                      required
                    />
                    <label className="field">
                      <span>Category</span>
                      <select name="category">
                        {[
                          "PRESCRIPTION",
                          "LAB_REPORT",
                          "DISCHARGE_SUMMARY",
                          "SCAN",
                          "OTHER",
                        ].map((c) => (
                          <option key={c} value={c}>
                            {label(c)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="form-note">
                      Use a private link from your document provider. Anyone
                      with access to this record can open the link.
                    </p>
                  </>
                )}
                {modal === "verifyPartner" && (
                  <>
                    <p className="form-note">
                      Confirm identity and supporting documents through your
                      verification process before approval.
                    </p>
                    <label className="field">
                      <span>Decision</span>
                      <select name="verified">
                        <option value="false">Pending / not approved</option>
                        <option value="true">
                          Identity and documents reviewed
                        </option>
                      </select>
                    </label>
                    <Field
                      name="notes"
                      label="Review notes and evidence reference"
                      required
                    />
                  </>
                )}
                {modal === "assign" && (
                  <label className="field">
                    <span>Verified partner</span>
                    <select name="partnerId" required>
                      <option value="">Select an available partner</option>
                      {partners
                        .filter((p) => p.kyc_verified && p.is_active)
                        .map((p) => (
                          <option key={p.user_id} value={p.user_id}>
                            {p.user?.full_name || p.full_name || p.user_id} ·{" "}
                            {p.operating_region}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                {modal === "resolve" && (
                  <Field
                    name="resolutionNotes"
                    label="Resolution and follow-up notes"
                    required
                  />
                )}
                {modal === "proof" && (
                  <>
                    <label className="field">
                      <span>Visit stage</span>
                      <select name="stage">
                        <option value="ARRIVAL_CHECKIN">
                          Arrival check-in
                        </option>
                        <option value="TASK_COMPLETION">Task completion</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>Take a visit photo</span>
                      <input
                        name="photo"
                        type="file"
                        accept="image/jpeg,image/png"
                        capture="user"
                        required
                      />
                    </label>
                    <p className="form-note">
                      Precise device location is required. No substitute photos
                      or locations will be generated.
                    </p>
                  </>
                )}
                <div className="dialog-actions">
                  <button
                    type="button"
                    onClick={() => setModal("")}
                    disabled={busy}
                  >
                    Cancel
                  </button>
                  <button className="primary" disabled={busy}>
                    {busy
                      ? "Saving…"
                      : modal === "booking"
                        ? "Send care request"
                        : modal === "proof"
                          ? "Submit proof"
                          : "Save & continue"}
                    <ArrowUpRight size={17} />
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
function TaskList({ tasks, role, busy, action, open }: any) {
  return (
    <div className="task-list">
      {tasks.map((t: any) => (
        <article className="task-row" key={t.id}>
          <div className="task-symbol">
            <HeartHandshake size={22} />
          </div>
          <div className="task-description">
            <span className="task-meta">
              {label(t.category)} · {t.tracking_code}
            </span>
            <h3>{t.title}</h3>
            <p>
              {t.parent?.parent_name || t.parent_name || "Care visit"} ·{" "}
              {date(t.scheduled_at)}
            </p>
            <p>{t.instructions}</p>
            {t.verification_logs?.map((v: any) => (
              <a
                key={v.id}
                href={v.selfie_image_url}
                target="_blank"
                rel="noreferrer"
              >
                {label(v.stage)} photo · {v.distance_from_target_meters}m from
                home
              </a>
            ))}
          </div>
          <div className="task-state">
            <span className={`status status-${t.status}`}>
              {label(t.status)}
            </span>
            {role === "CLIENT" &&
              t.assigned_partner_id &&
              [
                "DISPATCHED",
                "ACCEPTED",
                "IN_PROGRESS",
                "VERIFICATION_SUBMITTED",
              ].includes(t.status) && (
                <button onClick={() => open("track", t)}>
                  <MapPin size={14} />
                  Partner location
                </button>
              )}
            {role === "CLIENT" && t.status === "COMPLETED" && !t.review && (
              <button onClick={() => open("review", t)}>Review visit</button>
            )}
            {role === "ADMIN" && t.status === "PENDING_OPS_REVIEW" && (
              <button onClick={() => open("assign", t)}>
                Assign partner
                <ArrowUpRight size={14} />
              </button>
            )}
            {role === "ADMIN" && t.status === "VERIFICATION_SUBMITTED" && (
              <button
                disabled={busy}
                onClick={() =>
                  action(
                    `/tasks/${t.id}/complete`,
                    {},
                    "Visit approved and completed. No funds transferred.",
                  )
                }
              >
                Approve visit
              </button>
            )}
            {role === "PARTNER" && t.status === "DISPATCHED" && (
              <button
                disabled={busy}
                onClick={() =>
                  action(`/tasks/${t.id}/accept`, {}, "Assignment accepted.")
                }
              >
                Accept request
              </button>
            )}
            {role === "PARTNER" &&
              ["ACCEPTED", "IN_PROGRESS"].includes(t.status) && (
                <button onClick={() => open("proof", t)}>
                  <Camera size={15} />
                  Submit visit proof
                </button>
              )}
          </div>
        </article>
      ))}
    </div>
  );
}
