import { loadFont } from "@remotion/google-fonts/Inter";
import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Composition,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const { fontFamily } = loadFont();

const COLORS = {
  bg: "#F8FAFC",
  card: "#FFFFFF",
  border: "#E2E8F0",
  text: "#0F172A",
  muted: "#64748B",
  red: "#EF4444",
  green: "#10B981",
  caja: "#2563EB",
  counter: "#94A3B8",
  ringTrack: "#E2E8F0",
} as const;

/** ——— Timeline ——— */
const PHASE1_END = 630;
const BRIEF_BANNER_END = 720;
const SCALE_INTRO_END = 780;
const SCALE_SIM_END = 1380;
const TOTAL_DURATION = 1500; // 50s @ 30fps

const TOTAL_STUDENTS = 8;
const SIM_MINUTES_PHASE1 = 8;
const MOVE_FRAMES = 14;
const CIRCLE_SIZE = 72;
const SLOT_GAP = 96;
const SERVICE_X = 1480;

const SCALE_USERS = 300;
const SCALE_PWA_RATIO = 0.5; // same ~50% mix as Scenario B demo
const SCALE_A_MINUTES = SCALE_USERS * 1; // 300
const SCALE_B_MINUTES =
  SCALE_USERS * (1 - SCALE_PWA_RATIO) * 1 +
  SCALE_USERS * SCALE_PWA_RATIO * 0.5; // 225
const SCALE_GAP_MINUTES = SCALE_A_MINUTES - SCALE_B_MINUTES; // 75

type StudentType = "red" | "green";

type Student = {
  id: string;
  type: StudentType;
  initialIndex: number;
  serviceMinutes: number;
  startServiceAt: number;
  finishAt: number;
};

const SCENARIO_B_DISPLAY: StudentType[] = [
  "red",
  "green",
  "red",
  "red",
  "green",
  "red",
  "green",
  "green",
];

const serviceMinutesFor = (type: StudentType) => (type === "red" ? 1 : 0.5);

const buildQueue = (
  prefix: string,
  typesFrontToBack: StudentType[],
): Student[] => {
  let cursor = 0;
  return typesFrontToBack.map((type, initialIndex) => {
    const serviceMinutes = serviceMinutesFor(type);
    const startServiceAt = cursor;
    const finishAt = cursor + serviceMinutes;
    cursor = finishAt;
    return {
      id: `${prefix}-${initialIndex}`,
      type,
      initialIndex,
      serviceMinutes,
      startServiceAt,
      finishAt,
    };
  });
};

const scenarioA = buildQueue(
  "a",
  Array.from({ length: TOTAL_STUDENTS }, () => "red" as StudentType),
);

const scenarioB = buildQueue("b", [...SCENARIO_B_DISPLAY].reverse());

const framesPerSimMinute = PHASE1_END / SIM_MINUTES_PHASE1;
const simToFrame = (simMinutes: number) => simMinutes * framesPerSimMinute;

