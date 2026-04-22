// Screen 1 — Goal input (hero moment)

const GoalScreen = ({ theme }) => {
  const [goal, setGoal] = React.useState("50k organic signups/month for whitecarrot.io in 6 months vs Greenhouse and Ashby");
  const [domain] = React.useState("whitecarrot.io");

  const examples = [
    { title: "Rank #1 for \"ATS for startups\"", meta: "6 months · US/UK" },
    { title: "10k org signups from LLM citations", meta: "ChatGPT · Perplexity" },
    { title: "Outrank Greenhouse on long-tail", meta: "200 KWs · 12 wks" },
  ];

  return (
    <Chrome theme={theme} route="workspaces/wc-prod/new">
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'auto'}} className="prism-grid">
        {/* breadcrumb strip */}
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'14px 24px',borderBottom:'1px solid var(--border)',fontSize:12,color:'var(--text-mut)'}}>
          <span style={{color:'var(--text)'}}>New run</span>
          <span style={{color:'var(--text-dim)'}}>·</span>
          <span className="mono" style={{fontSize:11}}>target: {domain}</span>
          <div style={{flex:1}}/>
          <span style={{fontSize:11,color:'var(--text-dim)',display:'flex',alignItems:'center',gap:6}}>
            <span style={{width:6,height:6,borderRadius:3,background:'var(--ok)'}}/>
            DataForSEO · Claude sonnet-4-6
          </span>
        </div>

        {/* Hero */}
        <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px 24px',gap:28}}>
          <div style={{textAlign:'center',maxWidth:620}}>
            <div className="mono" style={{fontSize:10,color:'var(--accent)',letterSpacing:1.5,marginBottom:14,textTransform:'uppercase'}}>
              ▲ Prism · Foundation
            </div>
            <h1 style={{
              fontSize:34,fontWeight:600,letterSpacing:-0.9,margin:0,
              lineHeight:1.1,color:'var(--text)',
            }}>
              Describe a traffic goal.<br/>
              <span style={{color:'var(--text-mut)'}}>We'll plan the sprint.</span>
            </h1>
            <p style={{fontSize:13,color:'var(--text-mut)',marginTop:14,lineHeight:1.55}}>
              An orchestrator agent parses your goal, then fans out to 4 research specialists in parallel.
              Keyword volumes are live via DataForSEO.
            </p>
          </div>

          {/* The prompt box */}
          <div style={{width:'100%',maxWidth:620}}>
            <div style={{
              background:'var(--bg-card)',
              border:'1px solid var(--border-strong)',
              borderRadius:10,
              padding:'14px 14px 10px',
              boxShadow:'0 0 0 3px var(--accent-dim), 0 20px 50px rgba(0,0,0,0.35)',
              position:'relative',
            }}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,fontSize:11,color:'var(--text-dim)'}}>
                <Icon name="sparkle" size={12} />
                <span className="mono" style={{color:'var(--text-mut)'}}>goal.describe()</span>
                <div style={{flex:1}}/>
                <span className="mono" style={{fontSize:10}}>{goal.length} ch</span>
              </div>

              <textarea
                value={goal}
                onChange={(e)=>setGoal(e.target.value)}
                style={{
                  width:'100%',minHeight:92,resize:'none',
                  border:'none',outline:'none',background:'transparent',
                  color:'var(--text)',fontFamily:'inherit',fontSize:15,lineHeight:1.55,
                  letterSpacing:-0.1,
                }}
                placeholder="e.g. 50k signups in 6 months vs Greenhouse..."
              />

              {/* Footer */}
              <div style={{
                display:'flex',alignItems:'center',gap:10,
                paddingTop:10,borderTop:'1px solid var(--border)',marginTop:4,
              }}>
                <Chip>@{domain}</Chip>
                <Chip>6 months</Chip>
                <Chip>+2 competitors</Chip>
                <div style={{flex:1}}/>
                <div style={{display:'flex',alignItems:'center',gap:4,color:'var(--text-dim)',fontSize:10}} className="mono">
                  <span>⌘</span><span>↵</span>
                </div>
                <button style={{
                  display:'inline-flex',alignItems:'center',gap:7,
                  padding:'7px 13px',borderRadius:6,border:'1px solid var(--accent)',
                  background:'var(--accent)',color:'#fff',
                  fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:'inherit',
                }}>
                  Plan sprint
                  <Icon name="arrow" size={12} />
                </button>
              </div>
            </div>

            {/* suggestion chips */}
            <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:16,justifyContent:'center'}}>
              <div style={{fontSize:10,color:'var(--text-dim)',letterSpacing:0.8,textTransform:'uppercase',marginRight:4,alignSelf:'center'}}>Try:</div>
              {examples.map((e,i)=>(
                <div key={i} style={{
                  display:'flex',alignItems:'center',gap:8,
                  padding:'6px 10px',border:'1px solid var(--border)',borderRadius:6,
                  background:'var(--bg-card)',cursor:'pointer',fontSize:11,color:'var(--text-mut)',
                }}>
                  <span style={{color:'var(--text)'}}>{e.title}</span>
                  <span className="mono" style={{color:'var(--text-dim)',fontSize:10}}>{e.meta}</span>
                </div>
              ))}
            </div>
          </div>

          {/* What happens next */}
          <div style={{
            width:'100%',maxWidth:620,
            display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,
            marginTop:10,
          }}>
            {[
              {n:'01',l:'Parse intent',    s:'orchestrator · claude'},
              {n:'02',l:'Keyword research',s:'dataforseo · live'},
              {n:'03',l:'Competitor scan', s:'serp · stub'},
              {n:'04',l:'LLM visibility',  s:'gpt · stub'},
            ].map(s=>(
              <div key={s.n} style={{
                padding:'10px 11px',border:'1px solid var(--border)',borderRadius:6,
                background:'var(--bg-elev)',
              }}>
                <div className="mono" style={{fontSize:10,color:'var(--text-dim)',marginBottom:4}}>{s.n}</div>
                <div style={{fontSize:12,color:'var(--text)',fontWeight:500,marginBottom:2}}>{s.l}</div>
                <div className="mono" style={{fontSize:9,color:'var(--text-mut)'}}>{s.s}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom status bar */}
        <div style={{
          borderTop:'1px solid var(--border)',padding:'8px 16px',
          display:'flex',alignItems:'center',gap:14,fontSize:11,color:'var(--text-dim)',
          background:'var(--bg-elev)',
        }}>
          <span className="mono">14 runs · this workspace</span>
          <span>·</span>
          <span>Last: 2h ago · complete</span>
          <div style={{flex:1}}/>
          <span className="mono">v0.1.0-foundation</span>
        </div>
      </div>
    </Chrome>
  );
};

const Chip = ({ children }) => (
  <span style={{
    display:'inline-flex',alignItems:'center',gap:4,
    padding:'3px 8px',borderRadius:4,
    background:'var(--bg-hover)',color:'var(--text-mut)',
    fontSize:11,
  }} className="mono">{children}</span>
);

window.GoalScreen = GoalScreen;
