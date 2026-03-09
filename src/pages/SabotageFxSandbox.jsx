import { useMemo, useState } from "react";
import "../styles/SabotageFxSandbox.css";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const SabotageFxSandbox = () => {
  const [enabled, setEnabled] = useState(true);
  const [intensity, setIntensity] = useState(72);
  const [pulseMs, setPulseMs] = useState(1300);

  const rootStyle = useMemo(
    () => ({
      "--sab-red-core": `rgba(255, 44, 44, ${clamp(intensity / 100, 0.2, 0.95).toFixed(2)})`,
      "--sab-red-soft": `rgba(255, 44, 44, ${clamp(intensity / 180, 0.1, 0.6).toFixed(2)})`,
      "--sab-pulse-ms": `${clamp(pulseMs, 450, 2400)}ms`,
    }),
    [intensity, pulseMs]
  );

  return (
    <div className={`sabfx-shell ${enabled ? "is-on" : ""}`} style={rootStyle}>
      <div className="sabfx-toolbar">
        <div className="sabfx-toolbar-title">Sabotage Effect Sandbox</div>
        <div className="sabfx-controls">
          <label className="sabfx-field">
            <span>Intensity</span>
            <input
              type="range"
              min="20"
              max="100"
              value={intensity}
              onChange={(e) => setIntensity(Number(e.target.value))}
            />
            <strong>{intensity}</strong>
          </label>
          <label className="sabfx-field">
            <span>Pulse</span>
            <input
              type="range"
              min="450"
              max="2400"
              step="50"
              value={pulseMs}
              onChange={(e) => setPulseMs(Number(e.target.value))}
            />
            <strong>{pulseMs}ms</strong>
          </label>
          <button
            type="button"
            className={`sabfx-toggle ${enabled ? "on" : ""}`}
            onClick={() => setEnabled((v) => !v)}
          >
            {enabled ? "Disable" : "Enable"} Effect
          </button>
        </div>
      </div>

      <div className="sabfx-stage">
        {enabled && (
          <div className="sabfx-mode-banner" role="status">
            SABOTAGE ON
          </div>
        )}
        <div className="sabfx-mock-row">
          <section className="sabfx-mock-panel sabfx-red">
            <h3>Red Team</h3>
            <p>Target canvas lock</p>
          </section>
          <section className="sabfx-mock-panel sabfx-blue">
            <h3>Blue Team</h3>
            <p>Attacker controls</p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default SabotageFxSandbox;
