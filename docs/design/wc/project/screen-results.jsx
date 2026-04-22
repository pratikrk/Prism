// Screen 3 — Keyword results detail

const ResultsScreen = ({ theme }) => {
  const rows = [
    { kw:'applicant tracking system',         vol:74000, kd:72, cpc:12.40, int:'TOF', score:94, trend:[3,4,5,5,7,8,10], comp:'Greenhouse' },
    { kw:'ats for startups',                  vol:8100,  kd:38, cpc: 9.20, int:'MOF', score:91, trend:[1,2,3,4,6,7,8],  comp:'—'           },
    { kw:'greenhouse alternatives',           vol:3600,  kd:34, cpc:11.10, int:'BOF', score:88, trend:[2,3,4,5,5,6,7],  comp:'Greenhouse' },
    { kw:'best ats for small business',       vol:5400,  kd:41, cpc: 8.70, int:'MOF', score:86, trend:[2,2,3,4,5,6,6],  comp:'Ashby'       },
    { kw:'recruiting software',               vol:49500, kd:68, cpc:14.50, int:'TOF', score:82, trend:[5,5,6,7,7,8,9],  comp:'Greenhouse' },
    { kw:'ashby vs greenhouse',               vol:1900,  kd:22, cpc: 6.80, int:'BOF', score:80, trend:[1,1,2,3,4,5,6],  comp:'Ashby'       },
    { kw:'whitecarrot review',                vol:210,   kd:12, cpc: 3.20, int:'BOF', score:78, trend:[0,1,1,2,3,4,5],  comp:'—'           },
    { kw:'ats integrations slack',            vol:720,   kd:28, cpc: 5.40, int:'BOF', score:74, trend:[1,1,2,2,3,3,4],  comp:'—'           },
    { kw:'applicant tracking for agencies',   vol:1300,  kd:31, cpc: 7.80, int:'MOF', score:71, trend:[1,2,2,3,3,4,4],  comp:'—'           },
    { kw:'free ats software',                 vol:6600,  kd:44, cpc: 5.90, int:'TOF', score:68, trend:[3,4,4,5,6,6,7],  comp:'Greenhouse' },
    { kw:'ats with candidate scoring',        vol:480,   kd:18, cpc: 6.20, int:'BOF', score:66, trend:[0,1,1,1,2,2,3],  comp:'—'           },
    { kw:'how to choose an ats',              vol:2100,  kd:29, cpc: 4.10, int:'TOF', score:62, trend:[2,2,3,3,4,4,5],  comp:'Ashby'       },
  ];

  return (
    <Chrome theme={theme} route="runs/r_k3f8p2a/keyword · 412 rows">
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'auto',minHeight:0}}>
        {/* Results header */}
        <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border)'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{display:'flex',alignItems:'center',gap:7}}>
              <Icon name="layers" size={14} />
              <span style={{fontSize:14,fontWeight:600,color:'var(--text)'}}>Keyword research</span>
            </div>
            <StatusBadge status="complete" />
            <span className="mono" style={{fontSize:11,color:'var(--text-mut)'}}>412 rows · 18.2s · dataforseo $0.024</span>
            <div style={{flex:1}}/>
            <button style={btnGhost2}><Icon name="retry" size={11}/> Re-run</button>
            <button style={btnGhost2}><Icon name="dl" size={11}/> Export CSV</button>
          </div>

          {/* Stat strip */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginTop:14}}>
            <Stat label="total keywords"  value="412"     sub="seeds: 8"    />
            <Stat label="avg difficulty"  value="38.4"    sub="median 34"   bar={0.38} />
            <Stat label="total volume"    value="187.4k"  sub="/mo · en-US" />
            <Stat label="priority pool"   value="64"      sub="score ≥ 70"  accent />
          </div>
        </div>

        {/* Filter bar */}
        <div style={{padding:'10px 20px',borderBottom:'1px solid var(--border)',background:'var(--bg-elev)',display:'flex',alignItems:'center',gap:8}}>
          <div style={{
            display:'flex',alignItems:'center',gap:7,
            padding:'4px 9px',border:'1px solid var(--border)',borderRadius:5,
            background:'var(--bg-card)',minWidth:220,
          }}>
            <Icon name="search" size={11} />
            <input placeholder="Filter keywords..." style={{
              border:'none',outline:'none',background:'transparent',color:'var(--text)',
              fontSize:12,fontFamily:'inherit',width:160,
            }}/>
          </div>
          <Pill active>intent</Pill>
          <Pill>difficulty ≤ 50</Pill>
          <Pill>volume ≥ 500</Pill>
          <Pill>competitor</Pill>
          <div style={{flex:1}}/>
          <span className="mono" style={{fontSize:11,color:'var(--text-dim)'}}>sorted by priority score</span>
        </div>

        {/* Table */}
        <div style={{flex:1,overflow:'auto',minHeight:0}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead>
              <tr style={{background:'var(--bg-elev)',borderBottom:'1px solid var(--border)'}}>
                <Th w={26}>#</Th>
                <Th>keyword</Th>
                <Th w={70} right>volume</Th>
                <Th w={60} right>kd</Th>
                <Th w={60} right>cpc</Th>
                <Th w={50} center>intent</Th>
                <Th w={90}>trend (90d)</Th>
                <Th w={90}>owner</Th>
                <Th w={90} right>score</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i)=> (
                <tr key={i} style={{borderBottom:'1px solid var(--border)',background: i===0 ? 'var(--accent-dim)' : 'transparent'}}>
                  <Td mono dim>{String(i+1).padStart(2,'0')}</Td>
                  <Td>
                    <span style={{color:'var(--text)',fontWeight: i<3?500:400}}>{r.kw}</span>
                  </Td>
                  <Td mono right>{r.vol.toLocaleString()}</Td>
                  <Td right>
                    <KDBar kd={r.kd} />
                  </Td>
                  <Td mono right dim>${r.cpc.toFixed(2)}</Td>
                  <Td center>
                    <IntentPill intent={r.int} />
                  </Td>
                  <Td>
                    <Sparkline data={r.trend} />
                  </Td>
                  <Td dim>{r.comp}</Td>
                  <Td right>
                    <ScoreCell score={r.score} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer / pagination */}
        <div style={{
          borderTop:'1px solid var(--border)',padding:'8px 20px',
          display:'flex',alignItems:'center',gap:12,fontSize:11,color:'var(--text-mut)',
          background:'var(--bg-elev)',
        }}>
          <span className="mono">showing 12 of 412</span>
          <div style={{flex:1}}/>
          <span style={{display:'flex',alignItems:'center',gap:6}}>
            <span className="mono" style={{color:'var(--text-dim)'}}>next →</span>
            <span>Cluster (semantic)</span>
            <span style={{
              marginLeft:4,padding:'2px 6px',border:'1px dashed var(--border-strong)',borderRadius:3,
              fontSize:10,color:'var(--text-dim)',
            }} className="mono">sub-project 4</span>
          </span>
        </div>
      </div>
    </Chrome>
  );
};

