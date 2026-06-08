export type DataSyncState = "pending" | "synced" | "failed" | "sample";

export type DataSyncSnapshot = {
  state: DataSyncState;
  source: string;
  detail: string;
  lastSyncedAt?: string;
};

export type DataSyncSummary = {
  label: string;
  tone: DataSyncState;
  detail: string;
  meta: string;
};

const stateLabels: Record<DataSyncState, string> = {
  failed: "同步失败",
  pending: "待同步",
  sample: "样例数据",
  synced: "已同步",
};

export function summarizeDataSync(snapshot: DataSyncSnapshot): DataSyncSummary {
  return {
    label: stateLabels[snapshot.state],
    tone: snapshot.state,
    detail: snapshot.detail,
    meta: [snapshot.source, snapshot.lastSyncedAt].filter(Boolean).join(" · "),
  };
}
