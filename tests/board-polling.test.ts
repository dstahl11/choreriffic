import assert from "node:assert/strict";
import test from "node:test";
import {
  BOARD_MAX_BACKOFF_MS,
  BOARD_POLL_MS,
  boardPollDelay,
} from "@/hooks/use-board-data";

test("successful board polls return to the 30-second interval", () => {
  assert.equal(boardPollDelay(0, 0), BOARD_POLL_MS);
  assert.equal(boardPollDelay(0, 1_000), BOARD_POLL_MS + 1_000);
});

test("failed board polls back off exponentially and cap at five minutes", () => {
  assert.equal(boardPollDelay(1, 0), 60_000);
  assert.equal(boardPollDelay(2, 0), 120_000);
  assert.equal(boardPollDelay(3, 0), 240_000);
  assert.equal(boardPollDelay(4, 0), BOARD_MAX_BACKOFF_MS);
  assert.equal(boardPollDelay(20, 0), BOARD_MAX_BACKOFF_MS);
});

test("board polling jitter is constrained to at most one second", () => {
  assert.equal(boardPollDelay(0, -10), BOARD_POLL_MS);
  assert.equal(boardPollDelay(1, 5_000), 61_000);
});
