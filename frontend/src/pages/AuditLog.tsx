import React, { useState, useEffect } from 'react';
import { ShieldCheck } from 'lucide-react';
import { api } from '../services/api';
import type { AuditLogItem } from '../types';
import { useToast } from '../components/Toast';

export const AuditLogPage: React.FC = () => {
  const { showToast } = useToast();
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedAction, setSelectedAction] = useState('');
  const [selectedEntity, setSelectedEntity] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.getAuditLogs({
        action: selectedAction || undefined,
        entity: selectedEntity || undefined,
        limit,
        offset: (page - 1) * limit,
      });
      setLogs(res.items);
      setTotalCount(res.total);
    } catch (e: any) {
      showToast('error', 'Error Loading Audit Logs', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [selectedAction, selectedEntity, page]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center space-x-2">
          <ShieldCheck className="w-7 h-7 text-emerald-400" />
          <span>Immutable Audit Log Trail</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Cryptographically recorded security, authentication, and inventory transactions. Append-only system records.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <select
            value={selectedAction}
            onChange={(e) => {
              setSelectedAction(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
          >
            <option value="">All Actions</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
            <option value="LOGIN">LOGIN</option>
            <option value="FAILED_LOGIN">FAILED_LOGIN</option>
            <option value="LOGOUT">LOGOUT</option>
            <option value="APPROVE">APPROVE</option>
            <option value="ROLE_CHANGE">ROLE_CHANGE</option>
            <option value="PASSWORD_RESET">PASSWORD_RESET</option>
          </select>
        </div>

        <div>
          <select
            value={selectedEntity}
            onChange={(e) => {
              setSelectedEntity(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
          >
            <option value="">All Entities</option>
            <option value="ITEM">ITEM</option>
            <option value="USER">USER</option>
            <option value="STOCK_IN">STOCK_IN</option>
            <option value="STOCK_OUT">STOCK_OUT</option>
            <option value="REFRESH_TOKEN">REFRESH_TOKEN</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/90 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-6 py-3.5">Timestamp</th>
                <th className="px-6 py-3.5">Action</th>
                <th className="px-6 py-3.5">Entity</th>
                <th className="px-6 py-3.5">User ID / IP</th>
                <th className="px-6 py-3.5">Payload Value State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-sans">
                    Reading audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-sans">
                    No audit records found matching criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/50">
                    <td className="px-6 py-4 whitespace-nowrap text-slate-400 font-sans text-xs">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          log.action.includes('FAILED') || log.action.includes('DELETE')
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : log.action.includes('CREATE') || log.action.includes('LOGIN')
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-blue-950 text-blue-300 border border-blue-800'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-white">
                      {log.entity} {log.entityId && <span className="text-slate-500 font-normal">#{log.entityId}</span>}
                    </td>
                    <td className="px-6 py-4 text-slate-400 font-sans">
                      <div>User #{log.userId || 'System/Anon'}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{log.ip || '127.0.0.1'}</div>
                    </td>
                    <td className="px-6 py-4 max-w-xs truncate text-[11px]">
                      {log.newValue ? (
                        <pre className="text-emerald-400 truncate bg-slate-900/80 p-1.5 rounded-lg border border-slate-800">
                          {JSON.stringify(log.newValue)}
                        </pre>
                      ) : log.oldValue ? (
                        <pre className="text-amber-400 truncate bg-slate-900/80 p-1.5 rounded-lg border border-slate-800">
                          {JSON.stringify(log.oldValue)}
                        </pre>
                      ) : (
                        <span className="text-slate-600 font-sans">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400 font-sans">
          <div>
            Showing {(page - 1) * limit + 1} to {Math.min(page * limit, totalCount)} of {totalCount} records
          </div>
          <div className="flex space-x-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg disabled:opacity-30 hover:bg-slate-800 text-white"
            >
              Previous
            </button>
            <button
              disabled={page * limit >= totalCount}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg disabled:opacity-30 hover:bg-slate-800 text-white"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
