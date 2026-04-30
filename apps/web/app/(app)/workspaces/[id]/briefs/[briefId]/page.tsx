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

  const topRec = brief.executive_summary[0];
  const insightCards = brief.executive_summary.slice(0, 4);
  const sorted = [...brief.executive_summary].sort((a, b) => a.priority - b.priority);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* AI synthesis box */}
      <div style={{
        border: '1px solid var(--accent)',
        borderRadius: 8, padding: '14px 16px',
        background: 'var(--bg-card)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{
            width: 20, height: 20, borderRadius: 4,
            background: 'var(--accent-dim, rgba(99,102,241,0.14))',
            color: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9,
          }}>▲</span>
          <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Claude synthesis
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
          {topRec.rationale}
        </p>
      </div>

      {/* 2×2 insight cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {insightCards.map((rec: Recommendation, i: number) => (
          <div key={i} style={{
            border: '1px solid var(--border)', borderRadius: 8,
            background: 'var(--bg-card)', padding: '14px 16px',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
              {rec.title}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-mut)', lineHeight: 1.5, marginBottom: 8 }}>
              {rec.rationale}
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 10, color: 'var(--ok)', fontWeight: 500,
              padding: '2px 8px', borderRadius: 3, background: 'var(--ok-dim)',
            }}>
              {rec.estimated_impact}
            </div>
          </div>
        ))}
      </div>

      {/* Priority table */}
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, fontWeight: 500 }}>
          All recommendations
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['#', 'Title', 'Rationale', 'Impact'].map((h) => (
                  <th key={h} style={{
                    padding: '7px 10px', textAlign: h === '#' || h === 'Impact' ? 'center' : 'left',
                    fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase',
                    letterSpacing: 0.8, fontWeight: 500,
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((rec: Recommendation, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 10px', textAlign: 'center', width: 32 }}>
                    <span style={{
                      width: 22, height: 22, borderRadius: 5, display: 'inline-flex',
                      alignItems: 'center', justifyContent: 'center',
                      background: 'var(--accent-dim, rgba(99,102,241,0.12))',
                      color: 'var(--accent)', fontSize: 11, fontWeight: 700,
                    }}>
                      {rec.priority}
                    </span>
                  </td>
                  <td style={{ padding: '8px 10px', fontWeight: 500, color: 'var(--text)' }}>{rec.title}</td>
                  <td style={{ padding: '8px 10px', color: 'var(--text-mut)', maxWidth: 320, lineHeight: 1.4 }}>{rec.rationale}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <span style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 20,
                      background: 'var(--ok-dim)', color: 'var(--ok)', fontWeight: 500,
                    }}>
                      {rec.estimated_impact}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─── Clusters tab ──────────────────────────────────────────────────────────── */
function ClustersTab({ brief }: { brief: FullBrief }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  if (!brief.clusters.length) return <Empty label="No content clusters generated yet." />;

  const priorityBorderColor = (p: number) =>
    p === 0 ? 'var(--ok)' : p === 1 ? '#d97706' : 'var(--running)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {brief.clusters.map((cluster: ContentCluster, i: number) => {
        const isExp = expanded === i;
        return (
          <div
            key={i}
            onClick={() => setExpanded(isExp ? null : i)}
            style={{
              border: '1px solid var(--border)', borderRadius: 8,
              background: 'var(--bg-card)',
              borderLeft: `3px solid ${priorityBorderColor(cluster.priority)}`,
              cursor: 'pointer',
              overflow: 'hidden',
            }}
          >
            {/* Collapsed row */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 14px',
            }}>
              <span style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 20, flexShrink: 0,
                background: 'var(--accent-dim, rgba(99,102,241,0.12))',
                color: 'var(--accent)', fontWeight: 600,
              }}>
                P{cluster.priority}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1 }}>
                {cluster.name}
              </span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                {cluster.target_keywords.length} kws
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                {cluster.spoke_pages.length + 1} pages
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-dim)', transform: isExp ? 'rotate(90deg)' : undefined, transition: 'transform 0.15s', marginLeft: 4 }}>›</span>
            </div>

            {/* Expanded content */}
            {isExp && (
              <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border)' }}>
                {/* Hub page */}
                <div style={{
                  borderLeft: '3px solid var(--accent)',
                  padding: '8px 12px', marginTop: 12, marginBottom: 8,
                  background: 'var(--accent-dim, rgba(99,102,241,0.06))',
                  borderRadius: '0 6px 6px 0',
                }}>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 }}>Hub page</div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>{cluster.hub_page}</div>
                </div>
                {/* Spoke pages */}
                {cluster.spoke_pages.length > 0 && (
                  <div style={{ paddingLeft: 16 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Spoke pages</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {cluster.spoke_pages.map((p, j) => (
                        <div key={j} className="mono" style={{
                          fontSize: 11, padding: '4px 8px', borderRadius: 4,
                          background: 'var(--bg-hover)', color: 'var(--text-mut)',
                        }}>
                          {p}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Target keywords */}
                {cluster.target_keywords.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
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
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Keywords tab helpers ──────────────────────────────────────────────────── */
function Sparkline({ trend }: { trend?: number[] }) {
  if (!trend?.length) return <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>—</span>;
  const max = Math.max(...trend, 1);
  const W = 40, H = 14;
  const pts = trend.map((v, i) => {
    const x = (i / (trend.length - 1)) * W;
    const y = H - (v / max) * H;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={W} height={H} style={{ overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke="var(--running)" strokeWidth="1.2" />
    </svg>
  );
}

function KdBar({ kd }: { kd: number | null }) {
  if (kd == null) return <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>—</span>;
  const color = kd < 30 ? 'var(--ok)' : kd < 55 ? '#d97706' : 'var(--err)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--bg-hover)', overflow: 'hidden' }}>
        <div style={{ width: `${kd}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 10, color, fontWeight: 500, fontFamily: 'var(--font-mono, monospace)' }}>{kd}</span>
    </div>
  );
}

/* ─── Keywords tab ──────────────────────────────────────────────────────────── */
type SortField = 'priority_score' | 'volume' | 'difficulty';
type IntentFilter = 'All' | 'TOF' | 'MOF' | 'BOF';

function KeywordsTab({ brief }: { brief: FullBrief }) {
  const kw = brief.keyword_result;
  const [search, setSearch] = useState('');
  const [intent, setIntent] = useState<IntentFilter>('All');
  const [sort, setSort] = useState<{ field: SortField; dir: 'asc' | 'desc' }>({ field: 'priority_score', dir: 'desc' });
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!kw?.keywords?.length) return <Empty label="Keyword data not available." />;

  const allKws = kw.keywords;
  const avgKd = allKws.reduce((s, k) => s + (k.difficulty ?? 0), 0) / allKws.length;
  const totalVol = allKws.reduce((s, k) => s + (k.volume ?? 0), 0);
  const priorityPool = allKws.filter(k => k.priority_score >= 70).length;

  const filtered = allKws
    .filter(k => search === '' || k.term.toLowerCase().includes(search.toLowerCase()))
    .filter(k => intent === 'All' || k.intent === intent)
    .sort((a, b) => {
      const mul = sort.dir === 'desc' ? -1 : 1;
      const va = sort.field === 'volume' ? (a.volume ?? 0)
               : sort.field === 'difficulty' ? (a.difficulty ?? 0)
               : a.priority_score;
      const vb = sort.field === 'volume' ? (b.volume ?? 0)
               : sort.field === 'difficulty' ? (b.difficulty ?? 0)
               : b.priority_score;
      return (va - vb) * mul;
    });

  function toggleSort(field: SortField) {
    setSort(prev => prev.field === field
      ? { field, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
      : { field, dir: 'desc' });
  }

  const intentColors: Record<string, { bg: string; color: string }> = {
    TOF: { bg: 'rgba(91,141,255,0.12)', color: '#5b8dff' },
    MOF: { bg: 'rgba(245,165,36,0.12)', color: '#d97706' },
    BOF: { bg: 'rgba(62,207,142,0.12)', color: 'var(--ok)' },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Stat strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {([
          { label: 'Total keywords', value: allKws.length.toLocaleString() },
          { label: 'Avg difficulty', value: avgKd.toFixed(0), bar: avgKd },
          { label: 'Total volume', value: `${Math.round(totalVol / 1000)}k` },
          { label: 'Priority pool', value: priorityPool.toString(), accent: true },
        ] as Array<{ label: string; value: string; bar?: number; accent?: boolean }>).map(({ label, value, bar, accent }) => (
          <div key={label} style={{
            border: '1px solid var(--border)', borderRadius: 7,
            background: 'var(--bg-card)', padding: '10px 12px',
          }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: accent ? 'var(--accent)' : 'var(--text)', marginBottom: 2 }}>
              {value}
            </div>
            {bar != null && (
              <div style={{ width: '100%', height: 3, borderRadius: 2, background: 'var(--bg-hover)', marginBottom: 4, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(bar, 100)}%`, height: '100%', background: bar < 30 ? 'var(--ok)' : bar < 55 ? '#d97706' : 'var(--err)' }} />
              </div>
            )}
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search keywords…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, padding: '7px 10px', borderRadius: 6, fontSize: 12,
            border: '1px solid var(--border)', background: 'var(--bg-card)',
            color: 'var(--text)', outline: 'none',
          }}
        />
        {(['All', 'TOF', 'MOF', 'BOF'] as IntentFilter[]).map(f => (
          <button key={f} onClick={() => setIntent(f)} style={{
            padding: '5px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500,
            border: 'none', cursor: 'pointer',
            background: intent === f ? 'var(--accent)' : 'var(--bg-hover)',
            color: intent === f ? '#fff' : 'var(--text-dim)',
          }}>
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '7px 10px', textAlign: 'left', fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 500 }}>
                Keyword
              </th>
              {([['Volume', 'volume'], ['KD', 'difficulty'], ['CPC', null], ['Intent', null], ['Trend', null], ['Competitor', null], ['Score', 'priority_score']] as Array<[string, SortField | null]>).map(([h, sf]) => (
                <th key={h}
                  onClick={sf ? () => toggleSort(sf) : undefined}
                  style={{
                    padding: '7px 10px', textAlign: 'right',
                    fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase',
                    letterSpacing: 0.8, fontWeight: 500,
                    cursor: sf ? 'pointer' : undefined,
                    userSelect: 'none',
                  }}
                >
                  {h}{sf && sort.field === sf ? (sort.dir === 'desc' ? ' ↓' : ' ↑') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row: KeywordRow, i: number) => {
              const ic = row.intent ? intentColors[row.intent] : null;
              const isExp = expanded === row.term;
              return (
                <React.Fragment key={row.term}>
                  <tr
                    onClick={() => setExpanded(isExp ? null : row.term)}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      background: isExp ? 'var(--bg-hover)' : i % 2 === 0 ? 'transparent' : 'var(--bg-hover)',
                      cursor: 'pointer',
                    }}
                  >
                    <td style={{ padding: '8px 10px', color: 'var(--text)' }}>{row.term}</td>
                    <td className="mono" style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-mut)' }}>
                      {row.volume?.toLocaleString() ?? '—'}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                      <KdBar kd={row.difficulty} />
                    </td>
                    <td className="mono" style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-mut)' }}>
                      {row.cpc != null ? `$${row.cpc.toFixed(2)}` : '—'}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                      {ic ? (
                        <span style={{
                          fontSize: 10, padding: '2px 7px', borderRadius: 3, fontWeight: 500,
                          background: ic.bg, color: ic.color,
                          fontFamily: 'var(--font-mono, monospace)',
                        }}>
                          {row.intent}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                      <Sparkline trend={row.trend} />
                    </td>
                    <td className="mono" style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-dim)', fontSize: 11 }}>
                      {row.top_competitor ?? '—'}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
                        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--bg-hover)', overflow: 'hidden' }}>
                          <div style={{
                            width: `${row.priority_score}%`, height: '100%',
                            background: row.priority_score >= 70 ? 'var(--ok)' : row.priority_score >= 50 ? '#d97706' : 'var(--text-dim)',
                            borderRadius: 2,
                          }} />
                        </div>
                        <span className="mono" style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', minWidth: 28 }}>
                          {row.priority_score.toFixed(0)}
                        </span>
                      </div>
                    </td>
                  </tr>
                  {isExp && (
                    <tr key={`${row.term}-exp`} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td colSpan={8} style={{ padding: '10px 14px', background: 'var(--bg-elev)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                          <div>
                            <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>URL slug</div>
                            <div className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>/{row.term.toLowerCase().replace(/\s+/g, '-')}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Intent</div>
                            <div style={{ fontSize: 11, color: 'var(--text)' }}>{row.intent ?? 'Unknown'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Content type</div>
                            <div style={{ fontSize: 11, color: 'var(--text)' }}>
                              {row.intent === 'BOF' ? 'Landing page' : row.intent === 'MOF' ? 'Comparison guide' : 'Informational article'}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
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
      {/* Per-LLM breakdown cards (if available) */}
      {llm.llm_breakdown ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {llm.llm_breakdown.map((item) => (
            <div key={item.name} style={{
              border: '1px solid var(--border)', borderRadius: 7,
              background: 'var(--bg-card)', padding: '14px 16px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{item.name}</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.4px' }}>
                  {(item.citation_rate * 100).toFixed(0)}%
                </span>
              </div>
              <div style={{ width: '100%', height: 4, borderRadius: 2, background: 'var(--bg-hover)', overflow: 'hidden', marginBottom: 6 }}>
                <div style={{
                  width: `${item.citation_rate * 100}%`, height: '100%',
                  background: item.citation_rate > 0.5 ? 'var(--ok)' : item.citation_rate > 0.2 ? '#d97706' : 'var(--running)',
                  borderRadius: 2,
                }} />
              </div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                {item.cited}/{item.total} queries cited
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Fallback: original 3-stat view */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <StatCard label="Brand mentioned" value={llm.brand_mentioned ? 'Yes' : 'No'} highlight={llm.brand_mentioned} />
          <StatCard label="Mention count" value={String(llm.mention_count)} />
          <StatCard label="Queries tested" value={String(llm.queries_tested.length)} />
        </div>
      )}

      {/* GEO recommendations table (if available) */}
      {llm.geo_recommendations && llm.geo_recommendations.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, fontWeight: 500 }}>
            GEO action items
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Action', 'Impact', 'Effort'].map(h => (
                  <th key={h} style={{
                    padding: '7px 10px', textAlign: h === 'Action' ? 'left' : 'center',
                    fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase',
                    letterSpacing: 0.8, fontWeight: 500,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {llm.geo_recommendations.map((rec, i) => {
                const effortColor = rec.effort === 'Low' ? 'var(--ok)' : rec.effort === 'Med' ? '#d97706' : 'var(--err)';
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 10px', color: 'var(--text)' }}>{rec.action}</td>
                    <td className="mono" style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--accent)', fontWeight: 600 }}>
                      +{rec.impact_pct}%
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <span style={{
                        fontSize: 10, padding: '2px 8px', borderRadius: 3, fontWeight: 500,
                        background: `${effortColor}22`, color: effortColor,
                      }}>
                        {rec.effort}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

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
