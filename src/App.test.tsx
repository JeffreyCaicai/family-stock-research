import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

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
});
