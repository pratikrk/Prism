export default function ContentPage() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: 'var(--text-mut)', padding: 24 }}>
      <p style={{ fontSize: 15 }}>Content library</p>
      <p style={{ fontSize: 13 }}>Drafts, published pages, and in-progress pieces will appear here.</p>
      <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>Coming in the Content sub-project.</p>
    </div>
  );
}
