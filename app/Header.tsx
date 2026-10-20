type TabId = "blast" | "tree";

const TABS: { id: TabId; label: string }[] = [
  { id: "blast", label: "1. BLAST" },
  { id: "tree", label: "2. Phylogenetischer Baum" },
];

const SPIKE_COUNT = 14;

type Blob = {
  color: string;
  size: number;
  left: string;
  top: string;
  rotation: number;
  delay: number;
};

const BLOBS: Blob[] = [
  { color: "#E69F00", size: 180, left: "4%", top: "-30%", rotation: 10, delay: 0 },
  { color: "#0072B2", size: 135, left: "22%", top: "45%", rotation: 40, delay: -2 },
  { color: "#CC79A7", size: 225, left: "38%", top: "-45%", rotation: 70, delay: -4 },
  { color: "#009E73", size: 120, left: "52%", top: "50%", rotation: 20, delay: -1 },
  { color: "#D55E00", size: 195, left: "66%", top: "-20%", rotation: 55, delay: -3 },
  { color: "#56B4E9", size: 105, left: "80%", top: "55%", rotation: 5, delay: -5 },
  { color: "#CC79A7", size: 150, left: "90%", top: "-25%", rotation: 30, delay: -6 },
];

/** Page header with floating virus shapes behind the title and the two glass tabs. */
export default function Header(props: { tab: TabId; onTabChange: (tab: TabId) => void }) {
  return (
    <header className="relative" style={{ background: "#fef3e2" }}>
      <div className="absolute inset-0 overflow-hidden" aria-hidden>
        {BLOBS.map((blob, i) => (
          <VirusBlob key={i} blob={blob} />
        ))}
        <div
          className="absolute inset-0"
          style={{ backdropFilter: "blur(1.5px)", WebkitBackdropFilter: "blur(1.5px)" }}
        />
      </div>
      <div className="relative mx-auto max-w-5xl px-6 pt-5">
        <h1 className="mb-5 text-3xl font-bold text-neutral-900">Virus-Explorer</h1>
        <nav className="flex items-end gap-2">
          {TABS.map((t) => (
            <TabButton key={t.id} active={props.tab === t.id} onClick={() => props.onTabChange(t.id)}>
              {t.label}
            </TabButton>
          ))}
        </nav>
      </div>
    </header>
  );
}

/** The active tab is a white panel that opens into the page below; inactive tabs are frosted boxes. */
function TabButton(props: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  const active: React.CSSProperties = {
    background: "#fff",
    border: "none",
    color: "#000",
  };
  const plain: React.CSSProperties = {
    border: "none",
    background: "rgba(255,255,255,0.5)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    color: "#1f2328",
  };

  return (
    <button
      onClick={props.onClick}
      className="rounded-t-lg px-6 py-3 text-lg"
      style={props.active ? active : plain}
    >
      {/* an invisible bold copy reserves the bold width so switching tabs doesn't shift the layout */}
      <span className="grid">
        <span aria-hidden className="invisible col-start-1 row-start-1 font-bold">
          {props.children}
        </span>
        <span
          className="col-start-1 row-start-1"
          style={{ fontWeight: props.active ? 700 : 400 }}
        >
          {props.children}
        </span>
      </span>
    </button>
  );
}

function VirusBlob({ blob }: { blob: Blob }) {
  return (
    <svg
      viewBox="-50 -50 100 100"
      width={blob.size}
      height={blob.size}
      className="virus-blob absolute"
      style={{
        left: blob.left,
        top: blob.top,
        transform: `rotate(${blob.rotation}deg)`,
        animationDelay: `${blob.delay}s`,
        opacity: 0.9,
      }}
    >
      <g stroke={blob.color} strokeWidth={3} strokeLinecap="round">
        {Array.from({ length: SPIKE_COUNT }, (_, i) => {
          const angle = (2 * Math.PI * i) / SPIKE_COUNT;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          return (
            <g key={i}>
              <line x1={26 * cos} y1={26 * sin} x2={38 * cos} y2={38 * sin} />
              <circle cx={40 * cos} cy={40 * sin} r={4.5} fill={blob.color} />
            </g>
          );
        })}
      </g>
      <circle r={29} fill={blob.color} />
    </svg>
  );
}
