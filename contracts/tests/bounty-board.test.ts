import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const poster = accounts.get("wallet_1")!;
const worker = accounts.get("wallet_2")!;
const stranger = accounts.get("wallet_3")!;

const CONTRACT = "bounty-board-v2";
const REWARD = 5_000_000; // 5 STX
const DURATION = 1008; // ~1 week of Bitcoin blocks

const ERR_NOT_POSTER = Cl.uint(101);
const ERR_NOT_WORKER = Cl.uint(102);
const ERR_WRONG_STATUS = Cl.uint(103);
const ERR_OWN_BOUNTY = Cl.uint(104);
const ERR_REWARD_TOO_LOW = Cl.uint(105);
const ERR_EMPTY_TITLE = Cl.uint(106);
const ERR_TOO_EARLY = Cl.uint(108);
const ERR_EXPIRED = Cl.uint(109);
const ERR_BAD_DURATION = Cl.uint(110);

const contractId = () => `${simnet.deployer}.${CONTRACT}`;
const stx = (who: string) => simnet.getAssetsMap().get("STX")?.get(who) ?? 0n;

function post(reward = REWARD, sender = poster) {
  return simnet.callPublicFn(
    CONTRACT,
    "post-bounty",
    [Cl.stringUtf8("Design a logo"), Cl.stringUtf8("SVG, two colors"), Cl.stringAscii("design"), Cl.uint(reward), Cl.uint(DURATION)],
    sender,
  );
}

function call(fn: string, args: any[], sender: string) {
  return simnet.callPublicFn(CONTRACT, fn, args, sender);
}

function status(id = 1) {
  const { result } = simnet.callReadOnlyFn(CONTRACT, "get-bounty", [Cl.uint(id)], poster);
  // result is (some (tuple ...))
  return (result as any).value.value.status;
}

describe("post-bounty", () => {
  it("locks the reward in the contract and returns the id", () => {
    const before = stx(poster);
    const { result } = post();
    expect(result).toBeOk(Cl.uint(1));
    expect(stx(poster)).toBe(before - BigInt(REWARD));
    expect(stx(contractId())).toBe(BigInt(REWARD));
    expect(simnet.callReadOnlyFn(CONTRACT, "get-bounty-count", [], poster).result).toBeUint(1);
  });

  it("rejects rewards under the minimum and empty titles", () => {
    expect(post(1000).result).toBeErr(ERR_REWARD_TOO_LOW);
    const { result } = simnet.callPublicFn(
      CONTRACT,
      "post-bounty",
      [Cl.stringUtf8(""), Cl.stringUtf8(""), Cl.stringAscii("design"), Cl.uint(REWARD), Cl.uint(DURATION)],
      poster,
    );
    expect(result).toBeErr(ERR_EMPTY_TITLE);
  });
});

describe("happy path", () => {
  it("claim -> submit -> approve pays the worker", () => {
    post();
    expect(call("claim-bounty", [Cl.uint(1)], worker).result).toBeOk(Cl.bool(true));
    expect(call("submit-work", [Cl.uint(1), Cl.stringAscii("https://github.com/me/logo")], worker).result).toBeOk(
      Cl.bool(true),
    );

    const before = stx(worker);
    expect(call("approve-work", [Cl.uint(1)], poster).result).toBeOk(Cl.bool(true));
    expect(stx(worker)).toBe(before + BigInt(REWARD));
    expect(stx(contractId())).toBe(0n);
    expect(status()).toBeUint(3);
  });
});

describe("permissions", () => {
  it("poster cannot claim their own bounty", () => {
    post();
    expect(call("claim-bounty", [Cl.uint(1)], poster).result).toBeErr(ERR_OWN_BOUNTY);
  });

  it("only the worker can submit", () => {
    post();
    call("claim-bounty", [Cl.uint(1)], worker);
    expect(call("submit-work", [Cl.uint(1), Cl.stringAscii("x")], stranger).result).toBeErr(ERR_NOT_WORKER);
  });

  it("only the poster can approve, and only after submission", () => {
    post();
    call("claim-bounty", [Cl.uint(1)], worker);
    expect(call("approve-work", [Cl.uint(1)], poster).result).toBeErr(ERR_WRONG_STATUS);
    call("submit-work", [Cl.uint(1), Cl.stringAscii("x")], worker);
    expect(call("approve-work", [Cl.uint(1)], stranger).result).toBeErr(ERR_NOT_POSTER);
    expect(call("approve-work", [Cl.uint(1)], worker).result).toBeErr(ERR_NOT_POSTER);
  });

  it("a claimed bounty cannot be claimed again", () => {
    post();
    call("claim-bounty", [Cl.uint(1)], worker);
    expect(call("claim-bounty", [Cl.uint(1)], stranger).result).toBeErr(ERR_WRONG_STATUS);
  });
});

