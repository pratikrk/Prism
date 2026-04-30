// proto-primitives.jsx — shared atoms for the Prism prototype

const Icon = ({ name, size = 14 }) => {
  const d = {
    bolt:     <path d="M9 1L3 9h4l-1 6 6-8H8l1-6z" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round"/>,
    grid:     <><rect x="2" y="2" width="5" height="5" stroke="currentColor" strokeWidth="1.2" fill="none" rx="1"/><rect x="9" y="2" width="5" height="5" stroke="currentColor" strokeWidth="1.2" fill="none" rx="1"/><rect x="2" y="9" width="5" height="5" stroke="currentColor" strokeWidth="1.2" fill="none" rx="1"/><rect x="9" y="9" width="5" height="5" stroke="currentColor" strokeWidth="1.2" fill="none" rx="1"/></>,
    layers:   <><path d="M8 2l6 3-6 3-6-3 6-3z" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round"/><path d="M2 8l6 3 6-3" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round"/><path d="M2 11l6 3 6-3" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round" opacity=".5"/></>,
    branch:   <><circle cx="4" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.2" fill="none"/><circle cx="4" cy="13" r="1.5" stroke="currentColor" strokeWidth="1.2" fill="none"/><circle cx="12" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M4 4.5v7M4 8c0-2 2-3 4-3h3" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round"/></>,
    clock:    <><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M8 4.5V8l2.5 1.5" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round"/></>,
    settings: <><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></>,
    plus:     <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round"/>,
    chev:     <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    chevR:    <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    check:    <path d="M3 8l3.5 3.5L13 4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    x:        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round"/>,
    search:   <><circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></>,
    sparkle:  <path d="M8 2l1.2 3.3L12.5 6.5 9.2 7.7 8 11l-1.2-3.3L3.5 6.5l3.3-1.2L8 2z" stroke="currentColor" strokeWidth="1.1" fill="none" strokeLinejoin="round"/>,
    dl:       <path d="M8 2v8m-3-3l3 3 3-3M2 13h12" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    retry:    <path d="M13 8a5 5 0 11-1.5-3.5M13 2v3h-3" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    link:     <path d="M7 9l2 2m-3-5L4 8a2.5 2.5 0 003.5 3.5l1-1m-1-4l1-1A2.5 2.5 0 0112 9l-1 1" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round"/>,
    filter:   <path d="M2 3h12l-4.5 6v5l-3-1.5V9L2 3z" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round"/>,
    eye:      <><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.2" fill="none"/><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" fill="none"/></>,
    arrowR:   <path d="M3 8h10m-4-4l4 4-4 4" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    globe:    <><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M2 8h12M8 2c-2 2-3 4-3 6s1 4 3 6M8 2c2 2 3 4 3 6s-1 4-3 6" stroke="currentColor" strokeWidth="1.2" fill="none"/></>,
    zap:      <path d="M10 1L5 9h4l-1 6 7-8H11l-1-6z" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round"/>,
    trend:    <path d="M1 13l4-5 3 2 4-6 3 2" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    dot:      <circle cx="8" cy="8" r="3" fill="currentColor"/>,
    info:     <><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M8 7v5M8 5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 16 16" style={{flexShrink:0,display:'block'}}>{d[name] || d.dot}</svg>;
};

const PrismLogo = ({size=18}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 2L2 20h20L12 2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
    <path d="M12 2L7.5 20" stroke="currentColor" strokeWidth="1.4" strokeOpacity=".45"/>
    <path d="M12 2L16.5 20" stroke="currentColor" strokeWidth="1.4" strokeOpacity=".45"/>
    <path d="M5 14h14" stroke="currentColor" strokeWidth="1" strokeOpacity=".2"/>
  </svg>
);

const Badge = ({ status }) => {
  const m = {
    pending:  {l:'queued',  c:'var(--text-mut)',  bg:'var(--bg-hover)'},
    running:  {l:'running', c:'var(--running)',   bg:'var(--running-dim)', pulse:true},
    complete: {l:'done',    c:'var(--ok)',        bg:'var(--ok-dim)'},
    partial:  {l:'partial', c:'var(--warn)',      bg:'var(--warn-dim)'},
    failed:   {l:'failed',  c:'var(--err)',       bg:'var(--err-dim)'},
  }[status] || {l:status, c:'var(--text-mut)', bg:'var(--bg-hover)'};
  return (
    <span className="mono" style={{display:'inline-flex',alignItems:'center',gap:5,padding:'2px 8px',fontSize:10,borderRadius:3,color:m.c,background:m.bg,fontWeight:500,letterSpacing:.3}}>
      <span className={m.pulse?'pulse-dot':''} style={{width:5,height:5,borderRadius:3,background:m.c}}/>
      {m.l}
    </span>
  );
};

// Top bar
const TopBar = ({ workspaceName='whitecarrot', route, theme, setTheme }) => (
  <div style={{height:44,borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',padding:'0 16px',gap:10,background:'var(--bg-elev)',flexShrink:0}}>
    <div style={{display:'flex',alignItems:'center',gap:8,color:'var(--text)'}}>
      <PrismLogo size={16}/>
      <span style={{fontSize:13,fontWeight:700,letterSpacing:-.3}}>Prism</span>
    </div>
    <span style={{color:'var(--text-dim)',fontSize:13}}>/</span>
    <div style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--text-mut)'}}>
      <span style={{width:13,height:13,borderRadius:3,background:'linear-gradient(135deg,#ff8c42,#7c5cff)',display:'inline-block'}}/>
      <span>{workspaceName}</span>
      <Icon name="chev" size={10}/>
    </div>
    {route && <><span style={{color:'var(--text-dim)',fontSize:13}}>/</span><span className="mono" style={{fontSize:11,color:'var(--text-mut)'}}>{route}</span></>}
    <div style={{flex:1}}/>
    <div style={{display:'flex',alignItems:'center',gap:5,padding:'4px 9px',border:'1px solid var(--border)',borderRadius:5,fontSize:11,color:'var(--text-dim)',cursor:'pointer'}}>
      <Icon name="search" size={11}/> <span>Search</span> <span className="mono" style={{fontSize:10}}>⌘K</span>
    </div>
    <button onClick={()=>setTheme(t=>t==='dark'?'light':'dark')} style={{border:'1px solid var(--border)',background:'var(--bg-hover)',color:'var(--text-mut)',padding:'4px 8px',borderRadius:5,fontSize:11,display:'flex',alignItems:'center',gap:5}}>
      {theme==='dark'?'☀ Light':'☾ Dark'}
    </button>
    <div style={{width:24,height:24,borderRadius:'50%',background:'linear-gradient(135deg,#7c5cff,#ff6b9d)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:10,fontWeight:700}}>PM</div>
  </div>
);

// Sidebar
const Sidebar = ({ page, navigate }) => {
  const nav = [
    { id:'workspace',        icon:'sparkle', label:'New run',        short:'N' },
    { id:'runs',             icon:'grid',    label:'Runs',           short:'R' },
    { id:'strategy-brief',   icon:'zap',     label:'Strategy Brief'            },
    { id:'keywords',         icon:'layers',  label:'Keywords'                  },
    { id:'competitors',      icon:'branch',  label:'Competitors'               },
    { id:'content_audit',    icon:'eye',     label:'Content audit'             },
    { id:'llm_visibility',   icon:'globe',   label:'LLM visibility'            },
    { id:'history',          icon:'clock',   label:'History'                   },
  ];
  const ws = [
    { color:'#ff8c42', label:'whitecarrot', active:true },
    { color:'#3ecf8e', label:'acme-hr' },
    { color:'#5b8dff', label:'usenova' },
  ];
  return (
    <div style={{width:188,borderRight:'1px solid var(--border)',padding:'10px 8px',background:'var(--bg)',flexShrink:0,display:'flex',flexDirection:'column',gap:1,overflowY:'auto'}}>
      {nav.map(n=>(
        <button key={n.id} onClick={()=>navigate(n.id)} style={{
          display:'flex',alignItems:'center',gap:8,padding:'7px 9px',borderRadius:5,border:'none',
          background: page===n.id ? 'var(--bg-hover)':'transparent',
          color: page===n.id ? 'var(--text)':'var(--text-mut)',
          fontSize:12,fontWeight: page===n.id?500:400,cursor:'pointer',textAlign:'left',
        }}>
          <Icon name={n.icon} size={13}/> <span style={{flex:1}}>{n.label}</span>
          {n.short && <span className="mono" style={{fontSize:10,color:'var(--text-dim)'}}>{n.short}</span>}
        </button>
      ))}
      <div style={{height:1,background:'var(--border)',margin:'8px 4px'}}/>
      <div style={{fontSize:10,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:.8,padding:'4px 9px'}}>Workspaces</div>
      {ws.map(w=>(
        <div key={w.label} style={{display:'flex',alignItems:'center',gap:7,padding:'6px 9px',borderRadius:5,background:w.active?'var(--bg-hover)':'transparent',color:w.active?'var(--text)':'var(--text-mut)',fontSize:12,cursor:'pointer'}}>
          <span style={{width:10,height:10,borderRadius:3,background:w.color,flexShrink:0}}/>
          <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{w.label}</span>
        </div>
      ))}
      <div style={{display:'flex',alignItems:'center',gap:6,padding:'6px 9px',color:'var(--text-dim)',fontSize:12,cursor:'pointer'}}>
        <Icon name="plus" size={12}/> New workspace
      </div>
      <div style={{flex:1}}/>
      <div className="mono" style={{fontSize:10,color:'var(--text-dim)',padding:'6px 9px',display:'flex',alignItems:'center',gap:5}}>
        <span style={{width:6,height:6,borderRadius:3,background:'var(--ok)'}}/>4 workers · us-east
      </div>
    </div>
  );
};

// Reusable section header
const SectionHead = ({ title, right }) => (
  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
    <div style={{fontSize:10,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:1.2,fontWeight:500,whiteSpace:'nowrap'}}>{title}</div>
    <div style={{flex:1,height:1,background:'var(--border)'}}/>
    {right && <div>{right}</div>}
  </div>
);

// Ghost button
const GhostBtn = ({ children, onClick, style={} }) => (
  <button onClick={onClick} style={{display:'inline-flex',alignItems:'center',gap:5,padding:'5px 10px',border:'1px solid var(--border)',borderRadius:5,background:'transparent',color:'var(--text-mut)',fontSize:12,cursor:'pointer',fontFamily:'inherit',...style}}>
    {children}
  </button>
);

// Primary button
const PrimaryBtn = ({ children, onClick, style={} }) => (
  <button onClick={onClick} style={{display:'inline-flex',alignItems:'center',gap:6,padding:'8px 14px',border:'none',borderRadius:6,background:'var(--accent)',color:'#fff',fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'inherit',...style}}>
    {children}
  </button>
);

// Stat card
const StatCard = ({ label, value, sub, accent, bar }) => (
  <div style={{padding:'11px 13px',border:'1px solid var(--border)',borderRadius:7,background:accent?'var(--accent-dim)':'var(--bg-card)',flex:1,minWidth:0}}>
    <div className="mono" style={{fontSize:9,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:.8,marginBottom:3}}>{label}</div>
    <div style={{fontSize:24,fontWeight:700,letterSpacing:-.5,color:accent?'var(--accent)':'var(--text)',lineHeight:1.1}}>{value}</div>
    {sub && <div className="mono" style={{fontSize:10,color:'var(--text-dim)',marginTop:3}}>{sub}</div>}
    {bar!==undefined && <div style={{height:3,borderRadius:2,background:'var(--bg-hover)',marginTop:6,overflow:'hidden'}}><div style={{width:`${bar*100}%`,height:'100%',background:'var(--running)'}}/></div>}
  </div>
);

Object.assign(window, { Icon, PrismLogo, Badge, TopBar, Sidebar, SectionHead, GhostBtn, PrimaryBtn, StatCard });
