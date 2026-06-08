import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "./App";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
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
});
