// Entry — wire the design canvas and expose Tweaks toggle.

const TWEAK_DEFAULS = /*EDITMODE-BEGIN*/{
  "theme": "dark"
}/*EDITMODE-END*/;

function App() {
  const [theme, setTheme] = React.useState(TWEAK_DEFAULS.theme);

  // Tweaks bridge
  React.useEffect(() => {
    const onMsg = (e) => {
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type === '__activate_edit_mode') document.getElementById('tweaks-panel').classList.add('visible');
      if (e.data.type === '__deactivate_edit_mode') document.getElementById('tweaks-panel').classList.remove('visible');
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({type:'__edit_mode_available'}, '*');
    // Wire segment
    const seg = document.getElementById('theme-seg');
    const click = (ev) => {
      const b = ev.target.closest('button[data-theme]');
      if (!b) return;
      const t = b.dataset.theme;
      setTheme(t);
      seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.theme === t));
      window.parent.postMessage({type:'__edit_mode_set_keys', edits:{theme:t}}, '*');
    };
    seg.addEventListener('click', click);
    return () => { window.removeEventListener('message', onMsg); seg.removeEventListener('click', click); };
  }, []);

  const W = 1280, H = 800;

  return (
    <DesignCanvas>
      <DCSection id="prism-flow" title="Prism · Foundation" subtitle="Goal input → live job board → keyword results">
        <DCArtboard id="goal"    label="01 · Goal input (hero)"           width={W} height={H}>
          <div data-screen-label="01 Goal input" style={{width:'100%',height:'100%'}}>
            <GoalScreen theme={theme} />
          </div>
        </DCArtboard>
        <DCArtboard id="board"   label="02 · Live job board (DAG)"        width={W} height={H}>
          <div data-screen-label="02 Job board" style={{width:'100%',height:'100%'}}>
            <BoardScreen theme={theme} />
          </div>
        </DCArtboard>
        <DCArtboard id="results" label="03 · Keyword results · 412 rows"  width={W} height={H}>
          <div data-screen-label="03 Results" style={{width:'100%',height:'100%'}}>
            <ResultsScreen theme={theme} />
          </div>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