// --- small pieces -----------------------------------

const Stat = ({ label, value, sub, bar, accent }) => (
  <div style={{
    padding:'10px 12px',border:'1px solid var(--border)',borderRadius:6,
    background: accent ? 'var(--accent-dim)' : 'var(--bg-card)',
  }}>
    <div className="mono" style={{fontSize:9,color:'var(--text-dim)',letterSpacing:0.8,textTransform:'uppercase'}}>{label}</div>
    <div style={{fontSize:22,fontWeight:600,color: accent ? 'var(--accent)' : 'var(--text)',letterSpacing:-0.4,marginTop:2,lineHeight:1.1}}>{value}</div>
    <div className="mono" style={{fontSize:10,color:'var(--text-dim)',marginTop:2}}>{sub}</div>
    {bar !== undefined && (
      <div style={{height:3,borderRadius:2,background:'var(--bg-hover)',marginTop:6,overflow:'hidden'}}>
        <div style={{width:`${bar*100}%`,height:'100%',background:'var(--running)'}}/>
      </div>
    )}
  </div>
);

const Pill = ({ children, active }) => (
  <span style={{
    display:'inline-flex',alignItems:'center',gap:5,
    padding:'4px 9px',fontSize:11,borderRadius:4,
    border:`1px solid ${active?'var(--accent)':'var(--border)'}`,
    background: active?'var(--accent-dim)':'var(--bg-card)',
    color: active?'var(--accent)':'var(--text-mut)',
    cursor:'pointer',
  }}>
    {children}
    {!active && <Icon name="chev" size={9}/>}
  </span>
);

