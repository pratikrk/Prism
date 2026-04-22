// Shared Prism UI primitives — chrome shell, icons, badges.

const PrismLogo = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 2L2 20h20L12 2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
    <path d="M12 2L7 20" stroke="currentColor" strokeWidth="1.6" strokeOpacity="0.5"/>
    <path d="M12 2L17 20" stroke="currentColor" strokeWidth="1.6" strokeOpacity="0.5"/>
  </svg>
);

const Icon = ({ name, size = 14 }) => {
  const paths = {
    search: <path d="M7 1a6 6 0 014.47 10L15 14.5l-.5.5L11 11.47A6 6 0 117 1zm0 1a5 5 0 100 10A5 5 0 007 2z" fill="currentColor"/>,
    arrow:  <path d="M3 8h10m-4-4l4 4-4 4" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    chev:   <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    dot:    <circle cx="8" cy="8" r="3" fill="currentColor"/>,
    check:  <path d="M3 8l3.5 3.5L13 4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    x:      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round"/>,
    spin:   <path d="M8 1.5a6.5 6.5 0 016.5 6.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round"/>,
    plus:   <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round"/>,
    retry:  <path d="M13 8a5 5 0 11-1.5-3.5M13 2v3h-3" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    sparkle:<path d="M8 2l1.2 3.3L12.5 6.5 9.2 7.7 8 11l-1.2-3.3L3.5 6.5l3.3-1.2L8 2z" stroke="currentColor" strokeWidth="1" fill="none" strokeLinejoin="round"/>,
    settings: <><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></>,
    bolt:   <path d="M9 1L3 9h4l-1 6 6-8H8l1-6z" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round"/>,
    layers: <><path d="M8 2l6 3-6 3-6-3 6-3z" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round"/><path d="M2 8l6 3 6-3M2 11l6 3 6-3" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round" strokeOpacity="0.5"/></>,
    link:   <path d="M7 9l2 2m-3-5L4 8a2.5 2.5 0 003.5 3.5l1-1m-1-4l1-1A2.5 2.5 0 0112 9l-1 1" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round"/>,
    filter: <path d="M2 3h12l-4.5 6v5l-3-1.5V9L2 3z" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round"/>,
    dl:     <path d="M8 2v8m-3-3l3 3 3-3M2 13h12" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    grid:   <><rect x="2" y="2" width="5" height="5" stroke="currentColor" strokeWidth="1.2" fill="none"/><rect x="9" y="2" width="5" height="5" stroke="currentColor" strokeWidth="1.2" fill="none"/><rect x="2" y="9" width="5" height="5" stroke="currentColor" strokeWidth="1.2" fill="none"/><rect x="9" y="9" width="5" height="5" stroke="currentColor" strokeWidth="1.2" fill="none"/></>,
    clock:  <><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M8 4.5V8l2.5 1.5" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round"/></>,
    branch: <><circle cx="4" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.2" fill="none"/><circle cx="4" cy="13" r="1.5" stroke="currentColor" strokeWidth="1.2" fill="none"/><circle cx="12" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M4 4.5v7M4 8c0-2 2-3 4-3h3" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 16 16" style={{flexShrink:0,display:'block'}}>{paths[name]}</svg>;
};

const Chrome = ({ theme, children, workspaceName = 'whitecarrot', route = 'workspaces/wc-prod' }) => {
  return (
    <div className={`prism-root prism-${theme}`}>
      {/* Top bar */}
      <div style={{
        height: 42, borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', padding: '0 14px', gap: 10,
        background: 'var(--bg-elev)', flexShrink: 0,
      }}>
        <div style={{display:'flex',alignItems:'center',gap:8,color:'var(--text)'}}>
          <PrismLogo size={16} />
          <span style={{fontSize:13,fontWeight:600,letterSpacing:-0.2}}>Prism</span>
        </div>
        <div style={{color:'var(--text-dim)',fontSize:12}}>/</div>
        <div style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--text-mut)'}}>
          <span style={{width:14,height:14,borderRadius:3,background:'linear-gradient(135deg,#ff8c42,#7c5cff)',display:'inline-block'}}></span>
          <span>{workspaceName}</span>
          <Icon name="chev" size={10} />
        </div>
        <div style={{color:'var(--text-dim)',fontSize:12}}>/</div>
        <div className="mono" style={{fontSize:11,color:'var(--text-mut)'}}>{route}</div>

        <div style={{flex:1}} />

        <div style={{display:'flex',alignItems:'center',gap:4,fontSize:11,color:'var(--text-dim)',padding:'4px 8px',border:'1px solid var(--border)',borderRadius:5}}>
          <span className="mono" style={{fontSize:10}}>⌘K</span>
          <span>Search</span>
        </div>
        <div style={{color:'var(--text-mut)',display:'flex',alignItems:'center',cursor:'pointer'}}>
          <Icon name="settings" size={14} />
        </div>
        <div style={{width:22,height:22,borderRadius:'50%',background:'linear-gradient(135deg,#7c5cff,#ff6b9d)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:10,fontWeight:600}}>PM</div>
      </div>

      {/* Body: sidebar + main */}
      <div style={{display:'flex',height:'calc(100% - 42px)',minHeight:0}}>
        {/* Sidebar */}
        <div style={{width:180,borderRight:'1px solid var(--border)',padding:'12px 8px',background:'var(--bg)',flexShrink:0,display:'flex',flexDirection:'column',gap:2}}>
          <NavItem icon="bolt"   label="New run"     shortcut="N" active={route.includes('new')} />
          <NavItem icon="grid"   label="Runs"        shortcut="R" active={route.includes('wc-prod')} />
          <NavItem icon="layers" label="Keywords"    shortcut="K" />
          <NavItem icon="branch" label="Competitors" />
          <NavItem icon="clock"  label="History"     />
          <div style={{height:1,background:'var(--border)',margin:'10px 4px'}}/>
          <div style={{fontSize:10,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:0.8,padding:'6px 8px 4px'}}>Workspaces</div>
          <WsItem color="#ff8c42" label="whitecarrot"    active domain="whitecarrot.io" />
          <WsItem color="#3ecf8e" label="acme-hr"        domain="acme-hr.com" />
          <WsItem color="#5b8dff" label="nova"           domain="usenova.ai" />
          <div style={{color:'var(--text-dim)',fontSize:12,padding:'6px 8px',display:'flex',alignItems:'center',gap:6,cursor:'pointer'}}>
            <Icon name="plus" size={12} />
            <span>New workspace</span>
          </div>
          <div style={{flex:1}}/>
          <div style={{fontSize:10,color:'var(--text-dim)',padding:'6px 8px',display:'flex',alignItems:'center',gap:6}}>
            <span style={{width:6,height:6,borderRadius:3,background:'var(--ok)'}}/>
            <span className="mono">4 workers · us-east</span>
          </div>
        </div>

        {/* Main */}
        <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',overflow:'hidden'}}>
          {children}
        </div>
      </div>
    </div>
  );
};

const NavItem = ({ icon, label, shortcut, active }) => (
  <div style={{
    display:'flex',alignItems:'center',gap:8,padding:'6px 8px',borderRadius:5,
    color: active ? 'var(--text)' : 'var(--text-mut)',
    background: active ? 'var(--bg-hover)' : 'transparent',
    fontSize:12, cursor:'pointer', fontWeight: active ? 500 : 400,
  }}>
    <Icon name={icon} size={13} />
    <span>{label}</span>
    <span style={{flex:1}}/>
    {shortcut && <span className="mono" style={{fontSize:10,color:'var(--text-dim)'}}>{shortcut}</span>}
  </div>
);

const WsItem = ({ color, label, domain, active }) => (
  <div style={{
    display:'flex',alignItems:'center',gap:7,padding:'5px 8px',borderRadius:5,
    background: active ? 'var(--bg-hover)' : 'transparent',
    color: active ? 'var(--text)' : 'var(--text-mut)',
    fontSize:12,cursor:'pointer',
  }}>
    <span style={{width:10,height:10,borderRadius:3,background:color,flexShrink:0}}/>
    <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{label}</span>
  </div>
);

// Status badge — reusable across screens
const StatusBadge = ({ status, size = 'sm' }) => {
  const cfg = {
    pending: { label: 'queued',  color: 'var(--text-mut)', bg: 'var(--bg-hover)',   dot: 'var(--text-mut)' },
    running: { label: 'running', color: 'var(--running)',  bg: 'var(--running-dim)', dot: 'var(--running)'  },
    complete:{ label: 'done',    color: 'var(--ok)',       bg: 'var(--ok-dim)',     dot: 'var(--ok)'       },
    complete_with_errors: { label: 'partial', color: 'var(--warn)', bg: 'var(--warn-dim)', dot: 'var(--warn)' },
    failed:  { label: 'failed',  color: 'var(--err)',      bg: 'var(--err-dim)',    dot: 'var(--err)'      },
  }[status] || { label: status, color: 'var(--text-mut)', bg: 'var(--bg-hover)', dot: 'var(--text-mut)' };

  const pad = size === 'lg' ? '3px 9px' : '2px 7px';
  const fs  = size === 'lg' ? 11 : 10;
  return (
    <span className="mono" style={{
      display:'inline-flex',alignItems:'center',gap:5,
      padding:pad,fontSize:fs,borderRadius:3,
      color: cfg.color, background: cfg.bg, fontWeight: 500, letterSpacing: 0.2,
    }}>
      <span className={status === 'running' ? 'prism-pulse-dot' : ''}
            style={{width:5,height:5,borderRadius:3,background:cfg.dot}}/>
      {cfg.label}
    </span>
  );
};

Object.assign(window, { PrismLogo, Icon, Chrome, StatusBadge });