describe("cancel and abandon", () => {
  it("poster can cancel an open bounty and gets refunded", () => {
    const before = stx(poster);
    post();
    expect(call("cancel-bounty", [Cl.uint(1)], poster).result).toBeOk(Cl.bool(true));
    expect(stx(poster)).toBe(before);
    expect(status()).toBeUint(4);
  });

  it("poster cannot cancel once claimed", () => {
    post();
    call("claim-bounty", [Cl.uint(1)], worker);
    expect(call("cancel-bounty", [Cl.uint(1)], poster).result).toBeErr(ERR_WRONG_STATUS);
  });

  it("worker can abandon, reopening the bounty for others", () => {
    post();
    call("claim-bounty", [Cl.uint(1)], worker);
    expect(call("abandon-claim", [Cl.uint(1)], worker).result).toBeOk(Cl.bool(true));
    expect(status()).toBeUint(0);
    expect(call("claim-bounty", [Cl.uint(1)], stranger).result).toBeOk(Cl.bool(true));
  });
});

describe("timeouts", () => {
  it("poster can reopen a stale claim only after the claim window", () => {
    post();
    call("claim-bounty", [Cl.uint(1)], worker);
    expect(call("reopen-bounty", [Cl.uint(1)], poster).result).toBeErr(ERR_TOO_EARLY);
    simnet.mineEmptyBurnBlocks(144);
    expect(call("reopen-bounty", [Cl.uint(1)], poster).result).toBeOk(Cl.bool(true));
    expect(status()).toBeUint(0);
  });

  it("worker can collect if the poster ignores the submission", () => {
    post();
    call("claim-bounty", [Cl.uint(1)], worker);
    call("submit-work", [Cl.uint(1), Cl.stringAscii("x")], worker);
    expect(call("claim-payout", [Cl.uint(1)], worker).result).toBeErr(ERR_TOO_EARLY);
    simnet.mineEmptyBurnBlocks(144);
    const before = stx(worker);
    expect(call("claim-payout", [Cl.uint(1)], worker).result).toBeOk(Cl.bool(true));
    expect(stx(worker)).toBe(before + BigInt(REWARD));
    expect(status()).toBeUint(3);
  });

  it("a submitted bounty cannot be reopened by the poster", () => {
    post();
    call("claim-bounty", [Cl.uint(1)], worker);
    call("submit-work", [Cl.uint(1), Cl.stringAscii("x")], worker);
    simnet.mineEmptyBurnBlocks(144);
    expect(call("reopen-bounty", [Cl.uint(1)], poster).result).toBeErr(ERR_WRONG_STATUS);
  });
});

describe("deadlines and categories", () => {
  it("stores category and deadline", () => {
    post();
    const { result } = simnet.callReadOnlyFn(CONTRACT, "get-bounty", [Cl.uint(1)], poster);
    const b = (result as any).value.value;
    expect(b.category).toBeAscii("design");
    expect(Number(b.deadline.value) - Number(b["created-at"].value)).toBe(DURATION);
  });

  it("rejects durations outside 6..4320 blocks", () => {
    const args = (d: number) => [Cl.stringUtf8("t"), Cl.stringUtf8(""), Cl.stringAscii("dev"), Cl.uint(REWARD), Cl.uint(d)];
    expect(call("post-bounty", args(5), poster).result).toBeErr(ERR_BAD_DURATION);
    expect(call("post-bounty", args(4321), poster).result).toBeErr(ERR_BAD_DURATION);
  });

  it("cannot be claimed after the deadline, but can still be cancelled", () => {
    post();
    simnet.mineEmptyBurnBlocks(DURATION);
    expect(call("claim-bounty", [Cl.uint(1)], worker).result).toBeErr(ERR_EXPIRED);
    expect(call("cancel-bounty", [Cl.uint(1)], poster).result).toBeOk(Cl.bool(true));
  });
});