const formatClock = (simMinutes: number) => {
  const totalSeconds = Math.max(0, Math.round(simMinutes * 60));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const mins = m % 60;
    return `${h}h ${String(mins).padStart(2, "0")}m`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const formatMinutesLabel = (minutes: number) => {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return m === 0 ? `${h}h 00min` : `${h}h ${String(m).padStart(2, "0")}min`;
  }
  return `${minutes} min`;
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

const slotToX = (slot: number) => SERVICE_X - slot * SLOT_GAP;

const animatedX = (
  student: Student,
  peers: Student[],
  frame: number,
  fps: number,
): number => {
  const events: { frame: number; slot: number }[] = [
    { frame: 0, slot: student.initialIndex },
  ];

  for (let i = 0; i < student.initialIndex; i++) {
    const peer = peers.find((p) => p.initialIndex === i);
    if (!peer) continue;
    events.push({
      frame: Math.round(simToFrame(peer.finishAt)),
      slot: student.initialIndex - (i + 1),
    });
  }

  events.push({
    frame: Math.round(simToFrame(student.startServiceAt)),
    slot: 0,
  });

  const unique = events
    .sort((a, b) => a.frame - b.frame)
    .filter((e, idx, arr) => idx === 0 || e.frame !== arr[idx - 1].frame);

  if (frame < unique[0].frame) {
    return slotToX(unique[0].slot);
  }

  for (let i = 0; i < unique.length - 1; i++) {
    const from = unique[i];
    const to = unique[i + 1];
    if (frame >= from.frame && frame < to.frame) {
      const moveStart = Math.max(from.frame, to.frame - MOVE_FRAMES);
      if (frame < moveStart) {
        return slotToX(from.slot);
      }
      const progress = spring({
        frame: frame - moveStart,
        fps,
        config: { damping: 18, stiffness: 120, mass: 0.7 },
      });
      return interpolate(progress, [0, 1], [slotToX(from.slot), slotToX(to.slot)]);
    }
  }

  const last = unique[unique.length - 1];
  const settle = spring({
    frame: Math.max(0, frame - last.frame),
    fps,
    config: { damping: 18, stiffness: 120, mass: 0.7 },
  });
  const prevSlot =
    unique.length > 1 ? unique[unique.length - 2].slot : last.slot;
  return interpolate(settle, [0, 1], [slotToX(prevSlot), slotToX(last.slot)]);
};

const GlobalClock: React.FC<{
  simMinutes: number;
  label?: string;
  accent?: string;
}> = ({ simMinutes, label = "Tiempo simulado", accent }) => {
  return (
    <div
      style={{
        position: "absolute",
        top: 28,
        right: 40,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 4,
        zIndex: 20,
      }}
    >
      <span
        style={{
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: 1.2,
          color: accent ?? COLORS.muted,
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <div
        style={{
          fontSize: 52,
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          color: COLORS.text,
          lineHeight: 1,
          background: COLORS.card,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 16,
          padding: "12px 22px",
          boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
        }}
      >
        {formatClock(simMinutes)}
      </div>
    </div>
  );
};

const CounterAndRegister: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const counterW = compact ? 160 : 220;
  const caja = compact ? 64 : 88;
  return (
    <div
      style={{
        position: "absolute",
        right: compact ? 32 : 48,
        top: "50%",
        translate: "0 -50%",
        display: "flex",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: counterW,
          height: compact ? 40 : 56,
          background: COLORS.counter,
          borderRadius: 8,
          opacity: 0.95,
        }}
      />
      <div
        style={{
          width: caja,
          height: caja,
          background: COLORS.caja,
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginLeft: -4,
          boxShadow: "0 10px 24px rgba(37, 99, 235, 0.35)",
        }}
      >
        <span
          style={{
            color: "white",
            fontWeight: 700,
            fontSize: compact ? 13 : 16,
            letterSpacing: 1,
          }}
        >
          CAJA
        </span>
      </div>
    </div>
  );
};

const ProgressRing: React.FC<{
  progress: number;
  color: string;
  size: number;
}> = ({ progress, color, size }) => {
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamp01(progress));

  return (
    <svg
      width={size}
      height={size}
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        translate: "-50% -50%",
        rotate: "-90deg",
        pointerEvents: "none",
      }}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={COLORS.ringTrack}
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
      />
    </svg>
  );
};

