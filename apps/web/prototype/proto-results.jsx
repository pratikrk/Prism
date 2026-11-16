// proto-results.jsx — Keyword, Competitor, Content Audit, LLM Visibility

// ── Keyword Results ──────────────────────────────────────────────────────
const KeywordResults = ({ navigate }) => {
  const allRows = [
    { kw:'applicant tracking system',       vol:74000, kd:72, cpc:12.40, int:'TOF', score:94, trend:[3,4,5,5,7,8,10], comp:'Greenhouse' },
    { kw:'ats for startups',                vol:8100,  kd:38, cpc:9.20,  int:'MOF', score:91, trend:[1,2,3,4,6,7,8],  comp:'—' },
    { kw:'greenhouse alternatives',         vol:3600,  kd:34, cpc:11.10, int:'BOF', score:88, trend:[2,3,4,5,5,6,7],  comp:'Greenhouse' },
    { kw:'best ats for small business',     vol:5400,  kd:41, cpc:8.70,  int:'MOF', score:86, trend:[2,2,3,4,5,6,6],  comp:'Ashby' },
    { kw:'recruiting software',             vol:49500, kd:68, cpc:14.50, int:'TOF', score:82, trend:[5,5,6,7,7,8,9],  comp:'Greenhouse' },
    { kw:'ashby vs greenhouse',             vol:1900,  kd:22, cpc:6.80,  int:'BOF', score:80, trend:[1,1,2,3,4,5,6],  comp:'Ashby' },
    { kw:'whitecarrot review',              vol:210,   kd:12, cpc:3.20,  int:'BOF', score:78, trend:[0,1,1,2,3,4,5],  comp:'—' },
    { kw:'ats integrations slack',          vol:720,   kd:28, cpc:5.40,  int:'BOF', score:74, trend:[1,1,2,2,3,3,4],  comp:'—' },
    { kw:'applicant tracking for agencies', vol:1300,  kd:31, cpc:7.80,  int:'MOF', score:71, trend:[1,2,2,3,3,4,4],  comp:'—' },
    { kw:'free ats software',               vol:6600,  kd:44, cpc:5.90,  int:'TOF', score:68, trend:[3,4,4,5,6,6,7],  comp:'Greenhouse' },
    { kw:'ats with candidate scoring',      vol:480,   kd:18, cpc:6.20,  int:'BOF', score:66, trend:[0,1,1,1,2,2,3],  comp:'—' },
    { kw:'how to choose an ats',            vol:2100,  kd:29, cpc:4.10,  int:'TOF', score:62, trend:[2,2,3,3,4,4,5],  comp:'Ashby' },
    { kw:'hr software for startups',        vol:3300,  kd:35, cpc:8.10,  int:'TOF', score:60, trend:[2,3,3,4,4,5,5],  comp:'—' },
    { kw:'lever alternative',               vol:1100,  kd:20, cpc:7.00,  int:'BOF', score:58, trend:[1,1,2,2,3,3,4],  comp:'Lever' },
    { kw:'candidate tracking spreadsheet',  vol:880,   kd:15, cpc:2.30,  int:'TOF', score:55, trend:[1,1,1,2,2,3,3],  comp:'—' },
  ];

  const [search, setSearch]   = React.useState('');
  const [intFilter, setInt]   = React.useState('all');
  const [sortKey, setSort]    = React.useState('score');
  const [sortDir, setSortDir] = React.useState(-1);
  const [expanded, setExpanded] = React.useState(null);

  const toggleSort = (k) => {
    if (sortKey===k) setSortDir(d=>-d);
    else { setSort(k); setSortDir(-1); }
  };

  const rows = allRows
    .filter(r => r.kw.toLowerCase().includes(search.toLowerCase()))
    .filter(r => intFilter==='all' || r.int===intFilter)
    .sort((a,b)=> (a[sortKey]-b[sortKey])*sortDir);

  const SortTh = ({ label, k, w, right }) => (
    <th onClick={()=>toggleSort(k)} style={{padding:'8px 12px',textAlign:right?'right':'left',width:w,fontSize:10,fontWeight:500,color: sortKey===k?'var(--accent)':'var(--text-dim)',letterSpacing:.8,textTransform:'uppercase',fontFamily:'JetBrains Mono,monospace',cursor:'pointer',whiteSpace:'nowrap'}}>
      {label} {sortKey===k ? (sortDir===-1?'↓':'↑') : ''}
    </th>
  );

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',minHeight:0,overflow:'hidden',background:'var(--bg)'}}>
      {/* Header */}
      <div style={{padding:'16px 20px',borderBottom:'1px solid var(--border)',background:'var(--bg-elev)'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
          <button onClick={()=>navigate('workspace')} style={{border:'none',background:'transparent',color:'var(--text-mut)',cursor:'pointer',fontSize:18,lineHeight:1,padding:0}}>←</button>
          <Icon name="layers" size={14}/>
          <span style={{fontSize:14,fontWeight:600,color:'var(--text)'}}>Keyword research</span>
          <Badge status="complete"/>
          <span className="mono" style={{fontSize:11,color:'var(--text-mut)'}}>412 rows · 18.2s · dataforseo $0.024</span>
          <div style={{flex:1}}/>
          <GhostBtn><Icon name="dl" size={11}/> Export CSV</GhostBtn>
          <GhostBtn><Icon name="retry" size={11}/> Re-run</GhostBtn>
        </div>
        {/* Stats */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
          <StatCard label="total keywords" value="412"    sub="8 seed terms"/>
          <StatCard label="avg difficulty" value="38.4"   sub="median 34" bar={0.38}/>
          <StatCard label="total volume"   value="187.4k" sub="/mo · en-US"/>
          <StatCard label="priority pool"  value="64"     sub="score ≥ 70" accent/>
        </div>
        {/* Filters */}
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{display:'flex',alignItems:'center',gap:7,padding:'5px 9px',border:'1px solid var(--border)',borderRadius:5,background:'var(--bg-card)',minWidth:220}}>
            <Icon name="search" size={11}/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Filter keywords…"
              style={{border:'none',outline:'none',background:'transparent',color:'var(--text)',fontSize:12,fontFamily:'inherit',flex:1}}/>
          </div>
          {['all','TOF','MOF','BOF'].map(f=>(
            <button key={f} onClick={()=>setInt(f)} style={{padding:'5px 10px',fontSize:11,borderRadius:4,border:`1px solid ${intFilter===f?'var(--accent)':'var(--border)'}`,background:intFilter===f?'var(--accent-dim)':'var(--bg-card)',color:intFilter===f?'var(--accent)':'var(--text-mut)',cursor:'pointer',fontFamily:'inherit'}}>
              {f==='all'?'All intent':f}
            </button>
          ))}
          <div style={{flex:1}}/>
          <span className="mono" style={{fontSize:11,color:'var(--text-dim)'}}>showing {rows.length} of 412</span>
        </div>
      </div>

      {/* Table */}
      <div style={{flex:1,overflow:'auto',minHeight:0}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
          <thead style={{position:'sticky',top:0,background:'var(--bg-elev)',zIndex:1}}>
            <tr style={{borderBottom:'1px solid var(--border)'}}>
              <th style={{padding:'8px 12px',width:28,fontSize:10,color:'var(--text-dim)',fontFamily:'JetBrains Mono,monospace'}}>#</th>
              <SortTh label="Keyword"  k="kw"    />
              <SortTh label="Vol"      k="vol"   w={70}  right/>
              <SortTh label="KD"       k="kd"    w={80}  right/>
              <SortTh label="CPC"      k="cpc"   w={60}  right/>
              <th style={{padding:'8px 12px',width:55,fontSize:10,color:'var(--text-dim)',letterSpacing:.8,textTransform:'uppercase',fontFamily:'JetBrains Mono,monospace',textAlign:'center'}}>Intent</th>
              <th style={{padding:'8px 12px',width:90,fontSize:10,color:'var(--text-dim)',letterSpacing:.8,textTransform:'uppercase',fontFamily:'JetBrains Mono,monospace'}}>Trend</th>
              <th style={{padding:'8px 12px',fontSize:10,color:'var(--text-dim)',letterSpacing:.8,textTransform:'uppercase',fontFamily:'JetBrains Mono,monospace'}}>Comp</th>
              <SortTh label="Score" k="score" w={100} right/>
            </tr>
          </thead>
          <tbody>
            {rows.map((r,i)=>(
              <React.Fragment key={r.kw}>
                <tr onClick={()=>setExpanded(expanded===i?null:i)} style={{borderBottom:'1px solid var(--border)',cursor:'pointer',background:expanded===i?'var(--bg-hover)':i===0?'var(--accent-dim)':'transparent'}}>
                  <td style={{padding:'8px 12px',fontFamily:'JetBrains Mono,monospace',color:'var(--text-dim)',fontSize:10}}>{String(i+1).padStart(2,'0')}</td>
                  <td style={{padding:'8px 12px',color:'var(--text)',fontWeight:i<3?500:400}}>{r.kw}</td>
                  <td style={{padding:'8px 12px',textAlign:'right',fontFamily:'JetBrains Mono,monospace',fontSize:11}}>{r.vol.toLocaleString()}</td>
                  <td style={{padding:'8px 12px',textAlign:'right'}}>
                    <div style={{display:'inline-flex',alignItems:'center',gap:5,justifyContent:'flex-end'}}>
                      <span className="mono" style={{fontSize:11,minWidth:18}}>{r.kd}</span>
                      <div style={{width:32,height:4,borderRadius:2,background:'var(--bg-hover)',overflow:'hidden'}}>
                        <div style={{width:`${r.kd}%`,height:'100%',background:r.kd<30?'var(--ok)':r.kd<55?'var(--warn)':'var(--err)'}}/>
                      </div>
                    </div>
                  </td>
                  <td style={{padding:'8px 12px',textAlign:'right',fontFamily:'JetBrains Mono,monospace',color:'var(--text-mut)',fontSize:11}}>${r.cpc.toFixed(2)}</td>
                  <td style={{padding:'8px 12px',textAlign:'center'}}>
                    <span className="mono" style={{fontSize:10,padding:'2px 6px',borderRadius:3,
                      color:{TOF:'var(--running)',MOF:'var(--warn)',BOF:'var(--ok)'}[r.int],
                      background:{TOF:'var(--running-dim)',MOF:'var(--warn-dim)',BOF:'var(--ok-dim)'}[r.int]}}>
                      {r.int}
                    </span>
                  </td>
                  <td style={{padding:'8px 12px'}}>
                    <svg width="80" height="20" style={{display:'block'}}>
                      <polyline points={r.trend.map((v,j)=>`${j*(80/(r.trend.length-1))},${20-(v/Math.max(...r.trend,1))*18}`).join(' ')} fill="none" stroke="var(--running)" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round"/>
                      <circle cx={80} cy={20-(r.trend[r.trend.length-1]/Math.max(...r.trend,1))*18} r="2" fill="var(--running)"/>
                    </svg>
                  </td>
                  <td style={{padding:'8px 12px',color:'var(--text-mut)',fontSize:11}}>{r.comp}</td>
                  <td style={{padding:'8px 12px',textAlign:'right'}}>
                    <div style={{display:'inline-flex',alignItems:'center',gap:6}}>
                      <div style={{width:40,height:4,borderRadius:2,background:'var(--bg-hover)',overflow:'hidden'}}>
                        <div style={{width:`${r.score}%`,height:'100%',background:r.score>=85?'var(--ok)':r.score>=70?'var(--running)':'var(--text-mut)'}}/>
                      </div>
                      <span className="mono" style={{fontSize:11,fontWeight:600,color:r.score>=85?'var(--ok)':r.score>=70?'var(--running)':'var(--text-mut)',minWidth:20}}>{r.score}</span>
                    </div>
                  </td>
                </tr>
                {expanded===i && (
                  <tr style={{background:'var(--bg-hover)',borderBottom:'1px solid var(--border)'}}>
                    <td colSpan={9} style={{padding:'12px 16px'}}>
                      <div style={{display:'flex',gap:24,fontSize:12}}>
                        <div style={{display:'flex',flexDirection:'column',gap:5}}>
                          <span style={{color:'var(--text-dim)',fontSize:10,textTransform:'uppercase',letterSpacing:.8}}>Suggested URL</span>
                          <span className="mono" style={{color:'var(--accent)',fontSize:11}}>whitecarrot.io/blog/{r.kw.replace(/\s+/g,'-').toLowerCase()}</span>
                        </div>
                        <div style={{display:'flex',flexDirection:'column',gap:5}}>
                          <span style={{color:'var(--text-dim)',fontSize:10,textTransform:'uppercase',letterSpacing:.8}}>Rationale</span>
                          <span style={{color:'var(--text-mut)',maxWidth:360}}>High commercial intent with low competition gap vs {r.comp==='—'?'any major player':r.comp}. Strong candidate for Q1 content sprint.</span>
                        </div>
                        <div style={{display:'flex',flexDirection:'column',gap:5}}>
                          <span style={{color:'var(--text-dim)',fontSize:10,textTransform:'uppercase',letterSpacing:.8}}>Content type</span>
                          <span style={{color:'var(--text)'}}>{r.int==='BOF'?'Landing page / comparison':'Blog post / guide'}</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── Competitor Analysis ──────────────────────────────────────────────────
const CompetitorResults = ({ navigate }) => {
  const comps = [
    { domain:'greenhouse.io',  da:78, pages:1240, kws:28400, topKw:'applicant tracking system',    overlap:34, gap:189 },
    { domain:'ashby.com',      da:61, pages:480,  kws:9200,  topKw:'ats for startups',             overlap:21, gap:97  },
    { domain:'lever.co',       da:69, pages:890,  kws:15600, topKw:'recruiting software platform', overlap:18, gap:142 },
  ];
  const serp = [
    { pos:1, domain:'greenhouse.io', title:'Greenhouse ATS — Modern Hiring Software', kw:'applicant tracking system' },
    { pos:2, domain:'lever.co',      title:'Lever — Recruiting Software & ATS',        kw:'applicant tracking system' },
    { pos:3, domain:'ashby.com',     title:'Ashby — All-in-one Recruiting Platform',   kw:'applicant tracking system' },
    { pos:4, domain:'workable.com',  title:'Workable ATS — Hire Better People Faster', kw:'applicant tracking system' },
    { pos:5, domain:'bamboohr.com',  title:'BambooHR — HR Software for Small Business',kw:'applicant tracking system' },
  ];
  return (
    <div style={{flex:1,overflow:'auto',padding:'24px 28px',background:'var(--bg)'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:22}}>
        <button onClick={()=>navigate('workspace')} style={{border:'none',background:'transparent',color:'var(--text-mut)',cursor:'pointer',fontSize:18,lineHeight:1,padding:0}}>←</button>
        <Icon name="branch" size={14}/><span style={{fontSize:14,fontWeight:600,color:'var(--text)'}}>Competitor analysis</span>
        <Badge status="complete"/>
        <span className="mono" style={{fontSize:11,color:'var(--text-mut)'}}>3 competitors · stub data</span>
        <div style={{flex:1}}/>
        <GhostBtn><Icon name="dl" size={11}/> Export</GhostBtn>
      </div>

      {/* Competitor cards */}
      <SectionHead title="Domain overview"/>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:24}}>
        {comps.map(c=>(
          <div key={c.domain} style={{border:'1px solid var(--border)',borderRadius:7,background:'var(--bg-card)',padding:'14px 16px'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
              <div style={{width:22,height:22,borderRadius:4,background:'var(--bg-hover)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'var(--text)'}}>{c.domain[0].toUpperCase()}</div>
              <span style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{c.domain}</span>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              {[['DA',c.da],['Pages',c.pages.toLocaleString()],['Keywords',c.kws.toLocaleString()],['KW Gap',c.gap]].map(([l,v])=>(
                <div key={l} style={{padding:'8px 10px',background:'var(--bg)',borderRadius:5}}>
                  <div style={{fontSize:10,color:'var(--text-dim)',marginBottom:2}}>{l}</div>
                  <div style={{fontSize:16,fontWeight:600,color:'var(--text)',letterSpacing:-.3}}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{marginTop:10,fontSize:11,color:'var(--text-mut)'}}>
              Top KW: <span className="mono" style={{color:'var(--text)',fontSize:10}}>{c.topKw}</span>
            </div>
          </div>
        ))}
      </div>

      {/* SERP snapshot */}
      <SectionHead title="SERP snapshot · applicant tracking system"/>
      <div style={{border:'1px solid var(--border)',borderRadius:7,overflow:'hidden'}}>
        {serp.map((r,i)=>(
          <div key={i} style={{display:'grid',gridTemplateColumns:'36px 1fr 160px',gap:10,padding:'10px 14px',borderBottom:i<serp.length-1?'1px solid var(--border)':'none',alignItems:'center',background: i===0?'var(--accent-dim)':'transparent'}}>
            <span className="mono" style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{r.pos}</span>
            <div>
              <div style={{fontSize:13,color:'var(--running)',marginBottom:2}}>{r.title}</div>
              <div className="mono" style={{fontSize:10,color:'var(--text-dim)'}}>{r.domain}</div>
            </div>
            <div style={{textAlign:'right',fontSize:11,color:'var(--text-mut)'}}>
              {comps.find(c=>c.domain===r.domain) ? <span style={{color:'var(--err)'}}>competitor</span> : <span style={{color:'var(--text-dim)'}}>other</span>}
            </div>
          </div>
        ))}
        <div style={{padding:'10px 14px',background:'var(--warn-dim)',display:'flex',alignItems:'center',gap:8}}>
          <Icon name="info" size={12}/><span style={{fontSize:12,color:'var(--warn)'}}>whitecarrot.io not ranking in top 10 for this keyword — opportunity gap</span>
        </div>
      </div>
    </div>
  );
};

// ── Content Audit ────────────────────────────────────────────────────────
const ContentAuditResults = ({ navigate }) => {
  const pages = [
    { url:'/blog/ats-for-startups',          title:'Best ATS for Startups 2026',             score:82, words:2100, kw:'ats for startups',           issues:['missing H2 structure','no FAQ schema'] },
    { url:'/features/applicant-tracking',    title:'Applicant Tracking Features — Whitecarrot',score:74,words:1450,kw:'applicant tracking software', issues:['thin content < 1500w','weak CTA'] },
    { url:'/compare/greenhouse-alternative', title:'Greenhouse Alternative',                  score:68, words:980,  kw:'greenhouse alternatives',     issues:['very thin content','no internal links','missing meta description'] },
    { url:'/blog/recruiting-software-guide', title:'Recruiting Software: Complete Guide',     score:61, words:3200, kw:'recruiting software',         issues:['outdated stats 2023','no images','slow page speed'] },
    { url:'/pricing',                        title:'Pricing — Whitecarrot',                   score:55, words:320,  kw:'ats pricing',                 issues:['no structured FAQ','short content'] },
  ];
  return (
    <div style={{flex:1,overflow:'auto',padding:'24px 28px',background:'var(--bg)'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:22}}>
        <button onClick={()=>navigate('workspace')} style={{border:'none',background:'transparent',color:'var(--text-mut)',cursor:'pointer',fontSize:18,lineHeight:1,padding:0}}>←</button>
        <Icon name="eye" size={14}/><span style={{fontSize:14,fontWeight:600,color:'var(--text)'}}>Content audit</span>
        <Badge status="complete"/>
        <span className="mono" style={{fontSize:11,color:'var(--text-mut)'}}>34 pages · stub data</span>
        <div style={{flex:1}}/>
        <GhostBtn><Icon name="dl" size={11}/> Export</GhostBtn>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:22}}>
        <StatCard label="pages crawled" value="34" sub="whitecarrot.io"/>
        <StatCard label="avg score"     value="67" sub="out of 100" bar={0.67}/>
        <StatCard label="issues found"  value="48" sub="across all pages"/>
        <StatCard label="quick wins"    value="11" sub="score ≥ 70, fixable" accent/>
      </div>
      <SectionHead title="Page scores"/>
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {pages.map((p,i)=>(
          <div key={i} style={{border:'1px solid var(--border)',borderRadius:7,background:'var(--bg-card)',padding:'12px 14px'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
              <div style={{width:36,height:36,borderRadius:6,background:p.score>=75?'var(--ok-dim)':p.score>=60?'var(--warn-dim)':'var(--err-dim)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:13,color:p.score>=75?'var(--ok)':p.score>=60?'var(--warn)':'var(--err)',flexShrink:0}}>
                {p.score}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,color:'var(--text)',fontWeight:500,marginBottom:2}}>{p.title}</div>
                <div className="mono" style={{fontSize:10,color:'var(--text-dim)'}}>{p.url} · {p.words.toLocaleString()} words</div>
              </div>
              <span className="mono" style={{fontSize:10,padding:'2px 8px',borderRadius:3,background:'var(--bg-hover)',color:'var(--text-mut)'}}>{p.kw}</span>
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
              {p.issues.map((iss,j)=>(
                <span key={j} style={{fontSize:11,padding:'2px 8px',borderRadius:4,background:'var(--warn-dim)',color:'var(--warn)',border:'1px solid var(--warn)'}}>
                  ⚠ {iss}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── LLM Visibility ───────────────────────────────────────────────────────
const LLMVisibilityResults = ({ navigate }) => {
  const llms = [
    { name:'ChatGPT (GPT-4o)', cited:3, queries:20, rate:15, mentions:['ats for startups','applicant tracking tools','hiring software for small teams'] },
    { name:'Perplexity',       cited:4, queries:20, rate:20, mentions:['ats comparison 2026','greenhouse vs ashby vs whitecarrot'] },
    { name:'Claude',           cited:2, queries:20, rate:10, mentions:['best recruiting software startups'] },
    { name:'Gemini',           cited:1, queries:20, rate:5,  mentions:['ats for agencies'] },
  ];
  return (
    <div style={{flex:1,overflow:'auto',padding:'24px 28px',background:'var(--bg)'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:22}}>
        <button onClick={()=>navigate('workspace')} style={{border:'none',background:'transparent',color:'var(--text-mut)',cursor:'pointer',fontSize:18,lineHeight:1,padding:0}}>←</button>
        <Icon name="globe" size={14}/><span style={{fontSize:14,fontWeight:600,color:'var(--text)'}}>LLM visibility</span>
        <Badge status="complete"/>
        <span className="mono" style={{fontSize:11,color:'var(--text-mut)'}}>4 LLMs · stub data</span>
        <div style={{flex:1}}/>
        <GhostBtn><Icon name="dl" size={11}/> Export</GhostBtn>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:22}}>
        <StatCard label="LLMs checked" value="4"   sub="GPT · Perplexity · Claude · Gemini"/>
        <StatCard label="avg citation"  value="12%" sub="across 80 queries" bar={0.12}/>
        <StatCard label="total queries" value="80"  sub="20 per LLM"/>
        <StatCard label="cited queries" value="10"  sub="whitecarrot.io mentioned" accent/>
      </div>
      <SectionHead title="Citation rate by LLM"/>
      <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:24}}>
        {llms.map((l,i)=>(
          <div key={i} style={{border:'1px solid var(--border)',borderRadius:7,background:'var(--bg-card)',padding:'14px 16px'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
              <div style={{fontSize:13,fontWeight:600,color:'var(--text)',flex:1}}>{l.name}</div>
              <span style={{fontSize:22,fontWeight:700,color:l.rate>=15?'var(--ok)':l.rate>=10?'var(--warn)':'var(--err)',letterSpacing:-.3}}>{l.rate}%</span>
              <span style={{fontSize:11,color:'var(--text-mut)'}}>citation rate</span>
            </div>
            <div style={{height:6,borderRadius:3,background:'var(--bg-hover)',overflow:'hidden',marginBottom:10}}>
              <div style={{width:`${l.rate*4}%`,height:'100%',background:l.rate>=15?'var(--ok)':l.rate>=10?'var(--warn)':'var(--err)',transition:'width .5s ease'}}/>
            </div>
            <div style={{fontSize:11,color:'var(--text-dim)',marginBottom:6}}>Cited in queries:</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
              {l.mentions.map((m,j)=>(
                <span key={j} className="mono" style={{fontSize:10,padding:'2px 8px',borderRadius:3,background:'var(--bg-hover)',color:'var(--text-mut)'}}>{m}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{border:'1px solid var(--border)',borderRadius:7,background:'var(--bg-card)',padding:'14px 16px'}}>
        <div style={{fontSize:12,fontWeight:600,color:'var(--text)',marginBottom:6}}>💡 GEO recommendations</div>
        {[
          'Add structured FAQ schema to top-10 keyword pages to increase LLM citation probability',
          'Create an "ATS comparison" page targeting head-to-head queries (Greenhouse vs Ashby vs Whitecarrot)',
          'Publish original data (pricing transparency, onboarding speed benchmarks) — LLMs prefer citing primary sources',
        ].map((rec,i)=>(
          <div key={i} style={{display:'flex',gap:8,padding:'7px 0',borderTop:i?'1px solid var(--border)':'none',fontSize:12,color:'var(--text-mut)',lineHeight:1.5}}>
            <span style={{color:'var(--accent)',flexShrink:0}}>→</span>{rec}
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Strategy Brief ───────────────────────────────────────────────────────
const StrategyBriefScreen = ({ navigate }) => {
  const [activeTab, setActiveTab] = React.useState('summary');
  const [approved, setApproved]   = React.useState(false);
  const [copied,   setCopied]     = React.useState(false);

  const tabs = [
    { id:'summary',    label:'Executive Summary', icon:'sparkle'  },
    { id:'keywords',   label:'Keyword Intelligence', icon:'layers' },
    { id:'clusters',   label:'Content Clusters',  icon:'grid'     },
    { id:'competitor', label:'Competitor Gap',    icon:'branch'   },
    { id:'llm',        label:'LLM Visibility',    icon:'globe'    },
    { id:'plan',       label:'Action Plan',       icon:'zap'      },
  ];

  const copyLink = () => { setCopied(true); setTimeout(()=>setCopied(false), 2000); };

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',minHeight:0,overflow:'hidden',background:'var(--bg)'}}>
      {/* Header */}
      <div style={{padding:'14px 24px',borderBottom:'1px solid var(--border)',background:'var(--bg-elev)',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
          <button onClick={()=>navigate('workspace')} style={{border:'none',background:'transparent',color:'var(--text-mut)',cursor:'pointer',fontSize:18,lineHeight:1,padding:0}}>←</button>
          <Icon name="sparkle" size={14}/>
          <span style={{fontSize:15,fontWeight:700,letterSpacing:-.3,color:'var(--text)'}}>Strategy Brief</span>
          <span className="mono" style={{fontSize:10,padding:'2px 8px',borderRadius:3,background:'var(--accent-dim)',color:'var(--accent)'}}>Gate-1</span>
          <span className="mono" style={{fontSize:10,color:'var(--text-dim)'}}>whitecarrot.io · 26 weeks · synth by claude-sonnet-4-6</span>
          <div style={{flex:1}}/>
          <GhostBtn onClick={copyLink}>
            <Icon name="link" size={11}/> {copied ? '✓ Copied!' : 'Share link'}
          </GhostBtn>
          <GhostBtn><Icon name="dl" size={11}/> Export PDF</GhostBtn>
          <button onClick={()=>setApproved(true)} style={{
            display:'inline-flex',alignItems:'center',gap:6,padding:'7px 14px',
            border:'none',borderRadius:6,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit',
            background: approved ? 'var(--ok)' : 'var(--accent)',
            color:'#fff',
          }}>
            {approved ? <><Icon name="check" size={12}/> Approved — monitoring queued</> : <><Icon name="check" size={12}/> Approve & save strategy</>}
          </button>
        </div>
        {/* Stat strip */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:8}}>
          {[
            {l:'keywords',    v:'412',  s:'prioritised'},
            {l:'clusters',    v:'6',    s:'topic groups'},
            {l:'competitor gap',v:'189',s:'uncontested kws'},
            {l:'content pieces',v:'24', s:'recommended'},
            {l:'llm citation', v:'12%', s:'avg across 4 LLMs'},
            {l:'est. traffic',  v:'48k', s:'in 26 weeks'},
          ].map(s=>(
            <div key={s.l} style={{padding:'8px 10px',border:'1px solid var(--border)',borderRadius:5,background:'var(--bg-card)'}}>
              <div className="mono" style={{fontSize:9,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:.7}}>{s.l}</div>
              <div style={{fontSize:18,fontWeight:700,letterSpacing:-.4,color:'var(--text)',lineHeight:1.1,marginTop:2}}>{s.v}</div>
              <div className="mono" style={{fontSize:9,color:'var(--text-mut)',marginTop:2}}>{s.s}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{display:'flex',gap:0,borderBottom:'1px solid var(--border)',background:'var(--bg-elev)',flexShrink:0,overflowX:'auto'}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{
            display:'flex',alignItems:'center',gap:6,padding:'10px 16px',
            border:'none',borderBottom: activeTab===t.id ? '2px solid var(--accent)' : '2px solid transparent',
            background:'transparent',color: activeTab===t.id ? 'var(--accent)' : 'var(--text-mut)',
            fontSize:12,fontWeight: activeTab===t.id ? 600:400,cursor:'pointer',fontFamily:'inherit',
            whiteSpace:'nowrap',
          }}>
            <Icon name={t.icon} size={12}/>{t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{flex:1,overflow:'auto',minHeight:0,padding:'24px 28px'}}>
        {activeTab === 'summary'    && <BriefSummary/>}
        {activeTab === 'keywords'   && <BriefKeywords/>}
        {activeTab === 'clusters'   && <BriefClusters/>}
        {activeTab === 'competitor' && <BriefCompetitor/>}
        {activeTab === 'llm'        && <BriefLLM/>}
        {activeTab === 'plan'       && <BriefActionPlan/>}
      </div>
    </div>
  );
};

// ── Tab: Executive Summary ───────────────────────────────────────────────
const BriefSummary = () => (
  <div style={{maxWidth:740,margin:'0 auto',display:'flex',flexDirection:'column',gap:20}}>
    <div style={{border:'1px solid var(--accent)',borderRadius:8,padding:'18px 20px',background:'var(--accent-dim)'}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
        <PrismLogo size={16}/>
        <span style={{fontSize:12,fontWeight:600,color:'var(--accent)'}}>Claude synthesis · 9.4s</span>
      </div>
      <div style={{fontSize:14,color:'var(--text)',lineHeight:1.7}}>
        <b>whitecarrot.io</b> is well-positioned for a keyword-led growth sprint but is currently invisible in 3 of 4 major LLMs. The highest-leverage opportunity is a cluster of
        <b> bottom-of-funnel comparison and alternative pages</b> targeting <em>Greenhouse</em> and <em>Ashby</em> — terms with moderate difficulty (KD 22–38) where competitors
        have strong brand pages but weak SEO infrastructure. Pairing this with <b>FAQ schema on top-10 volume keywords</b> would meaningfully improve LLM citation rate.
        Recommended first 90 days: ship 6 high-priority content pieces, fix 5 thin-content pages, and publish one original benchmark report.
      </div>
    </div>

    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
      {[
        { icon:'zap',    title:'Biggest opportunity', body:'189 uncontested keywords where competitors don\'t have indexed pages. Primarily long-tail ATS alternatives + comparison queries.' },
        { icon:'trend',  title:'Fastest win',         body:'3 existing pages score < 70 but rank in positions 11–20 — one content refresh each could unlock top-10 and 2,400 visits/mo.' },
        { icon:'globe',  title:'LLM gap',             body:'Only 12% citation rate across GPT-4o, Perplexity, Claude, Gemini. Structured FAQ schema + original data are the main lever.' },
        { icon:'layers', title:'Content volume',      body:'6 clusters → 24 recommended pieces. Suggested pace: 3 per month over 8 months, starting with BOFU comparison pages.' },
      ].map((c,i)=>(
        <div key={i} style={{border:'1px solid var(--border)',borderRadius:7,padding:'14px 16px',background:'var(--bg-card)'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,color:'var(--accent)'}}>
            <Icon name={c.icon} size={13}/><span style={{fontSize:12,fontWeight:600,color:'var(--text)'}}>{c.title}</span>
          </div>
          <div style={{fontSize:12,color:'var(--text-mut)',lineHeight:1.6}}>{c.body}</div>
        </div>
      ))}
    </div>

    <div style={{border:'1px solid var(--border)',borderRadius:7,padding:'14px 16px',background:'var(--bg-card)'}}>
      <div style={{fontSize:12,fontWeight:600,color:'var(--text)',marginBottom:10}}>Priority order</div>
      {[
        { n:'1', t:'BOFU comparison + alternative pages (6 pages)', rationale:'High purchase intent, low competition, directly converts vs Greenhouse/Ashby', impact:'High' },
        { n:'2', t:'FAQ schema on top-10 volume keywords',           rationale:'Unlocks AI Overview + LLM citation — foundational for GEO',                  impact:'High' },
        { n:'3', t:'Refresh 5 thin content pages',                  rationale:'Existing pages in positions 11-20; one refresh each could land top 10',        impact:'Med'  },
        { n:'4', t:'Original benchmark report: ATS onboarding speed', rationale:'Primary source LLMs cite — drives citation rate and backlinks',              impact:'Med'  },
      ].map((r,i)=>(
        <div key={i} style={{display:'grid',gridTemplateColumns:'24px 1fr 180px 50px',gap:10,padding:'8px 0',borderTop:i?'1px solid var(--border)':'none',fontSize:12,alignItems:'start'}}>
          <span className="mono" style={{color:'var(--text-dim)',fontSize:11}}>{r.n}</span>
          <div>
            <div style={{color:'var(--text)',fontWeight:500,marginBottom:2}}>{r.t}</div>
            <div style={{color:'var(--text-mut)',fontSize:11}}>{r.rationale}</div>
          </div>
          <span style={{color:'var(--text-dim)',fontSize:11}}></span>
          <span style={{padding:'2px 7px',borderRadius:3,fontSize:10,background:r.impact==='High'?'var(--ok-dim)':'var(--warn-dim)',color:r.impact==='High'?'var(--ok)':'var(--warn)',textAlign:'center',height:'fit-content'}}>{r.impact}</span>
        </div>
      ))}
    </div>
  </div>
);

// ── Tab: Keyword Intelligence ────────────────────────────────────────────
const BriefKeywords = () => {
  const pools = [
    { stage:'BOFU', color:'var(--ok)', label:'Bottom of funnel', count:64, avgVol:2100, avgKD:26, sample:['greenhouse alternatives','ashby vs greenhouse','best ats for startups','whitecarrot review'] },
    { stage:'MOFU', color:'var(--warn)', label:'Middle of funnel', count:118, avgVol:5400, avgKD:39, sample:['best ats for small business','recruiting software comparison','ats integrations slack','ats with candidate scoring'] },
    { stage:'TOFU', color:'var(--running)', label:'Top of funnel', count:230, avgVol:32000, avgKD:61, sample:['applicant tracking system','recruiting software','hr software for startups','free ats software'] },
  ];
  return (
    <div style={{maxWidth:740,margin:'0 auto',display:'flex',flexDirection:'column',gap:16}}>
      <div style={{fontSize:13,color:'var(--text-mut)',lineHeight:1.6}}>412 keywords grouped by funnel stage. Prioritise <b style={{color:'var(--text)'}}>BOFU first</b> — highest intent, lowest competition, fastest path to signups.</div>
      {pools.map((p,i)=>(
        <div key={i} style={{border:`1px solid var(--border)`,borderLeft:`3px solid ${p.color}`,borderRadius:7,background:'var(--bg-card)',overflow:'hidden'}}>
          <div style={{padding:'12px 16px',display:'flex',alignItems:'center',gap:12,borderBottom:'1px solid var(--border)'}}>
            <span style={{fontSize:13,fontWeight:700,color:p.color,minWidth:44}} className="mono">{p.stage}</span>
            <span style={{fontSize:13,color:'var(--text)'}}>{p.label}</span>
            <div style={{flex:1}}/>
            <span className="mono" style={{fontSize:11,color:'var(--text-dim)'}}>{p.count} keywords</span>
            <span className="mono" style={{fontSize:11,color:'var(--text-dim)'}}>avg vol {p.avgVol.toLocaleString()}/mo</span>
            <span className="mono" style={{fontSize:11,color:'var(--text-dim)'}}>avg KD {p.avgKD}</span>
          </div>
          <div style={{padding:'10px 16px',display:'flex',flexWrap:'wrap',gap:6}}>
            {p.sample.map((kw,j)=>(
              <span key={j} className="mono" style={{fontSize:11,padding:'3px 8px',borderRadius:4,background:'var(--bg-hover)',color:'var(--text-mut)'}}>{kw}</span>
            ))}
            <span style={{fontSize:11,color:'var(--text-dim)',alignSelf:'center'}}>+{p.count-p.sample.length} more</span>
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Tab: Content Cluster Map ─────────────────────────────────────────────
const BriefClusters = () => {
  const [open, setOpen] = React.useState(0);
  const clusters = [
    { id:0, hub:'ATS Alternatives Hub', priority:'P0', kws:38, traffic:'12.4k', difficulty:'Low', color:'var(--ok)',
      hub_page:{ title:'Best Greenhouse Alternatives in 2026', kd:28, vol:3600 },
      spokes:[
        { title:'Greenhouse vs Ashby vs Whitecarrot — Full Comparison', kd:22, vol:1900 },
        { title:'Greenhouse Alternative for Startups',                   kd:19, vol:880  },
        { title:'Ashby Alternative: Why Startups Choose Whitecarrot',    kd:17, vol:590  },
        { title:'Lever Alternative for Fast-Growing Teams',              kd:20, vol:480  },
      ]
    },
    { id:1, hub:'ATS for Startups Hub', priority:'P0', kws:52, traffic:'18.1k', difficulty:'Med', color:'var(--ok)',
      hub_page:{ title:'Best ATS for Startups in 2026', kd:38, vol:8100 },
      spokes:[
        { title:'ATS for Series A Startups: What to Look For',          kd:24, vol:1200 },
        { title:'ATS with Slack Integration — Buyer\'s Guide',           kd:28, vol:720  },
        { title:'ATS Pricing: Greenhouse vs Ashby vs Whitecarrot',      kd:18, vol:1100 },
        { title:'How to Choose an ATS (Startup Checklist)',              kd:29, vol:2100 },
      ]
    },
    { id:2, hub:'Applicant Tracking System Hub', priority:'P1', kws:89, traffic:'42.6k', difficulty:'High', color:'var(--warn)',
      hub_page:{ title:'What is an Applicant Tracking System?', kd:55, vol:18100 },
      spokes:[
        { title:'ATS Software Features Explained',                       kd:41, vol:3300 },
        { title:'ATS for Small Business: Complete Guide',                kd:44, vol:5400 },
        { title:'ATS with Candidate Scoring — How It Works',            kd:18, vol:480  },
        { title:'ATS for Recruiting Agencies',                           kd:31, vol:1300 },
      ]
    },
    { id:3, hub:'Recruiting Software Hub', priority:'P1', kws:71, traffic:'31.2k', difficulty:'High', color:'var(--warn)',
      hub_page:{ title:'Best Recruiting Software in 2026', kd:61, vol:22200 },
      spokes:[
        { title:'Recruiting Software for HR Teams',                      kd:38, vol:4400 },
        { title:'Free Recruiting Software vs Paid: Is It Worth It?',    kd:29, vol:2900 },
        { title:'Recruiting Software with AI Features',                  kd:44, vol:1800 },
        { title:'Recruiting Software Integrations Guide',                kd:32, vol:1100 },
      ]
    },
    { id:4, hub:'Content Audit Refresh Hub', priority:'P2', kws:28, traffic:'6.8k', difficulty:'Low', color:'var(--running)',
      hub_page:{ title:'Whitecarrot ATS Features Overview', kd:15, vol:1200 },
      spokes:[
        { title:'Whitecarrot vs Greenhouse — Honest Comparison',         kd:12, vol:210  },
        { title:'Whitecarrot Pricing in 2026',                           kd:10, vol:390  },
        { title:'Whitecarrot Onboarding Guide for HR Teams',             kd:8,  vol:180  },
      ]
    },
    { id:5, hub:'GEO / LLM Visibility Hub', priority:'P2', kws:22, traffic:'4.1k', difficulty:'Low', color:'var(--running)',
      hub_page:{ title:'ATS Tools Recommended by AI in 2026', kd:14, vol:880 },
      spokes:[
        { title:'FAQ: Which ATS Do AI Assistants Recommend?',            kd:9,  vol:390  },
        { title:'How to Get Your SaaS Listed in ChatGPT Answers',        kd:18, vol:1200 },
        { title:'ATS Comparison: What Perplexity Says in 2026',         kd:11, vol:320  },
      ]
    },
  ];

  return (
    <div style={{maxWidth:800,margin:'0 auto',display:'flex',flexDirection:'column',gap:10}}>
      <div style={{fontSize:13,color:'var(--text-mut)',marginBottom:6,lineHeight:1.6}}>6 content clusters — each has one <b style={{color:'var(--text)'}}>hub page</b> (pillar) and supporting spokes. Start with P0 clusters.</div>
      {clusters.map((c,i)=>(
        <div key={i} style={{border:`1px solid var(--border)`,borderLeft:`3px solid ${c.color}`,borderRadius:7,background:'var(--bg-card)',overflow:'hidden'}}>
          <div onClick={()=>setOpen(open===i?-1:i)} style={{padding:'12px 16px',display:'flex',alignItems:'center',gap:10,cursor:'pointer'}}>
            <span style={{fontSize:10,padding:'2px 7px',borderRadius:3,background:c.priority==='P0'?'var(--ok-dim)':c.priority==='P1'?'var(--warn-dim)':'var(--running-dim)',color:c.priority==='P0'?'var(--ok)':c.priority==='P1'?'var(--warn)':'var(--running)',fontWeight:600}} className="mono">{c.priority}</span>
            <span style={{fontSize:13,fontWeight:600,color:'var(--text)',flex:1}}>{c.hub}</span>
            <span className="mono" style={{fontSize:10,color:'var(--text-dim)'}}>{c.kws} kws</span>
            <span className="mono" style={{fontSize:10,color:'var(--text-dim)'}}>{c.traffic}/mo est.</span>
            <span style={{fontSize:10,padding:'2px 7px',borderRadius:3,background:'var(--bg-hover)',color:'var(--text-dim)'}}>{c.difficulty} KD</span>
            <Icon name={open===i?'chev':'chevR'} size={11}/>
          </div>
          {open===i && (
            <div style={{borderTop:'1px solid var(--border)',padding:'12px 16px'}} className="fade-up">
              {/* Hub page */}
              <div style={{marginBottom:10}}>
                <div style={{fontSize:10,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:.8,marginBottom:6}}>Hub page (pillar)</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 60px 80px',gap:8,padding:'8px 10px',background:'var(--bg)',borderRadius:5,border:`1px solid ${c.color}`,alignItems:'center'}}>
                  <span style={{fontSize:12,color:'var(--text)',fontWeight:500}}>{c.hub_page.title}</span>
                  <span className="mono" style={{fontSize:10,color:'var(--text-dim)',textAlign:'right'}}>KD {c.hub_page.kd}</span>
                  <span className="mono" style={{fontSize:10,color:'var(--text-dim)',textAlign:'right'}}>{c.hub_page.vol.toLocaleString()}/mo</span>
                </div>
              </div>
              {/* Spoke pages */}
              <div>
                <div style={{fontSize:10,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:.8,marginBottom:6}}>Spoke pages ({c.spokes.length})</div>
                <div style={{display:'flex',flexDirection:'column',gap:4}}>
                  {c.spokes.map((s,j)=>(
                    <div key={j} style={{display:'grid',gridTemplateColumns:'20px 1fr 60px 80px',gap:8,padding:'6px 10px',background:'var(--bg-hover)',borderRadius:4,alignItems:'center'}}>
                      <span style={{color:'var(--text-dim)',fontSize:11}}>↳</span>
                      <span style={{fontSize:12,color:'var(--text-mut)'}}>{s.title}</span>
                      <span className="mono" style={{fontSize:10,color:'var(--text-dim)',textAlign:'right'}}>KD {s.kd}</span>
                      <span className="mono" style={{fontSize:10,color:'var(--text-dim)',textAlign:'right'}}>{s.vol.toLocaleString()}/mo</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// ── Tab: Competitor Gap ──────────────────────────────────────────────────
const BriefCompetitor = () => {
  const gaps = [
    { kw:'greenhouse alternatives',          vol:3600,  kd:34, youRank:'—',  ghRank:1,  ashRank:'—',  gap:'High'  },
    { kw:'ats for startups',                 vol:8100,  kd:38, youRank:'—',  ghRank:4,  ashRank:2,    gap:'High'  },
    { kw:'ashby vs greenhouse',              vol:1900,  kd:22, youRank:'—',  ghRank:3,  ashRank:1,    gap:'High'  },
    { kw:'lever alternative',                vol:1100,  kd:20, youRank:'—',  ghRank:'—',ashRank:'—',  gap:'High'  },
    { kw:'best ats for small business',      vol:5400,  kd:41, youRank:18,   ghRank:3,  ashRank:1,    gap:'Med'   },
    { kw:'recruiting software comparison',   vol:2200,  kd:33, youRank:'—',  ghRank:2,  ashRank:5,    gap:'Med'   },
    { kw:'free ats software',                vol:6600,  kd:44, youRank:'—',  ghRank:2,  ashRank:'—',  gap:'Med'   },
    { kw:'ats integrations slack',           vol:720,   kd:28, youRank:'—',  ghRank:'—',ashRank:'—',  gap:'Easy'  },
  ];
  const gapColor = (g)=>({High:'var(--err)',Med:'var(--warn)',Easy:'var(--ok)'})[g]||'var(--text-dim)';
  const gapBg    = (g)=>({High:'var(--err-dim)',Med:'var(--warn-dim)',Easy:'var(--ok-dim)'})[g]||'var(--bg-hover)';
  return (
    <div style={{maxWidth:760,margin:'0 auto',display:'flex',flexDirection:'column',gap:16}}>
      <div style={{fontSize:13,color:'var(--text-mut)',lineHeight:1.6}}>Keywords where Greenhouse or Ashby rank top-5 and <b style={{color:'var(--text)'}}>whitecarrot.io has no indexed page</b>. These are direct conversion opportunities.</div>
      <div style={{border:'1px solid var(--border)',borderRadius:7,overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
          <thead style={{background:'var(--bg-elev)'}}>
            <tr style={{borderBottom:'1px solid var(--border)'}}>
              {['Keyword','Vol/mo','KD','You','Greenhouse','Ashby','Gap'].map((h,i)=>(
                <th key={i} style={{padding:'8px 12px',textAlign:i>1?'center':'left',fontSize:10,color:'var(--text-dim)',fontWeight:500,letterSpacing:.8,textTransform:'uppercase',fontFamily:'JetBrains Mono,monospace'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gaps.map((r,i)=>(
              <tr key={i} style={{borderBottom:'1px solid var(--border)',background:r.youRank==='—'?'transparent':'var(--ok-dim)'}}>
                <td style={{padding:'8px 12px',color:'var(--text)'}}>{r.kw}</td>
                <td style={{padding:'8px 12px',fontFamily:'JetBrains Mono,monospace',fontSize:11}}>{r.vol.toLocaleString()}</td>
                <td style={{padding:'8px 12px',textAlign:'center',fontFamily:'JetBrains Mono,monospace',fontSize:11}}>{r.kd}</td>
                <td style={{padding:'8px 12px',textAlign:'center',fontFamily:'JetBrains Mono,monospace',fontSize:11,color:r.youRank==='—'?'var(--err)':'var(--ok)',fontWeight:600}}>{r.youRank}</td>
                <td style={{padding:'8px 12px',textAlign:'center',fontFamily:'JetBrains Mono,monospace',fontSize:11,color:'var(--text-mut)'}}>{r.ghRank}</td>
                <td style={{padding:'8px 12px',textAlign:'center',fontFamily:'JetBrains Mono,monospace',fontSize:11,color:'var(--text-mut)'}}>{r.ashRank}</td>
                <td style={{padding:'8px 12px',textAlign:'center'}}>
                  <span style={{fontSize:10,padding:'2px 7px',borderRadius:3,background:gapBg(r.gap),color:gapColor(r.gap),fontWeight:600}}>{r.gap}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{padding:'12px 16px',border:'1px solid var(--border)',borderRadius:7,background:'var(--bg-card)',fontSize:12,color:'var(--text-mut)',lineHeight:1.6}}>
        <b style={{color:'var(--text)'}}>Insight:</b> 189 total keywords where you have no indexed page but competitors do. The highest-ROI action is a single <em>"Greenhouse alternatives"</em> landing page targeting 8 keywords simultaneously. Estimated: 2 hours to write, 4-week ramp to top-5.
      </div>
    </div>
  );
};

// ── Tab: LLM Visibility ──────────────────────────────────────────────────
const BriefLLM = () => (
  <div style={{maxWidth:740,margin:'0 auto',display:'flex',flexDirection:'column',gap:16}}>
    <div style={{fontSize:13,color:'var(--text-mut)',lineHeight:1.6}}>How often <b style={{color:'var(--text)'}}>whitecarrot.io</b> appears in AI-generated answers for target queries. Stub data — real Perplexity API in Research Sprint sub-project.</div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
      {[
        { name:'GPT-4o',    rate:15, queries:20, cited:3,  color:'var(--ok)'      },
        { name:'Perplexity',rate:20, queries:20, cited:4,  color:'var(--ok)'      },
        { name:'Claude',    rate:10, queries:20, cited:2,  color:'var(--warn)'    },
        { name:'Gemini',    rate:5,  queries:20, cited:1,  color:'var(--err)'     },
      ].map((l,i)=>(
        <div key={i} style={{border:'1px solid var(--border)',borderRadius:7,padding:'14px',background:'var(--bg-card)',display:'flex',flexDirection:'column',gap:8}}>
          <div style={{fontSize:12,fontWeight:600,color:'var(--text)'}}>{l.name}</div>
          <div style={{fontSize:28,fontWeight:700,color:l.color,letterSpacing:-.5}}>{l.rate}%</div>
          <div style={{height:5,borderRadius:3,background:'var(--bg-hover)',overflow:'hidden'}}>
            <div style={{width:`${l.rate*4}%`,height:'100%',background:l.color}}/>
          </div>
          <div className="mono" style={{fontSize:10,color:'var(--text-dim)'}}>{l.cited}/{l.queries} queries cited</div>
        </div>
      ))}
    </div>
    <div style={{border:'1px solid var(--border)',borderRadius:7,background:'var(--bg-card)',padding:'16px'}}>
      <div style={{fontSize:13,fontWeight:600,color:'var(--text)',marginBottom:12}}>GEO action items to improve citation rate</div>
      {[
        { action:'Add FAQ schema to top-10 keyword pages',                         impact:'+8–12%', effort:'Low'  },
        { action:'Publish "ATS tools recommended by AI" landing page',             impact:'+5–8%',  effort:'Low'  },
        { action:'Create original benchmark: ATS onboarding speed study',          impact:'+10–15%',effort:'Med'  },
        { action:'Add "About" structured data with product category + use cases',  impact:'+3–5%',  effort:'Low'  },
        { action:'Get listed on G2, Capterra with keyword-rich descriptions',       impact:'+5–10%', effort:'Med'  },
      ].map((a,i)=>(
        <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 80px 60px',gap:10,padding:'8px 0',borderTop:i?'1px solid var(--border)':'none',alignItems:'center'}}>
          <span style={{fontSize:12,color:'var(--text)'}}>{a.action}</span>
          <span style={{fontSize:11,color:'var(--ok)',fontWeight:600,textAlign:'right'}}>{a.impact}</span>
          <span style={{fontSize:10,padding:'2px 7px',borderRadius:3,background:a.effort==='Low'?'var(--ok-dim)':'var(--warn-dim)',color:a.effort==='Low'?'var(--ok)':'var(--warn)',textAlign:'center'}}>{a.effort}</span>
        </div>
      ))}
    </div>
  </div>
);

// ── Tab: Action Plan ─────────────────────────────────────────────────────
const BriefActionPlan = () => {
  const months = [
    { label:'Month 1–2', theme:'BOFU quick wins', color:'var(--ok)', items:[
      { type:'Create', title:'Greenhouse alternatives landing page',           kd:34, vol:3600, cluster:'ATS Alternatives' },
      { type:'Create', title:'Ashby vs Greenhouse vs Whitecarrot comparison',  kd:22, vol:1900, cluster:'ATS Alternatives' },
      { type:'Create', title:'Best ATS for startups — guide',                  kd:38, vol:8100, cluster:'ATS for Startups'  },
      { type:'Fix',    title:'Refresh /features/applicant-tracking (thin)',     kd:null, vol:null, cluster:'Content audit'  },
      { type:'Fix',    title:'Add FAQ schema to /pricing + /features pages',   kd:null, vol:null, cluster:'GEO'            },
    ]},
    { label:'Month 3–4', theme:'MOFU authority', color:'var(--warn)', items:[
      { type:'Create', title:'How to choose an ATS — complete checklist',      kd:29, vol:2100, cluster:'ATS for Startups'  },
      { type:'Create', title:'ATS for small business — buyer guide',           kd:41, vol:5400, cluster:'ATS for Startups'  },
      { type:'Create', title:'ATS pricing comparison 2026',                    kd:18, vol:1100, cluster:'ATS Alternatives'  },
      { type:'Create', title:'ATS Slack + HRIS integrations guide',            kd:28, vol:720,  cluster:'ATS for Startups'  },
      { type:'Publish',title:'Benchmark: ATS onboarding speed (original data)',kd:null,vol:null, cluster:'GEO'              },
    ]},
    { label:'Month 5–8', theme:'TOFU scale', color:'var(--running)', items:[
      { type:'Create', title:'What is an ATS? — pillar page',                  kd:55, vol:18100,cluster:'ATS Hub'           },
      { type:'Create', title:'Best recruiting software 2026 — pillar page',    kd:61, vol:22200,cluster:'Recruiting Hub'    },
      { type:'Create', title:'Recruiting software for HR teams',               kd:38, vol:4400, cluster:'Recruiting Hub'    },
      { type:'Create', title:'ATS with AI features — buyer guide',             kd:44, vol:1800, cluster:'Recruiting Hub'    },
      { type:'Monitor',title:'Track rankings + LLM citations monthly',         kd:null,vol:null, cluster:'Monitoring'       },
    ]},
  ];
  const typeColor = (t)=>({Create:'var(--accent)',Fix:'var(--warn)',Publish:'var(--ok)',Monitor:'var(--running)'})[t]||'var(--text-dim)';
  const typeBg    = (t)=>({Create:'var(--accent-dim)',Fix:'var(--warn-dim)',Publish:'var(--ok-dim)',Monitor:'var(--running-dim)'})[t]||'var(--bg-hover)';
  return (
    <div style={{maxWidth:760,margin:'0 auto',display:'flex',flexDirection:'column',gap:14}}>
      <div style={{fontSize:13,color:'var(--text-mut)',lineHeight:1.6}}>24 content pieces across 8 months. Ordered by funnel stage — BOFU first to generate conversions while TOFU authority builds.</div>
      {months.map((m,i)=>(
        <div key={i} style={{border:'1px solid var(--border)',borderLeft:`3px solid ${m.color}`,borderRadius:7,background:'var(--bg-card)',overflow:'hidden'}}>
          <div style={{padding:'10px 16px',display:'flex',alignItems:'center',gap:10,background:'var(--bg-elev)',borderBottom:'1px solid var(--border)'}}>
            <span style={{fontSize:13,fontWeight:700,color:m.color}}>{m.label}</span>
            <span style={{fontSize:12,color:'var(--text)'}}>—</span>
            <span style={{fontSize:12,color:'var(--text-mut)'}}>{m.theme}</span>
            <div style={{flex:1}}/>
            <span className="mono" style={{fontSize:10,color:'var(--text-dim)'}}>{m.items.length} items</span>
          </div>
          <div style={{display:'flex',flexDirection:'column'}}>
            {m.items.map((it,j)=>(
              <div key={j} style={{display:'grid',gridTemplateColumns:'64px 1fr 120px 80px 80px',gap:10,padding:'8px 16px',borderTop:j?'1px solid var(--border)':'none',alignItems:'center'}}>
                <span style={{fontSize:10,padding:'2px 7px',borderRadius:3,background:typeBg(it.type),color:typeColor(it.type),fontWeight:600,textAlign:'center'}}>{it.type}</span>
                <span style={{fontSize:12,color:'var(--text)'}}>{it.title}</span>
                <span className="mono" style={{fontSize:10,color:'var(--text-dim)'}}>{it.cluster}</span>
                <span className="mono" style={{fontSize:10,color:'var(--text-dim)',textAlign:'right'}}>{it.vol?it.vol.toLocaleString()+'/mo':'—'}</span>
                <span className="mono" style={{fontSize:10,color:'var(--text-dim)',textAlign:'right'}}>{it.kd?'KD '+it.kd:'—'}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};