const Th = ({ children, w, right, center }) => (
  <th style={{
    padding:'8px 12px',textAlign: right?'right':center?'center':'left',
    width:w,
    fontSize:10,fontWeight:500,color:'var(--text-dim)',letterSpacing:0.8,textTransform:'uppercase',
    fontFamily:'JetBrains Mono, monospace',
  }}>{children}</th>
);

const Td = ({ children, mono, right, center, dim }) => (
  <td style={{
    padding:'8px 12px',
    textAlign: right?'right':center?'center':'left',
    fontFamily: mono?'JetBrains Mono, monospace':'inherit',
    color: dim?'var(--text-mut)':'var(--text)',
    fontSize: mono?11:12,
    whiteSpace:'nowrap',
  }}>{children}</td>
);

const KDBar = ({ kd }) => {
  const color = kd<30?'var(--ok)':kd<55?'var(--warn)':'var(--err)';
  return (
    <div style={{display:'inline-flex',alignItems:'center',gap:6,justifyContent:'flex-end'}}>
      <span className="mono" style={{fontSize:11,color:'var(--text)',minWidth:20}}>{kd}</span>
      <div style={{width:32,height:4,borderRadius:2,background:'var(--bg-hover)',overflow:'hidden'}}>
        <div style={{width:`${kd}%`,height:'100%',background:color}}/>
      </div>
    </div>
  );
};

const IntentPill = ({ intent }) => {
  const c = { TOF:'var(--running)', MOF:'var(--warn)', BOF:'var(--ok)' }[intent] || 'var(--text-mut)';
  const bg = { TOF:'var(--running-dim)', MOF:'var(--warn-dim)', BOF:'var(--ok-dim)' }[intent] || 'var(--bg-hover)';
  return <span className="mono" style={{fontSize:10,padding:'2px 6px',borderRadius:3,color:c,background:bg,letterSpacing:0.4}}>{intent}</span>;
};

const Sparkline = ({ data }) => {
  const max = Math.max(...data, 1);
  const w = 80, h = 20;
  const step = w / (data.length - 1);
  const pts = data.map((d, i)=> `${i*step},${h - (d/max)*h}`).join(' ');
  return (
    <svg width={w} height={h} style={{display:'block'}}>
      <polyline points={pts} fill="none" stroke="var(--running)" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round"/>
      <circle cx={(data.length-1)*step} cy={h - (data[data.length-1]/max)*h} r="2" fill="var(--running)"/>
    </svg>
  );
};

const ScoreCell = ({ score }) => {
  const color = score>=85?'var(--ok)':score>=70?'var(--running)':'var(--text-mut)';
  return (
    <div style={{display:'inline-flex',alignItems:'center',gap:6,justifyContent:'flex-end'}}>
      <div style={{width:40,height:4,borderRadius:2,background:'var(--bg-hover)',overflow:'hidden'}}>
        <div style={{width:`${score}%`,height:'100%',background:color}}/>
      </div>
      <span className="mono" style={{fontSize:11,color,fontWeight:600,minWidth:20}}>{score}</span>
    </div>
  );
};

const btnGhost2 = {
  display:'inline-flex',alignItems:'center',gap:5,
  padding:'4px 9px',borderRadius:5,border:'1px solid var(--border)',
  background:'var(--bg-card)',color:'var(--text-mut)',
  fontSize:11,cursor:'pointer',fontFamily:'inherit',
};

window.ResultsScreen = ResultsScreen;