const StudentCircle: React.FC<{
  student: Student;
  peers: Student[];
  frame: number;
  fps: number;
  showSavings?: boolean;
  savingsLabel?: string;
}> = ({ student, peers, frame, fps, showSavings, savingsLabel }) => {
  const finished = frame >= simToFrame(student.finishAt);
  const serving = frame >= simToFrame(student.startServiceAt) && !finished;
  const serviceProgress = serving
    ? clamp01(
        (frame - simToFrame(student.startServiceAt)) /
          (simToFrame(student.finishAt) - simToFrame(student.startServiceAt)),
      )
    : 0;

  const x = animatedX(student, peers, frame, fps);

  const exitProgress = finished
    ? spring({
        frame: frame - Math.round(simToFrame(student.finishAt)),
        fps,
        config: { damping: 200 },
      })
    : 0;

  const opacity = finished ? interpolate(exitProgress, [0, 1], [1, 0]) : 1;

  const scale = finished
    ? interpolate(exitProgress, [0, 1], [1, 0.6], {
        easing: Easing.out(Easing.cubic),
      })
    : serving
      ? interpolate(
          spring({
            frame: frame - Math.round(simToFrame(student.startServiceAt)),
            fps,
            config: { damping: 14, stiffness: 160 },
          }),
          [0, 1],
          [1, 1.08],
        )
      : 1;

  const color = student.type === "red" ? COLORS.red : COLORS.green;
  const timeLabel = student.type === "red" ? "1:00 min" : "0:30 seg";

  if (opacity < 0.01) {
    return null;
  }

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: "50%",
        translate: `${x}px -50%`,
        opacity,
        scale,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: CIRCLE_SIZE,
        marginLeft: -CIRCLE_SIZE / 2,
      }}
    >
      {showSavings && savingsLabel && !finished ? (
        <div
          style={{
            position: "absolute",
            top: -42,
            whiteSpace: "nowrap",
            background: "#ECFDF5",
            color: "#047857",
            border: "1px solid #A7F3D0",
            borderRadius: 999,
            padding: "4px 10px",
            fontSize: 13,
            fontWeight: 700,
            boxShadow: "0 4px 12px rgba(16, 185, 129, 0.2)",
            opacity: interpolate(
              frame,
              [Math.round(simToFrame(2.5)), Math.round(simToFrame(3))],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            ),
          }}
        >
          {savingsLabel}
        </div>
      ) : null}

      <div
        style={{
          width: CIRCLE_SIZE,
          height: CIRCLE_SIZE,
          borderRadius: "50%",
          background: color,
          position: "relative",
          boxShadow: serving
            ? `0 0 0 4px ${color}22, 0 12px 28px ${color}55`
            : `0 8px 18px ${color}40`,
        }}
      >
        {serving ? (
          <ProgressRing
            progress={serviceProgress}
            color={color}
            size={CIRCLE_SIZE + 18}
          />
        ) : null}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontWeight: 700,
            fontSize: 18,
          }}
        >
          {student.type === "red" ? "P" : "QR"}
        </div>
      </div>
      <div
        style={{
          marginTop: 10,
          fontSize: 14,
          fontWeight: 600,
          color: COLORS.muted,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {timeLabel}
      </div>
    </div>
  );
};

