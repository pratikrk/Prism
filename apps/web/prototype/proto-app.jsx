// proto-app.jsx — router + global shell

const SCREENS = ['signin','workspace-new','workspace','runs','keywords','competitors','content_audit','llm_visibility'];

function App() {
  const [screen, setScreen] = React.useState('signin');
  const [theme,  setTheme]  = React.useState(() => localStorage.getItem('prism-theme') || 'dark');

  React.useEffect(()=>{
    document.documentElement.className = theme;
    localStorage.setItem('prism-theme', theme);
  }, [theme]);

  // Keyboard shortcut: N = new run, R = runs
  React.useEffect(()=>{
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'n' || e.key === 'N') setScreen('workspace');
      if (e.key === 'r' || e.key === 'R') setScreen('runs');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const navigate = (s) => setScreen(s);

  // Full-screen auth screens (no sidebar)
  if (screen === 'signin')       return <div style={{height:'100vh'}}><SignInScreen navigate={navigate} theme={theme} setTheme={setTheme}/></div>;
  if (screen === 'workspace-new') return <div style={{height:'100vh'}}><WorkspaceNewScreen navigate={navigate} theme={theme} setTheme={setTheme}/></div>;

  // App shell with top bar + sidebar
  const sidebarPage = { runs:'runs', workspace:'workspace', 'strategy-brief':'strategy-brief', keywords:'keywords', competitors:'competitors', content_audit:'content_audit', llm_visibility:'llm_visibility', 'workspace-new':'workspace' }[screen] || 'workspace';
  const routeLabel = {
    workspace:      'workspaces/wc-prod',
    runs:           'runs',
    'strategy-brief':'runs/r_k3f8p2a/strategy-brief',
    keywords:       'runs/r_k3f8p2a/keyword',
    competitors:    'runs/r_k3f8p2a/competitor',
    content_audit:  'runs/r_k3f8p2a/content_audit',
    llm_visibility: 'runs/r_k3f8p2a/llm_visibility',
  }[screen] || '';

  return (
    <div style={{height:'100vh',display:'flex',flexDirection:'column',background:'var(--bg)',color:'var(--text)'}}>
      <TopBar workspaceName="whitecarrot" route={routeLabel} theme={theme} setTheme={setTheme}/>
      <div style={{flex:1,display:'flex',minHeight:0}}>
        <Sidebar page={sidebarPage} navigate={navigate}/>
        <div style={{flex:1,display:'flex',flexDirection:'column',minHeight:0,minWidth:0}}>
          {screen === 'runs'            && <RunsDashboard navigate={navigate}/>}
          {screen === 'workspace'       && <WorkspaceScreen navigate={navigate} theme={theme}/>}
          {screen === 'strategy-brief'  && <StrategyBriefScreen navigate={navigate}/>}
          {screen === 'keywords'        && <KeywordResults navigate={navigate}/>}
          {screen === 'competitors'     && <CompetitorResults navigate={navigate}/>}
          {screen === 'content_audit'   && <ContentAuditResults navigate={navigate}/>}
          {screen === 'llm_visibility'  && <LLMVisibilityResults navigate={navigate}/>}
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
