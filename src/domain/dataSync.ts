export type DataSyncState = "pending" | "synced" | "failed" | "sample";

export type DataSourceAttempt = {
  state: DataSyncState;
  source: string;
  detail: string;
};

export type DataSyncSnapshot = {
  state: DataSyncState;
  source: string;
  detail: string;
  attempts?: DataSourceAttempt[];
  lastSyncedAt?: string;
};

export type DataSyncSummary = {
  label: string;
  tone: DataSyncState;
  detail: string;
  meta: string;
};

export type DataReliabilitySummary = {
  label: string;
  tone: DataSyncState;
  evidence: string;
  guidance: string;
};

const stateLabels: Record<DataSyncState, string> = {
  failed: "同步失败",
  pending: "待同步",
  sample: "样例数据",
  synced: "已同步",
};

export function summarizeDataSync(snapshot: DataSyncSnapshot): DataSyncSummary {
  const attempts = snapshot.attempts?.map((attempt) => attempt.source).filter(Boolean) ?? [];
  return {
    label: stateLabels[snapshot.state],
    tone: snapshot.state,
    detail: snapshot.detail,
    meta: [
      snapshot.source,
      snapshot.lastSyncedAt,
      attempts.length ? `尝试 ${attempts.join("、")}` : "",
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

export function summarizeDataReliability(
  snapshot: DataSyncSnapshot,
): DataReliabilitySummary {
  if (snapshot.state === "failed") {
    return {
      label: "数据不可用",
      tone: "failed",
      evidence: snapshot.source,
      guidance: "不能生成买卖动作，只能进入人工排查和重新同步。",
    };
  }

  if (snapshot.state === "pending") {
    return {
      label: "等待同步",
      tone: "pending",
      evidence: snapshot.source,
      guidance: "先补齐行情、K 线和结构数据，再进入操作判断。",
    };
  }

  if (snapshot.state === "sample") {
    return {
      label: "样例验证",
      tone: "sample",
      evidence: snapshot.source,
      guidance: "仅用于验证流程，不作为实盘判断依据。",
    };
  }

  if (snapshot.source === "cache") {
    return {
      label: "缓存回退",
      tone: "sample",
      evidence: snapshot.lastSyncedAt ? `最近一次可信快照 · ${snapshot.lastSyncedAt}` : "最近一次可信快照",
      guidance: "可参考结构和位置，但不能当作最新盘中行情，需要下次同步确认。",
    };
  }

  return {
    label: "真实同步",
    tone: "synced",
    evidence: [snapshot.source, snapshot.lastSyncedAt].filter(Boolean).join(" · "),
    guidance: "可用于当前分析，仍需结合人工复核和仓位纪律。",
  };
}
