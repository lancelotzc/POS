import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import '../../styles/layout.css';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="admin-layout">
      <Sidebar />
      <main className="main-content">
        <div className="content-wrapper glass-panel-light">
          {children}
        </div>
      </main>
    </div>
  );
}
