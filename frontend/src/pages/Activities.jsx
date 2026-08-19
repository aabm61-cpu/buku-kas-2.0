import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { formatDateTime, roleLabel } from "@/lib/format";
import { Activity as ActivityIcon } from "lucide-react";

const actionColor = {
  create: "text-green-700 bg-green-50",
  update: "text-blue-700 bg-blue-50",
  delete: "text-red-700 bg-red-50",
  assign: "text-purple-700 bg-purple-50",
  unassign: "text-orange-700 bg-orange-50",
};

export default function Activities() {
  const [items, setItems] = useState([]);
  useEffect(() => { api.get("/activities?limit=200").then(r => setItems(r.data)); }, []);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs tracking-widest text-slate-500 mb-2">JEJAK AKSI SELURUH SISTEM</div>
        <h1 className="font-display font-extrabold text-3xl text-slate-900">Log Aktivitas</h1>
      </div>

      <Card className="bg-white border-slate-200 divide-y divide-slate-100">
        {items.map(a => (
          <div key={a.id} className="p-4 flex items-start gap-4" data-testid={`activity-${a.id}`}>
            <div className="h-9 w-9 rounded-full bg-slate-900 text-white flex items-center justify-center font-display font-bold text-sm shrink-0">
              {a.user_name?.charAt(0).toUpperCase() || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-900">{a.user_name || a.username}</span>
                <span className={`chip-${a.role} inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold`}>{roleLabel(a.role)}</span>
                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${actionColor[a.action] || "bg-slate-100 text-slate-700"}`}>{a.action}</span>
                <span className="text-slate-500 text-sm">{a.entity_type}</span>
              </div>
              {a.details && <div className="text-sm text-slate-700 mt-1">{a.details}</div>}
              <div className="text-xs text-slate-400 mt-1">{formatDateTime(a.created_at)}</div>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="p-12 text-center text-slate-500"><ActivityIcon className="h-8 w-8 mx-auto mb-2 text-slate-300" />Belum ada aktivitas.</div>}
      </Card>
    </div>
  );
}
