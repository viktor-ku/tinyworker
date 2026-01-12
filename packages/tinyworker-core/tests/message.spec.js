import { expect, test } from "vitest";
import {
  isPing,
  Ping,
  Com,
  isCom,
  Err,
  isErr,
  payload,
  sameId,
  id,
} from "../src/message.js";

test("ping", () => {
  const message = Ping();
  expect(isPing(message)).toBe(true);
});

test("com", () => {
  const message = Com();
  expect(isCom(message)).toBe(true);
});

test("com:42", () => {
  const message = Com(42);
  expect(payload(message)).toBe(42);
});

test("com:object", () => {
  const obj = { one: { two: { three: 3 } } };
  const message = Com(obj);
  expect(payload(message)).toBe(obj);
});

test("com:array", () => {
  const arr = [1, 2, 3, 4, 5];
  const message = Com(arr);
  expect(payload(message)).toBe(arr);
});

test("error", () => {
  const message = Err("some error");
  expect(isErr(message)).toBe(true);
  expect(payload(message)).toBe("some error");
});

test("should have same id (reference)", () => {
  const a = Com(1);
  const b = Com(2, id(a));
  expect(sameId(a, b)).toBe(true);
});

test("should have same id (hard)", () => {
  const a = Com(1);
  const b = Com(2, id(a).slice());
  expect(sameId(a, b)).toBe(true);
});
