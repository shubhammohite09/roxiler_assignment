import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { api, session } from './api.js';
import { Form, Table, Stars } from './components.jsx';

const ROLE_HOME = { admin: '/admin', user: '/stores', store_owner: '/owner' };
const ROLE_LABEL = { admin: 'Admin', user: 'User', store_owner: 'Store owner' };

// Loads data from the API whenever params/sort change
function useList(path, params, sort) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const key = JSON.stringify([params, sort]);
  const load = useCallback(() => {
    api(path, { params: { ...params, sort: sort?.key, order: sort?.dir } }).then(setRows).catch((e) => setError(e.message));
    // eslint-disable-next-line
  }, [path, key]);
  useEffect(load, [load]);
  return [rows, load, error];
}

export default function App() {
  const [user, setUser] = useState(session.get()?.user || null);
  const nav = useNavigate();
  const logout = () => { session.clear(); setUser(null); nav('/login'); };
  const guard = (role, el) => (!user ? <Navigate to="/login" /> : user.role !== role ? <Navigate to={ROLE_HOME[user.role]} /> : el);
  return (
    <>
      {user && (
        <header className="bar">
          <strong>Storefront Ratings</strong>
          <nav>
            <span className="muted">{user.name} · {ROLE_LABEL[user.role]}</span>
            <a href="/password" onClick={(e) => { e.preventDefault(); nav('/password'); }}>Change password</a>
            <button className="link" onClick={logout}>Log out</button>
          </nav>
        </header>
      )}
      <main>
        <Routes>
          <Route path="/login" element={<Login onLogin={setUser} />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/password" element={user ? <Password /> : <Navigate to="/login" />} />
          <Route path="/admin" element={guard('admin', <Admin />)} />
          <Route path="/stores" element={guard('user', <UserStores />)} />
          <Route path="/owner" element={guard('store_owner', <Owner />)} />
          <Route path="*" element={<Navigate to={user ? ROLE_HOME[user.role] : '/login'} />} />
        </Routes>
      </main>
    </>
  );
}

function AuthShell({ title, children, foot }) {
  return <section className="auth"><h1>{title}</h1>{children}<p className="muted">{foot}</p></section>;
}

function Login({ onLogin }) {
  const nav = useNavigate();
  return (
    <AuthShell title="Log in" foot={<>New here? <a href="/signup">Create an account</a></>}>
      <Form submitLabel="Log in" fields={[{ key: 'email', label: 'Email', rule: 'email' }, { key: 'password', label: 'Password', type: 'password' }]}
        onSubmit={async (v) => { const r = await api('/auth/login', { method: 'POST', body: v }); session.set(r); onLogin(r.user); nav(ROLE_HOME[r.user.role]); }} />
    </AuthShell>
  );
}

function Signup() {
  const nav = useNavigate();
  return (
    <AuthShell title="Create your account" foot={<>Already registered? <a href="/login">Log in</a></>}>
      <Form submitLabel="Sign up" fields={[
        { key: 'name', label: 'Full name (20-60 characters)', rule: 'name' },
        { key: 'email', label: 'Email', rule: 'email' },
        { key: 'address', label: 'Address', type: 'textarea', rule: 'address' },
        { key: 'password', label: 'Password', type: 'password', rule: 'password' }]}
        onSubmit={async (v) => { await api('/auth/signup', { method: 'POST', body: v }); nav('/login'); }} />
    </AuthShell>
  );
}

function Password() {
  return (
    <AuthShell title="Change password" foot="">
      <Form submitLabel="Update password" fields={[
        { key: 'currentPassword', label: 'Current password', type: 'password' },
        { key: 'newPassword', label: 'New password', type: 'password', rule: 'password' }]}
        onSubmit={(v) => api('/auth/password', { method: 'PUT', body: v })} />
    </AuthShell>
  );
}

// ---------- Admin
function Admin() {
  const [stats, setStats] = useState(null);
  const [tab, setTab] = useState('stores');
  useEffect(() => { api('/admin/stats').then(setStats); }, [tab]);
  return (
    <>
      <h1>Dashboard</h1>
      <div className="stats">
        {['users', 'stores', 'ratings'].map((k) => <div key={k}><b>{stats?.[k] ?? '–'}</b><span>{k === 'ratings' ? 'Ratings submitted' : k === 'users' ? 'Users' : 'Stores'}</span></div>)}
      </div>
      <div className="tabs">{[['stores', 'Stores'], ['users', 'Users'], ['addUser', 'Add user'], ['addStore', 'Add store']].map(([k, l]) =>
        <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'stores' && <AdminStores />}
      {tab === 'users' && <AdminUsers />}
      {tab === 'addUser' && <AddUser />}
      {tab === 'addStore' && <AddStore />}
    </>
  );
}

function Filters({ fields, values, onChange }) {
  return <div className="filters">{fields.map((f) => f === 'role' ? (
    <select key={f} value={values.role || ''} onChange={(e) => onChange({ ...values, role: e.target.value })} aria-label="Filter by role">
      <option value="">All roles</option><option value="admin">Admin</option><option value="user">User</option><option value="store_owner">Store owner</option>
    </select>) : (
    <input key={f} placeholder={`Filter by ${f}`} value={values[f] || ''} onChange={(e) => onChange({ ...values, [f]: e.target.value })} />))}</div>;
}

function AdminStores() {
  const [filters, setFilters] = useState({}); const [sort, setSort] = useState({ key: 'name', dir: 'asc' });
  const [rows] = useList('/admin/stores', filters, sort);
  return <><Filters fields={['name', 'email', 'address']} values={filters} onChange={setFilters} />
    <Table sort={sort} onSort={setSort} rows={rows} columns={[
      { key: 'name', label: 'Name', sortable: true }, { key: 'email', label: 'Email', sortable: true },
      { key: 'address', label: 'Address', sortable: true }, { key: 'rating', label: 'Rating', sortable: true, render: (r) => <Stars value={r.rating} /> }]} /></>;
}

function AdminUsers() {
  const [filters, setFilters] = useState({}); const [sort, setSort] = useState({ key: 'name', dir: 'asc' });
  const [rows] = useList('/admin/users', filters, sort);
  const [detail, setDetail] = useState(null);
  return <><Filters fields={['name', 'email', 'address', 'role']} values={filters} onChange={setFilters} />
    <Table sort={sort} onSort={setSort} rows={rows} onRow={(r) => api(`/admin/users/${r.id}`).then(setDetail)} columns={[
      { key: 'name', label: 'Name', sortable: true }, { key: 'email', label: 'Email', sortable: true },
      { key: 'address', label: 'Address', sortable: true }, { key: 'role', label: 'Role', sortable: true, render: (r) => ROLE_LABEL[r.role] }]} />
    {detail && <aside className="detail"><button className="link" onClick={() => setDetail(null)}>Close</button>
      <h2>{detail.name}</h2><p>{detail.email}</p><p>{detail.address}</p><p>{ROLE_LABEL[detail.role]}</p>
      {detail.role === 'store_owner' && <p>Store rating: <Stars value={detail.rating} /></p>}</aside>}</>;
}

function AddUser() {
  return <Form submitLabel="Add user" fields={[
    { key: 'name', label: 'Name (20-60 characters)', rule: 'name' }, { key: 'email', label: 'Email', rule: 'email' },
    { key: 'address', label: 'Address', type: 'textarea', rule: 'address' }, { key: 'password', label: 'Password', type: 'password', rule: 'password' },
    { key: 'role', label: 'Role', options: [{ value: 'user', label: 'Normal user' }, { value: 'admin', label: 'Admin' }, { value: 'store_owner', label: 'Store owner' }] }]}
    onSubmit={(v) => api('/admin/users', { method: 'POST', body: v })} />;
}

function AddStore() {
  const [owners] = useList('/admin/users', { role: 'store_owner' }, { key: 'name', dir: 'asc' });
  return <Form submitLabel="Add store" fields={[
    { key: 'name', label: 'Store name', rule: 'storeName' }, { key: 'email', label: 'Store email', rule: 'email' },
    { key: 'address', label: 'Address', type: 'textarea', rule: 'address' },
    { key: 'ownerId', label: 'Owner (optional)', options: owners.map((o) => ({ value: o.id, label: `${o.name} (${o.email})` })) }]}
    onSubmit={(v) => api('/admin/stores', { method: 'POST', body: v })} />;
}

// ---------- Normal user
function UserStores() {
  const [search, setSearch] = useState(''); const [sort, setSort] = useState({ key: 'name', dir: 'asc' });
  const [rows, reload, error] = useList('/stores', { search }, sort);
  const rate = async (id, rating) => { await api(`/stores/${id}/rating`, { method: 'PUT', body: { rating } }); reload(); };
  return (
    <>
      <h1>Stores</h1>
      <div className="filters"><input placeholder="Search by name or address" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      {error && <p className="err">{error}</p>}
      <Table sort={sort} onSort={setSort} rows={rows} columns={[
        { key: 'name', label: 'Store', sortable: true }, { key: 'address', label: 'Address', sortable: true },
        { key: 'rating', label: 'Overall rating', sortable: true, render: (r) => <Stars value={r.rating} /> },
        { key: 'my', label: 'Your rating', render: (r) => (
          <select value={r.my_rating || ''} aria-label={`Your rating for ${r.name}`} onChange={(e) => rate(r.id, Number(e.target.value))}>
            <option value="" disabled>{'Rate…'}</option>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} ★</option>)}
          </select>) }]} />
    </>
  );
}

// ---------- Store owner
function Owner() {
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' });
  const [data, setData] = useState(null);
  useEffect(() => { api('/owner/dashboard', { params: { sort: sort.key, order: sort.dir } }).then(setData); }, [sort]);
  if (!data) return <p>Loading…</p>;
  if (!data.store) return <p>No store is assigned to your account yet. Ask an administrator to link one.</p>;
  return (
    <>
      <h1>{data.store.name}</h1>
      <div className="stats"><div><b>{data.average ?? '–'}</b><span>Average rating</span></div><div><b>{data.raters.length}</b><span>Ratings received</span></div></div>
      <Table sort={sort} onSort={setSort} rows={data.raters} empty="No one has rated your store yet." columns={[
        { key: 'name', label: 'User', sortable: true }, { key: 'email', label: 'Email', sortable: true },
        { key: 'rating', label: 'Rating', sortable: true, render: (r) => <Stars value={r.rating} /> },
        { key: 'date', label: 'Updated', sortable: true, render: (r) => new Date(r.updated_at).toLocaleDateString() }]} />
    </>
  );
}
