import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

function parseTrackingList(raw) {
  return raw
    .split(/[\s,;]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export default function App() {
  const [raw, setRaw] = useState("");
  const [list, setList] = useState([]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [intervalMs, setIntervalMs] = useState(800);
  const [loop, setLoop] = useState(true);
  const [showText, setShowText] = useState(true);

  // 用于“自适应二维码尺寸”
  const [viewport, setViewport] = useState({
    w: window.innerWidth,
    h: window.innerHeight,
  });

  const timerRef = useRef(null);

  const parsedPreview = useMemo(() => parseTrackingList(raw), [raw]);
  const preview = parsedPreview.slice(0, 10);

  const current = list[idx] ?? "";

  // 让二维码大小随窗口变化：全屏时会更大
  useEffect(() => {
    const onResize = () =>
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // 根据视口动态计算二维码大小（你可以调比例）
  const qrSize = useMemo(() => {
    // 预留一些空间给文本/按钮
    const usable = Math.min(viewport.w, viewport.h) * 0.65;
    return Math.floor(clamp(usable, 260, 900));
  }, [viewport.w, viewport.h]);

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function startTimer() {
    stopTimer();
    timerRef.current = setInterval(() => {
      setIdx((prev) => {
        const next = prev + 1;
        if (next < list.length) return next;
        return loop ? 0 : prev;
      });
    }, intervalMs);
  }

  useEffect(() => {
    if (!playing) {
      stopTimer();
      return;
    }
    if (list.length <= 0) return;
    startTimer();
    return stopTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, intervalMs, list.length, loop]);

  function handleStart() {
    const arr = parseTrackingList(raw);
    setList(arr);
    setIdx(0);
    setPlaying(arr.length > 0);
  }

  function handleClear() {
    setRaw("");
    setList([]);
    setIdx(0);
    setPlaying(false);
  }

  function prevOne() {
    if (!list.length) return;
    setIdx((prev) => (prev - 1 + list.length) % list.length);
  }

  function nextOne() {
    if (!list.length) return;
    setIdx((prev) => {
      const next = prev + 1;
      if (next < list.length) return next;
      return loop ? 0 : prev;
    });
  }

  // 快捷键：Space 暂停/播放，←/→ 切换，F 全屏，+/- 调速度
  useEffect(() => {
    function onKeyDown(e) {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === "textarea" || tag === "input") return;

      if (e.code === "Space") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prevOne();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        nextOne();
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen?.();
        } else {
          document.exitFullscreen?.();
        }
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setIntervalMs((ms) => Math.max(150, ms - 100));
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        setIntervalMs((ms) => Math.min(5000, ms + 100));
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.length, loop]);

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <h2 style={styles.title}>QR Player (MVP)</h2>

        {/* 输入区 */}
        <div style={styles.inputGrid}>
          <div style={{ color: "#444" }}>
            从 Excel 复制运单号这一列，直接粘贴到下面（支持：换行 / 空格 / Tab /
            逗号 / 分号）
          </div>

          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={"例如：\n123456\n234567\n..."}
            rows={7}
            style={styles.textarea}
          />

          <div style={styles.rowWrap}>
            <button onClick={handleStart} style={styles.btnPrimary}>
              Start / Parse
            </button>
            <button onClick={handleClear} style={styles.btnSecondary}>
              Clear
            </button>

            <label style={styles.label}>
              每张停留(ms):
              <input
                type="number"
                value={intervalMs}
                min={150}
                max={5000}
                step={50}
                onChange={(e) => setIntervalMs(Number(e.target.value || 0))}
                style={styles.number}
              />
            </label>

            <label style={styles.label}>
              <input
                type="checkbox"
                checked={loop}
                onChange={(e) => setLoop(e.target.checked)}
              />
              循环播放
            </label>

            <label style={styles.label}>
              <input
                type="checkbox"
                checked={showText}
                onChange={(e) => setShowText(e.target.checked)}
              />
              显示运单号文本
            </label>
          </div>

          <div style={{ color: "#333" }}>
            识别预览：<b>{parsedPreview.length}</b> 条（显示前 10 条）
            <div style={styles.previewMono}>
              {preview.length === 0 ? (
                <div style={{ color: "#888" }}>（暂无）</div>
              ) : (
                preview.map((x, i) => (
                  <div key={i}>
                    {String(i + 1).padStart(2, "0")}. {x}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 播放区 */}
        <div style={styles.playerCard}>
          <div style={styles.playerHeader}>
            <button
              onClick={() => setPlaying((p) => !p)}
              disabled={list.length === 0}
              style={styles.btnPrimary}
            >
              {playing ? "Pause" : "Play"}
            </button>
            <button
              onClick={prevOne}
              disabled={list.length === 0}
              style={styles.btnSecondary}
            >
              Prev
            </button>
            <button
              onClick={nextOne}
              disabled={list.length === 0}
              style={styles.btnSecondary}
            >
              Next
            </button>

            <div style={{ marginLeft: "auto", color: "#444" }}>
              {list.length ? (
                <span>
                  进度：<b>{idx + 1}</b> / <b>{list.length}</b>
                </span>
              ) : (
                <span>尚未开始</span>
              )}
            </div>
          </div>

          {/* 关键：这里用 flex + minHeight，让二维码区域真正居中 */}
          <div style={styles.stage}>
            {list.length === 0 ? (
              <div style={{ color: "#888" }}>
                请先在上方粘贴运单号并点击 Start
              </div>
            ) : (
              <div style={styles.centerStack}>
                <QRCodeCanvas
                  value={current}
                  size={qrSize}
                  includeMargin
                  level="M"
                />
                {showText && <div style={styles.trackingText}>{current}</div>}
                <div style={styles.hint}>
                  快捷键：Space 播放/暂停 ｜ ←/→ 切换 ｜ F 全屏 ｜ +/- 调速度
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    width: "100%",
    padding: 16,
    fontFamily: "system-ui, -apple-system, Arial",
    boxSizing: "border-box",
    display: "flex",
    justifyContent: "center", // 水平居中整个内容
  },
  shell: {
    width: "100%",
    maxWidth: 900,
  },
  title: { margin: "8px 0 12px", textAlign: "center" },

  inputGrid: { display: "grid", gap: 10 },
  textarea: {
    width: "100%",
    padding: 12,
    fontSize: 14,
    borderRadius: 10,
    border: "1px solid #ccc",
    boxSizing: "border-box",
  },
  rowWrap: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
  label: { display: "flex", gap: 8, alignItems: "center", color: "#333" },
  number: {
    width: 110,
    padding: "6px 8px",
    borderRadius: 8,
    border: "1px solid #ccc",
  },
  previewMono: {
    marginTop: 6,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  },

  playerCard: {
    marginTop: 18,
    padding: 14,
    borderRadius: 14,
    border: "1px solid #ddd",
  },
  playerHeader: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },

  stage: {
    marginTop: 14,
    background: "white",
    borderRadius: 14,
    minHeight: 520,
    display: "flex",
    alignItems: "center", // 纵向居中
    justifyContent: "center", // 横向居中
    padding: 18,
    boxSizing: "border-box",
  },
  centerStack: { textAlign: "center" },
  trackingText: { marginTop: 10, fontSize: 20, fontWeight: 700 },
  hint: { marginTop: 6, color: "#666", fontSize: 12 },

  btnPrimary: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #222",
    background: "#222",
    color: "white",
    cursor: "pointer",
  },
  btnSecondary: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #aaa",
    background: "white",
    color: "#222",
    cursor: "pointer",
  },
};
