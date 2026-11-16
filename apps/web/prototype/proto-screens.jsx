// proto-screens.jsx
// Sign-in, Workspace create, Conversation thread (Gate-0), Job board, Runs dashboard

// ── Sign In ─────────────────────────────────────────────────────────────
const SignInScreen = ({ navigate, theme, setTheme }) => {
  const [email, setEmail] = React.useState('pratik@whitecarrot.io');
  const [pass,  setPass]  = React.useState('••••••••');
  const go = (e) => { e.preventDefault(); navigate('workspace'); };
  return (
    <div style={{height:'100%',background:'var(--bg)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:0}}>
      <div style={{position:'absolute',top:16,right:16,display:'flex',gap:8}}>
        <button onClick={()=>setTheme(t=>t==='dark'?'light':'dark')} style={{border:'1px solid var(--border)',background:'var(--bg-hover)',color:'var(--text-mut)',padding:'5px 10px',borderRadius:5,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>
          {theme==='dark'?'☀ Light':'☾ Dark'}
        </button>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:36,color:'var(--text)'}}>
        <PrismLogo size={28}/>
        <span style={{fontSize:22,fontWeight:700,letterSpacing:-.5}}>Prism</span>
      </div>
      <div style={{width:360,background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:10,padding:28,boxShadow:'0 8px 32px rgba(0,0,0,.2)'}}>
        <div style={{fontSize:15,fontWeight:600,color:'var(--text)',marginBottom:4}}>Sign in</div>
        <div style={{fontSize:12,color:'var(--text-mut)',marginBottom:20}}>Powered by Clerk</div>
        <form onSubmit={go} style={{display:'flex',flexDirection:'column',gap:12}}>
          <Field label="Email" value={email} onChange={setEmail} type="email"/>
          <Field label="Password" value={pass} onChange={setPass} type="password"/>
          <PrimaryBtn style={{marginTop:6,justifyContent:'center',padding:'9px 0'}}>Sign in</PrimaryBtn>
        </form>
        <div style={{marginTop:14,fontSize:11,color:'var(--text-mut)',textAlign:'center'}}>
          Don't have an account? <span style={{color:'var(--accent)',cursor:'pointer'}} onClick={()=>navigate('workspace-new')}>Sign up</span>
        </div>
      </div>
      <div className="mono" style={{marginTop:24,fontSize:10,color:'var(--text-dim)'}}>v0.1.0-foundation · Prism Platform</div>
    </div>
  );
};

// ── Create Workspace ────────────────────────────────────────────────────
const WorkspaceNewScreen = ({ navigate, theme, setTheme }) => {
  const [name,   setName]   = React.useState('');
  const [domain, setDomain] = React.useState('');
  const go = (e) => { e.preventDefault(); if (name && domain) navigate('workspace'); };
  return (
    <div style={{height:'100%',background:'var(--bg)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
      <div style={{position:'absolute',top:16,right:16}}>
        <button onClick={()=>setTheme(t=>t==='dark'?'light':'dark')} style={{border:'1px solid var(--border)',background:'var(--bg-hover)',color:'var(--text-mut)',padding:'5px 10px',borderRadius:5,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>
          {theme==='dark'?'☀ Light':'☾ Dark'}
        </button>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:32,color:'var(--text)'}}>
        <PrismLogo size={22}/><span style={{fontSize:18,fontWeight:700,letterSpacing:-.4}}>Prism</span>
      </div>
      <div style={{width:400,background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:10,padding:28,boxShadow:'0 8px 32px rgba(0,0,0,.2)'}}>
        <div style={{fontSize:15,fontWeight:600,color:'var(--text)',marginBottom:4}}>New workspace</div>
        <div style={{fontSize:12,color:'var(--text-mut)',marginBottom:22}}>Set a name and the target domain you're optimising.</div>
        <form onSubmit={go} style={{display:'flex',flexDirection:'column',gap:12}}>
          <Field label="Workspace name" value={name} onChange={setName} placeholder="e.g. whitecarrot"/>
          <Field label="Target domain" value={domain} onChange={setDomain} placeholder="e.g. whitecarrot.io"/>
          <PrimaryBtn style={{marginTop:6,justifyContent:'center',padding:'9px 0',opacity:(!name||!domain)?.5:1}}>Create workspace →</PrimaryBtn>
        </form>
        <div style={{marginTop:12,fontSize:11,color:'var(--text-mut)',textAlign:'center',cursor:'pointer'}} onClick={()=>navigate('signin')}>← Back to sign in</div>
      </div>
    </div>
  );
};

// ── Runs Dashboard ──────────────────────────────────────────────────────
const RunsDashboard = ({ navigate }) => {
  const runs = [
    { id:'r_k3f8p2a', goal:'50k organic signups/month for whitecarrot.io in 6 months vs Greenhouse and Ashby', status:'complete', agents:4, at:'2h ago', kws:412 },
    { id:'r_j2e7n1b', goal:'Rank #1 for "ATS for startups" in US + UK within 4 months',                      status:'complete_with_errors', agents:4, at:'Yesterday', kws:289 },
    { id:'r_h1d5m9c', goal:'10k organic signups from LLM citation (ChatGPT, Perplexity)',                   status:'running',  agents:4, at:'Just now', kws:null },
  ];
  return (
    <div style={{flex:1,padding:'24px 28px',overflow:'auto',background:'var(--bg)'}}>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:22}}>
        <div style={{fontSize:15,fontWeight:600,color:'var(--text)'}}>Runs</div>
        <div style={{flex:1}}/>
        <PrimaryBtn onClick={()=>navigate('workspace')} style={{fontSize:12,padding:'6px 12px'}}>
          <Icon name="plus" size={12}/> New run
        </PrimaryBtn>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {runs.map(r=>(
          <div key={r.id} onClick={()=>navigate('workspace')} style={{
            border:'1px solid var(--border)',borderRadius:7,background:'var(--bg-card)',
            padding:'14px 16px',cursor:'pointer',transition:'border-color .15s',
          }}
          onMouseEnter={e=>e.currentTarget.style.borderColor='var(--border-strong)'}
          onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:7}}>
              <Badge status={r.status}/>
              <span className="mono" style={{fontSize:10,color:'var(--text-dim)'}}>{r.id}</span>
              <div style={{flex:1}}/>
              <span style={{fontSize:11,color:'var(--text-dim)'}}>{r.at}</span>
            </div>
            <div style={{fontSize:13,color:'var(--text)',lineHeight:1.45,marginBottom:8}}>{r.goal}</div>
            <div style={{display:'flex',gap:14,fontSize:11}}>
              <span className="mono" style={{color:'var(--text-dim)'}}>{r.agents} agents</span>
              {r.kws && <span className="mono" style={{color:'var(--ok)'}}>{r.kws} keywords</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Workspace / Conversation Thread ─────────────────────────────────────
const WorkspaceScreen = ({ navigate, theme }) => {
  const [thread, setThread]         = React.useState([]);
  const [goalText, setGoalText]     = React.useState('50k organic signups/month for whitecarrot.io in 6 months vs Greenhouse and Ashby');
  const [orcRunning, setOrcRunning] = React.useState(false);
  const threadRef  = React.useRef(null);
  // threadArr mirrors thread state so setTimeout callbacks always see latest value
  const threadArr  = React.useRef([]);

  const push = (item) => {
    threadArr.current = [...threadArr.current, item];
    setThread([...threadArr.current]);
  };
  const replaceAt = (idx, item) => {
    threadArr.current = threadArr.current.map((v,i)=>i===idx?item:v);
    setThread([...threadArr.current]);
  };
  const updateJobsItem = (cb) => {
    let ji = -1;
    for (let j=threadArr.current.length-1;j>=0;j--) { if(threadArr.current[j].type==='jobs'){ji=j;break;} }
    if (ji<0) return;
    replaceAt(ji, cb(threadArr.current[ji]));
  };

  React.useEffect(()=>{
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [thread]);

  const submitGoal = () => {
    if (!goalText.trim() || orcRunning) return;
    const goal = goalText.trim();
    setGoalText('');
    setOrcRunning(true);
    push({ type:'goal', text:goal, at:new Date() });
    const spinIdx = threadArr.current.length; // will be next item
    setTimeout(()=>{
      push({ type:'plan', jobStatus:'running', plan:null });
    }, 300);
    setTimeout(()=>{
      replaceAt(spinIdx, {
        type:'plan', jobStatus:'awaiting_gate0', version:1,
        plan:{
          id:'plan_'+Math.random().toString(36).slice(2,8),
          intent:'rank + organic signups',
          domain:'whitecarrot.io',
          competitors:['greenhouse.io','ashby.com'],
          timelineWeeks:26,
          sprintOrder:['keyword','competitor','content_audit','llm_visibility'],
          planStatus:'draft', feedback:null,
        }
      });
      setOrcRunning(false);
    }, 3200);
  };

  const onRefine = (planIdx, feedback) => {
    replaceAt(planIdx, {...threadArr.current[planIdx], plan:{...threadArr.current[planIdx].plan, planStatus:'superseded'}});
    setOrcRunning(true);
    push({ type:'goal', text:`Feedback: "${feedback}"`, at:new Date(), isFeedback:true });
    const spinIdx = threadArr.current.length;
    setTimeout(()=>{ push({ type:'plan', jobStatus:'running', plan:null }); }, 300);
    setTimeout(()=>{
      const oldComps = threadArr.current.find(i=>i.type==='plan'&&i.plan?.planStatus==='superseded')?.plan?.competitors || [];
      replaceAt(spinIdx, {
        type:'plan', jobStatus:'awaiting_gate0', version:2,
        plan:{
          id:'plan_'+Math.random().toString(36).slice(2,8),
          intent:'rank + organic signups (refined)',
          domain:'whitecarrot.io',
          competitors:[...oldComps,'lever.co'],
          timelineWeeks:26,
          sprintOrder:['keyword','competitor','content_audit','llm_visibility'],
          planStatus:'draft', feedback,
        }
      });
      setOrcRunning(false);
    }, 3000);
  };

  const onApprove = (planIdx) => {
    replaceAt(planIdx, {...threadArr.current[planIdx], plan:{...threadArr.current[planIdx].plan, planStatus:'approved'}, jobStatus:'complete'});
    push({type:'confirm'});
    setTimeout(()=>{
      push({
        type:'jobs', sprintStatus:'pending',
        agents:[
          {id:'keyword',        label:'Keyword research', status:'pending', provider:'dataforseo · live'},
          {id:'competitor',     label:'Competitor scan',  status:'pending', provider:'stub'},
          {id:'content_audit',  label:'Content audit',   status:'pending', provider:'stub'},
          {id:'llm_visibility', label:'LLM visibility',  status:'pending', provider:'stub'},
        ],
      });
      startJobSim();
    }, 1200);
  };

  const startJobSim = () => {
    const steps = [
      {t:400,  id:'keyword',        s:'running'},
      {t:600,  id:'competitor',     s:'running'},
      {t:900,  id:'content_audit',  s:'running'},
      {t:1800, id:'llm_visibility', s:'running'},
      {t:4500, id:'competitor',     s:'complete'},
      {t:6000, id:'content_audit',  s:'complete'},
      {t:7200, id:'llm_visibility', s:'complete'},
      {t:9500, id:'keyword',        s:'complete'},
    ];
    steps.forEach(({t,id,s})=>{
      setTimeout(()=>{
        updateJobsItem(jobs=>{
          const agents = jobs.agents.map(a=>a.id===id?{...a,status:s}:a);
          const allDone = agents.every(a=>a.status==='complete');
          return {...jobs, agents, sprintStatus: allDone?'complete':'running'};
        });
      }, t);
    });
    // After all done: synthesis step → then push strategy brief card
    setTimeout(()=>{
      updateJobsItem(jobs=>({...jobs, synthesizing:true}));
    }, 9600);
    setTimeout(()=>{
      updateJobsItem(jobs=>({...jobs, synthesizing:false, synthDone:true}));
      push({ type:'brief' });
    }, 12500);
  };

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',minHeight:0,overflow:'hidden',background:'var(--bg)'}}>
      {/* Thread area */}
      <div ref={threadRef} style={{flex:1,overflow:'auto',padding:'32px 0 16px',minHeight:0}}>
        {thread.length===0 && (
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:12,opacity:.5}}>
            <PrismLogo size={36}/>
            <div style={{fontSize:14,color:'var(--text-mut)',textAlign:'center',lineHeight:1.6}}>Describe a traffic goal below.<br/>Prism will plan the sprint.</div>
          </div>
        )}
        <div style={{width:'100%',maxWidth:720,margin:'0 auto',padding:'0 28px',display:'flex',flexDirection:'column',gap:18}}>
          {thread.map((item,i)=>{
            if (item.type==='goal') return <GoalBubble key={i} text={item.text} isFeedback={item.isFeedback}/>;
            if (item.type==='plan') return <PlanCard key={i} item={item} idx={i} onRefine={onRefine} onApprove={onApprove} orcRunning={orcRunning}/>;
            if (item.type==='confirm') return <ConfirmCard key={i}/>;
            if (item.type==='jobs')    return <JobBoard key={i} item={item} navigate={navigate}/>;
            if (item.type==='brief')   return <StrategyBriefCard key={i} navigate={navigate}/>;
            return null;
          })}
          
        </div>
      </div>

      {/* Fixed goal input */}
      <div style={{borderTop:'1px solid var(--border)',background:'var(--bg-elev)',padding:'14px 0'}}>
        <div style={{width:'100%',maxWidth:720,margin:'0 auto',padding:'0 28px'}}>
          <div style={{
            border:'1px solid var(--border-strong)',borderRadius:10,
            background:'var(--bg-card)',padding:'12px 14px',
            boxShadow:'0 0 0 3px var(--accent-dim)',
          }}>
            <textarea
              value={goalText} onChange={e=>setGoalText(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)) submitGoal(); }}
              placeholder="Describe a traffic goal… e.g. 50k organic signups in 6 months vs Greenhouse"
              rows={2}
              style={{
                width:'100%',resize:'none',border:'none',outline:'none',background:'transparent',
                color:'var(--text)',fontSize:14,lineHeight:1.6,fontFamily:'inherit',display:'block',
              }}
            />
            <div style={{display:'flex',alignItems:'center',gap:8,marginTop:8,paddingTop:8,borderTop:'1px solid var(--border)'}}>
              <span className="mono" style={{fontSize:11,color:'var(--text-dim)',padding:'2px 7px',border:'1px solid var(--border)',borderRadius:4}}>whitecarrot.io</span>
              <div style={{flex:1}}/>
              <span className="mono" style={{fontSize:10,color:'var(--text-dim)'}}>⌘↵</span>
              <PrimaryBtn onClick={submitGoal} style={{padding:'6px 14px',fontSize:12,opacity:orcRunning?.6:1}}>
                {orcRunning ? <><span className="spin">↻</span> Planning…</> : <>Plan sprint <Icon name="arrowR" size={12}/></>}
              </PrimaryBtn>
            </div>
          </div>
          <div style={{fontSize:10,color:'var(--text-dim)',marginTop:6,textAlign:'center'}}>
            Orchestrator → 4 research agents · DataForSEO live · Claude sonnet-4-6
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Thread components ────────────────────────────────────────────────────

const GoalBubble = ({ text, isFeedback }) => (
  <div style={{display:'flex',justifyContent:'flex-end'}}>
    <div style={{
      maxWidth:'72%',background: isFeedback ? 'var(--bg-hover)' : 'var(--accent)',
      color: isFeedback ? 'var(--text-mut)' : '#fff',
      padding:'10px 14px',borderRadius:'10px 10px 2px 10px',
      fontSize:13,lineHeight:1.55,
    }}>
      {isFeedback && <div style={{fontSize:10,marginBottom:4,opacity:.6}}>Refinement feedback</div>}
      {text}
    </div>
  </div>
);

const PlanCard = ({ item, idx, onRefine, onApprove, orcRunning }) => {
  const { plan, jobStatus, version } = item;
  const [refineOpen, setRefineOpen] = React.useState(false);
  const [feedback,   setFeedback]   = React.useState('');
  const [editComp,   setEditComp]   = React.useState(false);
  const [localPlan,  setLocalPlan]  = React.useState(plan);
  const [compInput,  setCompInput]  = React.useState('');

  React.useEffect(()=>{ if(plan) setLocalPlan(plan); }, [plan]);

  if (!localPlan) return null;

  const isSuperseded = plan?.planStatus === 'superseded';
  const isApproved   = plan?.planStatus === 'approved';
  const canApprove   = jobStatus === 'awaiting_gate0' && !orcRunning;

  if (jobStatus === 'running' && !plan) {
    return (
      <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
        <div style={{width:24,height:24,borderRadius:6,background:'var(--accent-dim)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--accent)',flexShrink:0,marginTop:2}}>
          <PrismLogo size={13}/>
        </div>
        <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'2px 10px 10px 10px',padding:'12px 14px',fontSize:13,color:'var(--text-mut)',display:'flex',gap:8,alignItems:'center'}}>
          <span className="spin">↻</span> Orchestrator parsing goal…
          <span className="mono" style={{fontSize:10,color:'var(--text-dim)',marginLeft:6}}>claude-sonnet-4-6</span>
        </div>
      </div>
    );
  }
  if (!plan) return null;

  return (
    <div style={{display:'flex',gap:10,alignItems:'flex-start',opacity: isSuperseded?.5:1}}>
      <div style={{width:24,height:24,borderRadius:6,background:'var(--accent-dim)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--accent)',flexShrink:0,marginTop:2}}>
        <PrismLogo size={13}/>
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{
          background:'var(--bg-card)',border:`1px solid ${isSuperseded?'var(--border)':isApproved?'var(--ok)':'var(--border-strong)'}`,
          borderRadius:'2px 10px 10px 10px',padding:'14px 16px',
        }}>
          {/* Header */}
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
            <span style={{fontSize:12,fontWeight:600,color:'var(--text)'}}>Prism Plan</span>
            <span className="mono" style={{fontSize:10,color:'var(--text-dim)'}}>v{version}</span>
            {isSuperseded && <span style={{fontSize:10,padding:'2px 6px',borderRadius:3,background:'var(--bg-hover)',color:'var(--text-dim)'}}>superseded</span>}
            {isApproved   && <span style={{fontSize:10,padding:'2px 6px',borderRadius:3,background:'var(--ok-dim)',color:'var(--ok)'}}>✓ approved</span>}
            {!isSuperseded&&!isApproved && <Badge status="pending"/>}
          </div>

          {/* Fields */}
          <div style={{display:'grid',gridTemplateColumns:'120px 1fr',gap:'6px 0',fontSize:12,marginBottom:14}}>
            <KVRow k="intent" v={localPlan.intent}/>
            <KVRow k="domain" v={localPlan.domain}/>
            <KVRow k="timeline" v={`${localPlan.timelineWeeks} weeks`}/>
            <span style={{color:'var(--text-dim)',fontSize:11,alignSelf:'start',paddingTop:4}}>competitors</span>
            <div style={{display:'flex',flexWrap:'wrap',gap:5,alignItems:'center'}}>
              {localPlan.competitors.map((c,ci)=>(
                <span key={ci} style={{display:'inline-flex',alignItems:'center',gap:4,padding:'2px 7px',borderRadius:4,background:'var(--bg-hover)',color:'var(--text)',fontSize:11}}>
                  {c}
                  {!isSuperseded&&!isApproved && (
                    <span onClick={()=>setLocalPlan(p=>({...p,competitors:p.competitors.filter((_,j)=>j!==ci)}))} style={{color:'var(--text-dim)',cursor:'pointer',lineHeight:1}}>×</span>
                  )}
                </span>
              ))}
              {!isSuperseded&&!isApproved && (
                editComp ? (
                  <input value={compInput} onChange={e=>setCompInput(e.target.value)}
                    onKeyDown={e=>{
                      if(e.key==='Enter'&&compInput.trim()){
                        setLocalPlan(p=>({...p,competitors:[...p.competitors,compInput.trim()]}));
                        setCompInput(''); setEditComp(false);
                      }
                      if(e.key==='Escape') setEditComp(false);
                    }}
                    onBlur={()=>setEditComp(false)}
                    autoFocus
                    placeholder="domain.com"
                    style={{fontSize:11,border:'1px solid var(--accent)',borderRadius:4,padding:'2px 7px',background:'var(--bg-hover)',color:'var(--text)',outline:'none',width:100}}
                  />
                ) : (
                  <span onClick={()=>setEditComp(true)} style={{fontSize:11,color:'var(--accent)',cursor:'pointer',padding:'2px 6px',border:'1px dashed var(--accent)',borderRadius:4}}>+ add</span>
                )
              )}
            </div>
            <KVRow k="agents" v={localPlan.sprintOrder.join(' · ')}/>
          </div>

          {/* Actions — only when draft */}
          {!isSuperseded && !isApproved && (
            <>
              <div style={{height:1,background:'var(--border)',marginBottom:12}}/>
              {/* Refine expando */}
              <div style={{marginBottom:10}}>
                <button onClick={()=>setRefineOpen(o=>!o)} style={{
                  display:'flex',alignItems:'center',gap:5,fontSize:12,color:'var(--text-mut)',
                  background:'transparent',border:'none',cursor:'pointer',padding:0,fontFamily:'inherit',
                }}>
                  <Icon name="retry" size={12}/> Refine
                  <Icon name={refineOpen?'chev':'chevR'} size={11}/>
                </button>
                {refineOpen && (
                  <div style={{marginTop:8,display:'flex',flexDirection:'column',gap:7}} className="fade-up">
                    <textarea value={feedback} onChange={e=>setFeedback(e.target.value)}
                      rows={2} placeholder="e.g. also include lever.co as a competitor"
                      style={{fontSize:12,border:'1px solid var(--border)',borderRadius:5,padding:'8px 10px',background:'var(--bg)',color:'var(--text)',fontFamily:'inherit',resize:'none',outline:'none'}}
                    />
                    <GhostBtn onClick={()=>{ if(feedback.trim()){ onRefine(idx,feedback); setRefineOpen(false); setFeedback(''); }}}  style={{fontSize:12,alignSelf:'flex-start'}}>
                      <span className="spin" style={{display:orcRunning?'inline-block':'none'}}>↻</span> Re-plan
                    </GhostBtn>
                  </div>
                )}
              </div>
              {/* Approve */}
              <PrimaryBtn onClick={()=>canApprove&&onApprove(idx)} style={{fontSize:12,padding:'7px 14px',opacity:canApprove?1:.5}}>
                <Icon name="check" size={12}/> Approve & start research
              </PrimaryBtn>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const ConfirmCard = () => (
  <div style={{display:'flex',gap:10,alignItems:'flex-start'}} className="fade-up">
    <div style={{width:24,height:24,borderRadius:6,background:'var(--ok-dim)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--ok)',flexShrink:0,marginTop:2}}>
      <Icon name="check" size={12}/>
    </div>
    <div style={{background:'var(--ok-dim)',border:'1px solid var(--ok)',borderRadius:'2px 10px 10px 10px',padding:'10px 14px',fontSize:13,color:'var(--ok)'}}>
      Plan approved · dispatching 4 research agents…
      <span className="mono" style={{fontSize:10,color:'var(--ok)',marginLeft:10,opacity:.7}}>Celery chord</span>
    </div>
  </div>
);

// ── Job Board (in thread) ────────────────────────────────────────────────
const JobBoard = ({ item, navigate }) => {
  const { agents, sprintStatus } = item;
  const [elapsed, setElapsed] = React.useState(0);
  React.useEffect(()=>{
    const t=setInterval(()=>setElapsed(e=>e+1),1000);
    return ()=>clearInterval(t);
  },[]);

  return (
    <div style={{border:'1px solid var(--border)',borderRadius:8,background:'var(--bg-card)',overflow:'hidden'}} className="fade-up">
      {/* Sprint header */}
      <div style={{padding:'10px 14px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:10,background:'var(--bg-elev)'}}>
        <Badge status={sprintStatus==='pending'?'pending':sprintStatus==='complete'?'complete':'running'}/>
        <span style={{fontSize:12,color:'var(--text)'}}>Research sprint</span>
        <span className="mono" style={{fontSize:10,color:'var(--text-dim)'}}>{elapsed}s elapsed</span>
        <div style={{flex:1}}/>
        {sprintStatus==='complete' && <span style={{fontSize:11,color:'var(--ok)'}}>✓ Sprint complete</span>}
      </div>

      {/* Orchestrator row */}
      <AgentRow label="Orchestrator" status="complete" provider="claude-sonnet-4-6" note="plan parsed · awaiting_gate0 → approved" elapsed="3.1s" />
      <div style={{height:1,background:'var(--border)',margin:'0 14px'}}/>

      {/* Research agents */}
      {agents.map((a,i)=>(
        <AgentRow key={a.id} label={a.label} status={a.status} provider={a.provider}
          note={agentNote(a)}
          elapsed={a.status==='complete'?agentElapsed(a.id):a.status==='running'?elapsed+'s…':'—'}
          onView={a.status==='complete'?()=>navigate({keyword:'keywords',competitor:'competitors',content_audit:'content_audit',llm_visibility:'llm_visibility'}[a.id]||a.id):null}
        />
      ))}

      {/* Synthesis row */}
      {(item.synthesizing || item.synthDone) && (
        <AgentRow
          label="Synthesis agent"
          status={item.synthDone ? 'complete' : 'running'}
          provider="claude-sonnet-4-6"
          note={item.synthDone ? 'clusters + exec summary + action plan generated' : 'cross-referencing 4 agent outputs…'}
          elapsed={item.synthDone ? '2.9s' : elapsed+'s…'}
        />
      )}

      {/* Log stream */}
      <LogStream agents={agents} elapsed={elapsed}/>
    </div>
  );
};

const agentNote = (a) => ({
  keyword:        a.status==='complete'?'412 keywords · re-ranked by priority':a.status==='running'?'dataforseo.keywords_for_keywords()':'queued',
  competitor:     a.status==='complete'?'3 competitors analysed · SERP':a.status==='running'?'serp.organic() · stub':'queued',
  content_audit:  a.status==='complete'?'34 pages audited · scores computed':a.status==='running'?'crawling whitecarrot.io/* · stub':'queued',
  llm_visibility: a.status==='complete'?'4 LLMs checked · citation rate 12%':a.status==='running'?'querying GPT-4o, Perplexity · stub':'queued',
})[a.id] || '';
const agentElapsed = (id)=>({keyword:'18.2s',competitor:'4.5s',content_audit:'6.1s',llm_visibility:'7.8s'})[id]||'—';

const AgentRow = ({ label, status, provider, note, elapsed, onView }) => (
  <div style={{display:'flex',alignItems:'center',gap:10,padding:'9px 14px',fontSize:12}}>
    <div style={{width:20,height:20,borderRadius:4,background:status==='complete'?'var(--ok-dim)':status==='running'?'var(--running-dim)':'var(--bg-hover)',display:'flex',alignItems:'center',justifyContent:'center',color:status==='complete'?'var(--ok)':status==='running'?'var(--running)':'var(--text-dim)',flexShrink:0}}>
      {status==='complete'?<Icon name="check" size={10}/>:status==='running'?<span className="pulse-dot" style={{width:6,height:6,borderRadius:3,background:'currentColor'}}/>:<span style={{width:5,height:5,borderRadius:3,background:'currentColor',opacity:.3}}/>}
    </div>
    <span style={{fontWeight:500,color:'var(--text)',minWidth:130}}>{label}</span>
    <Badge status={status==='complete'?'complete':status==='running'?'running':'pending'}/>
    <span style={{flex:1,color:'var(--text-mut)',fontSize:11,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}} className="mono">{note}</span>
    <span className="mono" style={{fontSize:10,color:'var(--text-dim)',minWidth:45,textAlign:'right'}}>{elapsed}</span>
    {onView && (
      <button onClick={onView} style={{fontSize:11,padding:'3px 9px',border:'1px solid var(--accent)',borderRadius:4,background:'var(--accent-dim)',color:'var(--accent)',cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}}>
        View <Icon name="chevR" size={9}/>
      </button>
    )}
  </div>
);

const LogStream = ({ agents, elapsed }) => {
  const lines = React.useMemo(()=>{
    const all=[
      {t:0,   k:'orchestrator', l:'ok',   m:'plan → {intent, 2 competitors, timeline=26w} '},
      {t:0,   k:'orchestrator', l:'info', m:'chord([keyword, competitor, content_audit, llm_visibility]) dispatched'},
      {t:1,   k:'keyword',      l:'info', m:'dataforseo.keywords_for_keywords(seeds=[ats, recruiting, applicant tracking...])'},
      {t:1,   k:'competitor',   l:'info', m:'competitor_stub · serp.organic(q="applicant tracking system")'},
      {t:2,   k:'content_audit',l:'info', m:'content_audit_stub · crawling whitecarrot.io/*'},
      {t:3,   k:'llm_visibility',l:'info',m:'llm_visibility_stub · querying GPT-4o, Claude, Perplexity, Gemini'},
      {t:5,   k:'competitor',   l:'ok',   m:'competitor_stub → complete · 3 competitors'},
      {t:7,   k:'content_audit',l:'ok',   m:'content_audit_stub → complete · 34 pages'},
      {t:8,   k:'llm_visibility',l:'ok',  m:'llm_visibility_stub → complete · citation_rate=12%'},
      {t:10,  k:'keyword',      l:'info', m:'claude re-rank(412 kws, priority_score) · $0.024'},
      {t:10,  k:'keyword',      l:'ok',   m:'keyword → complete · 412 kws persisted'},
      {t:10,  k:'finalize',     l:'ok',   m:'all ok → sprint.status = complete'},
    ];
    return all.filter(l=>l.t<=elapsed);
  },[elapsed]);

  return (
    <div style={{borderTop:'1px solid var(--border)',background:'var(--bg)',padding:'8px 0',maxHeight:160,overflow:'auto'}}>
      {lines.map((l,i)=>(
        <div key={i} className="mono" style={{display:'grid',gridTemplateColumns:'30px 48px 100px 1fr',gap:8,padding:'3px 14px',fontSize:10,borderTop:i?'1px solid var(--border)':'none'}}>
          <span style={{color:'var(--text-dim)'}}>{String(l.t).padStart(2,'0')}s</span>
          <span style={{color:l.l==='ok'?'var(--ok)':'var(--running)'}}>{l.l}</span>
          <span style={{color:'var(--text-dim)'}}>{l.k}</span>
          <span style={{color:'var(--text)'}}>{l.m}</span>
        </div>
      ))}
    </div>
  );
};

// ── Small helpers ─────────────────────────────────────────────────────────
const Field = ({ label, value, onChange, type='text', placeholder }) => (
  <div style={{display:'flex',flexDirection:'column',gap:5}}>
    <label style={{fontSize:11,color:'var(--text-mut)',fontWeight:500}}>{label}</label>
    <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      style={{padding:'8px 10px',border:'1px solid var(--border)',borderRadius:5,background:'var(--bg-hover)',color:'var(--text)',fontSize:13,outline:'none',fontFamily:'inherit'}}
      onFocus={e=>e.target.style.borderColor='var(--accent)'}
      onBlur={e=>e.target.style.borderColor='var(--border)'}
    />
  </div>
);

const KVRow = ({ k, v }) => (
  <>
    <span style={{color:'var(--text-dim)',fontSize:11,paddingTop:2}}>{k}</span>
    <span style={{color:'var(--text)',fontSize:12}}>{v}</span>
  </>
);

const StrategyBriefCard = ({ navigate }) => (
  <div style={{display:'flex',gap:10,alignItems:'flex-start'}} className="fade-up">
    <div style={{width:24,height:24,borderRadius:6,background:'var(--accent-dim)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--accent)',flexShrink:0,marginTop:2}}>
      <PrismLogo size={13}/>
    </div>
    <div style={{flex:1,border:'1px solid var(--accent)',borderRadius:'2px 10px 10px 10px',background:'var(--bg-card)',overflow:'hidden'}}>
      <div style={{padding:'14px 16px',borderBottom:'1px solid var(--border)'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
          <span style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>Strategy Brief ready</span>
          <span className="mono" style={{fontSize:10,padding:'2px 8px',borderRadius:3,background:'var(--accent-dim)',color:'var(--accent)'}}>Gate-1 · awaiting review</span>
        </div>
        <div style={{fontSize:12,color:'var(--text-mut)',lineHeight:1.6}}>
          Synthesis complete — 6 content clusters, 24 recommended pieces, competitor gap analysis, LLM visibility report, and a prioritised action plan are ready for review.
        </div>
      </div>
      <div style={{padding:'12px 16px',display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,background:'var(--bg-elev)',borderBottom:'1px solid var(--border)'}}>
        {[
          {v:'6',    l:'clusters'},
          {v:'24',   l:'content pieces'},
          {v:'189',  l:'keyword gaps'},
          {v:'12%',  l:'LLM citation'},
          {v:'48k',  l:'est. traffic/mo'},
          {v:'26w',  l:'timeline'},
        ].map((s,i)=>(
          <div key={i} style={{display:'flex',gap:6,alignItems:'baseline'}}>
            <span style={{fontSize:16,fontWeight:700,color:'var(--accent)',letterSpacing:-.3}}>{s.v}</span>
            <span style={{fontSize:11,color:'var(--text-dim)'}}>{s.l}</span>
          </div>
        ))}
      </div>
      <div style={{padding:'12px 16px',display:'flex',gap:8}}>
        <PrimaryBtn onClick={()=>navigate('strategy-brief')} style={{fontSize:12,padding:'7px 14px'}}>
          <Icon name="sparkle" size={12}/> Review Strategy Brief
        </PrimaryBtn>
        <GhostBtn style={{fontSize:12}}>
          <Icon name="link" size={11}/> Share link
        </GhostBtn>
      </div>
    </div>
  </div>
);

Object.assign(window, { SignInScreen, WorkspaceNewScreen, WorkspaceScreen, RunsDashboard });
