import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Users, Bike, Building2, Search, ShieldCheck, Clock3,
  RefreshCw, LayoutDashboard, LogOut, AlertCircle,
  ExternalLink, CheckCircle
} from 'lucide-react';

const db = supabase as any;

type Tab = 'Overview' | 'Leads' | 'Discover' | 'Approvals';

export const RiderHunterPage: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [leads, setLeads] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, riders: 0, companies: 0, verified: 0 });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [discovering, setDiscovering] = useState(false);
  const [leadType, setLeadType] = useState('rider');
  const [area, setArea] = useState('Ibadan');

  const loadDashboard = async () => {
    setLoading(true);
    setError('');

    const { data: access, error: accessError } = await db.rpc('rh_is_staff');
    if (accessError || !access) {
      setAllowed(false);
      setLoading(false);
      return;
    }
    setAllowed(true);

    const [leadResult, sourceResult, runResult, approvalResult] = await Promise.all([
      db.from('rh_leads')
        .select('id,lead_type,full_name,business_name,phone,city,area,verification_status,recruitment_status,created_at')
        .order('created_at', { ascending: false }).limit(100),
      db.from('rh_discovery_sources')
        .select('*').order('created_at', { ascending: false }).limit(100),
      db.from('rh_discovery_runs')
        .select('*').order('created_at', { ascending: false }).limit(10),
      db.from('rh_approvals')
        .select('id,decision,reviewer_note,created_at,draft_id')
        .eq('decision', 'pending').order('created_at', { ascending: false }).limit(50),
    ]);

    if (leadResult.error) setError(leadResult.error.message);
    else {
      const rows = leadResult.data || [];
      setLeads(rows);
      setStats({
        total: rows.length,
        riders: rows.filter((x: any) => x.lead_type === 'rider').length,
        companies: rows.filter((x: any) => x.lead_type === 'company').length,
        verified: rows.filter((x: any) => x.verification_status === 'verified').length,
      });
    }

    if (sourceResult.error) setError(sourceResult.error.message);
    else setSources(sourceResult.data || []);

    if (runResult.error) setError(runResult.error.message);
    else setRuns(runResult.data || []);

    if (approvalResult.error) setError(approvalResult.error.message);
    else setApprovals(approvalResult.data || []);

    setLoading(false);
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const discover = async () => {
    setDiscovering(true);
    setError('');
    setNotice('');

    const { data, error: invokeError } = await supabase.functions.invoke(
      'rider-hunter-discover',
      { body: { leadType, area } }
    );

    if (invokeError) {
      setError(invokeError.message || 'Discovery request failed.');
    } else if (data?.error) {
      setError(data.error);
    } else {
      setNotice(data?.message || `Discovery complete. ${data?.sourcesFound || 0} sources saved.`);
      await loadDashboard();
    }

    setDiscovering(false);
  };

  const reviewSource = async (id: string, status: 'reviewed' | 'irrelevant') => {
    setError('');
    const { error: updateError } = await db
      .from('rh_discovery_sources')
      .update({
        review_status: status,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) setError(updateError.message);
    else {
      setNotice(status === 'reviewed' ? 'Source marked as reviewed.' : 'Source marked irrelevant.');
      await loadDashboard();
    }
  };

  const styles: Record<string, React.CSSProperties> = {
    page: { minHeight: '100vh', background: '#f5f7fb', color: '#071a3d', fontFamily: 'Inter, sans-serif' },
    sidebar: { width: 245, flexShrink: 0, background: '#071a3d', color: 'white', padding: 24, display: 'flex', flexDirection: 'column', gap: 12 },
    main: { flex: 1, minWidth: 0, padding: '30px clamp(16px, 4vw, 48px)' },
    card: { background: 'white', border: '1px solid #e7ebf2', borderRadius: 15, padding: 20 },
    muted: { color: '#748198', fontSize: 13 },
    button: { border: 0, background: '#2563eb', color: 'white', padding: '11px 16px', borderRadius: 9, fontWeight: 600, cursor: 'pointer' },
    field: { width: '100%', boxSizing: 'border-box', padding: 12, border: '1px solid #dce3ed', borderRadius: 9, background: 'white', color: '#071a3d' },
    nav: { width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderRadius: 10, border: 0, color: '#c7d5e8', background: 'transparent', cursor: 'pointer', textAlign: 'left', fontSize: 14 },
  };

  if (loading) return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: '#2563eb' }}>Loading Rider Hunter...</div>;

  if (!allowed) return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f5f7fb', padding: 20 }}>
      <div style={{ ...styles.card, maxWidth: 430, textAlign: 'center' }}>
        <ShieldCheck size={42} color="#2563eb" />
        <h2>Staff access required</h2>
        <p style={styles.muted}>Your account is not authorised to access OrderFlow Rider Hunter.</p>
        <button style={styles.button} onClick={() => navigate('/')}>Return to OrderFlow</button>
      </div>
    </div>
  );

  const navItems: { name: Tab; icon: any }[] = [
    { name: 'Overview', icon: LayoutDashboard },
    { name: 'Leads', icon: Users },
    { name: 'Discover', icon: Search },
    { name: 'Approvals', icon: Clock3 },
  ];

  return (
    <div style={styles.page}>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <aside style={styles.sidebar}>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 21, fontWeight: 800 }}>OrderFlow<span style={{ color: '#60a5fa' }}>.</span></div>
            <div style={{ fontSize: 11, color: '#a9bddb', letterSpacing: 2, marginTop: 5 }}>RIDER HUNTER</div>
          </div>

          {navItems.map(item => {
            const Icon = item.icon;
            const active = activeTab === item.name;
            return (
              <button key={item.name} onClick={() => { setActiveTab(item.name); setError(''); setNotice(''); }}
                style={{ ...styles.nav, background: active ? '#17345f' : 'transparent', color: active ? 'white' : '#c7d5e8', fontWeight: active ? 700 : 500 }}>
                <Icon size={18} /> {item.name}
              </button>
            );
          })}

          <div style={{ marginTop: 'auto', borderTop: '1px solid #294264', paddingTop: 18 }}>
            <div style={{ fontSize: 13, color: '#d8e3f2' }}>{user?.fullName || user?.email}</div>
            <button onClick={async () => { await signOut(); navigate('/login'); }}
              style={{ ...styles.nav, paddingLeft: 0, marginTop: 8 }}>
              <LogOut size={17} /> Sign out
            </button>
          </div>
        </aside>

        <main style={styles.main}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 15, flexWrap: 'wrap', marginBottom: 25 }}>
            <div>
              <div style={styles.muted}>RECRUITMENT OPERATIONS / IBADAN</div>
              <h1 style={{ fontSize: 29, margin: '8px 0 5px', letterSpacing: '-1px' }}>{activeTab}</h1>
              <div style={styles.muted}>OrderFlow rider and logistics recruitment workspace.</div>
            </div>
            <button style={styles.button} onClick={loadDashboard}>
              <RefreshCw size={15} style={{ verticalAlign: 'middle', marginRight: 7 }} /> Refresh
            </button>
          </div>

          {error && <div style={{ ...styles.card, color: '#b42318', marginBottom: 16 }}><AlertCircle size={17} /> {error}</div>}
          {notice && <div style={{ ...styles.card, color: '#167447', marginBottom: 16 }}><CheckCircle size={17} /> {notice}</div>}

          {activeTab === 'Overview' && <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 15, marginBottom: 22 }}>
              {[
                { label: 'Total leads', value: stats.total, icon: Users },
                { label: 'Riders', value: stats.riders, icon: Bike },
                { label: 'Companies', value: stats.companies, icon: Building2 },
                { label: 'Verified', value: stats.verified, icon: ShieldCheck },
              ].map(item => <div key={item.label} style={styles.card}>
                <item.icon size={20} color="#2563eb" />
                <div style={{ fontSize: 28, fontWeight: 750, marginTop: 14 }}>{item.value}</div>
                <div style={styles.muted}>{item.label}</div>
              </div>)}
            </div>
            <section style={styles.card}>
              <h2 style={{ fontSize: 18, marginTop: 0 }}>Recent discovery runs</h2>
              {runs.length === 0 ? <p style={styles.muted}>No discovery runs yet. Open Discover to start your first search.</p> :
                runs.map(run => <div key={run.id} style={{ padding: '13px 0', borderBottom: '1px solid #eef1f5' }}>
                  <strong>{run.lead_type}</strong> · {run.search_area || 'Ibadan'} · {run.status}
                  <div style={styles.muted}>{run.search_summary || 'No summary available.'}</div>
                </div>)}
            </section>
          </>}

          {activeTab === 'Discover' && <section style={{ ...styles.card, maxWidth: 760 }}>
            <h2 style={{ marginTop: 0 }}>Discover public sources</h2>
            <p style={styles.muted}>Search the web for public rider and logistics information around Ibadan. Results are unverified source pages and must be reviewed; they are not confirmed rider leads.</p>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, margin: '18px 0 7px' }}>What are you looking for?</label>
            <select value={leadType} onChange={e => setLeadType(e.target.value)} style={styles.field}>
              <option value="rider">Riders</option>
              <option value="company">Logistics companies</option>
              <option value="both">Both</option>
            </select>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, margin: '18px 0 7px' }}>Search location</label>
            <input value={area} onChange={e => setArea(e.target.value)} style={styles.field} placeholder="e.g. Ibadan" />
            <button disabled={discovering || !area.trim()} onClick={discover}
              style={{ ...styles.button, marginTop: 18, opacity: discovering || !area.trim() ? .6 : 1 }}>
              <Search size={16} style={{ verticalAlign: 'middle', marginRight: 8 }} />
              {discovering ? 'Searching with Tavily...' : 'Start discovery'}
            </button>
            <div style={{ marginTop: 22, borderTop: '1px solid #eef1f5', paddingTop: 16 }}>
              <strong>Recent public sources ({sources.length})</strong>
              {sources.length === 0 ? <p style={styles.muted}>No sources collected yet.</p> :
                sources.slice(0, 8).map(source => <div key={source.id} style={{ padding: '13px 0', borderBottom: '1px solid #eef1f5' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <strong>{source.source_title}</strong>
                    <span style={styles.muted}>{source.review_status}</span>
                  </div>
                  <p style={styles.muted}>{source.evidence_summary}</p>
                  <a href={source.source_url} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontSize: 13 }}>
                    Open source <ExternalLink size={13} style={{ verticalAlign: 'middle' }} />
                  </a>
                  {source.review_status === 'pending' && <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button onClick={() => reviewSource(source.id, 'reviewed')} style={styles.button}>Mark reviewed</button>
                    <button onClick={() => reviewSource(source.id, 'irrelevant')} style={{ ...styles.button, background: '#64748b' }}>Irrelevant</button>
                  </div>}
                </div>)}
            </div>
          </section>}

          {activeTab === 'Leads' && <section style={styles.card}>
            <h2 style={{ marginTop: 0 }}>Recruitment leads</h2>
            {leads.length === 0 ? <p style={styles.muted}>No confirmed leads have been added yet. Discovery sources are kept separate until verified.</p> :
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead><tr style={{ color: '#748198', borderBottom: '1px solid #e7ebf2' }}>
                    {['Name', 'Type', 'Location', 'Verification', 'Status'].map(x => <th key={x} style={{ padding: 12 }}>{x}</th>)}
                  </tr></thead>
                  <tbody>{leads.map(lead => <tr key={lead.id} style={{ borderBottom: '1px solid #eef1f5' }}>
                    <td style={{ padding: 13, fontWeight: 600 }}>{lead.business_name || lead.full_name}</td>
                    <td style={{ padding: 13 }}>{lead.lead_type}</td>
                    <td style={{ padding: 13 }}>{[lead.area, lead.city].filter(Boolean).join(', ')}</td>
                    <td style={{ padding: 13 }}>{lead.verification_status}</td>
                    <td style={{ padding: 13 }}>{lead.recruitment_status}</td>
                  </tr>)}</tbody>
                </table>
              </div>}
          </section>}

          {activeTab === 'Approvals' && <section style={styles.card}>
            <h2 style={{ marginTop: 0 }}>Pending approvals</h2>
            {approvals.length === 0 ? <p style={styles.muted}>No pending message approvals.</p> :
              approvals.map(item => <div key={item.id} style={{ padding: 14, borderBottom: '1px solid #eef1f5' }}>
                <strong>Message approval request</strong>
                <div style={styles.muted}>Draft ID: {item.draft_id}</div>
                <div style={styles.muted}>Submitted: {new Date(item.created_at).toLocaleString()}</div>
              </div>)}
            <p style={styles.muted}>Approval decisions remain subject to the database consent and administrator rules.</p>
          </section>}

          <div style={{ ...styles.muted, marginTop: 20 }}>OrderFlow Rider Hunter · Staff workspace</div>
        </main>
      </div>
    </div>
  );
};

export default RiderHunterPage;
