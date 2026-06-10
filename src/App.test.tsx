import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("renders the family pool workbench and first stock analysis", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "家庭股票池投研系统" })).toBeInTheDocument();
    expect(screen.getByText("家庭股票池")).toBeInTheDocument();
    expect(screen.getAllByText("海光信息").length).toBeGreaterThan(0);
    expect(screen.getAllByText("688041").length).toBeGreaterThan(0);
    expect(screen.getAllByText("已持有").length).toBeGreaterThan(0);
    expect(screen.getByText("数据健康")).toBeInTheDocument();
    expect(screen.getAllByText("同步状态").length).toBeGreaterThan(0);
    expect(screen.getAllByText("样例数据").length).toBeGreaterThan(0);
    expect(screen.getAllByText("可小仓试探").length).toBeGreaterThan(0);
  });

  it("adds a typed ticker into the local family pool", () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText("股票代码"), { target: { value: "600519" } });
    fireEvent.change(screen.getByLabelText("状态"), { target: { value: "researching" } });
    fireEvent.change(screen.getByLabelText("标签"), {
      target: { value: "白酒, 爸爸关注" },
    });
    fireEvent.click(screen.getByRole("button", { name: "加入家庭股票池" }));

    expect(screen.getAllByText("600519 待同步").length).toBeGreaterThan(0);
    expect(screen.getAllByText("600519").length).toBeGreaterThan(0);
    expect(screen.getAllByText("准备研究").length).toBeGreaterThan(0);
    expect(screen.getByText("白酒")).toBeInTheDocument();
    expect(screen.getAllByText("待同步").length).toBeGreaterThan(0);
    expect(screen.getAllByText("数据不足，暂不下结论").length).toBeGreaterThan(0);
    expect(screen.getByText("4 只")).toBeInTheDocument();
  });

  it("keeps a typed ticker after the app mounts again", () => {
    const { unmount } = render(<App />);

    fireEvent.change(screen.getByLabelText("股票代码"), { target: { value: "600519" } });
    fireEvent.change(screen.getByLabelText("标签"), {
      target: { value: "白酒, 爸爸关注" },
    });
    fireEvent.click(screen.getByRole("button", { name: "加入家庭股票池" }));
    unmount();

    render(<App />);

    expect(screen.getAllByText("600519 待同步").length).toBeGreaterThan(0);
    expect(screen.getByText("4 只")).toBeInTheDocument();
  });

  it("tries to write new stocks to the local file API", () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchSpy);
    render(<App />);

    fireEvent.change(screen.getByLabelText("股票代码"), { target: { value: "600519" } });
    fireEvent.change(screen.getByLabelText("标签"), {
      target: { value: "白酒, 爸爸关注" },
    });
    fireEvent.click(screen.getByRole("button", { name: "加入家庭股票池" }));

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:8787/api/family-pool",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(screen.getAllByText("600519 待同步").length).toBeGreaterThan(0);
  });

  it("loads family pool items from the local file API on startup", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            { ticker: "600519", status: "researching", tags: ["白酒", "爸爸关注"] },
          ],
        }),
      }),
    );

    render(<App />);

    expect((await screen.findAllByText("600519 待同步")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("准备研究").length).toBeGreaterThan(0);
    expect(screen.getByText("白酒")).toBeInTheDocument();
  });

  it("shows the selected stock technical structure layer", () => {
    render(<App />);

    expect(screen.getByText("结构分析层")).toBeInTheDocument();
    expect(screen.getByText("买点观察")).toBeInTheDocument();
    expect(screen.getAllByText("二买候选").length).toBeGreaterThan(0);
    expect(screen.getByText("中枢区间")).toBeInTheDocument();
    expect(screen.getByText("风险卖点")).toBeInTheDocument();
  });

  it("shows a concrete family operation plan for the selected stock", () => {
    render(<App />);

    expect(screen.getByText("家庭操作建议")).toBeInTheDocument();
    expect(screen.getByText("当前动作")).toBeInTheDocument();
    expect(screen.getAllByText("可小仓试探").length).toBeGreaterThan(0);
    expect(screen.getByText("触发条件")).toBeInTheDocument();
    expect(screen.getByText("失效条件")).toBeInTheDocument();
    expect(screen.getByText("仓位纪律")).toBeInTheDocument();
  });

  it("switches the analysis panel when a family stock is selected", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /选择 深南电路 002916/ }));

    expect(screen.getByRole("heading", { level: 2, name: "深南电路" })).toBeInTheDocument();
    expect(screen.getAllByText("可继续持有").length).toBeGreaterThan(0);
    expect(screen.getByText("399.13")).toBeInTheDocument();
  });

  it("refreshes the selected stock analysis from the local market sync API", async () => {
    const fetchSpy = vi
      .fn()
      .mockRejectedValueOnce(new Error("family pool api offline"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          snapshots: [
            {
              ticker: "688041",
              name: "海光信息",
              price: 281.12,
              dataHealthLabel: "行情、日线、周线、60 分钟线已更新",
              dataSync: {
                state: "synced",
                source: "AKShare",
                detail: "行情、日线、周线、60 分钟线已更新并生成结构摘要",
              },
            },
          ],
        }),
      });
    vi.stubGlobal("fetch", fetchSpy);

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "刷新分析" }));

    expect(await screen.findByText("281.12")).toBeInTheDocument();
    expect(screen.getByText("行情、日线、周线、60 分钟线已更新")).toBeInTheDocument();
  });

  it("does not show stale sample price after a real data sync failure", async () => {
    const fetchSpy = vi
      .fn()
      .mockRejectedValueOnce(new Error("family pool api offline"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          snapshots: [
            {
              ticker: "688041",
              dataHealthLabel: "auto 真实数据同步失败，不能下操作结论",
              dataSync: {
                state: "failed",
                source: "auto",
                detail: "真实数据同步超时或失败",
              },
              decisionInput: {
                dataHealth: "missing",
                riskFlags: ["真实数据同步失败"],
                structureSignal: "none",
                trend: "range",
              },
              structureAnalysis: null,
            },
          ],
        }),
      });
    vi.stubGlobal("fetch", fetchSpy);

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "刷新分析" }));

    expect(await screen.findAllByText("待同步")).not.toHaveLength(0);
    expect(screen.queryByText("274.06")).not.toBeInTheDocument();
    expect(screen.getByText("auto 真实数据同步失败，不能下操作结论")).toBeInTheDocument();
  });
});