const ScenarioPanel: React.FC<{
  title: string;
  subtitle: string;
  students: Student[];
  frame: number;
  fps: number;
  accent: string;
  highlightLastRed?: boolean;
}> = ({
  title,
  subtitle,
  students,
  frame,
  fps,
  accent,
  highlightLastRed,
}) => {
  const lastRed = useMemo(() => {
    const reds = students.filter((s) => s.type === "red");
    return reds[reds.length - 1];
  }, [students]);

  const lastRedA = scenarioA[scenarioA.length - 1];
  const waitSavedMin =
    lastRed && lastRedA
      ? lastRedA.startServiceAt - lastRed.startServiceAt
      : 0;

  return (
    <div
      style={{
        flex: 1,
        background: COLORS.card,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 20,
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 6,
          background: accent,
        }}
      />

      <div style={{ padding: "22px 28px 0 28px" }}>
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: COLORS.text,
            marginBottom: 4,
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 15, color: COLORS.muted, fontWeight: 500 }}>
          {subtitle}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
        }}
      >
        <CounterAndRegister />
        {students.map((student) => (
          <StudentCircle
            key={student.id}
            student={student}
            peers={students}
            frame={frame}
            fps={fps}
            showSavings={
              Boolean(highlightLastRed) && student.id === lastRed?.id
            }
            savingsLabel={
              waitSavedMin > 0
                ? `−${waitSavedMin}:00 min menos de espera`
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
};

const BriefBanner: React.FC<{ frame: number; fps: number }> = ({
  frame,
  fps,
}) => {
  if (frame < PHASE1_END || frame >= BRIEF_BANNER_END) {
    return null;
  }

  const appear = spring({
    frame: frame - PHASE1_END,
    fps,
    config: { damping: 18, stiffness: 90 },
  });
  const fadeOut = interpolate(
    frame,
    [BRIEF_BANNER_END - 25, BRIEF_BANNER_END],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <div
      style={{
        position: "absolute",
        left: 48,
        right: 48,
        bottom: 36,
        opacity: appear * fadeOut,
        translate: `0 ${interpolate(appear, [0, 1], [40, 0])}px`,
        background: "rgba(15, 23, 42, 0.88)",
        backdropFilter: "blur(10px)",
        borderRadius: 18,
        padding: "22px 28px",
        color: "white",
        zIndex: 30,
        boxShadow: "0 20px 50px rgba(15, 23, 42, 0.35)",
      }}
    >
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          marginBottom: 8,
          lineHeight: 1.35,
        }}
      >
        Con 8 estudiantes:{" "}
        <span style={{ color: "#FCA5A5" }}>8:00 min (Sin App)</span>
        {"  vs  "}
        <span style={{ color: "#6EE7B7" }}>6:00 min (Con PWA)</span>
      </div>
      <div style={{ fontSize: 16, color: "#CBD5E1", fontWeight: 500 }}>
        Ahora escalamos a 300 estudiantes — misma fila única, sin prioridad.
      </div>
    </div>
  );
};

const Legend: React.FC = () => {
  return (
    <div
      style={{
        display: "flex",
        gap: 24,
        alignItems: "center",
        marginTop: 8,
      }}
    >
      {[
        { color: COLORS.red, label: "Pago presencial en caja (P)" },
        { color: COLORS.green, label: "Pedido PWA / QR listo (QR)" },
      ].map((item) => (
        <div
          key={item.label}
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: item.color,
            }}
          />
          <span style={{ fontSize: 13, color: COLORS.muted, fontWeight: 500 }}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
};

/** Deterministic mix for scale phase (~50% green), interleaved */
const scaleTypeAt = (index: number, mixed: boolean): StudentType => {
  if (!mixed) return "red";
  // Interleave without priority: R G R G … with slight clustering like the demo
  const pattern: StudentType[] = [
    "red",
    "green",
    "red",
    "red",
    "green",
    "red",
    "green",
    "green",
  ];
  return pattern[index % pattern.length];
};

const servedCountAt = (
  simMinutes: number,
  totalMinutes: number,
  totalUsers: number,
) => {
  const ratio = clamp01(simMinutes / totalMinutes);
  return Math.min(totalUsers, Math.floor(ratio * totalUsers + 1e-6));
};

const StreamDots: React.FC<{
  served: number;
  total: number;
  mixed: boolean;
  localFrame: number;
  done: boolean;
}> = ({ served, total, mixed, localFrame, done }) => {
  const remaining = Math.max(0, total - served);
  const visible = Math.min(28, remaining);
  const pulse = (localFrame % 8) / 8;

  return (
    <div
      style={{
        position: "absolute",
        left: 40,
        right: 280,
        top: "58%",
        height: 36,
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 6,
        opacity: done ? 0.35 : 1,
      }}
    >
      {Array.from({ length: visible }).map((_, i) => {
        const queueIndex = remaining - visible + i;
        const type = scaleTypeAt(Math.max(0, queueIndex), mixed);
        const color = type === "red" ? COLORS.red : COLORS.green;
        const drift = interpolate(pulse, [0, 1], [0, 4]);
        return (
          <div
            key={i}
            style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: color,
              opacity:
                visible <= 1
                  ? 1
                  : interpolate(i, [0, visible - 1], [0.45, 1]),
              translate: `${drift}px 0`,
              boxShadow: `0 2px 6px ${color}55`,
            }}
          />
        );
      })}
      {remaining > visible ? (
        <span
          style={{
            marginLeft: 8,
            fontSize: 13,
            fontWeight: 700,
            color: COLORS.muted,
            whiteSpace: "nowrap",
          }}
        >
          +{remaining - visible}
        </span>
      ) : null}
    </div>
  );
};

const ScaleScenarioRow: React.FC<{
  title: string;
  subtitle: string;
  accent: string;
  mixed: boolean;
  totalMinutes: number;
  simMinutes: number;
  localFrame: number;
  showFinishedBadge?: boolean;
}> = ({
  title,
  subtitle,
  accent,
  mixed,
  totalMinutes,
  simMinutes,
  localFrame,
  showFinishedBadge,
}) => {
  const served = servedCountAt(simMinutes, totalMinutes, SCALE_USERS);
  const progress = clamp01(simMinutes / totalMinutes);
  const done = served >= SCALE_USERS;
  const elapsed = Math.min(simMinutes, totalMinutes);

  const badgeSpring = spring({
    frame: Math.max(0, localFrame - Math.round((SCALE_B_MINUTES / SCALE_A_MINUTES) * (SCALE_SIM_END - SCALE_INTRO_END))),
    fps: 30,
    config: { damping: 16, stiffness: 100 },
  });

  return (
    <div
      style={{
        flex: 1,
        background: COLORS.card,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 20,
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
        padding: "20px 28px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 6,
          background: accent,
        }}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          paddingRight: 8,
        }}
      >
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.text }}>
            {title}
          </div>
          <div style={{ fontSize: 15, color: COLORS.muted, fontWeight: 500 }}>
            {subtitle}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: 34,
              fontWeight: 800,
              fontVariantNumeric: "tabular-nums",
              color: accent,
              lineHeight: 1,
            }}
          >
            {served}
            <span style={{ fontSize: 18, color: COLORS.muted, fontWeight: 600 }}>
              {" "}
              / {SCALE_USERS}
            </span>
          </div>
          <div style={{ fontSize: 13, color: COLORS.muted, fontWeight: 600 }}>
            atendidos · {formatMinutesLabel(Math.round(elapsed))}
          </div>
        </div>
      </div>

      <div
        style={{
          height: 16,
          background: "#F1F5F9",
          borderRadius: 999,
          overflow: "hidden",
          border: `1px solid ${COLORS.border}`,
        }}
      >
        <div
          style={{
            width: `${progress * 100}%`,
            height: "100%",
            background: `linear-gradient(90deg, ${accent}cc, ${accent})`,
            borderRadius: 999,
          }}
        />
      </div>

      <div
        style={{
          flex: 1,
          position: "relative",
          minHeight: 110,
          background: "#F8FAFC",
          borderRadius: 14,
          border: `1px dashed ${COLORS.border}`,
        }}
      >
        <CounterAndRegister compact />
        <StreamDots
          served={served}
          total={SCALE_USERS}
          mixed={mixed}
          localFrame={localFrame}
          done={done}
        />
        {done ? (
          <div
            style={{
              position: "absolute",
              left: 28,
              top: "50%",
              translate: "0 -50%",
              background: "#ECFDF5",
              color: "#047857",
              border: "1px solid #A7F3D0",
              borderRadius: 999,
              padding: "8px 14px",
              fontSize: 15,
              fontWeight: 700,
            }}
          >
            ✓ Fila completada
          </div>
        ) : null}
        {showFinishedBadge && done ? (
          <div
            style={{
              position: "absolute",
              right: 120,
              top: 16,
              opacity: badgeSpring,
              scale: interpolate(badgeSpring, [0, 1], [0.9, 1]),
              background: "#FEF3C7",
              color: "#B45309",
              border: "1px solid #FCD34D",
              borderRadius: 12,
              padding: "10px 14px",
              fontSize: 14,
              fontWeight: 700,
              maxWidth: 280,
              lineHeight: 1.35,
              boxShadow: "0 8px 20px rgba(180, 83, 9, 0.15)",
            }}
          >
            B ya terminó. En A aún faltan ~{SCALE_GAP_MINUTES} min de atención.
          </div>
        ) : null}
      </div>
    </div>
  );
};

