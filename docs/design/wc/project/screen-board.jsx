// Screen 2 — Live job board (DAG pipeline view)

const BoardScreen = ({ theme }) => {
  const goal = "50k organic signups/month for whitecarrot.io in 6 months vs Greenhouse and Ashby";

  // agents in flight
  const agents = [
    { id:'keyword',        label:'Keyword',         status:'complete', elapsed:'18.2s', provider:'dataforseo', rows:412, note:'412 kw · re-ranked' },
    { id:'competitor',     label:'Competitor',      status:'running',  elapsed:'11.7s', provider:'stub',       rows:null, note:'fetching SERP · greenhouse.io' },
    { id:'content_audit',  label:'Content audit',   status:'running',  elapsed:'6.4s',  provider:'stub',       rows:null, note:'crawling 34 pages' },
    { id:'llm_visibility', label:'LLM visibility',  status:'pending',  elapsed:'—',     provider:'stub',       rows:null, note:'queued' },
  ];

  return (
    <Chrome theme={theme} route="runs/r_k3f8p2a · live">
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'auto',minHeight:0}}>
        {/* Run header */}
        <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border)',background:'var(--bg-elev)'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
            <StatusBadge status="running" size="lg" />
            <span className="mono" style={{fontSize:11,color:'var(--text-mut)'}}>run_k3f8p2a</span>
            <span style={{color:'var(--text-dim)',fontSize:11}}>·</span>
            <span style={{fontSize:11,color:'var(--text-mut)'}}>sprint · 1 of 5 agents complete</span>
            <div style={{flex:1}}/>
            <button style={btnGhost}>
              <Icon name="x" size={11} /> Cancel
            </button>
            <button style={btnGhost}>
              <Icon name="link" size={11} /> Share
            </button>
          </div>
          <div style={{fontSize:13,color:'var(--text)',lineHeight:1.5,letterSpacing:-0.1,maxWidth:760}}>{goal}</div>
          <div style={{display:'flex',alignItems:'center',gap:14,marginTop:10,fontSize:11,color:'var(--text-dim)'}}>
            <span className="mono">started 00:00:38 ago</span>
            <span>·</span>
            <span>est. 00:00:45 remaining</span>
            <span>·</span>
            <span className="mono">worker-c4 · us-east · celery@5</span>
          </div>
        </div>

        {/* DAG */}
        <div style={{padding:'28px 24px 8px',position:'relative'}}>
          <SectionTitle>Pipeline</SectionTitle>
          <div style={{position:'relative',display:'grid',gridTemplateColumns:'200px 40px 1fr',gap:0,alignItems:'stretch',marginTop:14}}>
            {/* Left: orchestrator */}
            <div>
              <AgentNode
                kind="orchestrator"
                label="Orchestrator"
                status="complete"
                meta="claude-sonnet-4-6"
                body={
                  <>
                    <KV k="intent"  v="rank+signups" />
                    <KV k="timeline" v="26 weeks" />
                    <KV k="sprint"  v="4 agents" />
                  </>
                }
                elapsed="3.1s"
              />
            </div>

            {/* Connector column */}
            <svg width="40" height="100%" style={{overflow:'visible'}} viewBox="0 0 40 380" preserveAspectRatio="none">
              {/* Fan-out lines */}
              {[0,1,2,3].map(i => {
                const y = 48 + i * 84;
                const status = agents[i].status;
                const stroke = status === 'complete' ? 'var(--ok)' : status === 'running' ? 'var(--running)' : 'var(--border-strong)';
                const opacity = status === 'pending' ? 0.5 : 1;
                return (
                  <g key={i} opacity={opacity}>
                    <path d={`M 0 180 C 16 180, 16 ${y}, 40 ${y}`} stroke={stroke} strokeWidth="1.2" fill="none" />
                    {/* flow dot for running */}
                    {status === 'running' && (
                      <circle r="2.2" fill="var(--running)">
                        <animateMotion dur="1.6s" repeatCount="indefinite" path={`M 0 180 C 16 180, 16 ${y}, 40 ${y}`} />
                      </circle>
                    )}
                  </g>
                );
              })}
              <circle cx="0" cy="180" r="3" fill="var(--ok)" />
            </svg>

            {/* Right: agents column */}
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {agents.map(a => <AgentRow key={a.id} {...a} />)}
            </div>
          </div>

          {/* Finalize node */}
          <div style={{
            marginTop:18,marginLeft:240,padding:'10px 12px',
            border:'1px dashed var(--border-strong)',borderRadius:6,
            display:'flex',alignItems:'center',gap:10,background:'var(--bg-elev)',
            maxWidth:520,
          }}>
            <Icon name="check" size={12} />
            <span style={{fontSize:12,color:'var(--text)'}}>Finalize</span>
            <span className="mono" style={{fontSize:10,color:'var(--text-dim)'}}>chord callback · awaits all</span>
            <div style={{flex:1}}/>
            <StatusBadge status="pending" />
          </div>
        </div>

        {/* Event stream */}
        <div style={{padding:'18px 24px 24px'}}>
          <SectionTitle right={<span className="mono" style={{fontSize:10,color:'var(--text-dim)'}}>SSE · job_events · LISTEN</span>}>
            Event stream
          </SectionTitle>
          <div style={{
            marginTop:10,
            border:'1px solid var(--border)',borderRadius:6,
            background:'var(--bg-card)',
            fontSize:11, overflow:'hidden',
          }} className="mono">
            {[
              { t:'00:00:00.12', lvl:'info',  msg:'POST /workspaces/wc-prod/jobs → job_k3f8p2a created', k:'orchestrator' },
              { t:'00:00:00.14', lvl:'info',  msg:'orchestrator_task.delay(job_k3f8p2a)', k:'orchestrator' },
              { t:'00:00:00.91', lvl:'info',  msg:'claude.messages.create(model=sonnet-4-6, tools=[plan])', k:'orchestrator' },
              { t:'00:00:03.22', lvl:'ok',    msg:'plan → {intent, 2 competitors, sprint_order=[kw,comp,audit,llm]}', k:'orchestrator' },
              { t:'00:00:03.24', lvl:'info',  msg:'chord([keyword, competitor, content_audit, llm_visibility]) dispatched', k:'sprint' },
              { t:'00:00:03.31', lvl:'info',  msg:'keyword_task → dataforseo.keywords_for_keywords(seeds=[ats, recruiting, ...])', k:'keyword' },
              { t:'00:00:11.78', lvl:'info',  msg:'dataforseo · 412 rows · cache miss · cost $0.024', k:'keyword' },
              { t:'00:00:14.02', lvl:'info',  msg:'claude re-rank(412 kws, priority_score)', k:'keyword' },
              { t:'00:00:21.44', lvl:'ok',    msg:'keyword → complete · 412 kws persisted', k:'keyword' },
              { t:'00:00:26.83', lvl:'info',  msg:'competitor_stub · serp.organic(q="applicant tracking system")', k:'competitor', live:true },
              { t:'00:00:32.17', lvl:'info',  msg:'content_audit_stub · crawled 18/34 whitecarrot.io/*', k:'content_audit', live:true },
            ].map((e, i)=> (
              <div key={i} style={{
                display:'grid',gridTemplateColumns:'86px 48px 72px 1fr',gap:10,
                padding:'5px 12px',
                borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                background: e.live ? 'var(--bg-hover)' : 'transparent',
              }}>
                <span style={{color:'var(--text-dim)'}}>{e.t}</span>
                <span style={{color: e.lvl==='ok'?'var(--ok)':'var(--running)', fontWeight:500}}>{e.lvl}</span>
                <span style={{color:'var(--text-mut)'}}>{e.k}</span>
                <span style={{color:'var(--text)'}}>
                  {e.msg}
                  {e.live && <span className="prism-caret"></span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Chrome>
  );
};

const SectionTitle = ({ children, right }) => (
  <div style={{display:'flex',alignItems:'center',gap:10}}>
    <div style={{fontSize:11,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:1.2,fontWeight:500}}>{children}</div>
    <div style={{flex:1,height:1,background:'var(--border)'}}/>
    {right}
  </div>
);

const KV = ({ k, v }) => (
  <div style={{display:'flex',justifyContent:'space-between',fontSize:11,padding:'2px 0'}}>
    <span className="mono" style={{color:'var(--text-dim)'}}>{k}</span>
    <span style={{color:'var(--text)'}}>{v}</span>
  </div>
);

const AgentNode = ({ label, status, meta, body, elapsed }) => (
  <div style={{
    border:'1px solid var(--border-strong)',borderRadius:6,
    background:'var(--bg-card)',padding:10,
    position:'relative',
  }}>
    <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}>
      <span style={{fontSize:12,fontWeight:600,color:'var(--text)',letterSpacing:-0.1}}>{label}</span>
      <div style={{flex:1}}/>
      <StatusBadge status={status} />
    </div>
    <div className="mono" style={{fontSize:10,color:'var(--text-mut)',marginBottom:8}}>{meta}</div>
    <div style={{borderTop:'1px solid var(--border)',paddingTop:7}}>
      {body}
    </div>
    <div className="mono" style={{fontSize:10,color:'var(--text-dim)',marginTop:8,display:'flex',justifyContent:'space-between'}}>
      <span>elapsed</span><span>{elapsed}</span>
    </div>
  </div>
);

const AgentRow = ({ label, status, elapsed, provider, rows, note }) => {
  const bar = status === 'complete' ? 100 : status === 'running' ? null : 0;
  return (
    <div style={{
      border:'1px solid var(--border)',
      borderRadius:6, background:'var(--bg-card)',
      padding:'10px 12px',
      display:'grid',gridTemplateColumns:'140px 90px 1fr 90px 80px',gap:12,alignItems:'center',
      opacity: status === 'pending' ? 0.55 : 1,
    }}>
      <div style={{display:'flex',alignItems:'center',gap:7}}>
        <span style={{
          width:18,height:18,borderRadius:4,
          background: status==='complete'?'var(--ok-dim)':status==='running'?'var(--running-dim)':'var(--bg-hover)',
          display:'flex',alignItems:'center',justifyContent:'center',
          color: status==='complete'?'var(--ok)':status==='running'?'var(--running)':'var(--text-dim)',
        }}>
          {status==='complete' ? <Icon name="check" size={10}/> : status==='running' ? <span className="prism-pulse-dot" style={{width:6,height:6,borderRadius:3,background:'currentColor'}}/> : <Icon name="dot" size={10}/>}
        </span>
        <span style={{fontSize:12,fontWeight:500,color:'var(--text)'}}>{label}</span>
      </div>
      <StatusBadge status={status} />
      <div style={{display:'flex',flexDirection:'column',gap:4,minWidth:0}}>
        <div className="mono" style={{fontSize:10,color:'var(--text-mut)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
          {note}
        </div>
        {/* progress bar */}
        <div style={{height:2,borderRadius:1,background:'var(--bg-hover)',overflow:'hidden',position:'relative'}}>
          {bar === 100 && <div style={{width:'100%',height:'100%',background:'var(--ok)'}}/>}
          {bar === null && (
            <>
              <div style={{width:'100%',height:'100%',background:'var(--running-dim)'}}/>
              <div style={{position:'absolute',top:0,left:0,width:'40%',height:'100%',background:'var(--running)',animation:'prism-stream 1.8s ease-in-out infinite'}}/>
            </>
          )}
        </div>
      </div>
      <div className="mono" style={{fontSize:10,color:'var(--text-dim)',textAlign:'right'}}>
        {provider}
      </div>
      <div className="mono" style={{fontSize:11,color:'var(--text-mut)',textAlign:'right'}}>
        {elapsed}
      </div>
    </div>
  );
};

const btnGhost = {
  display:'inline-flex',alignItems:'center',gap:5,
  padding:'4px 9px',borderRadius:5,border:'1px solid var(--border)',
  background:'transparent',color:'var(--text-mut)',
  fontSize:11,cursor:'pointer',fontFamily:'inherit',
};

window.BoardScreen = BoardScreen;
