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

    expect(screen.getByText("600519 待同步")).toBeInTheDocument();
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

    expect(screen.getByText("600519 待同步")).toBeInTheDocument();
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
    expect(screen.getByText("600519 待同步")).toBeInTheDocument();
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
});
