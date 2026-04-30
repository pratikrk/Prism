'use client';

import React, { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { getBrief, approveBrief } from '@/lib/api';
import type {
  FullBrief, ContentCluster, Recommendation,
  KeywordRow, CompetitorSummary, GapKeyword, AuditPage,
} from '@prism/types';

/* ─── Tab config ────────────────────────────────────────────────────────────── */
const TABS = [
  { slug: 'summary',    label: 'Summary',        icon: '✦' },
  { slug: 'keywords',   label: 'Keywords',       icon: '⊞' },
  { slug: 'clusters',   label: 'Clusters',       icon: '⊟' },
  { slug: 'competitor', label: 'Competitor Gap',  icon: '⑂' },
  { slug: 'llm',        label: 'LLM Visibility',  icon: '◉' },
  { slug: 'action',     label: 'Action Plan',    icon: '⚡' },
] as const;
type TabSlug = typeof TABS[number]['slug'];

/* ─── Empty state ───────────────────────────────────────────────────────────── */
function Empty({ label }: { label: string }) {
  return (
    <div style={{
      padding: '40px 0', textAlign: 'center',
      color: 'var(--text-dim)', fontSize: 13,
      border: '1px dashed var(--border)', borderRadius: 8,
    }}>
      {label}
    </div>
  );
}

/* ─── Brief stat strip ──────────────────────────────────────────────────────── */
function BriefStatStrip({ brief }: { brief: FullBrief }) {
  const stats = [
    { label: 'KEYWORDS',    value: brief.keyword_result?.keywords.length ?? '—' },
    { label: 'CLUSTERS',    value: brief.clusters.length },
    { label: 'GAP TERMS',   value: brief.competitor_result?.gap_keywords.length ?? '—' },
    { label: 'CONTENT',     value: brief.executive_summary.length },
    { label: 'LLM MENTIONS', value: brief.llm_visibility_result?.mention_count ?? '—' },
    { label: 'TRAFFIC EST', value: brief.competitor_result?.competitors[0]?.estimated_traffic
        ? `${Math.round(brief.competitor_result.competitors[0].estimated_traffic / 1000)}k`
        : '—' },
  ];
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)',
      gap: 0, borderBottom: '1px solid var(--border)',
      background: 'var(--bg-elev)',
    }}>
      {stats.map(({ label, value }, i) => (
        <div key={label} style={{
          padding: '10px 16px',
          borderLeft: i > 0 ? '1px solid var(--border)' : undefined,
        }}>
          <div className="mono" style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>
            {label}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.3px' }}>
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Summary tab ───────────────────────────────────────────────────────────── */
function SummaryTab({ brief }: { brief: FullBrief }) {
  if (!brief.executive_summary.length) return <Empty label="No recommendations yet." />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {brief.executive_summary.map((rec: Recommendation, i: number) => (
        <div key={i} style={{
          border: '1px solid var(--border)', borderRadius: 8,
          background: 'var(--bg-card)', padding: '14px 16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{
              width: 22, height: 22, borderRadius: 5, flexShrink: 0,
              background: 'var(--accent-dim, rgba(99,102,241,0.12))',
              color: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700,
            }}>
              {rec.priority}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                {rec.title}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-mut)', lineHeight: 1.5, marginBottom: 6 }}>
                {rec.rationale}
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 11, color: 'var(--ok)', fontWeight: 500,
              }}>
                <svg width={10} height={10} viewBox="0 0 16 16" fill="none">
                  <path d="M3 8l4 4 6-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {rec.estimated_impact}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Clusters tab ──────────────────────────────────────────────────────────── */
function ClustersTab({ brief }: { brief: FullBrief }) {
  if (!brief.clusters.length) return <Empty label="No content clusters generated yet." />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {brief.clusters.map((cluster: ContentCluster, i: number) => (
        <div key={i} style={{
          border: '1px solid var(--border)', borderRadius: 8,
          background: 'var(--bg-card)', padding: '14px 16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 20,
              background: 'var(--accent-dim, rgba(99,102,241,0.12))',
              color: 'var(--accent)', fontWeight: 600,
            }}>
              P{cluster.priority}
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{cluster.name}</span>
          </div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 8 }}>
            Hub: {cluster.hub_page}
          </div>
          {cluster.spoke_pages.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Spoke pages
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {cluster.spoke_pages.map((p, j) => (
                  <span key={j} className="mono" style={{
                    fontSize: 10, padding: '2px 6px', borderRadius: 4,
                    background: 'var(--bg-hover)', color: 'var(--text-mut)',
                  }}>
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}
          {cluster.target_keywords.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Target keywords
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {cluster.target_keywords.map((kw, j) => (
                  <span key={j} style={{
                    fontSize: 10, padding: '2px 7px', borderRadius: 4,
                    border: '1px solid var(--border)', color: 'var(--text-mut)',
                  }}>
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Keywords tab ──────────────────────────────────────────────────────────── */
function KeywordsTab({ brief }: { brief: FullBrief }) {
  const kw = brief.keyword_result;
  if (!kw?.keywords?.length) return <Empty label="Keyword data not available." />;

  const sorted = [...kw.keywords].sort((a: KeywordRow, b: KeywordRow) => b.priority_score - a.priority_score);
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Keyword', 'Volume', 'Difficulty', 'Priority'].map((h) => (
              <th key={h} style={{
                padding: '8px 10px', textAlign: h === 'Keyword' ? 'left' : 'right',
                fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase',
                letterSpacing: 0.8, fontWeight: 500,
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row: KeywordRow, i: number) => (
            <tr key={i} style={{
              borderBottom: '1px solid var(--border)',
              background: i % 2 === 0 ? 'transparent' : 'var(--bg-hover)',
            }}>
              <td style={{ padding: '8px 10px', color: 'var(--text)' }}>{row.term}</td>
              <td className="mono" style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-mut)' }}>
                {row.volume?.toLocaleString() ?? '—'}
              </td>
              <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                {row.difficulty != null ? (
                  <span style={{
                    fontSize: 10, padding: '2px 7px', borderRadius: 4,
                    background: row.difficulty < 30 ? 'var(--ok-dim)' : row.difficulty < 60 ? 'rgba(245,165,36,0.12)' : 'var(--err-dim)',
                    color: row.difficulty < 30 ? 'var(--ok)' : row.difficulty < 60 ? '#d97706' : 'var(--err)',
                    fontWeight: 500,
                  }}>
                    {row.difficulty}
                  </span>
                ) : '—'}
              </td>
              <td className="mono" style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--accent)', fontWeight: 600 }}>
                {row.priority_score.toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Competitor tab ────────────────────────────────────────────────────────── */
function CompetitorTab({ brief }: { brief: FullBrief }) {
  const comp = brief.competitor_result;
  if (!comp) return <Empty label="Competitor data not available." />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {comp.competitors.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, fontWeight: 500 }}>
            Competitor overview
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {comp.competitors.map((c: CompetitorSummary, i: number) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '1fr repeat(3, 100px)',
                gap: 10, alignItems: 'center',
                border: '1px solid var(--border)', borderRadius: 6,
                background: 'var(--bg-card)', padding: '10px 14px',
              }}>
                <div className="mono" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500 }}>{c.domain}</div>
                <div style={{ textAlign: 'right' }}>
                  <div className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{c.estimated_traffic.toLocaleString()}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>est. traffic</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{c.ranking_keywords.toLocaleString()}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>kws ranking</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{c.overlap_keywords}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>overlap</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {comp.quick_wins.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, fontWeight: 500 }}>
            Quick wins
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {comp.quick_wins.map((kw: GapKeyword, i: number) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '1fr 80px 60px',
                gap: 10, alignItems: 'center',
                padding: '8px 10px', borderRadius: 5,
                background: i % 2 === 0 ? 'transparent' : 'var(--bg-hover)',
                border: '1px solid transparent',
              }}>
                <span style={{ fontSize: 12, color: 'var(--text)' }}>{kw.term}</span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-mut)', textAlign: 'right' }}>
                  vol {kw.volume.toLocaleString()}
                </span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-mut)', textAlign: 'right' }}>
                  #{kw.competitor_position} {kw.competitor}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── LLM Visibility tab ─────────────────────────────────────────────────────── */
function LLMTab({ brief }: { brief: FullBrief }) {
  const llm = brief.llm_visibility_result;
  if (!llm) return <Empty label="LLM visibility data not available." />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <StatCard label="Brand mentioned" value={llm.brand_mentioned ? 'Yes' : 'No'} highlight={llm.brand_mentioned} />
        <StatCard label="Mention count" value={String(llm.mention_count)} />
        <StatCard label="Queries tested" value={String(llm.queries_tested.length)} />
      </div>

      {/* Competitor mentions */}
      {Object.keys(llm.competitor_mentions).length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, fontWeight: 500 }}>
            Competitor citation rates
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {Object.entries(llm.competitor_mentions).sort(([,a], [,b]) => (b as number) - (a as number)).map(([domain, count]) => (
              <div key={domain} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '7px 10px', borderRadius: 5, background: 'var(--bg-hover)',
              }}>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text)', flex: 1 }}>{domain}</span>
                <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-mut)' }}>{count as number}×</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Queries tested */}
      {llm.queries_tested.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, fontWeight: 500 }}>
            Queries tested
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {llm.queries_tested.map((q, i) => (
              <div key={i} style={{
                fontSize: 12, color: 'var(--text-mut)', padding: '5px 8px',
                borderLeft: '2px solid var(--border)',
              }}>
                {q}
              </div>
            ))}
          </div>
        </div>
      )}

      {llm.note && (
        <div style={{
          fontSize: 12, color: 'var(--text-mut)', padding: '10px 12px',
          background: 'var(--bg-hover)', borderRadius: 6, lineHeight: 1.5,
        }}>
          {llm.note}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 7,
      background: 'var(--bg-card)', padding: '12px 14px',
    }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: highlight ? 'var(--ok)' : 'var(--text)', marginBottom: 3 }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{label}</div>
    </div>
  );
}

/* ─── Action Plan tab ────────────────────────────────────────────────────────── */
function ActionPlanTab({ brief }: { brief: FullBrief }) {
  if (!brief.executive_summary.length) return <Empty label="No action items generated yet." />;

  const sorted = [...brief.executive_summary].sort((a: Recommendation, b: Recommendation) => a.priority - b.priority);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {sorted.map((rec: Recommendation, i: number) => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: '24px 1fr auto',
          gap: 12, alignItems: 'start',
          border: '1px solid var(--border)', borderRadius: 7,
          background: 'var(--bg-card)', padding: '12px 14px',
        }}>
          <span style={{
            width: 24, height: 24, borderRadius: 5, flexShrink: 0,
            background: 'var(--accent-dim, rgba(99,102,241,0.12))',
            color: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700,
          }}>
            {rec.priority}
          </span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{rec.title}</div>
            <div style={{ fontSize: 11, color: 'var(--text-mut)', lineHeight: 1.4 }}>{rec.rationale}</div>
          </div>
          <div style={{
            fontSize: 10, padding: '3px 8px', borderRadius: 20, whiteSpace: 'nowrap',
            background: 'var(--ok-dim)', color: 'var(--ok)', fontWeight: 500,
          }}>
            {rec.estimated_impact}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Content Audit (used from clusters tab when no clusters) ─────────────────── */
// (content_audit_result is surfaced in the Clusters tab if clusters are empty)

/* ─── Brief page ─────────────────────────────────────────────────────────────── */
export default function BriefPage() {
  const { id: workspaceId, briefId } = useParams<{ id: string; briefId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { getToken } = useAuth();

  const initialTab = (searchParams.get('tab') ?? 'summary') as TabSlug;
  const [activeTab, setActiveTab] = useState<TabSlug>(initialTab);
  const [approving, setApproving] = useState(false);

  const { data: brief, mutate, isLoading } = useSWR(
    `brief:${briefId}`,
    async () => {
      const tok = await getToken();
      if (!tok) return null;
      return getBrief(tok, briefId);
    },
  );

  async function handleApprove() {
    const tok = await getToken();
    if (!tok) return;
    setApproving(true);
    try {
      await approveBrief(tok, briefId);
      await mutate();
    } finally {
      setApproving(false);
    }
  }

  function handleTabClick(slug: TabSlug) {
    setActiveTab(slug);
    router.replace(`/workspaces/${workspaceId}/briefs/${briefId}?tab=${slug}`, { scroll: false });
  }

  if (isLoading || !brief) {
    return (
      <div style={{ padding: 32, color: 'var(--text-dim)', fontSize: 13 }}>
        Loading brief…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{
        borderBottom: '1px solid var(--border)',
        padding: '14px 24px',
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'var(--bg-elev)', flexShrink: 0,
      }}>
        <Link href={`/workspaces/${workspaceId}`} style={{
          color: 'var(--text-dim)', fontSize: 12, textDecoration: 'none',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <svg width={12} height={12} viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </Link>

        <div style={{ width: 1, height: 14, background: 'var(--border)' }} />

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
              Strategy Brief
            </h1>
            <span style={{
              fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 3,
              background: 'var(--accent-dim, rgba(99,102,241,0.14))',
              color: 'var(--accent)',
              fontFamily: 'var(--font-mono, monospace)',
            }}>
              Gate-1
            </span>
          </div>
          <p className="mono" style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--text-dim)' }}>
            {new Date(brief.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{
            fontSize: 10, fontWeight: 500, padding: '3px 9px', borderRadius: 20,
            background: brief.status === 'approved' ? 'var(--ok-dim)' : 'var(--accent-dim, rgba(99,102,241,0.12))',
            color: brief.status === 'approved' ? 'var(--ok)' : 'var(--accent)',
            textTransform: 'uppercase', letterSpacing: 0.6,
          }}>
            {brief.status}
          </span>

          {brief.share_token && (
            <button
              onClick={() => navigator.clipboard.writeText(`${window.location.origin}/share/${brief.share_token}`)}
              style={{
                padding: '6px 12px', borderRadius: 6,
                background: 'var(--bg-hover)', color: 'var(--text)',
                border: '1px solid var(--border)', cursor: 'pointer',
                fontSize: 11, fontWeight: 500,
              }}
            >
              Copy share link
            </button>
          )}

          {brief.status === 'draft' && (
            <button
              onClick={handleApprove}
              disabled={approving}
              style={{
                padding: '6px 16px', borderRadius: 6,
                background: 'var(--accent)', color: '#fff',
                border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                opacity: approving ? 0.6 : 1,
              }}
            >
              {approving ? 'Approving…' : 'Approve Strategy'}
            </button>
          )}
        </div>
      </div>

      <BriefStatStrip brief={brief} />

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', borderBottom: '1px solid var(--border)',
        padding: '0 24px', flexShrink: 0, background: 'var(--bg)',
        overflowX: 'auto',
      }}>
        {TABS.map(({ slug, label, icon }) => (
          <button
            key={slug}
            onClick={() => handleTabClick(slug)}
            style={{
              padding: '10px 14px', fontSize: 12, fontWeight: 500,
              background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              color: activeTab === slug ? 'var(--text)' : 'var(--text-dim)',
              borderBottom: activeTab === slug ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1,
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}
          >
            <span style={{ fontSize: 10, opacity: 0.7 }}>{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab content ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        {activeTab === 'summary'    && <SummaryTab brief={brief} />}
        {activeTab === 'keywords'   && <KeywordsTab brief={brief} />}
        {activeTab === 'clusters'   && <ClustersTab brief={brief} />}
        {activeTab === 'competitor' && <CompetitorTab brief={brief} />}
        {activeTab === 'llm'        && <LLMTab brief={brief} />}
        {activeTab === 'action'     && <ActionPlanTab brief={brief} />}
      </div>
    </div>
  );
}
