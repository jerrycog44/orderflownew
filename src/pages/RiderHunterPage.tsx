import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import {
  Users, Bike, Building2, Search, ShieldCheck,
  Clock3, RefreshCw, LayoutDashboard, LogOut,
  AlertCircle, MapPin
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const db = supabase as any;

export const RiderHunterPage: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, riders: 0, companies: 0, verified: 0 });
  const [error, setError] = useState('');

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

    const { data, error: leadsError } = await db
      .from('rh_leads')
      .select('id, lead_type, full_name, business_name, phone, city, area, verification_status, recruitment_status, created_at')
      .order('created_at', { ascending: false })
      .limit(8);

    if (leadsError) {
      setError(leadsError.message);
    } else {
      const rows = data || [];
      setLeads(rows);
      setStats({
        total: rows.length,
        riders: rows.filter((x: any) => x.lead_type === 'rider').length,
        companies: rows.filter((x: any) => x.lead_type === 'company').length,
        verified: rows.filter((x: any) => x.verification_status === 'verified').length,
      });
    }

    setLoading(false);
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const styles: Record<string, React.CSSProperties> = {
    page: { minHeight: '100vh', background: '#f5f7fb', color: '#071a3d', fontFamily: 'Inter, sans-serif' },
    sidebar: { width: 245, background: '#071a3d', color: 'white', padding: 24, display: 'flex', flexDirection: 'column', gap: 26 },
    main: { flex: 1, minWidth: 0, padding: '30px clamp(18px, 4vw, 48px)' },
    nav: { display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderRadius: 10, background: '#17345f', color: 'white', fontWeight: 600 },
    card: { background: 'white', border: '1px solid #e7ebf2', borderRadius: 15, padding: 20 },
    muted: { color: '#748198', fontSize: 13 },
    button: { border: 0, background: '#2563eb', color: 'white', padding: '11px 16px', borderRadius: 9, fontWeight: 600, cursor: 'pointer' },
  };

  if (loading) return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: '#2563eb' }}>Loading Rider Hunter...</div>;

  if (!allowed) return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f5f7fb', padding: 20 }}>
      <div style={{ ...styles.card, maxWidth: 430, textAlign: 'center' }}>
        <ShieldCheck size={42} color="#2563eb" />
        <h2>Staff access required</h2>
        <p style={styles.muted}>Your account is not authorised to access OrderFlow Rider Hunter. Ask an administrator to activate your staff access.</p>
        <button style={styles.button} onClick={() => navigate('/')}>Return to OrderFlow</button>
      </div>
    </div>
  );

  return (
    <div style={styles.page}>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <aside style={styles.sidebar}>
          <div>
            <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.7px' }}>OrderFlow<span style={{ color: '#60a5fa' }}>.</span></div>
            <div style={{ fontSize: 11, color: '#a9bddb', letterSpacing: 2, marginTop: 5 }}>RIDER HUNTER</div>
          </div>
          <div style={styles.nav}><LayoutDashboard size={18} /> Overview</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', color: '#b7c7df' }}><Users size={18} /> Leads</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', color: '#b7c7df' }}><Search size={18} /> Discover</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', color: '#b7c7df' }}><Clock3 size={18} /> Approvals</div>
          <div style={{ marginTop: 'auto', borderTop: '1px solid #294264', paddingTop: 18 }}>
            <div style={{ fontSize: 13, color: '#d8e3f2' }}>{user?.fullName || user?.email}</div>
            <button onClick={async () => { await signOut(); navigate('/login'); }} style={{ background: 'none', border: 0, color: '#a9bddb', display: 'flex', gap: 9, padding: '14px 0', cursor: 'pointer' }}><LogOut size={17} /> Sign out</button>
          </div>
        </aside>

        <main style={styles.main}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 15, flexWrap: 'wrap', marginBottom: 30 }}>
            <div>
              <div style={styles.muted}>RECRUITMENT OPERATIONS / IBADAN</div>
              <h1 style={{ fontSize: 29, margin: '8px 0 5px', letterSpacing: '-1px' }}>Overview</h1>
              <div style={styles.muted}>Your rider and logistics recruitment workspace.</div>
            </div>
            <button style={styles.button} onClick={loadDashboard}><RefreshCw size={15} style={{ verticalAlign: 'middle', marginRight: 7 }} /> Refresh</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(155px,1fr))', gap: 15, marginBottom: 25 }}>
            {[
              { label: 'Recent leads', value: stats.total, icon: Users },
              { label: 'Riders', value: stats.riders, icon: Bike },
              { label: 'Companies', value: stats.companies, icon: Building2 },
              { label: 'Verified', value: stats.verified, icon: ShieldCheck },
            ].map(item => (
              <div key={item.label} style={styles.card}>
                <item.icon size={20} color="#2563eb" />
                <div style={{ fontSize: 28, fontWeight: 750, marginTop: 14 }}>{item.value}</div>
                <div style={styles.muted}>{item.label}</div>
              </div>
            ))}
          </div>

          {error && <div style={{ ...styles.card, color: '#b42318', marginBottom: 18 }}><AlertCircle size={17} /> {error}</div>}

          <section style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div><h2 style={{ fontSize: 18, margin: 0 }}>Latest leads</h2><p style={styles.muted}>Recently added recruitment prospects</p></div>
              <span style={{ ...styles.muted, display: 'flex', gap: 5, alignItems: 'center' }}><MapPin size={14} /> Ibadan</span>
            </div>
            {leads.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '38px 10px', color: '#748198' }}>
                <Users size={30} />
                <h3 style={{ color: '#071a3d' }}>No leads yet</h3>
                <p style={styles.muted}>Your verified recruitment workspace is ready for its first leads.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead><tr style={{ color: '#748198', borderBottom: '1px solid #e7ebf2' }}>
                    {['Name', 'Type', 'Location', 'Verification', 'Status'].map(x => <th key={x} style={{ padding: 12 }}>{x}</th>)}
                  </tr></thead>
                  <tbody>{leads.map(lead => (
                    <tr key={lead.id} style={{ borderBottom: '1px solid #eef1f5' }}>
                      <td style={{ padding: 13, fontWeight: 600 }}>{lead.business_name || lead.full_name}</td>
                      <td style={{ padding: 13 }}>{lead.lead_type}</td>
                      <td style={{ padding: 13 }}>{[lead.area, lead.city].filter(Boolean).join(', ')}</td>
                      <td style={{ padding: 13 }}>{lead.verification_status}</td>
                      <td style={{ padding: 13 }}>{lead.recruitment_status}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </section>
          <div style={{ ...styles.muted, marginTop: 20 }}>OrderFlow Rider Hunter · Staff workspace</div>
        </main>
      </div>
    </div>
  );
};

export default RiderHunterPage;
