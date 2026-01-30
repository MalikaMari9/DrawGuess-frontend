export default function EventLog({ items, onClear }) {
  return (
    <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <b>Event Log</b>
        <button onClick={onClear}>Clear</button>
      </div>

      <div
        style={{
          height: 260,
          overflow: "auto",
          background: "#111",
          color: "#eee",
          padding: 10,
          borderRadius: 6,
          fontFamily: "monospace",
          fontSize: 12,
        }}
      >
        {items.length === 0 ? (
          <div style={{ opacity: 0.7 }}>(empty)</div>
        ) : (
          items.map((x, i) => (
            <div key={i} style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              [{x.t}] {x.dir}: {x.text}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
