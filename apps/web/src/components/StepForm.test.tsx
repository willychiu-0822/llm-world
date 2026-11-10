import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StepForm } from "./StepForm";

const wants = [{ id: "want_1", text: "想在別人面前唱一首歌", districtKey: "music", status: "active" }];
const predecessors = [{ deedId: "deed_mia", text: "先問清楚試用課會做什麼", executor: "ai", characterName: "Mia 的小鳥", isDemo: false }];
const sessions = [{ id: "ses_1", startsAt: "2030-11-09T23:00:00.000Z", capacity: 10, remaining: 3 }];

describe("StepForm", () => {
  it("defines a self step with a session, a before-note and a referenced predecessor", async () => {
    const onSubmit = vi.fn();
    render(<StepForm wants={wants} predecessors={predecessors} sessions={sessions} trialId="trl_1" hints={{ ai: "來問問題", self: "報名這週日" }} onSubmit={onSubmit} />);
    const u = userEvent.setup();
    await u.click(screen.getByRole("radio", { name: /本人/ }));
    await u.click(screen.getByRole("button", { name: /參考這一步/ }));
    expect(screen.getByLabelText("第一步")).toHaveValue("先問清楚試用課會做什麼");
    await u.clear(screen.getByLabelText("第一步"));
    await u.type(screen.getByLabelText("第一步"), "週六去上試用課");
    await u.selectOptions(screen.getByLabelText("報名場次"), "ses_1");
    await u.type(screen.getByLabelText(/做之前的話/), "應該會很尷尬吧");
    await u.click(screen.getByRole("button", { name: "確定這一步" }));
    expect(onSubmit).toHaveBeenCalledWith({
      executor: "self",
      text: "週六去上試用課",
      wantId: "want_1",
      sourceDeedIds: ["deed_mia"],
      trialId: "trl_1",
      sessionId: "ses_1",
      noteBefore: "應該會很尷尬吧",
    });
  });

  it("defines an AI step without time fields", async () => {
    const onSubmit = vi.fn();
    render(<StepForm wants={wants} predecessors={[]} onSubmit={onSubmit} />);
    const u = userEvent.setup();
    await u.click(screen.getByRole("radio", { name: /AI 角色/ }));
    expect(screen.queryByLabelText("什麼時候")).toBeNull();
    await u.type(screen.getByLabelText("第一步"), "幫我問老師流程");
    await u.click(screen.getByRole("button", { name: "確定這一步" }));
    expect(onSubmit).toHaveBeenCalledWith({ executor: "ai", text: "幫我問老師流程", wantId: "want_1", sourceDeedIds: [] });
  });

  it("converts the planned time to an ISO string with the Taipei offset", async () => {
    const onSubmit = vi.fn();
    render(<StepForm wants={[]} predecessors={[]} onSubmit={onSubmit} />);
    const u = userEvent.setup();
    await u.type(screen.getByLabelText("第一步"), "去聽 open mic");
    await u.type(screen.getByLabelText("什麼時候"), "2030-11-07T19:30");
    await u.type(screen.getByLabelText("在哪裡"), "音樂坊");
    await u.click(screen.getByRole("button", { name: "確定這一步" }));
    expect(onSubmit).toHaveBeenCalledWith({ executor: "self", text: "去聽 open mic", sourceDeedIds: [], plannedAt: "2030-11-07T19:30:00+08:00", where: "音樂坊" });
  });

  it("asks for text before submitting", async () => {
    const onSubmit = vi.fn();
    render(<StepForm wants={[]} predecessors={[]} onSubmit={onSubmit} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "確定這一步" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("寫下一個小小的第一步");
  });
});