const ScalePhase: React.FC<{ frame: number; fps: number }> = ({
  frame,
  fps,
}) => {
  const introLocal = frame - BRIEF_BANNER_END;
  const simLocal = frame - SCALE_INTRO_END;

  const introOpacity = interpolate(
    frame,
    [BRIEF_BANNER_END, BRIEF_BANNER_END + 20, SCALE_INTRO_END - 10, SCALE_INTRO_END],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const simOpacity = interpolate(
    frame,
    [SCALE_INTRO_END - 5, SCALE_INTRO_END + 15],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const simMinutes = interpolate(
    frame,
    [SCALE_INTRO_END, SCALE_SIM_END],
    [0, SCALE_A_MINUTES],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.linear,
    },
  );

  const finalBanner = frame >= SCALE_SIM_END;
  const finalAppear = spring({
    frame: frame - SCALE_SIM_END,
    fps,
    config: { damping: 18, stiffness: 90 },
  });

  const bDone = simMinutes >= SCALE_B_MINUTES;

  return (
    <AbsoluteFill style={{ fontFamily }}>
      {/* Intro card */}
      {frame >= BRIEF_BANNER_END && frame < SCALE_INTRO_END + 20 ? (
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: introOpacity,
            zIndex: 5,
          }}
        >
          <div
            style={{
              background: COLORS.card,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 24,
              padding: "36px 48px",
              textAlign: "center",
              boxShadow: "0 24px 60px rgba(15, 23, 42, 0.12)",
              translate: `0 ${interpolate(
                spring({
                  frame: Math.max(0, introLocal),
                  fps,
                  config: { damping: 16, stiffness: 100 },
                }),
                [0, 1],
                [24, 0],
              )}px`,
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: 1.4,
                textTransform: "uppercase",
                color: COLORS.caja,
                marginBottom: 10,
              }}
            >
              Escalando la simulación
            </div>
            <div style={{ fontSize: 40, fontWeight: 800, color: COLORS.text }}>
              300 estudiantes en cada escenario
            </div>
            <div
              style={{
                marginTop: 12,
                fontSize: 18,
                color: COLORS.muted,
                fontWeight: 500,
              }}
            >
              Misma fila única · 50% adopción PWA · acelerado para ver el gap
            </div>
          </div>
        </AbsoluteFill>
      ) : null}

      {/* Scale simulation UI */}
      {frame >= SCALE_INTRO_END - 10 ? (
        <AbsoluteFill
          style={{
            opacity: simOpacity,
            padding: "28px 40px 48px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ marginBottom: 14, maxWidth: 1100, paddingRight: 280 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: 1.4,
                textTransform: "uppercase",
                color: COLORS.caja,
                marginBottom: 6,
              }}
            >
              SIGAP · Simulación a escala
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>
              300 usuarios: la ventaja se multiplica sin saltarse turnos
            </div>
            <Legend />
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              flex: 1,
              minHeight: 0,
              paddingBottom: finalBanner ? 150 : 0,
            }}
          >
            <ScaleScenarioRow
              title="ESCENARIO A — Sin App"
              subtitle="100% pago presencial · 1:00 min c/u"
              accent={COLORS.red}
              mixed={false}
              totalMinutes={SCALE_A_MINUTES}
              simMinutes={simMinutes}
              localFrame={Math.max(0, simLocal)}
              showFinishedBadge={false}
            />
            <ScaleScenarioRow
              title="ESCENARIO B — Con PWA (fila única)"
              subtitle="~50% QR (0:30) intercalados · sin prioridad"
              accent={COLORS.green}
              mixed
              totalMinutes={SCALE_B_MINUTES}
              simMinutes={Math.min(simMinutes, SCALE_B_MINUTES)}
              localFrame={Math.max(0, simLocal)}
              showFinishedBadge={bDone && !finalBanner}
            />
          </div>

          <GlobalClock
            simMinutes={simMinutes}
            label="Tiempo simulado (acelerado)"
            accent={bDone ? COLORS.green : COLORS.muted}
          />
        </AbsoluteFill>
      ) : null}

      {finalBanner ? (
        <div
          style={{
            position: "absolute",
            left: 48,
            right: 48,
            bottom: 36,
            opacity: finalAppear,
            translate: `0 ${interpolate(finalAppear, [0, 1], [40, 0])}px`,
            background: "rgba(15, 23, 42, 0.92)",
            backdropFilter: "blur(10px)",
            borderRadius: 18,
            padding: "24px 28px",
            color: "white",
            zIndex: 40,
            boxShadow: "0 20px 50px rgba(15, 23, 42, 0.35)",
          }}
        >
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              marginBottom: 10,
              lineHeight: 1.35,
            }}
          >
            300 estudiantes:{" "}
            <span style={{ color: "#FCA5A5" }}>
              {formatMinutesLabel(SCALE_A_MINUTES)} (Sin App)
            </span>
            {"  vs  "}
            <span style={{ color: "#6EE7B7" }}>
              {formatMinutesLabel(SCALE_B_MINUTES)} (Con PWA)
            </span>
            {"  →  "}
            <span style={{ color: "#FDE68A" }}>
              {SCALE_GAP_MINUTES} min de diferencia
            </span>
          </div>
          <div style={{ fontSize: 16, color: "#CBD5E1", fontWeight: 500 }}>
            A mayor adopción de la PWA, menor tiempo promedio en caja — y quienes
            pagan presencial también terminan antes, sin perder su turno en la
            fila única.
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const PhaseOne: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const simMinutes = interpolate(frame, [0, PHASE1_END], [0, SIM_MINUTES_PHASE1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ fontFamily }}>
      <AbsoluteFill
        style={{
          padding: "28px 40px 48px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ opacity: titleOpacity, marginBottom: 18, maxWidth: 1200 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: 1.4,
              textTransform: "uppercase",
              color: COLORS.caja,
              marginBottom: 6,
            }}
          >
            SIGAP · Factibilidad operativa
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.2 }}>
            Fila única sin prioridad: la PWA acelera sin saltarse turnos
          </div>
          <Legend />
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
            flex: 1,
            minHeight: 0,
            marginTop: 8,
            paddingBottom: frame >= PHASE1_END ? 130 : 0,
          }}
        >
          <ScenarioPanel
            title="ESCENARIO A: Fila Tradicional — Sin App"
            subtitle="Sin PWA (100% Pago Presencial)"
            students={scenarioA}
            frame={frame}
            fps={fps}
            accent={COLORS.red}
          />
          <ScenarioPanel
            title="ESCENARIO B: Fila Única con PWA — Sin Prioridad"
            subtitle="Con PWA (Una sola fila, sin saltarse turnos)"
            students={scenarioB}
            frame={frame}
            fps={fps}
            accent={COLORS.green}
            highlightLastRed
          />
        </div>
      </AbsoluteFill>

      <GlobalClock simMinutes={simMinutes} />
      <BriefBanner frame={frame} fps={fps} />
    </AbsoluteFill>
  );
};

export const FeasibilityDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const phase1Opacity = interpolate(
    frame,
    [BRIEF_BANNER_END - 15, BRIEF_BANNER_END + 10],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        background: COLORS.bg,
        fontFamily,
        color: COLORS.text,
      }}
    >
      {frame < BRIEF_BANNER_END + 15 ? (
        <AbsoluteFill style={{ opacity: phase1Opacity }}>
          <PhaseOne frame={frame} fps={fps} />
        </AbsoluteFill>
      ) : null}

      {frame >= BRIEF_BANNER_END ? (
        <ScalePhase frame={frame} fps={fps} />
      ) : null}
    </AbsoluteFill>
  );
};

export const MyComposition = () => {
  return (
    <Composition
      id="CafeteriaPWA"
      component={FeasibilityDemo}
      durationInFrames={TOTAL_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
